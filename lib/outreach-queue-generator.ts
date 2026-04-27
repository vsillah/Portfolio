/**
 * In-app outreach draft generation: assembles a system prompt from
 * `system_prompts`, enriches with research / RAG / chat / meeting context,
 * dispatches to the right LLM provider per `config.model`, and inserts the
 * resulting draft into `outreach_queue`.
 *
 * Two entry points:
 *  - `generateOutreachDraftInApp`     — channel='email'  (Saraev 6-step JSON)
 *  - `generateLinkedInDraftInApp`     — channel='linkedin' (connection_note + follow_up_dm)
 *
 * Both share `buildOutreachPromptContext` for prompt assembly so they stay in
 * lockstep on research brief, Pinecone RAG, prior site chat, meeting tasks,
 * and the `{{...}}` sentinels.
 *
 * Parity vs WF-CLG-002 (n8n, deprecated): same template keys, same tiered
 * research brief, same RAG path. The n8n agent nodes were ignoring all of
 * that — this module is the single source of truth.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getSystemPrompt, type SystemPrompt } from '@/lib/system-prompts'
import { loadLeadResearchBrief, type ContactEnrichment } from '@/lib/lead-research-context'
import {
  loadOpenOutreachTasksForContact,
  formatMeetingActionItemsBlock,
  applyMeetingActionItemsPlaceholders,
} from '@/lib/meeting-tasks-context'
import {
  appendPineconeAndChatContextWithMetadata,
  applyPriorOutreachHistorySentinel,
  type PineconeChatContextMetadata,
} from '@/lib/email-llm-context'
import {
  loadLeadCorrespondenceExcerpt,
  type PriorOutreachMetadata,
} from '@/lib/lead-correspondence-context'
import { generateJsonCompletion } from '@/lib/llm-dispatch'
import {
  DEFAULT_OUTREACH_MODEL,
  inferProvider,
  type LlmProvider,
} from '@/lib/constants/llm-models'
import {
  EMAIL_TEMPLATE_KEYS,
  LINKEDIN_TEMPLATE_KEYS,
  type EmailTemplateKey,
  type LinkedInTemplateKey,
  type OutreachChannel,
} from '@/lib/constants/prompt-keys'

const DEFAULT_EMAIL_TEMPLATE_KEY: EmailTemplateKey = 'email_cold_outreach'
const DEFAULT_LINKEDIN_TEMPLATE_KEY: LinkedInTemplateKey = 'linkedin_cold_outreach'

/**
 * The literal "user message" string we send to the LLM for each channel.
 * Exported so the Preview Prompt admin route can show admins exactly what the
 * generator will send — these strings are part of the prompt contract.
 */
export const EMAIL_USER_PROMPT =
  'Draft the cold outreach email now. Respond only with JSON: { "subject": "...", "body": "..." }'
export const LINKEDIN_USER_PROMPT =
  'Draft the LinkedIn invite + follow-up DM now. Respond only with JSON: { "connection_note": "...", "follow_up_dm": "..." }'

export function userPromptFor(channel: OutreachChannel): string {
  return channel === 'linkedin' ? LINKEDIN_USER_PROMPT : EMAIL_USER_PROMPT
}

/** Max chars for user-supplied meeting summary (prompt injection / cost guard). */
export const MEETING_SUMMARY_MAX_CHARS = 8000

/** Max LinkedIn invite (connection note) length, mirroring the platform cap. */
export const LINKEDIN_CONNECTION_NOTE_MAX_CHARS = 300

export function capMeetingSummary(text: string): string {
  const t = text.trim()
  if (t.length <= MEETING_SUMMARY_MAX_CHARS) return t
  return t.slice(0, MEETING_SUMMARY_MAX_CHARS) + '\n…[truncated]'
}

export function isInAppOutreachGenerationEnabled(): boolean {
  return process.env.ENABLE_IN_APP_OUTREACH_GEN !== 'false'
}

export type InAppOutreachGenerateResult =
  | { outcome: 'created'; id: string; subject: string | null; body: string }
  | { outcome: 'skipped'; reason: 'draft_exists' }

// ============================================================================
// Shared prompt-context builder
// ============================================================================

interface PromptContextRequest {
  contactId: number
  channel: OutreachChannel
  templateKey: string
  /** Falsy / absent → not appended; otherwise capped before injection. */
  meetingSummary?: string | null
  /** When false, skip auto-loading the latest meeting record. Default true. */
  includeLatestMeeting?: boolean
  /** Step 1 surfaces meeting action items; later steps blank them. */
  sequenceStep: number
}

interface PromptContext {
  contact: ContactEnrichment
  systemPrompt: string
  promptRow: SystemPrompt | null
  model: string
  provider: LlmProvider
  temperature: number
  maxTokens: number
  /**
   * Char counts + RAG fingerprint for downstream traceability (Phase 2).
   * Persisted into `outreach_queue.generation_inputs` on every successful
   * draft insert and surfaced in the "Why this draft?" admin panel.
   */
  contextSizes: {
    researchBrief: number
    socialProof: number
    meetingSnippet: number
    meetingActionItems: number
    pineconeChars: number
    priorChatPresent: boolean
    pineconeBlockHash: string | null
    /** Phase 3 — prior outreach history block size + entry count + inbound flag. */
    priorOutreachChars: number
    priorOutreachEntries: number
    priorOutreachHasInbound: boolean
  }
}

/**
 * Shape persisted to `outreach_queue.generation_inputs` (jsonb). Keep keys in
 * sync with `migrations/2026_04_27_outreach_queue_generation_inputs.sql` and
 * the WhyThisDraftModal renderer — the migration is intentionally schema-less,
 * so this type is the single source of truth that humans look at.
 */
export interface GenerationInputs {
  template_key: string
  prompt_version: number | null
  channel: OutreachChannel
  model: string
  provider: LlmProvider
  temperature: number
  max_tokens: number
  sequence_step: number
  research_brief_chars: number
  social_proof_chars: number
  meeting_summary_present: boolean
  meeting_action_items_chars: number
  pinecone_chars: number
  prior_chat_present: boolean
  pinecone_block_hash: string | null
  /** Phase 3 — prior outreach history (sent/replied/inbound) injected into prompt. */
  prior_outreach_chars: number
  prior_outreach_entries: number
  prior_outreach_has_inbound: boolean
}

function buildGenerationInputs(args: {
  ctx: PromptContext
  templateKey: string
  channel: OutreachChannel
  sequenceStep: number
}): GenerationInputs {
  const { ctx, templateKey, channel, sequenceStep } = args
  return {
    template_key: templateKey,
    prompt_version: ctx.promptRow?.version ?? null,
    channel,
    model: ctx.model,
    provider: ctx.provider,
    temperature: ctx.temperature,
    max_tokens: ctx.maxTokens,
    sequence_step: sequenceStep,
    research_brief_chars: ctx.contextSizes.researchBrief,
    social_proof_chars: ctx.contextSizes.socialProof,
    meeting_summary_present: ctx.contextSizes.meetingSnippet > 0,
    meeting_action_items_chars: ctx.contextSizes.meetingActionItems,
    pinecone_chars: ctx.contextSizes.pineconeChars,
    prior_chat_present: ctx.contextSizes.priorChatPresent,
    pinecone_block_hash: ctx.contextSizes.pineconeBlockHash,
    prior_outreach_chars: ctx.contextSizes.priorOutreachChars,
    prior_outreach_entries: ctx.contextSizes.priorOutreachEntries,
    prior_outreach_has_inbound: ctx.contextSizes.priorOutreachHasInbound,
  }
}

async function fetchLatestMeetingSnippet(contactId: number): Promise<string | null> {
  if (!supabaseAdmin) return null
  const { data: meetings } = await supabaseAdmin
    .from('meeting_records')
    .select('transcript, raw_notes, structured_notes')
    .eq('contact_submission_id', contactId)
    .order('meeting_date', { ascending: false })
    .limit(1)

  if (!meetings?.length) return null
  const meeting = meetings[0]
  const notes = meeting.structured_notes as Record<string, unknown> | null
  const raw =
    (notes?.summary as string) ||
    meeting.raw_notes ||
    (meeting.transcript ? meeting.transcript.substring(0, 1000) : null)
  if (!raw?.trim()) return null
  return capMeetingSummary(raw)
}

/**
 * Build the fully-substituted system prompt + LLM config for an outreach
 * generation. Pure-ish wrt the database: reads `system_prompts`, lead
 * research, meetings, and the RAG/chat sentinels — but does not write
 * anywhere. Callers (email / LinkedIn) decide how to interpret the LLM JSON
 * response and what row to insert into `outreach_queue`.
 */
export async function buildOutreachPromptContext(
  req: PromptContextRequest,
): Promise<PromptContext> {
  const { contact, researchBrief: baseBrief, socialProof } =
    await loadLeadResearchBrief(req.contactId)

  let meetingSnippet: string | null = null
  if (req.meetingSummary != null && req.meetingSummary.trim() !== '') {
    meetingSnippet = capMeetingSummary(req.meetingSummary)
  } else if (req.includeLatestMeeting !== false) {
    meetingSnippet = await fetchLatestMeetingSnippet(req.contactId)
  }

  const researchBrief =
    meetingSnippet && meetingSnippet.length > 0
      ? `${baseBrief}\n\n## Recent meeting context\n${meetingSnippet}`
      : baseBrief

  const promptRow = await getSystemPrompt(req.templateKey)
  const senderName = process.env.EMAIL_FROM_NAME || 'Vambah Sillah'

  let systemPrompt =
    promptRow?.prompt ||
    fallbackPromptFor(req.channel)

  // Meeting action items gating:
  //   - Only surface for step 1; later steps already have their own talking points.
  //   - applyMeetingActionItemsPlaceholders runs unconditionally so that if the
  //     prompt carries {{meeting_action_items}} sentinels but we have no tasks,
  //     the block is blanked out (no raw placeholder leaks into the draft).
  const meetingActionItems =
    req.sequenceStep === 1
      ? await loadOpenOutreachTasksForContact(req.contactId)
      : []
  const meetingActionItemsBlock = formatMeetingActionItemsBlock(meetingActionItems)
  systemPrompt = applyMeetingActionItemsPlaceholders(systemPrompt, meetingActionItemsBlock)

  systemPrompt = systemPrompt
    .replace(/\{\{research_brief\}\}/g, researchBrief)
    .replace(/\{\{social_proof\}\}/g, socialProof)
    .replace(/\{\{sender_name\}\}/g, senderName)

  const priorOutreach = await loadLeadCorrespondenceExcerpt(req.contactId, req.channel)
  systemPrompt = applyPriorOutreachHistorySentinel(systemPrompt, priorOutreach.block)
  const priorMeta: PriorOutreachMetadata = priorOutreach.metadata

  const ragResult = await appendPineconeAndChatContextWithMetadata(systemPrompt, {
    contact,
    researchTextForRag: researchBrief,
  })
  systemPrompt = ragResult.prompt
  const ragMeta: PineconeChatContextMetadata = ragResult.metadata

  const config = (promptRow?.config ?? {}) as {
    model?: string
    temperature?: number
    maxTokens?: number
  }
  const model = config.model || DEFAULT_OUTREACH_MODEL
  const temperature = config.temperature ?? 0.75
  const maxTokens = config.maxTokens ?? (req.channel === 'linkedin' ? 600 : 600)
  const provider = inferProvider(model)

  return {
    contact,
    systemPrompt,
    promptRow,
    model,
    provider,
    temperature,
    maxTokens,
    contextSizes: {
      researchBrief: researchBrief.length,
      socialProof: socialProof.length,
      meetingSnippet: meetingSnippet?.length ?? 0,
      meetingActionItems: meetingActionItemsBlock?.length ?? 0,
      pineconeChars: ragMeta.pineconeChars,
      priorChatPresent: ragMeta.priorChatPresent,
      pineconeBlockHash: ragMeta.pineconeBlockHash,
      priorOutreachChars: priorMeta.chars,
      priorOutreachEntries: priorMeta.entriesIncluded,
      priorOutreachHasInbound: priorMeta.hasInbound,
    },
  }
}

function fallbackPromptFor(channel: OutreachChannel): string {
  if (channel === 'linkedin') {
    return [
      'You are a BDR at AmaduTown. Use the research brief and social proof.',
      'Respond with JSON: { "connection_note": "...", "follow_up_dm": "..." }',
      'connection_note must be <= 280 characters.',
    ].join('\n')
  }
  return [
    'You are a BDR at AmaduTown. Use the research brief and social proof.',
    'Respond with JSON: { "subject": "...", "body": "..." }',
  ].join('\n')
}

// ============================================================================
// Lead-validation helpers
// ============================================================================

interface LeadGuardResult {
  isTestData: boolean
}

async function loadAndGuardLead(contactId: number): Promise<LeadGuardResult> {
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('contact_submissions')
    .select('id, do_not_contact, removed_at, is_test_data')
    .eq('id', contactId)
    .single()

  if (leadError || !lead) {
    throw new Error('Lead not found')
  }
  if (lead.do_not_contact) {
    throw new Error('Lead is marked as do-not-contact')
  }
  if (lead.removed_at) {
    throw new Error('Lead has been removed')
  }

  return { isTestData: lead.is_test_data === true }
}

interface DuplicateGuardArgs {
  contactId: number
  channel: OutreachChannel
  sequenceStep: number
  sourceTaskId: string | null
  force: boolean
}

async function findExistingDraft(args: DuplicateGuardArgs): Promise<string | null> {
  if (!supabaseAdmin || args.force) return null

  let existingQuery = supabaseAdmin
    .from('outreach_queue')
    .select('id')
    .eq('contact_submission_id', args.contactId)
    .eq('channel', args.channel)
    .eq('sequence_step', args.sequenceStep)
    .eq('status', 'draft')

  if (args.sourceTaskId === null) {
    existingQuery = existingQuery.is('source_task_id', null)
  } else {
    existingQuery = existingQuery.eq('source_task_id', args.sourceTaskId)
  }

  const { data: existing } = await existingQuery.limit(1).maybeSingle()
  return (existing?.id as string | undefined) ?? null
}

// ============================================================================
// Email generator (replaces the original generateOutreachDraftInApp body)
// ============================================================================

/**
 * Generate a cold-outreach email draft via the configured LLM and insert into
 * outreach_queue (status draft).
 *
 * `sourceTaskId` — when provided, the generated draft is linked back to a
 * meeting_action_task via outreach_queue.source_task_id. The draft-exists
 * guard also scopes to this field so a task-driven draft never collides with
 * a sequence-driven draft for the same contact/step (see 2026_04_17 migration,
 * CTO M3).
 *
 * `templateKey` — pin a specific Saraev template (one of EMAIL_TEMPLATE_KEYS).
 * Defaults to `email_cold_outreach` for back-compat with pre-Phase-2 callers.
 */
export async function generateOutreachDraftInApp(params: {
  contactId: number
  sequenceStep?: number
  force?: boolean
  meetingSummary?: string | null
  includeLatestMeeting?: boolean
  sourceTaskId?: string | null
  templateKey?: EmailTemplateKey
}): Promise<InAppOutreachGenerateResult> {
  if (!isInAppOutreachGenerationEnabled()) {
    throw new Error('In-app outreach generation is disabled (ENABLE_IN_APP_OUTREACH_GEN=false)')
  }
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }

  const sequenceStep =
    typeof params.sequenceStep === 'number' && params.sequenceStep >= 1 && params.sequenceStep <= 6
      ? params.sequenceStep
      : 1

  const templateKey: EmailTemplateKey =
    params.templateKey && (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(params.templateKey)
      ? params.templateKey
      : DEFAULT_EMAIL_TEMPLATE_KEY

  const { isTestData } = await loadAndGuardLead(params.contactId)

  const sourceTaskId = params.sourceTaskId ?? null
  const force = params.force === true

  const existingId = await findExistingDraft({
    contactId: params.contactId,
    channel: 'email',
    sequenceStep,
    sourceTaskId,
    force,
  })
  if (existingId) {
    return { outcome: 'skipped', reason: 'draft_exists' }
  }

  const ctx = await buildOutreachPromptContext({
    contactId: params.contactId,
    channel: 'email',
    templateKey,
    meetingSummary: params.meetingSummary,
    includeLatestMeeting: params.includeLatestMeeting,
    sequenceStep,
  })

  const completion = await generateJsonCompletion({
    model: ctx.model,
    systemPrompt: ctx.systemPrompt,
    userPrompt: EMAIL_USER_PROMPT,
    temperature: ctx.temperature,
    maxTokens: ctx.maxTokens,
    costContext: {
      reference: { type: 'contact', id: String(params.contactId) },
      metadata: {
        operation: 'outreach_queue_in_app',
        channel: 'email',
        template_key: templateKey,
      },
    },
  })

  let parsed: { subject?: string; body?: string }
  try {
    parsed = JSON.parse(completion.content) as { subject?: string; body?: string }
  } catch (err) {
    console.error('[outreach-queue-generator] email JSON parse failed:', err, completion.content.slice(0, 200))
    throw new Error('Generated email JSON was malformed')
  }

  const body = (parsed.body || '').trim()
  if (!body) {
    throw new Error('Generated outreach body is empty')
  }
  const subject = (parsed.subject || `Quick note for ${ctx.contact.name}`).trim()

  const generationInputs = buildGenerationInputs({
    ctx,
    templateKey,
    channel: 'email',
    sequenceStep,
  })

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('outreach_queue')
    .insert({
      contact_submission_id: params.contactId,
      channel: 'email',
      subject,
      body,
      sequence_step: sequenceStep,
      status: 'draft',
      generation_model: ctx.model,
      generation_prompt_summary: `in_app:${templateKey}`,
      generation_inputs: generationInputs,
      is_test_data: isTestData,
      source_task_id: sourceTaskId,
    })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    console.error('[outreach-queue-generator] insert error:', insertErr)
    throw new Error('Failed to save outreach draft')
  }

  return {
    outcome: 'created',
    id: inserted.id as string,
    subject,
    body,
  }
}

// ============================================================================
// LinkedIn generator
// ============================================================================

/**
 * Generate a LinkedIn outreach draft (connection note + follow-up DM) and
 * insert it into outreach_queue with channel='linkedin'.
 *
 * The body is formatted as a single text blob:
 *
 *   CONNECTION NOTE
 *
 *   <note>
 *
 *   ---
 *
 *   FOLLOW-UP DM (send 3-7 days after the invite is accepted)
 *
 *   <follow_up_dm>
 *
 * which renders cleanly in the existing Outreach UI without schema changes.
 * `subject` is left null (per the existing channel='linkedin' convention).
 */
export async function generateLinkedInDraftInApp(params: {
  contactId: number
  sequenceStep?: number
  force?: boolean
  meetingSummary?: string | null
  includeLatestMeeting?: boolean
  sourceTaskId?: string | null
  templateKey?: LinkedInTemplateKey
}): Promise<InAppOutreachGenerateResult> {
  if (!isInAppOutreachGenerationEnabled()) {
    throw new Error('In-app outreach generation is disabled (ENABLE_IN_APP_OUTREACH_GEN=false)')
  }
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }

  const sequenceStep =
    typeof params.sequenceStep === 'number' && params.sequenceStep >= 1 && params.sequenceStep <= 6
      ? params.sequenceStep
      : 1

  const templateKey: LinkedInTemplateKey =
    params.templateKey && (LINKEDIN_TEMPLATE_KEYS as readonly string[]).includes(params.templateKey)
      ? params.templateKey
      : DEFAULT_LINKEDIN_TEMPLATE_KEY

  const { isTestData } = await loadAndGuardLead(params.contactId)

  const sourceTaskId = params.sourceTaskId ?? null
  const force = params.force === true

  const existingId = await findExistingDraft({
    contactId: params.contactId,
    channel: 'linkedin',
    sequenceStep,
    sourceTaskId,
    force,
  })
  if (existingId) {
    return { outcome: 'skipped', reason: 'draft_exists' }
  }

  const ctx = await buildOutreachPromptContext({
    contactId: params.contactId,
    channel: 'linkedin',
    templateKey,
    meetingSummary: params.meetingSummary,
    includeLatestMeeting: params.includeLatestMeeting,
    sequenceStep,
  })

  const completion = await generateJsonCompletion({
    model: ctx.model,
    systemPrompt: ctx.systemPrompt,
    userPrompt: LINKEDIN_USER_PROMPT,
    temperature: ctx.temperature,
    maxTokens: ctx.maxTokens,
    costContext: {
      reference: { type: 'contact', id: String(params.contactId) },
      metadata: {
        operation: 'outreach_queue_in_app',
        channel: 'linkedin',
        template_key: templateKey,
      },
    },
  })

  let parsed: { connection_note?: string; follow_up_dm?: string }
  try {
    parsed = JSON.parse(completion.content) as {
      connection_note?: string
      follow_up_dm?: string
    }
  } catch (err) {
    console.error(
      '[outreach-queue-generator] linkedin JSON parse failed:',
      err,
      completion.content.slice(0, 200),
    )
    throw new Error('Generated LinkedIn JSON was malformed')
  }

  const note = (parsed.connection_note || '').trim()
  const dm = (parsed.follow_up_dm || '').trim()
  if (!note) {
    throw new Error('Generated LinkedIn connection_note is empty')
  }
  if (!dm) {
    throw new Error('Generated LinkedIn follow_up_dm is empty')
  }

  const cappedNote =
    note.length > LINKEDIN_CONNECTION_NOTE_MAX_CHARS
      ? note.slice(0, LINKEDIN_CONNECTION_NOTE_MAX_CHARS - 1) + '…'
      : note

  const body = formatLinkedInBody(cappedNote, dm)

  const generationInputs = buildGenerationInputs({
    ctx,
    templateKey,
    channel: 'linkedin',
    sequenceStep,
  })

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('outreach_queue')
    .insert({
      contact_submission_id: params.contactId,
      channel: 'linkedin',
      subject: null,
      body,
      sequence_step: sequenceStep,
      status: 'draft',
      generation_model: ctx.model,
      generation_prompt_summary: `in_app:${templateKey}`,
      generation_inputs: generationInputs,
      is_test_data: isTestData,
      source_task_id: sourceTaskId,
    })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    console.error('[outreach-queue-generator] linkedin insert error:', insertErr)
    throw new Error('Failed to save LinkedIn draft')
  }

  return {
    outcome: 'created',
    id: inserted.id as string,
    subject: null,
    body,
  }
}

/** Exported for tests: format the LinkedIn body the way the UI expects. */
export function formatLinkedInBody(connectionNote: string, followUpDm: string): string {
  return [
    'CONNECTION NOTE',
    '',
    connectionNote,
    '',
    '---',
    '',
    'FOLLOW-UP DM (send 3-7 days after the invite is accepted)',
    '',
    followUpDm,
  ].join('\n')
}
