import { createHash } from 'crypto'

export const WARM_OUTREACH_RESPONSE_CLASSES = [
  'interested',
  'question',
  'referral',
  'objection',
  'not_now',
  'unsubscribe_or_do_not_contact',
  'negative_or_sensitive',
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
  originalSubject?: string | null
}

export type WarmOutreachResponseLifecycleDecision = {
  responseClass: WarmOutreachResponseClass
  confidence: number
  humanQaRequired: true
  humanQaReasons: string[]
  replyDraft: {
    subject: string
    body: string
    approvalState: 'pending_human_qa'
    status: 'draft'
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

  if (providerMessageId) {
    return `warm-outreach:reply:${provider}:${providerThreadId}:${providerMessageId}`
  }

  const basis = [
    input.contactId,
    input.channel,
    input.outreachQueueId ?? 'no-queue',
    compactText(input.responseText).toLowerCase(),
  ].join('|')

  return `warm-outreach:reply:manual:${shortHash(basis)}`
}

function classifyText(text: string): {
  responseClass: WarmOutreachResponseClass
  confidence: number
} {
  if (includesAny(text, UNSUBSCRIBE_PATTERNS)) {
    return { responseClass: 'unsubscribe_or_do_not_contact', confidence: 0.9 }
  }
  if (includesAny(text, NEGATIVE_OR_SENSITIVE_PATTERNS)) {
    return { responseClass: 'negative_or_sensitive', confidence: 0.82 }
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
  if (responseClass === 'unsubscribe_or_do_not_contact') reasons.add('suppression_update_requires_human_approval')
  if (responseClass === 'negative_or_sensitive') reasons.add('negative_or_sensitive_response_boundary')
  if (responseClass === 'ambiguous') reasons.add('low_confidence_classification')
  return [...reasons]
}

function draftBodyFor(input: WarmOutreachResponseInput, responseClass: WarmOutreachResponseClass) {
  const name = input.contactName?.trim() || 'there'
  switch (responseClass) {
    case 'interested':
      return `Hi ${name},\n\nThanks for the reply. I can share the next practical step and keep this focused on what would be useful for you.\n\nWould a short review be helpful this week?`
    case 'question':
      return `Hi ${name},\n\nGood question. I want to answer it with the right context instead of guessing from the thread.\n\nI can send the clearest answer after reviewing the relationship packet and any prior notes.`
    case 'referral':
      return `Hi ${name},\n\nThank you for the referral path. I appreciate you being thoughtful about the right connection.\n\nIf it is useful, I can send a short note that makes the context clear and keeps the ask modest.`
    case 'objection':
      return `Hi ${name},\n\nI appreciate the direct note. That context helps.\n\nNo pressure from my side. If there is a smaller angle worth clarifying, I can keep the follow-up focused there.`
    case 'not_now':
      return `Hi ${name},\n\nThat makes sense. I appreciate you letting me know.\n\nI can step back for now and reconnect only around the timing you are comfortable with.`
    case 'unsubscribe_or_do_not_contact':
      return `Hi ${name},\n\nUnderstood. I will mark this so you are not contacted again through this outreach path.`
    case 'negative_or_sensitive':
      return `Hi ${name},\n\nI hear the concern. I do not want to handle sensitive details casually or add pressure here.\n\nI will review the context before deciding whether any response is appropriate.`
    case 'ambiguous':
    default:
      return `Hi ${name},\n\nThanks for the reply. I want to make sure I understand the context correctly before responding.\n\nI will review the thread and relationship notes before deciding on the next step.`
  }
}

function taskPriorityFor(responseClass: WarmOutreachResponseClass) {
  if (responseClass === 'unsubscribe_or_do_not_contact' || responseClass === 'negative_or_sensitive') return 'urgent'
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
    case 'negative_or_sensitive':
      return `Review sensitive warm response from ${contactName}`
    case 'ambiguous':
      return `Classify ambiguous warm response from ${contactName}`
    case 'unsubscribe_or_do_not_contact':
    default:
      return `Review do-not-contact request from ${contactName}`
  }
}

function dueDateFor(responseClass: WarmOutreachResponseClass, now = new Date()) {
  if (responseClass === 'unsubscribe_or_do_not_contact' || responseClass === 'negative_or_sensitive') {
    return now.toISOString().slice(0, 10)
  }
  if (responseClass === 'not_now') return null
  const due = new Date(now.getTime() + 2 * 24 * 60 * 60_000)
  return due.toISOString().slice(0, 10)
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

  const suppressionProposal =
    classification.responseClass === 'unsubscribe_or_do_not_contact'
      ? {
          action: 'mark_do_not_contact' as const,
          reason: 'Captured response requested unsubscribe, removal, or no further contact.',
          requiresHumanApproval: true as const,
          idempotencyKey: suppressionKey,
        }
      : null

  const followUpTaskProposal = {
    title: followUpTitleFor(classification.responseClass, contactName),
    description: [
      `Captured ${classification.responseClass.replace(/_/g, ' ')} warm outreach response on ${input.channel}.`,
      `Human QA must approve the reply draft, next-touch decision, and any suppression change before external action.`,
      input.outreachQueueId ? `Linked outreach queue row: ${input.outreachQueueId}.` : null,
    ].filter(Boolean).join(' '),
    priority: taskPriorityFor(classification.responseClass) as 'low' | 'medium' | 'high' | 'urgent',
    taskCategory: 'outreach' as const,
    dueDate: dueDateFor(classification.responseClass),
    idempotencyKey: taskKey,
  }

  return {
    responseClass: classification.responseClass,
    confidence: classification.confidence,
    humanQaRequired: true,
    humanQaReasons: humanQaReasonsFor(classification.responseClass),
    replyDraft: {
      subject: `Draft reply: ${classification.responseClass.replace(/_/g, ' ')}`,
      body: draftBodyFor(input, classification.responseClass),
      approvalState: 'pending_human_qa',
      status: 'draft',
    },
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
  }
}
