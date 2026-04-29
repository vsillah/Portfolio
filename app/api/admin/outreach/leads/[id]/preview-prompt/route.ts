/**
 * GET /api/admin/outreach/leads/:id/preview-prompt
 *
 * Phase 2 transparency endpoint. Returns the fully-assembled system prompt +
 * user prompt + the same context-size trace that gets persisted into
 * `outreach_queue.generation_inputs` on a real generate — but does NOT call
 * the LLM and does NOT insert into outreach_queue. Lets admins review what
 * the generator will send before spending a token.
 *
 * Query params:
 *   - channel:      'email' (default) | 'linkedin'
 *   - templateKey:  optional; must match the channel's allowed key set
 *   - sequenceStep: 1-6 (default 1)
 *
 * Auth: admin (verifyAdmin), same gate as POST /generate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildOutreachPromptContext,
  userPromptFor,
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

export const dynamic = 'force-dynamic'
/** Mirrors POST /generate — RAG fetch + research brief build can take 10-15s. */
export const maxDuration = 30

const EMAIL_KEY_SET = new Set<string>(EMAIL_TEMPLATE_KEYS)
const LINKEDIN_KEY_SET = new Set<string>(LINKEDIN_TEMPLATE_KEYS)
const CHANNEL_SET = new Set<string>(OUTREACH_CHANNELS)

const DEFAULT_EMAIL_TEMPLATE: EmailTemplateKey = 'email_cold_outreach'
const DEFAULT_LINKEDIN_TEMPLATE: LinkedInTemplateKey = 'linkedin_cold_outreach'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const contactId = parseInt(params.id, 10)
  if (Number.isNaN(contactId) || contactId < 1) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  if (!isInAppOutreachGenerationEnabled()) {
    return NextResponse.json(
      { error: 'Outreach generation is temporarily unavailable.' },
      { status: 503 },
    )
  }

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const channelRaw = searchParams.get('channel') ?? 'email'
  const channel: OutreachChannel = CHANNEL_SET.has(channelRaw)
    ? (channelRaw as OutreachChannel)
    : 'email'

  const allowedKeys = channel === 'linkedin' ? LINKEDIN_KEY_SET : EMAIL_KEY_SET
  const defaultKey: EmailTemplateKey | LinkedInTemplateKey =
    channel === 'linkedin' ? DEFAULT_LINKEDIN_TEMPLATE : DEFAULT_EMAIL_TEMPLATE
  const templateKeyRaw = searchParams.get('templateKey')
  let templateKey: EmailTemplateKey | LinkedInTemplateKey = defaultKey
  if (templateKeyRaw) {
    if (!allowedKeys.has(templateKeyRaw)) {
      return NextResponse.json(
        {
          error: `templateKey '${templateKeyRaw}' is not valid for channel '${channel}'.`,
        },
        { status: 400 },
      )
    }
    templateKey = templateKeyRaw as EmailTemplateKey | LinkedInTemplateKey
  }

  const sequenceStepRaw = searchParams.get('sequenceStep')
  const sequenceStepParsed = sequenceStepRaw ? parseInt(sequenceStepRaw, 10) : 1
  const sequenceStep =
    Number.isFinite(sequenceStepParsed) &&
    sequenceStepParsed >= 1 &&
    sequenceStepParsed <= 6
      ? sequenceStepParsed
      : 1

  // Don't surface a preview for DNC / removed leads — same gate as generate.
  const { data: lead, error: leadError } = await sb
    .from('contact_submissions')
    .select('id, do_not_contact, removed_at')
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

  try {
    const ctx = await buildOutreachPromptContext({
      contactId,
      channel,
      templateKey,
      sequenceStep,
    })

    return NextResponse.json({
      channel,
      templateKey,
      sequenceStep,
      promptVersion: ctx.promptRow?.version ?? null,
      promptName: ctx.promptRow?.name ?? null,
      model: ctx.model,
      provider: ctx.provider,
      temperature: ctx.temperature,
      maxTokens: ctx.maxTokens,
      systemPrompt: ctx.systemPrompt,
      userPrompt: userPromptFor(channel),
      contextSizes: {
        researchBriefChars: ctx.contextSizes.researchBrief,
        socialProofChars: ctx.contextSizes.socialProof,
        meetingSnippetChars: ctx.contextSizes.meetingSnippet,
        meetingTextSource: ctx.contextSizes.meetingTextSource,
        meetingActionItemsChars: ctx.contextSizes.meetingActionItems,
        pineconeChars: ctx.contextSizes.pineconeChars,
        priorChatPresent: ctx.contextSizes.priorChatPresent,
        pineconeBlockHash: ctx.contextSizes.pineconeBlockHash,
        valueEvidenceChars: ctx.contextSizes.valueEvidenceChars,
        valueEvidenceRows: ctx.contextSizes.valueEvidenceRows,
        ragQueryChars: ctx.contextSizes.ragQueryChars,
        ragSkippedReason: ctx.contextSizes.ragSkippedReason,
        ragAttempted: ctx.contextSizes.ragAttempted,
        ragErrorClass: ctx.contextSizes.ragErrorClass,
        ragHttpStatus: ctx.contextSizes.ragHttpStatus,
        ragLatencyMs: ctx.contextSizes.ragLatencyMs,
        ragEmptyResponse: ctx.contextSizes.ragEmptyResponse,
      },
    })
  } catch (err) {
    console.error('[preview-prompt] failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Could not assemble the prompt: ${message}` },
      { status: 500 },
    )
  }
}
