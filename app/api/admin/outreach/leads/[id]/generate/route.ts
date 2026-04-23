import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerOutreachGeneration } from '@/lib/n8n'
import {
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
} from '@/lib/constants/prompt-keys'

export const dynamic = 'force-dynamic'

const EMAIL_TEMPLATE_KEY_SET = new Set<string>(EMAIL_TEMPLATE_KEYS)

/**
 * POST /api/admin/outreach/leads/:id/generate
 *
 * Manually trigger outreach email generation (WF-CLG-002) for an existing lead.
 * Loads the lead and any linked meeting_records to build context for the email.
 *
 * Body (all fields optional; empty body preserves pre-Phase-2 behavior):
 *   - templateKey: one of EMAIL_TEMPLATE_KEYS to pin the Saraev template used.
 *   - customNote, includeDashboardLink: reserved for Phase 3+ (ignored today).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const contactId = parseInt(params.id, 10)
  if (isNaN(contactId)) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  // Tolerate empty / non-JSON bodies (the original callers send none).
  const body = (await request.json().catch(() => ({}))) as {
    templateKey?: string
  }
  let templateKey: EmailTemplateKey | undefined
  if (typeof body?.templateKey === 'string' && EMAIL_TEMPLATE_KEY_SET.has(body.templateKey)) {
    templateKey = body.templateKey as EmailTemplateKey
  }

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { data: lead, error: leadError } = await sb
    .from('contact_submissions')
    .select('id, name, email, company, rep_pain_points, quick_wins, do_not_contact, removed_at, lead_source')
    .eq('id', contactId)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  if (lead.do_not_contact) {
    return NextResponse.json(
      { error: 'Lead is marked as do-not-contact' },
      { status: 400 }
    )
  }

  if (lead.removed_at) {
    return NextResponse.json(
      { error: 'Lead has been removed' },
      { status: 400 }
    )
  }

  const { data: meetings } = await sb
    .from('meeting_records')
    .select('transcript, raw_notes, structured_notes')
    .eq('contact_submission_id', contactId)
    .order('meeting_date', { ascending: false })
    .limit(1)

  let meetingSummary: string | undefined
  if (meetings && meetings.length > 0) {
    const meeting = meetings[0]
    const notes = meeting.structured_notes as Record<string, unknown> | null
    meetingSummary = (notes?.summary as string)
      || meeting.raw_notes
      || (meeting.transcript ? meeting.transcript.substring(0, 1000) : undefined)
  }

  const painPoints = lead.rep_pain_points || lead.quick_wins || undefined
  const templateKeyStr: string | null = templateKey ?? null
  const nowIso = new Date().toISOString()

  try {
    const result = await triggerOutreachGeneration({
      contact_id: contactId,
      score_tier: 'hot',
      lead_score: 80,
      sequence_step: 1,
      is_followup: false,
      meeting_summary: meetingSummary,
      pain_points: painPoints,
      ...(templateKey ? { template_key: templateKey } : {}),
    })

    // Authoritative completion is delivered by
    //   - INSERT trigger `trg_outreach_queue_mark_n8n_success` (DB-level, fires
    //     when n8n/in-app actually writes the draft row), and
    //   - `/api/webhooks/n8n/outreach-generation-complete` (n8n's final node),
    // both of which flip `last_n8n_outreach_status` from `pending` → `success`
    // / `failed`. Those transitions are streamed to open admin tabs via
    // Supabase Realtime (see `useRealtimeOutreach`). We must not shortcut to
    // `success` here — `triggerOutreachGeneration` is a fire-and-forget
    // webhook ack, and any historical "count > 0" check spuriously marks
    // success for any lead that already had queue rows from prior runs.
    if (result.triggered) {
      await sb
        .from('contact_submissions')
        .update({
          last_n8n_outreach_triggered_at: nowIso,
          last_n8n_outreach_status: 'pending',
          last_n8n_outreach_template_key: templateKeyStr,
        })
        .eq('id', contactId)
    } else {
      await sb
        .from('contact_submissions')
        .update({
          last_n8n_outreach_triggered_at: nowIso,
          last_n8n_outreach_status: 'failed',
          last_n8n_outreach_template_key: templateKeyStr,
        })
        .eq('id', contactId)
    }

    return NextResponse.json({
      triggered: result.triggered,
      /**
       * Preserved for back-compat with older clients; always 0 now. n8n's
       * webhook is fire-and-forget and the response does not guarantee a
       * draft row exists yet. Use `last_n8n_outreach_status` (pushed via
       * Realtime) to determine completion.
       * @deprecated
       */
      queueCountImmediate: 0,
      ...(templateKey ? { templateKey } : {}),
      ...(!result.triggered && { fallback: 'in-app' }),
    })
  } catch (err) {
    console.error('[generate] Outreach generation trigger failed:', err)
    await sb
      .from('contact_submissions')
      .update({
        last_n8n_outreach_triggered_at: nowIso,
        last_n8n_outreach_status: 'failed',
        last_n8n_outreach_template_key: templateKeyStr,
      })
      .eq('id', contactId)
    return NextResponse.json(
      { triggered: false, fallback: 'in-app' }
    )
  }
}
