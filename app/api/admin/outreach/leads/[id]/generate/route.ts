import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  generateOutreachDraftInApp,
  generateLinkedInDraftInApp,
  isInAppOutreachGenerationEnabled,
} from '@/lib/outreach-queue-generator'
import {
  EMAIL_TEMPLATE_KEYS,
  LINKEDIN_TEMPLATE_KEYS,
  OUTREACH_CHANNELS,
  type EmailTemplateKey,
  type LinkedInTemplateKey,
  type OutreachChannel,
} from '@/lib/constants/prompt-keys'
import { notifyOutreachDraftReady } from '@/lib/slack-outreach-notification'

export const dynamic = 'force-dynamic'
/**
 * Outreach generation can take 30-50s for slower models (Claude Sonnet, GPT-4o
 * with long Saraev prompts + RAG context). Vercel hobby/pro default is 10s,
 * which truncates the response and surfaces as "n8n unavailable" in the UI.
 */
export const maxDuration = 60

const EMAIL_KEY_SET = new Set<string>(EMAIL_TEMPLATE_KEYS)
const LINKEDIN_KEY_SET = new Set<string>(LINKEDIN_TEMPLATE_KEYS)
const CHANNEL_SET = new Set<string>(OUTREACH_CHANNELS)

/**
 * POST /api/admin/outreach/leads/:id/generate
 *
 * Generates an outreach draft in-app (no n8n). The draft is written to
 * `outreach_queue` synchronously and `contact_submissions.last_n8n_outreach_status`
 * is updated so the existing Realtime + Outreach panel UI continues to work
 * unchanged. The column name is historical — the work is now entirely in-app.
 *
 * Body (all fields optional, defaults preserve pre-Phase-2 callers):
 *   - channel: 'email' (default) | 'linkedin'
 *   - templateKey: pin a Saraev/LinkedIn template; must match the channel
 *   - sequenceStep: 1-6 (default 1)
 *   - force: bypass the duplicate-draft guard
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
  if (Number.isNaN(contactId) || contactId < 1) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    channel?: string
    templateKey?: string
    sequenceStep?: number
    force?: boolean
  }

  const channel: OutreachChannel =
    typeof body.channel === 'string' && CHANNEL_SET.has(body.channel)
      ? (body.channel as OutreachChannel)
      : 'email'

  const allowedKeys = channel === 'linkedin' ? LINKEDIN_KEY_SET : EMAIL_KEY_SET
  let templateKey: EmailTemplateKey | LinkedInTemplateKey | undefined
  if (typeof body.templateKey === 'string') {
    if (!allowedKeys.has(body.templateKey)) {
      return NextResponse.json(
        {
          error: `templateKey '${body.templateKey}' is not valid for channel '${channel}'.`,
        },
        { status: 400 },
      )
    }
    templateKey = body.templateKey as EmailTemplateKey | LinkedInTemplateKey
  }

  const sequenceStep =
    typeof body.sequenceStep === 'number' &&
    body.sequenceStep >= 1 &&
    body.sequenceStep <= 6
      ? body.sequenceStep
      : 1
  const force = body.force === true

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  if (!isInAppOutreachGenerationEnabled()) {
    return NextResponse.json(
      { error: 'Outreach generation is temporarily unavailable.' },
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
  // Mark pending so the Outreach panel + Realtime show "running" copy while we
  // synchronously generate. The success/failed flip happens at the end of the
  // try/catch — the row is single-writer per request.
  await sb
    .from('contact_submissions')
    .update({
      last_n8n_outreach_triggered_at: triggeredAtIso,
      last_n8n_outreach_status: 'pending',
      last_n8n_outreach_template_key: templateKey ?? null,
    })
    .eq('id', contactId)

  try {
    const result =
      channel === 'linkedin'
        ? await generateLinkedInDraftInApp({
            contactId,
            sequenceStep,
            force,
            templateKey: templateKey as LinkedInTemplateKey | undefined,
          })
        : await generateOutreachDraftInApp({
            contactId,
            sequenceStep,
            force,
            templateKey: templateKey as EmailTemplateKey | undefined,
          })

    await sb
      .from('contact_submissions')
      .update({
        last_n8n_outreach_status: 'success',
      })
      .eq('id', contactId)

    if (result.outcome === 'created') {
      // Fire-and-forget Slack ping so reps see new drafts even when the panel
      // is closed. Failure here must not break the API response.
      notifyOutreachDraftReady({
        contactId,
        contactName: lead.name,
        contactEmail: lead.email,
        channel,
        templateKey: templateKey ?? null,
        queueId: result.id,
      }).catch((err) => {
        console.warn('[generate] notifyOutreachDraftReady failed', err)
      })
    }

    return NextResponse.json({
      // `triggered` preserves the existing client contract (`useOutreachGeneration`
      // expects it). With the in-app path the work is already complete, but the
      // hook still flips to "success" via Realtime / messages_count bump.
      triggered: true,
      queueCountImmediate: result.outcome === 'created' ? 1 : 0,
      outcome: result.outcome,
      channel,
      ...(templateKey ? { templateKey } : {}),
      ...(result.outcome === 'created'
        ? { id: result.id, subject: result.subject }
        : { reason: result.reason }),
    })
  } catch (err) {
    console.error('[generate] in-app generation failed:', err)
    await sb
      .from('contact_submissions')
      .update({
        last_n8n_outreach_status: 'failed',
      })
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
          triggered: false,
          fallback: 'in-app',
          error: 'Outreach generation is temporarily unavailable.',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        triggered: false,
        fallback: 'in-app',
        error: 'Could not generate the draft. Please try again.',
      },
      { status: 500 },
    )
  }
}
