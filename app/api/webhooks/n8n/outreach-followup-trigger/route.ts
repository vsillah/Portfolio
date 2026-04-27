import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  generateOutreachDraftInApp,
  isInAppOutreachGenerationEnabled,
} from '@/lib/outreach-queue-generator'
import {
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
} from '@/lib/constants/prompt-keys'
import { notifyOutreachDraftReady } from '@/lib/slack-outreach-notification'

export const dynamic = 'force-dynamic'
/**
 * Outreach generation can take 30-50s for slower models (Claude Sonnet, GPT-4o
 * with long Saraev prompts + RAG context). Vercel default is 10s; bump headroom
 * so n8n's HTTP request doesn't time out on the cold-start path.
 */
export const maxDuration = 60

const EMAIL_KEY_SET = new Set<string>(EMAIL_TEMPLATE_KEYS)

/**
 * POST /api/webhooks/n8n/outreach-followup-trigger
 *
 * Drop-in replacement for the deprecated `WF-CLG-002` (`clg-outreach-gen`)
 * webhook that `WF-CLG-003: Send and Follow-Up` used to call after the 4-day
 * no-reply branch. WF-CLG-002 was retired in Phase 4 of the in-app outreach
 * generator unification — this route exposes the in-app generator
 * (`generateOutreachDraftInApp`) to n8n so the auto-follow-up sequence keeps
 * producing step n+1 drafts using the active Saraev system_prompts row,
 * Pinecone RAG voice, and prior-correspondence context (Phase 3).
 *
 * Auth: `Authorization: Bearer ${N8N_INGEST_SECRET}` — same pattern as the
 * other n8n→app webhooks (`milestone-notify`, `vep-task-complete`).
 *
 * Body:
 *   {
 *     contact_submission_id: number | string,   // required
 *     sequence_step?: number,                   // 1-6, default 1
 *     template_key?: string,                    // must be in EMAIL_TEMPLATE_KEYS
 *     force?: boolean,                          // bypass duplicate-draft guard
 *   }
 *
 * Response (200):
 *   { ok: true, contact_submission_id, outcome: 'created'|'skipped',
 *     queue_id?, subject?, reason? }
 *
 * Errors:
 *   401 — bad/missing bearer
 *   400 — invalid body, DNC, removed lead, bad template_key
 *   404 — lead not found
 *   503 — in-app generation disabled (ENABLE_IN_APP_OUTREACH_GEN=false) or
 *         provider key missing (OPENAI/ANTHROPIC)
 *   500 — unexpected
 *
 * LinkedIn is not in scope for the auto-follow-up flow today; reps trigger
 * LinkedIn drafts manually from the admin UI. Adding `channel: 'linkedin'`
 * support here is a deliberate follow-up.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET
  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    contact_submission_id?: number | string
    sequence_step?: number
    template_key?: string
    force?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawId = body.contact_submission_id
  const contactId =
    typeof rawId === 'number' ? rawId : parseInt(String(rawId ?? ''), 10)
  if (!Number.isFinite(contactId) || contactId <= 0) {
    return NextResponse.json(
      { error: 'contact_submission_id is required (positive integer)' },
      { status: 400 },
    )
  }

  const sequenceStep =
    typeof body.sequence_step === 'number' &&
    body.sequence_step >= 1 &&
    body.sequence_step <= 6
      ? body.sequence_step
      : 1

  let templateKey: EmailTemplateKey | undefined
  if (typeof body.template_key === 'string' && body.template_key.length > 0) {
    if (!EMAIL_KEY_SET.has(body.template_key)) {
      return NextResponse.json(
        {
          error: `template_key '${body.template_key}' is not a valid email template`,
        },
        { status: 400 },
      )
    }
    templateKey = body.template_key as EmailTemplateKey
  }

  const force = body.force === true

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  if (!isInAppOutreachGenerationEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'In-app outreach generation is disabled (ENABLE_IN_APP_OUTREACH_GEN=false)',
      },
      { status: 503 },
    )
  }

  const { data: lead, error: leadError } = await sb
    .from('contact_submissions')
    .select('id, name, email, do_not_contact, removed_at')
    .eq('id', contactId)
    .single()

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
  if (lead.do_not_contact) {
    return NextResponse.json(
      { error: 'Lead is marked as do-not-contact' },
      { status: 400 },
    )
  }
  if (lead.removed_at) {
    return NextResponse.json({ error: 'Lead has been removed' }, { status: 400 })
  }

  const triggeredAtIso = new Date().toISOString()
  // Mark pending so the admin UI Realtime layer + Outreach panel show "running"
  // copy while we generate synchronously. Mirrors POST /generate.
  await sb
    .from('contact_submissions')
    .update({
      last_n8n_outreach_triggered_at: triggeredAtIso,
      last_n8n_outreach_status: 'pending',
      last_n8n_outreach_template_key: templateKey ?? null,
    })
    .eq('id', contactId)

  try {
    const result = await generateOutreachDraftInApp({
      contactId,
      sequenceStep,
      force,
      templateKey,
    })

    await sb
      .from('contact_submissions')
      .update({ last_n8n_outreach_status: 'success' })
      .eq('id', contactId)

    if (result.outcome === 'created') {
      notifyOutreachDraftReady({
        contactId,
        contactName: lead.name,
        contactEmail: lead.email,
        channel: 'email',
        templateKey: templateKey ?? null,
        queueId: result.id,
      }).catch((err) => {
        console.warn(
          '[outreach-followup-trigger] notifyOutreachDraftReady failed',
          err,
        )
      })
    }

    return NextResponse.json({
      ok: true,
      contact_submission_id: contactId,
      outcome: result.outcome,
      sequence_step: sequenceStep,
      ...(templateKey ? { template_key: templateKey } : {}),
      ...(result.outcome === 'created'
        ? { queue_id: result.id, subject: result.subject }
        : result.outcome === 'existing'
          ? { queue_id: result.queueId, already_exists: true as const, template_key: result.templateKey }
          : { reason: result.reason }),
    })
  } catch (err) {
    console.error('[outreach-followup-trigger] generation failed:', err)
    await sb
      .from('contact_submissions')
      .update({ last_n8n_outreach_status: 'failed' })
      .eq('id', contactId)

    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Lead is marked as do-not-contact') {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message === 'Lead has been removed') {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (
      message === 'OPENAI_API_KEY not configured' ||
      message === 'ANTHROPIC_API_KEY not configured'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Outreach generation is temporarily unavailable.',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Could not generate the draft. Please try again.',
      },
      { status: 500 },
    )
  }
}
