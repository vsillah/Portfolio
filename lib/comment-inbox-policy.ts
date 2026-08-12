import type { CreateAgentWorkItemInput } from '@/lib/agent-work-items'
import type {
  SocialCommentClassificationStatus,
  SocialCommentPriority,
  SocialCommentReplySubmissionState,
  SocialCommentResponseApprovalState,
  SocialCommentSentiment,
} from '@/lib/social-comment-inbox'

export const COMMENT_CLASSIFICATIONS = [
  'low_risk_acknowledgement',
  'substantive_question',
  'buying_lead_intent',
  'partnership_intent',
  'criticism_negative',
  'misinformation_unsupported_claim',
  'sensitive_privacy_legal_financial',
  'spam',
  'low_confidence',
  'provider_manual_ambiguity',
] as const

export type CommentClassification = (typeof COMMENT_CLASSIFICATIONS)[number]

export const COMMENT_POLICY_SIGNALS = [
  'private_data',
  'unsupported_claim',
  'pricing_or_custom_promise',
  'legal_or_financial_advice',
  'negative_or_conflict_tone',
  'lead_handoff',
  'provider_ambiguity',
  'external_boundary_uncertainty',
  'spam',
] as const

export type CommentPolicySignal = (typeof COMMENT_POLICY_SIGNALS)[number]

export type CommentReplyTone = 'public_safe' | 'neutral' | 'negative' | 'conflict' | 'sensitive'

export type CommentSourceVisibility = 'public' | 'private' | 'internal' | 'unknown'

export type CommentInboxSource = {
  label: string
  visibility: CommentSourceVisibility
  summary?: string | null
  usedForPublicClaim?: boolean
  supportsPublicClaim?: boolean
}

export type CommentInboxItem = {
  id: string
  text: string
  platform?: string | null
  provider?: string | null
  providerCommentId?: string | null
  threadId?: string | null
  authorId?: string | null
  authorHandle?: string | null
  postId?: string | null
  postLabel?: string | null
  createdAt: string
}

export type CommentReplyDraftCandidate = {
  text?: string | null
  confidence?: number | null
  tone?: CommentReplyTone | null
  containsPrivateData?: boolean
  containsUnsupportedClaim?: boolean
  containsPricingOrCustomPromise?: boolean
  containsLegalOrFinancialAdvice?: boolean
  derivedFromPrivateSource?: boolean
  provenanceSummary?: string | null
  sourceDistanceNote?: string | null
}

export type PreviousAutoReply = {
  authorId?: string | null
  threadId?: string | null
  sentAt: string
}

export type CommentInboxPolicyOptions = {
  classificationConfidenceThreshold?: number
  autoSendConfidenceThreshold?: number
  holdMinutes?: number
  throttleHours?: number
}

export type CommentInboxPolicyInput = {
  comment: CommentInboxItem
  confidence: number
  now?: string
  signals?: Partial<Record<CommentPolicySignal, boolean>>
  sources?: CommentInboxSource[]
  draft?: CommentReplyDraftCandidate | null
  previousAutoReplies?: PreviousAutoReply[]
  options?: CommentInboxPolicyOptions
}

export type CommentProviderCapabilityPolicySnapshot = {
  capability_status?: string | null
  capabilityStatus?: string | null
  supports_reply_submission?: boolean | null
  supportsReplySubmission?: boolean | null
  external_submission_enabled?: boolean | null
  externalSubmissionEnabled?: boolean | null
}

export type SocialCommentPolicyRecord = {
  id?: string | null
  publish_id?: string | null
  publishId?: string | null
  content_id?: string | null
  contentId?: string | null
  platform?: string | null
  provider?: string | null
  provider_comment_id?: string | null
  providerCommentId?: string | null
  provider_parent_comment_id?: string | null
  providerParentCommentId?: string | null
  thread_id?: string | null
  threadId?: string | null
  author_public_handle?: string | null
  authorPublicHandle?: string | null
  author_display_name?: string | null
  authorDisplayName?: string | null
  body?: string | null
  text?: string | null
  provider_created_at?: string | null
  providerCreatedAt?: string | null
  captured_at?: string | null
  capturedAt?: string | null
  created_at?: string | null
  createdAt?: string | null
  provider_capability?: CommentProviderCapabilityPolicySnapshot | null
  providerCapability?: CommentProviderCapabilityPolicySnapshot | null
}

export type SocialCommentPolicyInputOptions = Omit<CommentInboxPolicyInput, 'comment' | 'signals'> & {
  signals?: Partial<Record<CommentPolicySignal, boolean>>
}

export type CommentReplyDraftPolicy = {
  text: string
  status: 'draft_public_reply' | 'human_review_draft'
  preserveVoice: 'vambah_amadutown'
  provenanceSummary: string
  sourceDistanceNote: string
  mustNotQuotePrivateSourceMaterial: true
  rules: string[]
}

export type CommentAutoSendDecision = {
  eligible: boolean
  canSendNow: boolean
  earliestSendAt: string
  blockedReasons: string[]
  holdReasons: string[]
}

export type CommentLeadWorkItemProposal = Pick<
  CreateAgentWorkItemInput,
  'title' | 'objective' | 'priority' | 'status' | 'ownerAgentKey' | 'ownerRuntime' | 'source' | 'metadata' | 'idempotencyKey'
>

export const COMMENT_PROVIDER_OWNED_FIELDS = [
  'publish_id',
  'content_id',
  'platform',
  'provider',
  'provider_comment_id',
  'provider_parent_comment_id',
  'parent_comment_id',
  'thread_id',
  'record_type',
  'author_public_handle',
  'author_display_name',
  'author_profile_url',
  'author_is_channel_owner',
  'body',
  'comment_url',
  'provider_created_at',
  'provider_updated_at',
  'captured_at',
  'provider_capability',
  'ingestion_run_id',
  'raw_payload',
] as const

export type CommentProviderOwnedField = (typeof COMMENT_PROVIDER_OWNED_FIELDS)[number]

export type CommentWorkflowUpdateProposal = {
  table: 'social_content_comments'
  commentId: string
  providerCommentId: string | null
  workflowOwnedPatch: {
    classification_status: SocialCommentClassificationStatus
    classification_reason: string
    sentiment: SocialCommentSentiment
    priority: SocialCommentPriority
    response_approval_state: SocialCommentResponseApprovalState
    reply_submission_state: SocialCommentReplySubmissionState
    proposed_reply_text: string | null
    approved_reply_text: null
    reply_provider_comment_id: null
    reply_submitted_at: null
    metadata: Record<string, unknown>
  }
  providerOwnedFieldsNotMutated: CommentProviderOwnedField[]
  providerIngestionBoundary: {
    ingestionEnabled: false
    replySubmissionEnabled: false
    externalActionsAllowed: false
    note: string
  }
}

export type CommentInboxPolicyDecision = {
  classification: CommentClassification
  confidence: number
  humanQaRequired: boolean
  humanQaReasons: string[]
  autoSend: CommentAutoSendDecision
  replyDraft: CommentReplyDraftPolicy
  workflowUpdateProposal: CommentWorkflowUpdateProposal
  leadWorkItemProposal: CommentLeadWorkItemProposal | null
}

const DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.55
const DEFAULT_AUTO_SEND_CONFIDENCE_THRESHOLD = 0.85
const DEFAULT_HOLD_MINUTES = 15
const DEFAULT_THROTTLE_HOURS = 24
const BEHANZIN_AGENT_KEY = 'warm-lead-capture'

const CLASSIFICATION_HUMAN_QA_REASONS: Partial<Record<CommentClassification, string>> = {
  substantive_question: 'substantive_question_requires_review',
  buying_lead_intent: 'buying_intent_requires_human_follow_up',
  partnership_intent: 'partnership_intent_requires_review',
  criticism_negative: 'criticism_or_negative_tone_requires_review',
  misinformation_unsupported_claim: 'unsupported_or_misinformation_claim_requires_review',
  sensitive_privacy_legal_financial: 'sensitive_privacy_legal_financial_topic_requires_review',
  spam: 'spam_requires_manual_disposition',
  low_confidence: 'low_confidence_requires_review',
  provider_manual_ambiguity: 'provider_manual_ambiguity_requires_review',
}

function includesAny(text: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function toDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

function normalizeText(text: string) {
  return text.trim().toLowerCase()
}

function optionalString(value: string | null | undefined) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

function providerCapabilityStatus(capability: CommentProviderCapabilityPolicySnapshot | null | undefined) {
  return optionalString(capability?.capability_status) ?? optionalString(capability?.capabilityStatus)
}

function providerSupportsReplySubmission(capability: CommentProviderCapabilityPolicySnapshot | null | undefined) {
  return capability?.supports_reply_submission ?? capability?.supportsReplySubmission ?? null
}

function providerExternalSubmissionEnabled(capability: CommentProviderCapabilityPolicySnapshot | null | undefined) {
  return capability?.external_submission_enabled ?? capability?.externalSubmissionEnabled ?? null
}

function isProviderAmbiguous(capability: CommentProviderCapabilityPolicySnapshot | null | undefined) {
  if (!capability || Object.keys(capability).length === 0) return true
  const status = providerCapabilityStatus(capability)
  return (
    status !== 'verified'
    || providerSupportsReplySubmission(capability) !== true
    || providerExternalSubmissionEnabled(capability) !== true
  )
}

function hasPrivateSourcePublicClaim(input: CommentInboxPolicyInput) {
  const sources = input.sources ?? []
  return sources.some((source) => (
    source.usedForPublicClaim === true
    && source.visibility !== 'public'
  ))
}

function hasUnsupportedPublicClaim(input: CommentInboxPolicyInput) {
  const sources = input.sources ?? []
  return sources.some((source) => (
    source.usedForPublicClaim === true
    && source.supportsPublicClaim === false
  ))
}

function inferClassification(input: CommentInboxPolicyInput): CommentClassification {
  const text = normalizeText(input.comment.text)
  const signals = input.signals ?? {}
  const threshold = input.options?.classificationConfidenceThreshold ?? DEFAULT_CLASSIFICATION_CONFIDENCE_THRESHOLD

  if (signals.spam || includesAny(text, [
    /\bbuy followers\b/,
    /\bcrypto\b/,
    /\bairdrop\b/,
    /\bclick (this|my) link\b/,
    /\bmake \$?\d+\b/,
  ])) {
    return 'spam'
  }

  if (signals.provider_ambiguity || input.comment.provider === 'manual') {
    return 'provider_manual_ambiguity'
  }

  if (input.confidence < threshold) {
    return 'low_confidence'
  }

  if (signals.private_data || signals.legal_or_financial_advice || includesAny(text, [
    /\b(ssn|social security|home address|phone number|email address)\b/,
    /\blegal advice\b/,
    /\bfinancial advice\b/,
    /\binvest(ment|ing)? advice\b/,
    /\bprivate\b/,
    /\bconfidential\b/,
  ])) {
    return 'sensitive_privacy_legal_financial'
  }

  if (signals.lead_handoff || includesAny(text, [
    /\b(hire|book|consultation|quote|proposal|pricing|price|cost|demo)\b/,
    /\bcan you build\b/,
    /\bneed help\b/,
    /\bwork with (you|amadutown)\b/,
  ])) {
    return 'buying_lead_intent'
  }

  if (includesAny(text, [
    /\bpartner(ship)?\b/,
    /\bcollaborat(e|ion)\b/,
    /\bsponsor(ship)?\b/,
    /\bjoint venture\b/,
  ])) {
    return 'partnership_intent'
  }

  if (signals.negative_or_conflict_tone || includesAny(text, [
    /\bwrong\b/,
    /\bterrible\b/,
    /\bdisagree\b/,
    /\bscam\b/,
    /\bfake\b/,
    /\bthis is bad\b/,
  ])) {
    return 'criticism_negative'
  }

  if (signals.unsupported_claim || hasUnsupportedPublicClaim(input) || includesAny(text, [
    /\bmisleading\b/,
    /\bnot true\b/,
    /\bfalse\b/,
    /\bprove it\b/,
    /\bsource\?\b/,
  ])) {
    return 'misinformation_unsupported_claim'
  }

  if (text.includes('?') || includesAny(text, [
    /^\s*(how|what|why|when|where|can|could|would|should)\b/,
  ])) {
    return 'substantive_question'
  }

  return 'low_risk_acknowledgement'
}

function buildProvenanceSummary(input: CommentInboxPolicyInput) {
  const draftSummary = input.draft?.provenanceSummary?.trim()
  if (draftSummary) return draftSummary

  const publicSources = (input.sources ?? [])
    .filter((source) => source.visibility === 'public')
    .map((source) => source.label.trim())
    .filter(Boolean)

  if (publicSources.length > 0) {
    return `Public source context: ${publicSources.join(', ')}.`
  }

  return 'No public source claims are introduced by the draft reply.'
}

function buildSourceDistanceNote(input: CommentInboxPolicyInput) {
  const draftNote = input.draft?.sourceDistanceNote?.trim()
  if (draftNote) return draftNote

  return [
    'Reply must be original public copy in Vambah/AmaduTown voice.',
    'Use source material only as context; do not quote private notes, chats, client records, or benchmark creators.',
  ].join(' ')
}

function defaultReplyText(classification: CommentClassification) {
  switch (classification) {
    case 'buying_lead_intent':
      return 'Appreciate you reaching out. I will keep the details out of the public thread and follow up through the right channel.'
    case 'partnership_intent':
      return 'Appreciate the note. This may be worth a closer look, so I will review the fit before replying in detail.'
    case 'substantive_question':
      return 'Good question. I want to answer this with the right context, so I will review the source material before responding in detail.'
    case 'criticism_negative':
      return 'I appreciate you raising this. I want to understand the concern clearly before responding in public.'
    case 'misinformation_unsupported_claim':
      return 'I appreciate the push for clarity. I will check the source context before making any public claim here.'
    case 'sensitive_privacy_legal_financial':
      return 'Thanks for the note. I cannot work through private or sensitive details in a public thread.'
    case 'spam':
      return 'No public reply should be drafted for this comment until a human reviews the disposition.'
    case 'low_confidence':
      return 'This needs human review before a public reply is drafted.'
    case 'provider_manual_ambiguity':
      return 'This needs provider context review before a public reply is drafted.'
    case 'low_risk_acknowledgement':
    default:
      return 'Appreciate you reading and engaging with this.'
  }
}

function buildReplyDraftPolicy(
  input: CommentInboxPolicyInput,
  classification: CommentClassification,
): CommentReplyDraftPolicy {
  const text = input.draft?.text?.trim() || defaultReplyText(classification)
  const humanReviewClassifications: ReadonlySet<CommentClassification> = new Set([
    'substantive_question',
    'buying_lead_intent',
    'partnership_intent',
    'criticism_negative',
    'misinformation_unsupported_claim',
    'sensitive_privacy_legal_financial',
    'spam',
    'low_confidence',
    'provider_manual_ambiguity',
  ])

  return {
    text,
    status: humanReviewClassifications.has(classification) ? 'human_review_draft' : 'draft_public_reply',
    preserveVoice: 'vambah_amadutown',
    provenanceSummary: buildProvenanceSummary(input),
    sourceDistanceNote: buildSourceDistanceNote(input),
    mustNotQuotePrivateSourceMaterial: true,
    rules: [
      'Keep the reply short, grounded, and public-safe.',
      'Do not include private data, private-source quotes, unsupported claims, pricing, custom promises, or legal/financial advice.',
      'Route lead, partnership, sensitive, negative, unsupported, low-confidence, and provider-ambiguous comments to human QA.',
    ],
  }
}

function recentAutoReplyExists(input: CommentInboxPolicyInput, now: Date, throttleHours: number) {
  const comment = input.comment
  const throttleStart = new Date(now.getTime() - throttleHours * 60 * 60_000)

  return (input.previousAutoReplies ?? []).some((reply) => {
    const sentAt = toDate(reply.sentAt, new Date(0))
    if (sentAt < throttleStart || sentAt > now) return false
    return Boolean(
      reply.authorId
      && comment.authorId
      && reply.threadId
      && comment.threadId
      && reply.authorId === comment.authorId
      && reply.threadId === comment.threadId,
    )
  })
}

function buildHumanQaReasons(
  input: CommentInboxPolicyInput,
  classification: CommentClassification,
): string[] {
  const signals = input.signals ?? {}
  const reasons = new Set<string>()
  const classificationReason = CLASSIFICATION_HUMAN_QA_REASONS[classification]
  if (classificationReason) reasons.add(classificationReason)

  if (signals.private_data || input.draft?.containsPrivateData) reasons.add('private_data_boundary')
  if (signals.unsupported_claim || input.draft?.containsUnsupportedClaim || hasUnsupportedPublicClaim(input)) {
    reasons.add('unsupported_public_claim_boundary')
  }
  if (signals.pricing_or_custom_promise || input.draft?.containsPricingOrCustomPromise) {
    reasons.add('pricing_or_custom_promise_boundary')
  }
  if (signals.legal_or_financial_advice || input.draft?.containsLegalOrFinancialAdvice) {
    reasons.add('legal_or_financial_advice_boundary')
  }
  if (signals.negative_or_conflict_tone || input.draft?.tone === 'negative' || input.draft?.tone === 'conflict') {
    reasons.add('negative_or_conflict_tone_boundary')
  }
  if (signals.lead_handoff) reasons.add('lead_handoff_boundary')
  if (signals.provider_ambiguity) reasons.add('provider_ambiguity_boundary')
  if (signals.external_boundary_uncertainty) reasons.add('external_public_boundary_uncertainty')
  if (input.draft?.derivedFromPrivateSource || hasPrivateSourcePublicClaim(input)) {
    reasons.add('private_source_public_claim_boundary')
  }

  return [...reasons]
}

export function buildCommentInboxPolicyInputFromSocialComment(
  record: SocialCommentPolicyRecord,
  options: SocialCommentPolicyInputOptions,
): CommentInboxPolicyInput {
  const providerCapability = record.provider_capability ?? record.providerCapability ?? null
  const providerCommentId = optionalString(record.provider_comment_id) ?? optionalString(record.providerCommentId)
  const providerParentCommentId = optionalString(record.provider_parent_comment_id) ?? optionalString(record.providerParentCommentId)
  const threadId = optionalString(record.thread_id) ?? optionalString(record.threadId) ?? providerParentCommentId ?? providerCommentId
  const authorHandle = optionalString(record.author_public_handle) ?? optionalString(record.authorPublicHandle)
  const authorDisplayName = optionalString(record.author_display_name) ?? optionalString(record.authorDisplayName)
  const contentId = optionalString(record.content_id) ?? optionalString(record.contentId)
  const publishId = optionalString(record.publish_id) ?? optionalString(record.publishId)
  const id = optionalString(record.id) ?? providerCommentId ?? `${record.platform ?? 'comment'}:unknown`
  const text = optionalString(record.body) ?? optionalString(record.text)
  const createdAt = (
    optionalString(record.provider_created_at)
    ?? optionalString(record.providerCreatedAt)
    ?? optionalString(record.captured_at)
    ?? optionalString(record.capturedAt)
    ?? optionalString(record.created_at)
    ?? optionalString(record.createdAt)
    ?? new Date(0).toISOString()
  )

  return {
    ...options,
    signals: {
      ...(options.signals ?? {}),
      provider_ambiguity: Boolean(options.signals?.provider_ambiguity || isProviderAmbiguous(providerCapability)),
    },
    comment: {
      id,
      text: text ?? '',
      platform: optionalString(record.platform),
      provider: optionalString(record.provider),
      providerCommentId,
      threadId,
      authorId: authorHandle ?? authorDisplayName,
      authorHandle: authorHandle ?? authorDisplayName,
      postId: contentId ?? publishId,
      postLabel: contentId ? `Social content ${contentId}` : publishId ? `Social publish ${publishId}` : null,
      createdAt,
    },
  }
}

function buildAutoSendDecision(
  input: CommentInboxPolicyInput,
  classification: CommentClassification,
  humanQaReasons: string[],
): CommentAutoSendDecision {
  const now = toDate(input.now, new Date())
  const commentCreatedAt = toDate(input.comment.createdAt, now)
  const options = input.options ?? {}
  const autoSendConfidenceThreshold = options.autoSendConfidenceThreshold ?? DEFAULT_AUTO_SEND_CONFIDENCE_THRESHOLD
  const holdMinutes = options.holdMinutes ?? DEFAULT_HOLD_MINUTES
  const throttleHours = options.throttleHours ?? DEFAULT_THROTTLE_HOURS
  const earliestSendAt = addMinutes(commentCreatedAt, holdMinutes)
  const blockedReasons = new Set<string>()
  const holdReasons = new Set<string>()
  const draft = input.draft
  const signals = input.signals ?? {}

  if (classification !== 'low_risk_acknowledgement') blockedReasons.add(`classification_${classification}`)
  if (input.confidence < autoSendConfidenceThreshold) blockedReasons.add('confidence_below_auto_send_threshold')
  if (draft?.confidence != null && draft.confidence < autoSendConfidenceThreshold) {
    blockedReasons.add('draft_confidence_below_auto_send_threshold')
  }
  if (humanQaReasons.length > 0) blockedReasons.add('human_qa_required')
  if (signals.private_data || draft?.containsPrivateData) blockedReasons.add('private_data')
  if (signals.unsupported_claim || draft?.containsUnsupportedClaim || hasUnsupportedPublicClaim(input)) {
    blockedReasons.add('unsupported_claim')
  }
  if (signals.pricing_or_custom_promise || draft?.containsPricingOrCustomPromise) {
    blockedReasons.add('pricing_or_custom_promise')
  }
  if (signals.legal_or_financial_advice || draft?.containsLegalOrFinancialAdvice) {
    blockedReasons.add('legal_or_financial_advice')
  }
  if (signals.negative_or_conflict_tone || draft?.tone === 'negative' || draft?.tone === 'conflict') {
    blockedReasons.add('negative_or_conflict_tone')
  }
  if (signals.lead_handoff || classification === 'buying_lead_intent') blockedReasons.add('lead_handoff')
  if (signals.provider_ambiguity || classification === 'provider_manual_ambiguity') blockedReasons.add('provider_ambiguity')
  if (signals.external_boundary_uncertainty) blockedReasons.add('external_public_boundary_uncertainty')
  if (draft?.derivedFromPrivateSource || hasPrivateSourcePublicClaim(input)) {
    blockedReasons.add('private_source_public_claim')
  }
  if (recentAutoReplyExists(input, now, throttleHours)) {
    blockedReasons.add('author_thread_auto_reply_throttle')
  }
  if (now < earliestSendAt) holdReasons.add('hold_window_pending')

  const eligible = blockedReasons.size === 0
  return {
    eligible,
    canSendNow: eligible && holdReasons.size === 0,
    earliestSendAt: earliestSendAt.toISOString(),
    blockedReasons: [...blockedReasons],
    holdReasons: [...holdReasons],
  }
}

function classificationStatusForComment(classification: CommentClassification): SocialCommentClassificationStatus {
  switch (classification) {
    case 'spam':
      return 'spam'
    case 'sensitive_privacy_legal_financial':
    case 'misinformation_unsupported_claim':
    case 'provider_manual_ambiguity':
      return 'blocked'
    case 'low_risk_acknowledgement':
    case 'substantive_question':
    case 'buying_lead_intent':
    case 'partnership_intent':
    case 'criticism_negative':
    case 'low_confidence':
    default:
      return 'needs_response'
  }
}

function sentimentForComment(classification: CommentClassification): SocialCommentSentiment {
  switch (classification) {
    case 'criticism_negative':
      return 'negative'
    case 'low_risk_acknowledgement':
      return 'positive'
    case 'spam':
    case 'low_confidence':
    case 'provider_manual_ambiguity':
      return 'unknown'
    case 'substantive_question':
    case 'buying_lead_intent':
    case 'partnership_intent':
    case 'misinformation_unsupported_claim':
    case 'sensitive_privacy_legal_financial':
    default:
      return 'neutral'
  }
}

function priorityForComment(classification: CommentClassification): SocialCommentPriority {
  switch (classification) {
    case 'sensitive_privacy_legal_financial':
      return 'urgent'
    case 'buying_lead_intent':
    case 'partnership_intent':
    case 'criticism_negative':
    case 'misinformation_unsupported_claim':
    case 'provider_manual_ambiguity':
      return 'high'
    case 'substantive_question':
    case 'low_confidence':
      return 'normal'
    case 'low_risk_acknowledgement':
    case 'spam':
    default:
      return 'low'
  }
}

function buildClassificationReason(
  classification: CommentClassification,
  humanQaReasons: string[],
  autoSend: CommentAutoSendDecision,
) {
  return [
    `Policy classification: ${classification}.`,
    humanQaReasons.length > 0 ? `Human QA: ${humanQaReasons.join(', ')}.` : 'Human QA: not required by policy.',
    autoSend.blockedReasons.length > 0
      ? `Auto-send blocked: ${autoSend.blockedReasons.join(', ')}.`
      : `Auto-send eligible after hold: ${autoSend.earliestSendAt}.`,
  ].join(' ')
}

function buildWorkflowUpdateProposal(input: {
  policyInput: CommentInboxPolicyInput
  classification: CommentClassification
  humanQaReasons: string[]
  autoSend: CommentAutoSendDecision
  replyDraft: CommentReplyDraftPolicy
}): CommentWorkflowUpdateProposal {
  const { policyInput, classification, humanQaReasons, autoSend, replyDraft } = input
  const humanQaRequired = humanQaReasons.length > 0
  const replySubmissionState: SocialCommentReplySubmissionState = replyDraft.text ? 'draft' : 'not_applicable'
  const responseApprovalState: SocialCommentResponseApprovalState = humanQaRequired ? 'pending' : 'not_required'

  return {
    table: 'social_content_comments',
    commentId: policyInput.comment.id,
    providerCommentId: policyInput.comment.providerCommentId ?? null,
    workflowOwnedPatch: {
      classification_status: classificationStatusForComment(classification),
      classification_reason: buildClassificationReason(classification, humanQaReasons, autoSend),
      sentiment: sentimentForComment(classification),
      priority: priorityForComment(classification),
      response_approval_state: responseApprovalState,
      reply_submission_state: replySubmissionState,
      proposed_reply_text: replyDraft.text,
      approved_reply_text: null,
      reply_provider_comment_id: null,
      reply_submitted_at: null,
      metadata: {
        policy_decision: {
          classification,
          confidence: policyInput.confidence,
          human_qa_required: humanQaRequired,
          human_qa_reasons: humanQaReasons,
          auto_send: autoSend,
          provenance_summary: replyDraft.provenanceSummary,
          source_distance_note: replyDraft.sourceDistanceNote,
          provider_ingestion_enabled: false,
          reply_submission_enabled: false,
          external_actions_allowed: false,
        },
      },
    },
    providerOwnedFieldsNotMutated: [...COMMENT_PROVIDER_OWNED_FIELDS],
    providerIngestionBoundary: {
      ingestionEnabled: false,
      replySubmissionEnabled: false,
      externalActionsAllowed: false,
      note: 'Policy decisions may propose local workflow-owned fields only; provider ingestion and reply submission remain separate approval-gated lanes.',
    },
  }
}

export function buildCommentLeadWorkItemProposal(
  input: CommentInboxPolicyInput,
  decision?: Pick<CommentInboxPolicyDecision, 'classification' | 'replyDraft'>,
): CommentLeadWorkItemProposal | null {
  const classification = decision?.classification ?? inferClassification(input)
  if (classification !== 'buying_lead_intent') return null

  const comment = input.comment
  const authorLabel = comment.authorHandle || comment.authorId || 'unknown author'
  const platformLabel = comment.platform || comment.provider || 'comment channel'
  const sourceId = comment.providerCommentId || comment.id
  const replyText = decision?.replyDraft.text || defaultReplyText('buying_lead_intent')

  return {
    title: `Review buying-intent comment from ${authorLabel}`,
    objective: [
      `Assess the buying-intent comment on ${platformLabel}.`,
      'Prepare a human-approved follow-up path and keep any commercial details out of the public thread until reviewed.',
      `Draft public reply: ${replyText}`,
    ].join(' '),
    priority: 'high',
    status: 'proposed',
    ownerAgentKey: BEHANZIN_AGENT_KEY,
    ownerRuntime: 'n8n',
    source: {
      type: 'social_comment',
      id: sourceId,
      label: `${platformLabel} comment from ${authorLabel}`,
    },
    metadata: {
      comment_id: comment.id,
      provider_comment_id: comment.providerCommentId ?? null,
      platform: comment.platform ?? null,
      provider: comment.provider ?? null,
      thread_id: comment.threadId ?? null,
      author_id: comment.authorId ?? null,
      author_handle: comment.authorHandle ?? null,
      post_id: comment.postId ?? null,
      post_label: comment.postLabel ?? null,
      classification,
      public_reply_draft: replyText,
      outreach_auto_send_allowed: false,
      human_qa_required: true,
      provenance_summary: buildProvenanceSummary(input),
      source_distance_note: buildSourceDistanceNote(input),
      workflow_owned_fields_only: true,
      provider_ingestion_enabled: false,
      reply_submission_enabled: false,
      external_actions_allowed: false,
      provider_owned_fields_not_mutated: COMMENT_PROVIDER_OWNED_FIELDS,
    },
    idempotencyKey: `comment-lead:${sourceId}`,
  }
}

export function evaluateCommentInboxPolicy(input: CommentInboxPolicyInput): CommentInboxPolicyDecision {
  const classification = inferClassification(input)
  const replyDraft = buildReplyDraftPolicy(input, classification)
  const humanQaReasons = buildHumanQaReasons(input, classification)
  const autoSend = buildAutoSendDecision(input, classification, humanQaReasons)
  const workflowUpdateProposal = buildWorkflowUpdateProposal({
    policyInput: input,
    classification,
    humanQaReasons,
    autoSend,
    replyDraft,
  })
  const partialDecision = { classification, replyDraft }
  const leadWorkItemProposal = buildCommentLeadWorkItemProposal(input, partialDecision)

  return {
    classification,
    confidence: input.confidence,
    humanQaRequired: humanQaReasons.length > 0,
    humanQaReasons,
    autoSend,
    replyDraft,
    workflowUpdateProposal,
    leadWorkItemProposal,
  }
}
