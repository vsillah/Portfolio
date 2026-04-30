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
import { fetchIndustryValueEvidenceExcerpt } from '@/lib/value-evidence-industry-excerpt'
import {
  loadLeadCorrespondenceExcerpt,
  type PriorOutreachMetadata,
} from '@/lib/lead-correspondence-context'
import { generateJsonCompletion } from '@/lib/llm-dispatch'
import {
  attachAgentArtifact,
  recordAgentStep,
} from '@/lib/agent-run'
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

/** Provenance of meeting text injected into the research brief (generation_inputs). */
export type MeetingTextSource =
  | 'none'
  | 'inline_summary'
  | 'structured_summary'
  | 'raw_notes'
  | 'transcript_excerpt'

const MEETING_TRANSCRIPT_FALLBACK_CAP = 8_000

export function isInAppOutreachGenerationEnabled(): boolean {
  return process.env.ENABLE_IN_APP_OUTREACH_GEN !== 'false'
}

export type InAppOutreachGenerateResult =
  | { outcome: 'created'; id: string; subject: string | null; body: string }
  | {
      outcome: 'existing'
      queueId: string
      templateKey: string
      channel: OutreachChannel
    }
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
  /**
   * When set, use this meeting's notes (must belong to the contact). Takes
   * precedence over includeLatestMeeting for snippet selection.
   */
  meetingRecordId?: string | null
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
    meetingTextSource: MeetingTextSource
    meetingActionItems: number
    pineconeChars: number
    priorChatPresent: boolean
    pineconeBlockHash: string | null
    /** Phase 3 — prior outreach history block size + entry count + inbound flag. */
    priorOutreachChars: number
    priorOutreachEntries: number
    priorOutreachHasInbound: boolean
    valueEvidenceChars: number
    valueEvidenceRows: number
    ragQueryChars: number
    ragSkippedReason: string | null
    ragAttempted: boolean
    ragErrorClass: string | null
    ragHttpStatus: number | null
    ragLatencyMs: number | null
    ragEmptyResponse: boolean
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
  /** Where meeting text came from (inline form vs DB structured vs transcript cap). */
  meeting_text_source: MeetingTextSource
  /** Industry value evidence block from `value_evidence_summary` (0 when skipped/empty). */
  value_evidence_chars: number
  value_evidence_rows: number
  /** RAG query length sent to n8n (0 when skipped before HTTP). */
  rag_query_chars: number
  rag_skipped_reason: string | null
  rag_attempted: boolean
  rag_error_class: string | null
  rag_http_status: number | null
  rag_latency_ms: number | null
  rag_empty_response: boolean
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
    meeting_text_source: ctx.contextSizes.meetingTextSource,
    value_evidence_chars: ctx.contextSizes.valueEvidenceChars,
    value_evidence_rows: ctx.contextSizes.valueEvidenceRows,
    rag_query_chars: ctx.contextSizes.ragQueryChars,
    rag_skipped_reason: ctx.contextSizes.ragSkippedReason,
    rag_attempted: ctx.contextSizes.ragAttempted,
    rag_error_class: ctx.contextSizes.ragErrorClass,
    rag_http_status: ctx.contextSizes.ragHttpStatus,
    rag_latency_ms: ctx.contextSizes.ragLatencyMs,
    rag_empty_response: ctx.contextSizes.ragEmptyResponse,
  }
}

function meetingTextFromRow(meeting: {
  transcript: string | null
  raw_notes: string | null
  structured_notes: unknown
}): { text: string | null; source: MeetingTextSource } {
  const notes = meeting.structured_notes as Record<string, unknown> | null
  const summaryRaw = notes?.summary as string | undefined
  if (summaryRaw?.trim()) {
    return { text: capMeetingSummary(summaryRaw), source: 'structured_summary' }
  }
  if (meeting.raw_notes?.trim()) {
    return { text: capMeetingSummary(meeting.raw_notes), source: 'raw_notes' }
  }
  if (meeting.transcript?.trim()) {
    const slice = meeting.transcript.substring(0, MEETING_TRANSCRIPT_FALLBACK_CAP)
    return { text: capMeetingSummary(slice), source: 'transcript_excerpt' }
  }
  return { text: null, source: 'none' }
}

async function fetchLatestMeetingSnippet(
  contactId: number,
): Promise<{ text: string | null; source: MeetingTextSource }> {
  if (!supabaseAdmin) return { text: null, source: 'none' }
  const { data: meetings } = await supabaseAdmin
    .from('meeting_records')
    .select('transcript, raw_notes, structured_notes')
    .eq('contact_submission_id', contactId)
    .order('meeting_date', { ascending: false })
    .limit(1)

  if (!meetings?.length) return { text: null, source: 'none' }
  return meetingTextFromRow(meetings[0])
}

async function fetchMeetingSnippetByRecordId(
  contactId: number,
  meetingRecordId: string,
): Promise<{ text: string | null; source: MeetingTextSource }> {
  if (!supabaseAdmin) return { text: null, source: 'none' }
  const { data: meeting } = await supabaseAdmin
    .from('meeting_records')
    .select('transcript, raw_notes, structured_notes')
    .eq('id', meetingRecordId)
    .eq('contact_submission_id', contactId)
    .maybeSingle()
  if (!meeting) return { text: null, source: 'none' }
  return meetingTextFromRow(meeting)
}

/**
 * Resolves the meeting that scopes a sequence-driven draft (context column +
 * prompt notes). When `meetingRecordId` is set, it must belong to the contact.
 * Otherwise, when `includeLatestMeeting` is true, use the most recent record.
 */
export async function resolveContextMeetingRecordIdForOutreach(options: {
  contactId: number
  /** Explicit meeting (UUID) from the client, or from product flows. */
  meetingRecordId?: string | null
  /** When no explicit id, load the latest `meeting_records` row for the contact. */
  includeLatestMeeting: boolean
}): Promise<string | null> {
  if (!supabaseAdmin) return null
  const raw = options.meetingRecordId?.trim()
  if (raw) {
    const { data, error } = await supabaseAdmin
      .from('meeting_records')
      .select('id')
      .eq('id', raw)
      .eq('contact_submission_id', options.contactId)
      .maybeSingle()
    if (error || !data?.id) {
      throw new Error('Meeting not found for this lead')
    }
    return data.id as string
  }
  if (options.includeLatestMeeting) {
    const { data } = await supabaseAdmin
      .from('meeting_records')
      .select('id')
      .eq('contact_submission_id', options.contactId)
      .order('meeting_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data?.id as string) ?? null
  }
  return null
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
  let meetingTextSource: MeetingTextSource = 'none'
  if (req.meetingSummary != null && req.meetingSummary.trim() !== '') {
    meetingSnippet = capMeetingSummary(req.meetingSummary)
    meetingTextSource = 'inline_summary'
  } else if (req.meetingRecordId) {
    const m = await fetchMeetingSnippetByRecordId(req.contactId, req.meetingRecordId)
    meetingSnippet = m.text
    meetingTextSource = m.source
  } else if (req.includeLatestMeeting !== false) {
    const m = await fetchLatestMeetingSnippet(req.contactId)
    meetingSnippet = m.text
    meetingTextSource = m.source
  }

  let researchBrief =
    meetingSnippet && meetingSnippet.length > 0
      ? `${baseBrief}\n\n## Recent meeting context\n${meetingSnippet}`
      : baseBrief

  const valueEvidence = await fetchIndustryValueEvidenceExcerpt(contact.industry)
  if (valueEvidence.block) {
    researchBrief = `${researchBrief}\n\n${valueEvidence.block}`
  }

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
      meetingTextSource,
      meetingActionItems: meetingActionItemsBlock?.length ?? 0,
      pineconeChars: ragMeta.pineconeChars,
      priorChatPresent: ragMeta.priorChatPresent,
      pineconeBlockHash: ragMeta.pineconeBlockHash,
      priorOutreachChars: priorMeta.chars,
      priorOutreachEntries: priorMeta.entriesIncluded,
      priorOutreachHasInbound: priorMeta.hasInbound,
      valueEvidenceChars: valueEvidence.chars,
      valueEvidenceRows: valueEvidence.rowsUsed,
      ragQueryChars: ragMeta.ragQueryChars,
      ragSkippedReason: ragMeta.ragSkippedReason,
      ragAttempted: ragMeta.ragAttempted,
      ragErrorClass: ragMeta.ragErrorClass,
      ragHttpStatus: ragMeta.ragHttpStatus,
      ragLatencyMs: ragMeta.ragLatencyMs,
      ragEmptyResponse: ragMeta.ragEmptyResponse,
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
  /** Required for sequence-driven (null source_task) duplicate detection. */
  templateKey: string
  /** meeting_records.id; null = no meeting context in scope. */
  contextMeetingRecordId: string | null
  force: boolean
}

async function findExistingDraft(args: DuplicateGuardArgs): Promise<string | null> {
  if (!supabaseAdmin || args.force) return null

  if (args.sourceTaskId != null) {
    const { data: existing } = await supabaseAdmin
      .from('outreach_queue')
      .select('id')
      .eq('contact_submission_id', args.contactId)
      .eq('channel', args.channel)
      .eq('sequence_step', args.sequenceStep)
      .eq('status', 'draft')
      .eq('source_task_id', args.sourceTaskId)
      .limit(1)
      .maybeSingle()
    return (existing?.id as string | undefined) ?? null
  }

  let existingQuery = supabaseAdmin
    .from('outreach_queue')
    .select('id')
    .eq('contact_submission_id', args.contactId)
    .eq('channel', args.channel)
    .eq('sequence_step', args.sequenceStep)
    .eq('status', 'draft')
    .is('source_task_id', null)
    .contains('generation_inputs', { template_key: args.templateKey })

  if (args.contextMeetingRecordId == null) {
    existingQuery = existingQuery.is('context_meeting_record_id', null)
  } else {
    existingQuery = existingQuery.eq('context_meeting_record_id', args.contextMeetingRecordId)
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
  /** `meeting_records.id` (UUID) — prompt + duplicate scope. */
  meetingRecordId?: string | null
  includeLatestMeeting?: boolean
  sourceTaskId?: string | null
  templateKey?: EmailTemplateKey
  agentRunId?: string | null
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

  const hasSummary = params.meetingSummary != null && params.meetingSummary.trim() !== ''
  const includeLatest = params.includeLatestMeeting !== false
  const contextMeetingRecordId =
    sourceTaskId != null
      ? null
      : await resolveContextMeetingRecordIdForOutreach({
          contactId: params.contactId,
          meetingRecordId: params.meetingRecordId ?? null,
          includeLatestMeeting: hasSummary ? false : includeLatest,
        })

  const existingId = await findExistingDraft({
    contactId: params.contactId,
    channel: 'email',
    sequenceStep,
    sourceTaskId,
    templateKey,
    contextMeetingRecordId: sourceTaskId == null ? contextMeetingRecordId : null,
    force,
  })
  if (existingId) {
    if (sourceTaskId != null) {
      return { outcome: 'skipped', reason: 'draft_exists' }
    }
    return {
      outcome: 'existing',
      queueId: existingId,
      templateKey,
      channel: 'email',
    }
  }

  const ctx = await buildOutreachPromptContext({
    contactId: params.contactId,
    channel: 'email',
    templateKey,
    meetingSummary: params.meetingSummary,
    meetingRecordId: contextMeetingRecordId ?? undefined,
    includeLatestMeeting: hasSummary ? false : includeLatest,
    sequenceStep,
  })

  if (params.agentRunId) {
    await recordAgentStep({
      runId: params.agentRunId,
      stepKey: 'prompt_context',
      name: 'Prompt context assembled',
      status: 'completed',
      outputSummary: `Prepared ${templateKey} email prompt for contact ${params.contactId}.`,
      metadata: {
        channel: 'email',
        template_key: templateKey,
        model: ctx.model,
        sequence_step: sequenceStep,
      },
      idempotencyKey: `${params.agentRunId}:email:prompt_context`,
    }).catch((err) => console.warn('[outreach-queue-generator] agent step failed:', err))
  }

  const completion = await generateJsonCompletion({
    model: ctx.model,
    systemPrompt: ctx.systemPrompt,
    userPrompt: EMAIL_USER_PROMPT,
    temperature: ctx.temperature,
    maxTokens: ctx.maxTokens,
    costContext: {
      reference: { type: 'contact', id: String(params.contactId) },
      agentRunId: params.agentRunId ?? undefined,
      metadata: {
        operation: 'outreach_queue_in_app',
        channel: 'email',
        template_key: templateKey,
      },
    },
  })

  if (params.agentRunId) {
    await recordAgentStep({
      runId: params.agentRunId,
      stepKey: 'llm_dispatch',
      name: 'LLM draft generated',
      status: 'completed',
      tokensIn: completion.usage?.prompt_tokens ?? completion.usage?.input_tokens ?? null,
      tokensOut: completion.usage?.completion_tokens ?? completion.usage?.output_tokens ?? null,
      outputSummary: `Generated email JSON with ${completion.provider}.`,
      metadata: {
        provider: completion.provider,
        model: completion.model,
        channel: 'email',
        template_key: templateKey,
      },
      idempotencyKey: `${params.agentRunId}:email:llm_dispatch`,
    }).catch((err) => console.warn('[outreach-queue-generator] agent step failed:', err))
  }

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
      context_meeting_record_id: sourceTaskId == null ? contextMeetingRecordId : null,
    })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    console.error('[outreach-queue-generator] insert error:', insertErr)
    throw new Error('Failed to save outreach draft')
  }

  if (params.agentRunId) {
    await attachAgentArtifact({
      runId: params.agentRunId,
      artifactType: 'outreach_draft',
      title: subject,
      refType: 'outreach_queue',
      refId: inserted.id as string,
      url: `/admin/outreach?contact=${params.contactId}`,
      metadata: { channel: 'email', template_key: templateKey },
      idempotencyKey: `${params.agentRunId}:email:artifact:${inserted.id}`,
    }).catch((err) => console.warn('[outreach-queue-generator] agent artifact failed:', err))
    await recordAgentStep({
      runId: params.agentRunId,
      stepKey: 'draft_saved',
      name: 'Outreach draft saved',
      status: 'completed',
      outputSummary: `Saved draft ${inserted.id}.`,
      metadata: { queue_id: inserted.id, channel: 'email' },
      idempotencyKey: `${params.agentRunId}:email:draft_saved`,
    }).catch((err) => console.warn('[outreach-queue-generator] agent step failed:', err))
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
  meetingRecordId?: string | null
  includeLatestMeeting?: boolean
  sourceTaskId?: string | null
  templateKey?: LinkedInTemplateKey
  agentRunId?: string | null
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

  const hasSummary = params.meetingSummary != null && params.meetingSummary.trim() !== ''
  const includeLatest = params.includeLatestMeeting !== false
  const contextMeetingRecordId =
    sourceTaskId != null
      ? null
      : await resolveContextMeetingRecordIdForOutreach({
          contactId: params.contactId,
          meetingRecordId: params.meetingRecordId ?? null,
          includeLatestMeeting: hasSummary ? false : includeLatest,
        })

  const existingId = await findExistingDraft({
    contactId: params.contactId,
    channel: 'linkedin',
    sequenceStep,
    sourceTaskId,
    templateKey,
    contextMeetingRecordId: sourceTaskId == null ? contextMeetingRecordId : null,
    force,
  })
  if (existingId) {
    if (sourceTaskId != null) {
      return { outcome: 'skipped', reason: 'draft_exists' }
    }
    return {
      outcome: 'existing',
      queueId: existingId,
      templateKey,
      channel: 'linkedin',
    }
  }

  const ctx = await buildOutreachPromptContext({
    contactId: params.contactId,
    channel: 'linkedin',
    templateKey,
    meetingSummary: params.meetingSummary,
    meetingRecordId: contextMeetingRecordId ?? undefined,
    includeLatestMeeting: hasSummary ? false : includeLatest,
    sequenceStep,
  })

  if (params.agentRunId) {
    await recordAgentStep({
      runId: params.agentRunId,
      stepKey: 'prompt_context',
      name: 'Prompt context assembled',
      status: 'completed',
      outputSummary: `Prepared ${templateKey} LinkedIn prompt for contact ${params.contactId}.`,
      metadata: {
        channel: 'linkedin',
        template_key: templateKey,
        model: ctx.model,
        sequence_step: sequenceStep,
      },
      idempotencyKey: `${params.agentRunId}:linkedin:prompt_context`,
    }).catch((err) => console.warn('[outreach-queue-generator] agent step failed:', err))
  }

  const completion = await generateJsonCompletion({
    model: ctx.model,
    systemPrompt: ctx.systemPrompt,
    userPrompt: LINKEDIN_USER_PROMPT,
    temperature: ctx.temperature,
    maxTokens: ctx.maxTokens,
    costContext: {
      reference: { type: 'contact', id: String(params.contactId) },
      agentRunId: params.agentRunId ?? undefined,
      metadata: {
        operation: 'outreach_queue_in_app',
        channel: 'linkedin',
        template_key: templateKey,
      },
    },
  })

  if (params.agentRunId) {
    await recordAgentStep({
      runId: params.agentRunId,
      stepKey: 'llm_dispatch',
      name: 'LLM draft generated',
      status: 'completed',
      tokensIn: completion.usage?.prompt_tokens ?? completion.usage?.input_tokens ?? null,
      tokensOut: completion.usage?.completion_tokens ?? completion.usage?.output_tokens ?? null,
      outputSummary: `Generated LinkedIn JSON with ${completion.provider}.`,
      metadata: {
        provider: completion.provider,
        model: completion.model,
        channel: 'linkedin',
        template_key: templateKey,
      },
      idempotencyKey: `${params.agentRunId}:linkedin:llm_dispatch`,
    }).catch((err) => console.warn('[outreach-queue-generator] agent step failed:', err))
  }

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
      context_meeting_record_id: sourceTaskId == null ? contextMeetingRecordId : null,
    })
    .select('id')
    .single()

  if (insertErr || !inserted?.id) {
    console.error('[outreach-queue-generator] linkedin insert error:', insertErr)
    throw new Error('Failed to save LinkedIn draft')
  }

  if (params.agentRunId) {
    await attachAgentArtifact({
      runId: params.agentRunId,
      artifactType: 'outreach_draft',
      title: `LinkedIn draft for ${ctx.contact.name}`,
      refType: 'outreach_queue',
      refId: inserted.id as string,
      url: `/admin/outreach?contact=${params.contactId}`,
      metadata: { channel: 'linkedin', template_key: templateKey },
      idempotencyKey: `${params.agentRunId}:linkedin:artifact:${inserted.id}`,
    }).catch((err) => console.warn('[outreach-queue-generator] agent artifact failed:', err))
    await recordAgentStep({
      runId: params.agentRunId,
      stepKey: 'draft_saved',
      name: 'Outreach draft saved',
      status: 'completed',
      outputSummary: `Saved LinkedIn draft ${inserted.id}.`,
      metadata: { queue_id: inserted.id, channel: 'linkedin' },
      idempotencyKey: `${params.agentRunId}:linkedin:draft_saved`,
    }).catch((err) => console.warn('[outreach-queue-generator] agent step failed:', err))
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
