import { createHash } from 'crypto'

export const WARM_OUTREACH_RESPONSE_CLASSES = [
  'interested',
  'question',
  'referral',
  'objection',
  'not_now',
  'unsubscribe_do_not_contact',
  'negative_sensitive',
  'ambiguous',
] as const

export type WarmOutreachResponseClass = (typeof WARM_OUTREACH_RESPONSE_CLASSES)[number]

export const WARM_OUTREACH_RESPONSE_CHANNELS = [
  'email',
  'linkedin',
  'facebook',
  'phone_contact',
] as const

export type WarmOutreachResponseChannel = (typeof WARM_OUTREACH_RESPONSE_CHANNELS)[number]
export type WarmOutreachContactCommunicationChannel =
  | 'email'
  | 'linkedin'
  | 'chat'
  | 'voice'

export type WarmOutreachResponseInput = {
  contactId: number
  contactName?: string | null
  channel: WarmOutreachResponseChannel
  responseText: string
  receivedAt?: string | null
  outreachQueueId?: string | null
  provider?: string | null
  providerThreadId?: string | null
  providerMessageId?: string | null
  messageKey?: string | null
  originalSubject?: string | null
  relationshipContext?: WarmOutreachResponseRelationshipContext | null
}

export type WarmOutreachResponseRelationshipContext = {
  relationshipBasis?: string | null
  openingAngle?: string | null
  suggestedNextStep?: string | null
  safeToMention?: string[]
  summarizeOnly?: string[]
  doNotMention?: string[]
  commonalities?: string[]
  riskFlags?: string[]
  warnings?: string[]
  blockers?: string[]
  readinessStatus?: string | null
}

type WarmOutreachApprovalGateState =
  | 'pending_human_reply_review'
  | 'blocked_next_touch_timing_review'
  | 'blocked_suppression_review'
  | 'blocked_negative_review'
  | 'blocked_uncertain_review'

export type WarmOutreachResponseLifecycleDecision = {
  responseClass: WarmOutreachResponseClass
  confidence: number
  humanQaRequired: true
  humanQaReasons: string[]
  interpretation: {
    capturedResponseSummary: string
    classificationLabel: string
    recommendedNextAction: {
      label: string
      description: string
      priority: 'low' | 'medium' | 'high' | 'urgent'
      requiresNextTouchDecision: boolean
    }
  }
  replyDraft: {
    subject: string
    body: string
    reviewerNotes: string[]
    approvalState: 'pending_human_qa'
    status: 'draft'
  }
  approvalGate: {
    state: WarmOutreachApprovalGateState
    label: string
    humanActionRequired: string
    recoveryPath: string
    blockedExternalActions: string[]
  }
  followUpTaskProposal: {
    title: string
    description: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    taskCategory: 'outreach'
    dueDate: string | null
    idempotencyKey: string
  } | null
  suppressionProposal: {
    action: 'mark_do_not_contact'
    state: 'pending_human_approval'
    reason: string
    requiresHumanApproval: true
    idempotencyKey: string
  } | null
  idempotency: {
    responseKey: string
    replyDraftKey: string
  }
  executionBoundary: {
    providerIngestionEnabled: false
    externalMonitoringEnabled: false
    replySubmissionEnabled: false
    externalSendEnabled: false
    gmailDraftCreationEnabled: false
    slackActionEnabled: false
    humanQaRequired: true
  }
  sourceUseBoundary: {
    portfolioLocalContextOnly: true
    privateEvidencePolicy: 'summarize_private_sources_do_not_quote_raw'
    safeToMention: string[]
    summarizeOnly: string[]
    doNotMention: string[]
  }
}

const INTERESTED_PATTERNS = [
  /\b(interested|sounds good|let'?s talk|book|schedule|demo|pricing|price|proposal|quote)\b/i,
  /\b(can you help|need help|work with you|worth discussing)\b/i,
]
const QUESTION_PATTERNS = [
  /\?/,
  /^\s*(how|what|why|when|where|can|could|would|should|do you)\b/i,
]
const REFERRAL_PATTERNS = [
  /\b(referral|refer|introduced?|intro|connect you|put you in touch|talk to my|colleague|partner)\b/i,
]
const OBJECTION_PATTERNS = [
  /\b(not a fit|too expensive|no budget|already have|we use|not interested|doesn'?t work|can't justify)\b/i,
]
const NOT_NOW_PATTERNS = [
  /\b(not now|later|next quarter|next month|circle back|follow up later|busy|after the holidays|in a few weeks)\b/i,
]
const UNSUBSCRIBE_PATTERNS = [
  /\b(unsubscribe|do not contact|don'?t contact|stop emailing|remove me|take me off|never contact)\b/i,
]
const NEGATIVE_OR_SENSITIVE_PATTERNS = [
  /\b(angry|upset|offensive|inappropriate|scam|spam|harassment|legal|lawyer|confidential|private|sensitive)\b/i,
]
function includesAny(text: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(text))
}

function compactText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function truncate(value: string, maxLength: number) {
  const text = compactText(value)
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3).trim()}...`
}

function shortHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function normalizeProviderPart(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || fallback
}

export function communicationChannelForWarmResponse(
  channel: WarmOutreachResponseChannel,
): WarmOutreachContactCommunicationChannel {
  if (channel === 'facebook') return 'chat'
  if (channel === 'phone_contact') return 'voice'
  return channel
}

export function buildWarmOutreachResponseIdempotencyKey(
  input: WarmOutreachResponseInput,
) {
  const provider = normalizeProviderPart(input.provider, 'manual')
  const providerThreadId = normalizeProviderPart(input.providerThreadId, 'manual-thread')
  const providerMessageId = normalizeProviderPart(input.providerMessageId, '')
  const messageKey = normalizeProviderPart(input.messageKey, '')

  if (providerMessageId) {
    return `warm-outreach:reply:${provider}:${providerThreadId}:${providerMessageId}`
  }

  const basis = [
    input.contactId,
    input.channel,
    input.outreachQueueId ?? 'no-queue',
    messageKey || compactText(input.responseText).toLowerCase(),
  ].join('|')

  return `warm-outreach:reply:manual:${shortHash(basis)}`
}

function classifyText(text: string): {
  responseClass: WarmOutreachResponseClass
  confidence: number
} {
  if (includesAny(text, UNSUBSCRIBE_PATTERNS)) {
    return { responseClass: 'unsubscribe_do_not_contact', confidence: 0.9 }
  }
  if (includesAny(text, NEGATIVE_OR_SENSITIVE_PATTERNS)) {
    return { responseClass: 'negative_sensitive', confidence: 0.82 }
  }
  if (includesAny(text, REFERRAL_PATTERNS)) {
    return { responseClass: 'referral', confidence: 0.78 }
  }
  if (includesAny(text, INTERESTED_PATTERNS)) {
    return { responseClass: 'interested', confidence: 0.8 }
  }
  if (includesAny(text, OBJECTION_PATTERNS)) {
    return { responseClass: 'objection', confidence: 0.75 }
  }
  if (includesAny(text, NOT_NOW_PATTERNS)) {
    return { responseClass: 'not_now', confidence: 0.72 }
  }
  if (includesAny(text, QUESTION_PATTERNS)) {
    return { responseClass: 'question', confidence: 0.72 }
  }
  return { responseClass: 'ambiguous', confidence: 0.45 }
}

function humanQaReasonsFor(responseClass: WarmOutreachResponseClass) {
  const reasons = new Set<string>(['warm_outreach_reply_requires_human_qa'])
  if (responseClass === 'interested') reasons.add('buying_or_sales_intent_review')
  if (responseClass === 'question') reasons.add('question_requires_contextual_answer_review')
  if (responseClass === 'referral') reasons.add('referral_path_requires_relationship_review')
  if (responseClass === 'objection') reasons.add('objection_response_requires_review')
  if (responseClass === 'not_now') reasons.add('next_touch_timing_requires_human_decision')
  if (responseClass === 'unsubscribe_do_not_contact') reasons.add('suppression_update_requires_human_approval')
  if (responseClass === 'negative_sensitive') reasons.add('negative_response_boundary')
  if (responseClass === 'ambiguous') reasons.add('low_confidence_classification')
  return [...reasons]
}

function contextAnchor(context: WarmOutreachResponseRelationshipContext | null | undefined) {
  const safe = context?.safeToMention?.find(Boolean)
  if (safe) return safe
  const commonality = context?.commonalities?.find(Boolean)
  if (commonality) return commonality
  const openingAngle = context?.openingAngle?.trim()
  if (openingAngle) return openingAngle
  const basis = context?.relationshipBasis?.trim()
  if (basis) return basis
  return null
}

function reviewerNotesFor(context: WarmOutreachResponseRelationshipContext | null | undefined) {
  const notes = [
    'Use Portfolio-local relationship context only; do not quote raw private source material.',
    ...(context?.summarizeOnly?.length
      ? [`Summarize only: ${context.summarizeOnly.slice(0, 3).join('; ')}.`]
      : []),
    ...(context?.doNotMention?.length
      ? [`Do not mention: ${context.doNotMention.slice(0, 3).join('; ')}.`]
      : []),
    ...(context?.riskFlags?.length
      ? [`Risk flags: ${context.riskFlags.slice(0, 3).join('; ')}.`]
      : []),
  ]
  return notes
}

function draftBodyFor(input: WarmOutreachResponseInput, responseClass: WarmOutreachResponseClass) {
  const name = input.contactName?.trim() || 'there'
  const anchor = contextAnchor(input.relationshipContext)
  const contextSentence = anchor
    ? `I am grounding this in the context around ${anchor}.`
    : 'I am grounding this in the relationship context already in Portfolio.'

  switch (responseClass) {
    case 'interested':
      return `Hi ${name},\n\nThanks for the reply. ${contextSentence}\n\nA useful next step may be a short review of what would help most from here. Would that be helpful this week?`
    case 'question':
      return `Hi ${name},\n\nGood question. ${contextSentence}\n\nI want to answer this with the right context instead of guessing from the thread. I can send the clearest answer after reviewing the notes tied to this relationship.`
    case 'referral':
      return `Hi ${name},\n\nThank you for the referral path. I appreciate you being thoughtful about the right connection.\n\nIf useful, I can send a short note that makes the context clear and keeps the ask modest.`
    case 'objection':
      return `Hi ${name},\n\nI appreciate the direct note. That context helps.\n\nNo pressure from my side. If there is a smaller angle worth clarifying, I can keep the follow-up focused there.`
    case 'not_now':
      return `Hi ${name},\n\nThat makes sense. I appreciate you letting me know.\n\nI can step back for now and reconnect only around the timing you are comfortable with.`
    case 'unsubscribe_do_not_contact':
      return `Hi ${name},\n\nUnderstood. I will mark this so you are not contacted again through this outreach path.`
    case 'negative_sensitive':
      return `Hi ${name},\n\nI hear the concern. I do not want to handle sensitive details casually or add pressure here.\n\nI will review the context before deciding whether any response is appropriate.`
    case 'ambiguous':
    default:
      return `Hi ${name},\n\nThanks for the reply. I want to make sure I understand the context correctly before responding.\n\nI will review the thread and relationship notes before deciding on the next step.`
  }
}

function taskPriorityFor(responseClass: WarmOutreachResponseClass) {
  if (responseClass === 'unsubscribe_do_not_contact' || responseClass === 'negative_sensitive') return 'urgent'
  if (responseClass === 'interested' || responseClass === 'referral') return 'high'
  return 'medium'
}

function followUpTitleFor(responseClass: WarmOutreachResponseClass, contactName: string) {
  switch (responseClass) {
    case 'interested':
      return `Review interested warm response from ${contactName}`
    case 'question':
      return `Answer warm outreach question from ${contactName}`
    case 'referral':
      return `Review warm referral path from ${contactName}`
    case 'objection':
      return `Review warm outreach objection from ${contactName}`
    case 'not_now':
      return `Set next-touch timing for ${contactName}`
    case 'negative_sensitive':
      return `Review sensitive warm response from ${contactName}`
    case 'ambiguous':
      return `Classify ambiguous warm response from ${contactName}`
    case 'unsubscribe_do_not_contact':
    default:
      return `Review do-not-contact request from ${contactName}`
  }
}

function dueDateFor(responseClass: WarmOutreachResponseClass, now = new Date()) {
  if (responseClass === 'unsubscribe_do_not_contact' || responseClass === 'negative_sensitive') {
    return now.toISOString().slice(0, 10)
  }
  if (responseClass === 'not_now') return null
  const due = new Date(now.getTime() + 2 * 24 * 60 * 60_000)
  return due.toISOString().slice(0, 10)
}

function responseClassLabel(responseClass: WarmOutreachResponseClass) {
  if (responseClass === 'unsubscribe_do_not_contact') return 'unsubscribe / do not contact'
  if (responseClass === 'negative_sensitive') return 'negative / sensitive'
  return responseClass.replace(/_/g, ' ')
}

function recommendedNextActionFor(
  responseClass: WarmOutreachResponseClass,
  context: WarmOutreachResponseRelationshipContext | null | undefined,
) {
  const suggested = context?.suggestedNextStep?.trim()
  switch (responseClass) {
    case 'interested':
      return {
        label: 'Review short next-step reply',
        description: suggested || 'Prepare a concise next-step reply grounded in the local relationship packet.',
        requiresNextTouchDecision: true,
      }
    case 'question':
      return {
        label: 'Answer with relationship context',
        description: 'Review the packet, answer only what is supported, and keep private evidence summarized.',
        requiresNextTouchDecision: true,
      }
    case 'objection':
      return {
        label: 'Decide whether a lower-pressure clarification helps',
        description: 'Review the objection and either approve a short clarification or stop the sequence.',
        requiresNextTouchDecision: true,
      }
    case 'not_now':
      return {
        label: 'Set next-touch timing',
        description: 'Choose whether to pause, schedule a later reminder, or suppress the outreach path.',
        requiresNextTouchDecision: true,
      }
    case 'unsubscribe_do_not_contact':
      return {
        label: 'Review suppression update',
        description: 'Confirm the unsubscribe or do-not-contact request before any further outreach is allowed.',
        requiresNextTouchDecision: false,
      }
    case 'referral':
      return {
        label: 'Review referral path',
        description: 'Prepare a modest referral note and verify what can be safely mentioned.',
        requiresNextTouchDecision: true,
      }
    case 'negative_sensitive':
      return {
        label: 'Stop and review negative or sensitive response',
        description: 'Do not reply or continue the sequence until a human reviews tone, risk, and suppression options.',
        requiresNextTouchDecision: false,
      }
    case 'ambiguous':
    default:
      return {
        label: 'Clarify classification before acting',
        description: 'Review the captured response and relationship context before drafting or scheduling anything.',
        requiresNextTouchDecision: true,
      }
  }
}

function approvalGateFor(
  responseClass: WarmOutreachResponseClass,
  context: WarmOutreachResponseRelationshipContext | null | undefined,
): WarmOutreachResponseLifecycleDecision['approvalGate'] {
  const hasSuppressionBlocker =
    context?.blockers?.some((blocker) => /do not contact|unsubscribed|removed|suppress/i.test(blocker)) ?? false
  const blockedExternalActions = [
    'outbound_message_send',
    'gmail_draft_creation',
    'linkedin_dm',
    'facebook_action',
    'phone_action',
    'slack_action',
    'n8n_dispatch',
    'provider_monitoring',
  ]

  if (responseClass === 'unsubscribe_do_not_contact' || hasSuppressionBlocker) {
    return {
      state: 'blocked_suppression_review',
      label: 'Blocked: suppression review required',
      humanActionRequired: 'Confirm suppression, mark do-not-contact if appropriate, and close or document any non-response.',
      recoveryPath: 'Open the relationship packet suppression state, confirm the local evidence, then approve suppression or explicitly clear the blocker before any next step.',
      blockedExternalActions,
    }
  }

  if (responseClass === 'negative_sensitive') {
    return {
      state: 'blocked_negative_review',
      label: 'Blocked: negative or sensitive response review required',
      humanActionRequired: 'Review tone, safety, and whether no response is the correct path.',
      recoveryPath: 'Document the decision in the contact workroom; approve a short repair note only if the relationship context supports it.',
      blockedExternalActions,
    }
  }

  if (responseClass === 'ambiguous') {
    return {
      state: 'blocked_uncertain_review',
      label: 'Blocked: classification uncertain',
      humanActionRequired: 'Clarify the reply intent before any draft or follow-up timing is approved.',
      recoveryPath: 'Re-read the captured response alongside the relationship packet, then reclassify or capture a clearer summary.',
      blockedExternalActions,
    }
  }

  if (responseClass === 'not_now') {
    return {
      state: 'blocked_next_touch_timing_review',
      label: 'Blocked: timing decision required',
      humanActionRequired: 'Choose pause, reminder date, or suppression before the sequence continues.',
      recoveryPath: 'Set a local next-touch task only after the contact-provided timing is reviewed.',
      blockedExternalActions,
    }
  }

  return {
    state: 'pending_human_reply_review',
    label: 'Pending: human reply approval',
    humanActionRequired: 'Review and edit the local reply draft before any outbound channel is used.',
    recoveryPath: 'Approve the local draft in the contact workroom, then use the separately approved outbound channel.',
    blockedExternalActions,
  }
}

export function buildWarmOutreachResponseLifecycleDecision(
  input: WarmOutreachResponseInput,
): WarmOutreachResponseLifecycleDecision {
  const text = compactText(input.responseText)
  const classification = classifyText(text)
  const contactName = input.contactName?.trim() || `contact ${input.contactId}`
  const responseKey = buildWarmOutreachResponseIdempotencyKey(input)
  const replyDraftKey = `warm-outreach:reply-draft:${shortHash(responseKey)}`
  const suppressionKey = `warm-outreach:suppression:${shortHash(responseKey)}`
  const taskKey = `warm-outreach:follow-up-task:${shortHash(responseKey)}`

  const recommendedNextAction = recommendedNextActionFor(
    classification.responseClass,
    input.relationshipContext,
  )
  const approvalGate = approvalGateFor(classification.responseClass, input.relationshipContext)
  const priority = taskPriorityFor(classification.responseClass) as 'low' | 'medium' | 'high' | 'urgent'
  const suppressionProposal =
    classification.responseClass === 'unsubscribe_do_not_contact'
      ? {
          action: 'mark_do_not_contact' as const,
          state: 'pending_human_approval' as const,
          reason: 'Captured response requested unsubscribe, removal, or no further contact.',
          requiresHumanApproval: true as const,
          idempotencyKey: suppressionKey,
        }
      : null

  const followUpTaskProposal = {
    title: followUpTitleFor(classification.responseClass, contactName),
    description: [
      `Captured ${responseClassLabel(classification.responseClass)} warm outreach response on ${input.channel}.`,
      `Recommended next action: ${recommendedNextAction.label}.`,
      `Approval gate: ${approvalGate.label}.`,
      `Human QA must approve the reply draft, next-touch decision, and any suppression change before external action.`,
      input.outreachQueueId ? `Linked outreach queue row: ${input.outreachQueueId}.` : null,
    ].filter(Boolean).join(' '),
    priority,
    taskCategory: 'outreach' as const,
    dueDate: dueDateFor(classification.responseClass),
    idempotencyKey: taskKey,
  }

  return {
    responseClass: classification.responseClass,
    confidence: classification.confidence,
    humanQaRequired: true,
    humanQaReasons: humanQaReasonsFor(classification.responseClass),
    interpretation: {
      capturedResponseSummary: truncate(text, 220),
      classificationLabel: responseClassLabel(classification.responseClass),
      recommendedNextAction: {
        ...recommendedNextAction,
        priority,
      },
    },
    replyDraft: {
      subject: `Draft reply: ${responseClassLabel(classification.responseClass)}`,
      body: draftBodyFor(input, classification.responseClass),
      reviewerNotes: reviewerNotesFor(input.relationshipContext),
      approvalState: 'pending_human_qa',
      status: 'draft',
    },
    approvalGate,
    followUpTaskProposal,
    suppressionProposal,
    idempotency: {
      responseKey,
      replyDraftKey,
    },
    executionBoundary: {
      providerIngestionEnabled: false,
      externalMonitoringEnabled: false,
      replySubmissionEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      slackActionEnabled: false,
      humanQaRequired: true,
    },
    sourceUseBoundary: {
      portfolioLocalContextOnly: true,
      privateEvidencePolicy: 'summarize_private_sources_do_not_quote_raw',
      safeToMention: input.relationshipContext?.safeToMention ?? [],
      summarizeOnly: input.relationshipContext?.summarizeOnly ?? [],
      doNotMention: input.relationshipContext?.doNotMention ?? [],
    },
  }
}
