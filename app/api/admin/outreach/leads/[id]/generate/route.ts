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
import {
  endAgentRun,
  markAgentRunFailed,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'

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
 *   - meeting_record_id: optional `meeting_records.id` (UUID) for context + dedup
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
    /** If true, insert another row even when a draft already exists for this step. */
    force?: boolean
    /** Optional: scope the draft to this meeting (must belong to the lead). */
    meeting_record_id?: string
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
    .select(
      'id, name, email, do_not_contact, removed_at, last_n8n_outreach_status, last_n8n_outreach_triggered_at, last_n8n_outreach_template_key',
    )
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

  const n8nSnapshot = {
    last_n8n_outreach_status: lead.last_n8n_outreach_status as string | null,
    last_n8n_outreach_triggered_at: lead.last_n8n_outreach_triggered_at as string | null,
    last_n8n_outreach_template_key: lead.last_n8n_outreach_template_key as string | null,
  }

  const meetingRecordId =
    typeof body.meeting_record_id === 'string' && body.meeting_record_id.trim() !== ''
      ? body.meeting_record_id.trim()
      : null

  const triggeredAtIso = new Date().toISOString()
  const agentRun = await startAgentRun({
    agentKey: 'manual-admin',
    runtime: 'manual',
    kind: 'outreach_generation',
    title: `Generate ${channel} outreach draft`,
    subject: {
      type: 'contact_submission',
      id: contactId,
      label: lead.name || lead.email || `Lead ${contactId}`,
    },
    triggerSource: 'admin:outreach_generate',
    triggeredByUserId: auth.user.id,
    currentStep: 'Lead validated',
    metadata: {
      channel,
      template_key: templateKey ?? null,
      sequence_step: sequenceStep,
      force,
      meeting_record_id: meetingRecordId,
    },
  })
  const agentRunId = agentRun.id

  await recordAgentStep({
    runId: agentRunId,
    stepKey: 'lead_validated',
    name: 'Lead validated',
    status: 'completed',
    outputSummary: `Lead ${contactId} is eligible for outreach generation.`,
    metadata: { contact_id: contactId, channel },
    idempotencyKey: `${agentRunId}:lead_validated`,
  }).catch((err) => console.warn('[generate] agent step failed', err))

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
            meetingRecordId,
            templateKey: templateKey as LinkedInTemplateKey | undefined,
            agentRunId,
          })
        : await generateOutreachDraftInApp({
            contactId,
            sequenceStep,
            force,
            meetingRecordId,
            templateKey: templateKey as EmailTemplateKey | undefined,
            agentRunId,
          })

    if (result.outcome === 'existing') {
      await sb
        .from('contact_submissions')
        .update({
          last_n8n_outreach_status: n8nSnapshot.last_n8n_outreach_status,
          last_n8n_outreach_triggered_at: n8nSnapshot.last_n8n_outreach_triggered_at,
          last_n8n_outreach_template_key: n8nSnapshot.last_n8n_outreach_template_key,
        })
        .eq('id', contactId)

      const { data: emRow } = await sb
        .from('email_messages')
        .select('id')
        .eq('source_system', 'outreach_queue')
        .eq('source_id', result.queueId)
        .maybeSingle()

      await endAgentRun({
        runId: agentRunId,
        status: 'completed',
        currentStep: 'Existing draft returned',
        outcome: {
          outcome: 'existing',
          queue_id: result.queueId,
          channel: result.channel,
          template_key: result.templateKey,
        },
      }).catch((err) => console.warn('[generate] end agent run failed', err))

      const emailMessageId = (emRow?.id as string) ?? null
      const openDraftUrl = emailMessageId
        ? `/admin/email-messages/${emailMessageId}`
        : `/admin/email-center?contact=${contactId}`

      return NextResponse.json({
        triggered: false,
        outcome: 'existing',
        queueId: result.queueId,
        templateKey: result.templateKey,
        channel: result.channel,
        agentRunId,
        emailMessageId,
        openDraftUrl,
      })
    }

    if (result.outcome === 'skipped') {
      await sb
        .from('contact_submissions')
        .update({
          last_n8n_outreach_status: n8nSnapshot.last_n8n_outreach_status,
          last_n8n_outreach_triggered_at: n8nSnapshot.last_n8n_outreach_triggered_at,
          last_n8n_outreach_template_key: n8nSnapshot.last_n8n_outreach_template_key,
        })
        .eq('id', contactId)
      await endAgentRun({
        runId: agentRunId,
        status: 'cancelled',
        currentStep: 'Skipped existing task draft',
        outcome: { outcome: 'skipped', reason: 'draft_exists' },
      }).catch((err) => console.warn('[generate] end agent run failed', err))
      return NextResponse.json(
        {
          error:
            'A draft is already linked to this task. Open it from the meeting task or Email center.',
          outcome: 'skipped',
          reason: 'draft_exists',
          triggered: false,
          agentRunId,
        },
        { status: 409 },
      )
    }

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
      await recordAgentEvent({
        runId: agentRunId,
        eventType: 'notification_dispatched',
        severity: 'info',
        message: 'Slack draft-ready notification queued.',
        metadata: { queue_id: result.id, channel },
        idempotencyKey: `${agentRunId}:notification_dispatched`,
      }).catch((err) => console.warn('[generate] agent event failed', err))
    }

    // Only `created` reaches here (`existing` and `skipped` return above).
    if (result.outcome !== 'created') {
      return NextResponse.json({ error: 'Unexpected generation outcome' }, { status: 500 })
    }

    await endAgentRun({
      runId: agentRunId,
      status: 'completed',
      currentStep: 'Outreach draft ready',
      outcome: {
        outcome: result.outcome,
        queue_id: result.id,
        channel,
        template_key: templateKey ?? null,
      },
    }).catch((err) => console.warn('[generate] end agent run failed', err))

    return NextResponse.json({
      // `triggered` preserves the existing client contract (`useOutreachGeneration`
      // expects it). With the in-app path the work is already complete, but the
      // hook still flips to "success" via Realtime / messages_count bump.
      triggered: true,
      queueCountImmediate: 1,
      outcome: result.outcome,
      channel,
      agentRunId,
      ...(templateKey ? { templateKey } : {}),
      id: result.id,
      subject: result.subject,
    })
  } catch (err) {
    console.error('[generate] in-app generation failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    await recordAgentStep({
      runId: agentRunId,
      stepKey: 'generation_failed',
      name: 'Generation failed',
      status: 'failed',
      outputSummary: message,
      metadata: { channel, template_key: templateKey ?? null },
      idempotencyKey: `${agentRunId}:generation_failed`,
    }).catch((stepErr) => console.warn('[generate] agent failure step failed', stepErr))
    await markAgentRunFailed(agentRunId, message, {
      channel,
      template_key: templateKey ?? null,
      contact_id: contactId,
    }).catch((runErr) => console.warn('[generate] mark agent run failed', runErr))
    await sb
      .from('contact_submissions')
      .update({
        last_n8n_outreach_status: 'failed',
      })
      .eq('id', contactId)

    if (message === 'Meeting not found for this lead') {
      return NextResponse.json(
        { error: 'The selected meeting was not found for this lead.' },
        { status: 400 }
      )
    }
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
