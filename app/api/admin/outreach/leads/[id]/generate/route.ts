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

    const { count: queueCountImmediate } = await sb
      .from('outreach_queue')
      .select('id', { count: 'exact', head: true })
      .eq('contact_submission_id', contactId)

    const q = queueCountImmediate ?? 0
    if (result.triggered) {
      if (q > 0) {
        await sb
          .from('contact_submissions')
          .update({
            last_n8n_outreach_triggered_at: nowIso,
            last_n8n_outreach_status: 'success',
            last_n8n_outreach_template_key: templateKeyStr,
          })
          .eq('id', contactId)
      } else {
        await sb
          .from('contact_submissions')
          .update({
            last_n8n_outreach_triggered_at: nowIso,
            last_n8n_outreach_status: 'pending',
            last_n8n_outreach_template_key: templateKeyStr,
          })
          .eq('id', contactId)
      }
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
      /** Rows in outreach_queue for this lead right after the n8n webhook returns (0 = async insert or failure). */
      queueCountImmediate: q,
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
