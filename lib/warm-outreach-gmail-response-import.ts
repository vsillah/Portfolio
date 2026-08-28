import { createHash } from 'crypto'

import {
  buildWarmOutreachResponseLifecycleDecision,
  buildWarmOutreachResponseIdempotencyKey,
  type WarmOutreachResponseLifecycleDecision,
} from './warm-outreach-response-lifecycle'

type PortfolioRow = Record<string, unknown>

export type WarmOutreachGmailReplyPayload = {
  provider: 'gmail'
  threadId?: string | null
  messageId?: string | null
  historyId?: string | null
  from?: string | null
  to?: string[] | string | null
  cc?: string[] | string | null
  subject?: string | null
  text?: string | null
  snippet?: string | null
  receivedAt?: string | null
  sourceUrl?: string | null
  inReplyTo?: string | null
  references?: string[] | string | null
  queueId?: string | null
  contactId?: number | string | null
}

export type WarmOutreachGmailImportPortfolioRows = {
  contacts?: PortfolioRow[]
  outreachQueue?: PortfolioRow[]
  contactCommunications?: PortfolioRow[]
  emailMessages?: PortfolioRow[]
  actionTasks?: PortfolioRow[]
}

export type WarmOutreachGmailImportCandidateStatus =
  | 'ready_for_review'
  | 'duplicate_replay'
  | 'unmatched_manual_review'
  | 'ambiguous_manual_review'
  | 'blocked_suppressed'
  | 'blocked_existing_response'
  | 'provider_disabled'

export type WarmOutreachGmailResponseImportCandidate = {
  provider: 'gmail'
  status: WarmOutreachGmailImportCandidateStatus
  statusLabel: string
  confidence: 'none' | 'low' | 'medium' | 'high'
  confidenceScore: number
  matchedContactId: number | null
  matchedContactName: string | null
  matchedOutreachQueueId: string | null
  normalizedRecipient: string | null
  subjectFingerprint: string | null
  providerThreadId: string | null
  providerMessageId: string | null
  duplicateKeys: string[]
  matchSignals: string[]
  blockers: string[]
  nextAction: string
  recoveryPath: string
  captureRequest: {
    contactId: number
    channel: 'email'
    sourceType: 'gmail'
    provider: 'gmail'
    responseText: string
    receivedAt: string | null
    outreachQueueId: string | null
    providerThreadId: string | null
    providerMessageId: string | null
    messageKey: string
    originalSubject: string | null
    sourceUrl: string | null
  } | null
  localEvidence: {
    table: 'contact_communications'
    sourceSystem: 'manual'
    sourceId: string
    lifecycle: 'warm_outreach_response'
    provider: 'gmail'
    providerThreadId: string | null
    providerMessageId: string | null
    matchStatus: WarmOutreachGmailImportCandidateStatus
    responseClass: WarmOutreachResponseLifecycleDecision['responseClass']
    approvalGate: WarmOutreachResponseLifecycleDecision['approvalGate']
    externalActionsEnabled: false
  } | null
  decision: WarmOutreachResponseLifecycleDecision | null
}

export type WarmOutreachGmailResponseImportPlan = {
  version: 'warm-outreach-gmail-response-import/v1'
  provider: 'gmail'
  dryRun: true
  dryRunImportEnabled: boolean
  liveProviderImportEnabled: false
  providerPollingEnabled: false
  gmailApiCalled: false
  externalActionsEnabled: false
  gmailDraftCreationEnabled: false
  slackDispatchEnabled: false
  n8nDispatchEnabled: false
  state: 'dry_run_ready' | 'manual_review_required' | 'provider_disabled' | 'blocked'
  label: string
  candidates: WarmOutreachGmailResponseImportCandidate[]
  summary: {
    total: number
    readyForReview: number
    duplicateReplay: number
    unmatched: number
    ambiguous: number
    suppressed: number
    existingResponse: number
    providerDisabled: number
  }
  auditNotes: string[]
}

function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number.parseInt(text(value) ?? '', 10)
  return Number.isFinite(parsed) ? parsed : null
}

function record(value: unknown): PortfolioRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PortfolioRow
    : {}
}

function rows(value: PortfolioRow[] | undefined): PortfolioRow[] {
  return Array.isArray(value) ? value : []
}

function stableHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 20)
}

function normalizeEmail(value: unknown): string | null {
  const raw = Array.isArray(value) ? value.join(',') : text(value)
  if (!raw) return null
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0].toLowerCase() : null
}

function normalizeSubject(value: unknown): string | null {
  const subject = text(value)
  if (!subject) return null
  return subject
    .replace(/^\s*(re|fw|fwd)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function subjectFingerprint(value: unknown): string | null {
  const normalized = normalizeSubject(value)
  return normalized ? stableHash(normalized) : null
}

function metadata(row: PortfolioRow): PortfolioRow {
  return record(row.metadata)
}

function generationInputs(row: PortfolioRow): PortfolioRow {
  return record(row.generation_inputs)
}

function nested(row: PortfolioRow, snakeKey: string, camelKey: string): PortfolioRow {
  return {
    ...record(generationInputs(row)[snakeKey]),
    ...record(generationInputs(row)[camelKey]),
    ...record(metadata(row)[snakeKey]),
    ...record(metadata(row)[camelKey]),
  }
}

function rowId(row: PortfolioRow): string | null {
  return text(row.id) ?? text(row.source_id)
}

function contactIdFor(row: PortfolioRow): number | null {
  return numberValue(row.contact_submission_id) ?? numberValue(row.contactId) ?? numberValue(row.contact_id)
}

function queueThreadId(row: PortfolioRow): string | null {
  const draft = nested(row, 'gmail_draft_creation', 'gmailDraftCreation')
  return text(row.thread_id) ?? text(row.threadId) ?? text(draft.thread_id) ?? text(draft.threadId)
}

function queueMessageId(row: PortfolioRow): string | null {
  const draft = nested(row, 'gmail_draft_creation', 'gmailDraftCreation')
  return text(row.message_id) ?? text(row.messageId) ?? text(draft.message_id) ?? text(draft.messageId)
}

function rowProviderMessageId(row: PortfolioRow): string | null {
  const rowMetadata = metadata(row)
  const provenance = record(rowMetadata.source_provenance)
  return (
    text(row.provider_message_id) ??
    text(row.providerMessageId) ??
    text(rowMetadata.provider_message_id) ??
    text(rowMetadata.providerMessageId) ??
    text(provenance.provider_message_id) ??
    text(provenance.providerMessageId)
  )
}

function rowProviderThreadId(row: PortfolioRow): string | null {
  const rowMetadata = metadata(row)
  const provenance = record(rowMetadata.source_provenance)
  return (
    text(row.provider_thread_id) ??
    text(row.providerThreadId) ??
    text(row.thread_id) ??
    text(row.threadId) ??
    text(rowMetadata.provider_thread_id) ??
    text(rowMetadata.providerThreadId) ??
    text(provenance.provider_thread_id) ??
    text(provenance.providerThreadId)
  )
}

function rowSourceId(row: PortfolioRow): string | null {
  return text(row.source_id) ?? text(metadata(row).source_id)
}

function isExistingWarmResponse(row: PortfolioRow): boolean {
  const rowMetadata = metadata(row)
  const sourceId = rowSourceId(row)
  const messageType = text(row.message_type)?.toLowerCase() ?? text(row.email_kind)?.toLowerCase()
  return (
    rowMetadata.lifecycle === 'warm_outreach_response' ||
    Boolean(sourceId?.startsWith('warm-outreach:reply:')) ||
    messageType === 'reply' ||
    text(row.status)?.toLowerCase() === 'replied'
  )
}

function contactSuppressed(contact: PortfolioRow | undefined): string | null {
  if (!contact) return null
  if (contact.do_not_contact === true || contact.doNotContact === true) {
    return 'Contact is marked do not contact in Portfolio.'
  }
  if (text(contact.removed_at) || text(contact.removedAt)) return 'Contact was removed from outreach.'
  const status = text(contact.outreach_status)?.toLowerCase() ?? text(contact.status)?.toLowerCase()
  if (status === 'unsubscribed' || status === 'suppressed' || status === 'opted_out') {
    return 'Contact has a suppressed outreach status in Portfolio.'
  }
  return null
}

function confidenceFor(score: number): WarmOutreachGmailResponseImportCandidate['confidence'] {
  if (score >= 85) return 'high'
  if (score >= 55) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

function payloadText(reply: WarmOutreachGmailReplyPayload) {
  return text(reply.text) ?? text(reply.snippet) ?? ''
}

function payloadReceivedAt(reply: WarmOutreachGmailReplyPayload): string | null {
  const value = text(reply.receivedAt)
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function messageKeyFor(reply: WarmOutreachGmailReplyPayload) {
  return [
    'gmail',
    text(reply.threadId) ?? 'no-thread',
    text(reply.messageId) ?? 'no-message',
    stableHash({
      from: normalizeEmail(reply.from),
      subject: normalizeSubject(reply.subject),
      body: payloadText(reply).slice(0, 500),
      receivedAt: payloadReceivedAt(reply),
    }),
  ].join(':')
}

function sourceUrlFor(reply: WarmOutreachGmailReplyPayload) {
  return text(reply.sourceUrl) ??
    (text(reply.threadId) ? `https://mail.google.com/mail/u/0/#inbox/${text(reply.threadId)}` : null)
}

function scoreQueueMatch(reply: WarmOutreachGmailReplyPayload, queue: PortfolioRow, contact: PortfolioRow | undefined) {
  const signals: string[] = []
  let score = 0
  const replyThreadId = text(reply.threadId)
  const replyMessageId = text(reply.messageId)
  const replyQueueId = text(reply.queueId)
  const replyContactId = numberValue(reply.contactId)
  const replyRecipient = normalizeEmail(reply.from)
  const queueId = rowId(queue)
  const queueContactId = contactIdFor(queue)
  const queueSubjectFingerprint = subjectFingerprint(queue.subject)
  const replySubjectFingerprint = subjectFingerprint(reply.subject)

  if (replyQueueId && queueId && replyQueueId === queueId) {
    score += 90
    signals.push('queue_id')
  }
  if (replyContactId && queueContactId && replyContactId === queueContactId) {
    score += 35
    signals.push('contact_id')
  }
  if (replyThreadId && queueThreadId(queue) === replyThreadId) {
    score += 55
    signals.push('gmail_thread_id')
  }
  if (replyMessageId && queueMessageId(queue) === replyMessageId) {
    score += 18
    signals.push('gmail_message_id')
  }
  if (replyRecipient && normalizeEmail(contact?.email) === replyRecipient) {
    score += 30
    signals.push('normalized_recipient')
  }
  if (replySubjectFingerprint && queueSubjectFingerprint && replySubjectFingerprint === queueSubjectFingerprint) {
    score += 15
    signals.push('subject_fingerprint')
  }

  return { score, signals }
}

function statusLabel(status: WarmOutreachGmailImportCandidateStatus) {
  switch (status) {
    case 'ready_for_review':
      return 'Ready for human review'
    case 'duplicate_replay':
      return 'Duplicate replay blocked'
    case 'unmatched_manual_review':
      return 'Unmatched reply needs manual recovery'
    case 'ambiguous_manual_review':
      return 'Ambiguous match needs human review'
    case 'blocked_suppressed':
      return 'Suppressed contact blocked'
    case 'blocked_existing_response':
      return 'Existing response already recorded'
    case 'provider_disabled':
    default:
      return 'Provider import disabled'
  }
}

function nextActionFor(status: WarmOutreachGmailImportCandidateStatus) {
  switch (status) {
    case 'ready_for_review':
      return 'Review and import the local response evidence through the existing warm response lifecycle.'
    case 'duplicate_replay':
      return 'Reuse the existing response evidence; do not create another reply draft or follow-up task.'
    case 'unmatched_manual_review':
      return 'Open the contact workroom, find the right queue/contact manually, then rerun with a queue id or contact id.'
    case 'ambiguous_manual_review':
      return 'Choose the correct contact and queue row before importing this reply.'
    case 'blocked_suppressed':
      return 'Review suppression evidence before recording any next-touch task.'
    case 'blocked_existing_response':
      return 'Open the existing response and repair only missing local draft/task evidence if needed.'
    case 'provider_disabled':
    default:
      return 'Enable only the dry-run import planner for QA; live Gmail polling remains blocked.'
  }
}

function recoveryPathFor(status: WarmOutreachGmailImportCandidateStatus) {
  switch (status) {
    case 'ready_for_review':
      return 'Use the existing contact response capture path; external send, Gmail drafts, Slack, and n8n stay off.'
    case 'duplicate_replay':
      return 'Compare provider thread/message id, queue id, contact id, and response key against existing Portfolio evidence.'
    case 'unmatched_manual_review':
      return 'Add a durable queue id, Gmail thread id, message id, or normalized recipient match before import.'
    case 'ambiguous_manual_review':
      return 'Resolve the candidate in the contact workroom; do not auto-select between multiple warm queue rows.'
    case 'blocked_suppressed':
      return 'Confirm DNC/unsubscribe/removed state, then approve suppression or explicitly clear the blocker.'
    case 'blocked_existing_response':
      return 'Treat this as already replied; do not create duplicate response evidence.'
    case 'provider_disabled':
    default:
      return 'Keep the provider import disabled until a future explicit Gmail import activation gate.'
  }
}

export function planWarmOutreachGmailResponseImport(args: {
  replies: WarmOutreachGmailReplyPayload[]
  rows: WarmOutreachGmailImportPortfolioRows
  dryRunImportEnabled?: boolean
}): WarmOutreachGmailResponseImportPlan {
  const dryRunImportEnabled = args.dryRunImportEnabled !== false
  const contacts = rows(args.rows.contacts)
  const queues = rows(args.rows.outreachQueue).filter((row) => {
    const channel = text(row.channel)?.toLowerCase()
    return !channel || channel === 'email'
  })
  const responseRows = [
    ...rows(args.rows.contactCommunications),
    ...rows(args.rows.emailMessages),
  ].filter(isExistingWarmResponse)

  const candidates = args.replies.map((reply): WarmOutreachGmailResponseImportCandidate => {
    const providerThreadId = text(reply.threadId)
    const providerMessageId = text(reply.messageId)
    const normalizedRecipient = normalizeEmail(reply.from)
    const subjectHash = subjectFingerprint(reply.subject)
    const responseText = payloadText(reply)
    const duplicateKey = buildWarmOutreachResponseIdempotencyKey({
      contactId: numberValue(reply.contactId) ?? 0,
      channel: 'email',
      responseText,
      provider: 'gmail',
      sourceType: 'gmail',
      providerThreadId,
      providerMessageId,
      messageKey: messageKeyFor(reply),
    })

    if (!dryRunImportEnabled) {
      return {
        provider: 'gmail',
        status: 'provider_disabled',
        statusLabel: statusLabel('provider_disabled'),
        confidence: 'none',
        confidenceScore: 0,
        matchedContactId: null,
        matchedContactName: null,
        matchedOutreachQueueId: null,
        normalizedRecipient,
        subjectFingerprint: subjectHash,
        providerThreadId,
        providerMessageId,
        duplicateKeys: [duplicateKey],
        matchSignals: [],
        blockers: ['Gmail response import planner is disabled for this request.'],
        nextAction: nextActionFor('provider_disabled'),
        recoveryPath: recoveryPathFor('provider_disabled'),
        captureRequest: null,
        localEvidence: null,
        decision: null,
      }
    }

    const scored = queues
      .map((queue) => {
        const contact = contacts.find((item) => numberValue(item.id) === contactIdFor(queue))
        const match = scoreQueueMatch(reply, queue, contact)
        return { queue, contact, ...match }
      })
      .filter((item) => item.score >= 50)
      .sort((a, b) => b.score - a.score)
    const top = scored[0]
    const ambiguous =
      scored.length > 1 &&
      top &&
      scored[1].score >= Math.max(50, top.score - 15)
    const matchedQueue = ambiguous ? null : top?.queue ?? null
    const matchedContact = ambiguous
      ? null
      : top?.contact ?? contacts.find((contact) => {
          const explicitContactId = numberValue(reply.contactId)
          return (
            (explicitContactId && numberValue(contact.id) === explicitContactId) ||
            normalizeEmail(contact.email) === normalizedRecipient
          )
        }) ?? null
    const matchedContactId = matchedContact ? numberValue(matchedContact.id) : null
    const matchedQueueId = matchedQueue ? rowId(matchedQueue) : null
    const matchSignals = ambiguous
      ? [...new Set(scored.flatMap((item) => item.signals))]
      : top?.signals ?? (matchedContact ? ['normalized_recipient'] : [])
    const confidenceScore = ambiguous ? top?.score ?? 0 : top?.score ?? (matchedContact ? 50 : 0)
    const suppressionReason = contactSuppressed(matchedContact ?? undefined)
    const existingKeys = responseRows
      .filter((row) => {
        const rowContactId = contactIdFor(row)
        const source = rowSourceId(row)
        return (
          (providerMessageId && rowProviderMessageId(row) === providerMessageId) ||
          (providerThreadId && rowProviderThreadId(row) === providerThreadId && rowContactId === matchedContactId) ||
          Boolean(source && source === duplicateKey) ||
          Boolean(source && providerMessageId && source.includes(providerMessageId))
        )
      })
      .map((row) => rowSourceId(row) ?? rowId(row) ?? 'existing-response')
    const queueAlreadyReplied =
      matchedQueue &&
      (text(matchedQueue.status)?.toLowerCase() === 'replied' ||
        Boolean(text(matchedQueue.replied_at)) ||
        Boolean(text(matchedQueue.reply_content)))
    const status: WarmOutreachGmailImportCandidateStatus =
      existingKeys.length > 0
        ? 'duplicate_replay'
        : ambiguous
          ? 'ambiguous_manual_review'
          : !matchedContactId
            ? 'unmatched_manual_review'
            : suppressionReason
              ? 'blocked_suppressed'
              : queueAlreadyReplied
                ? 'blocked_existing_response'
                : 'ready_for_review'
    const blockers = [
      status === 'unmatched_manual_review' ? 'No durable Portfolio contact or queue match was found.' : null,
      status === 'ambiguous_manual_review' ? 'Multiple warm outreach queue rows match this Gmail reply.' : null,
      suppressionReason,
      status === 'blocked_existing_response' ? 'Matched queue already has replied evidence.' : null,
      status === 'duplicate_replay' ? 'Existing Gmail response evidence already matches this provider message.' : null,
    ].filter(Boolean) as string[]
    const captureRequest =
      matchedContactId && responseText && status === 'ready_for_review'
        ? {
            contactId: matchedContactId,
            channel: 'email' as const,
            sourceType: 'gmail' as const,
            provider: 'gmail' as const,
            responseText,
            receivedAt: payloadReceivedAt(reply),
            outreachQueueId: matchedQueueId,
            providerThreadId,
            providerMessageId,
            messageKey: messageKeyFor(reply),
            originalSubject: text(reply.subject) ?? text(matchedQueue?.subject),
            sourceUrl: sourceUrlFor(reply),
          }
        : null
    const decision = captureRequest
      ? buildWarmOutreachResponseLifecycleDecision({
          ...captureRequest,
          contactName: text(matchedContact?.name),
          relationshipContext: {
            relationshipBasis: text(matchedContact?.warm_source_detail) ??
              text(matchedContact?.relationship_strength) ??
              'Matched from local Portfolio Gmail reply import readiness.',
            suggestedNextStep: 'Review imported Gmail reply evidence in the contact workroom.',
            blockers,
          },
        })
      : null
    const sourceId = decision?.idempotency.responseKey ?? duplicateKey

    return {
      provider: 'gmail',
      status,
      statusLabel: statusLabel(status),
      confidence: confidenceFor(confidenceScore),
      confidenceScore,
      matchedContactId,
      matchedContactName: text(matchedContact?.name),
      matchedOutreachQueueId: matchedQueueId,
      normalizedRecipient,
      subjectFingerprint: subjectHash,
      providerThreadId,
      providerMessageId,
      duplicateKeys: [...new Set([sourceId, ...existingKeys])],
      matchSignals,
      blockers,
      nextAction: nextActionFor(status),
      recoveryPath: recoveryPathFor(status),
      captureRequest,
      localEvidence: decision
        ? {
            table: 'contact_communications',
            sourceSystem: 'manual',
            sourceId,
            lifecycle: 'warm_outreach_response',
            provider: 'gmail',
            providerThreadId,
            providerMessageId,
            matchStatus: status,
            responseClass: decision.responseClass,
            approvalGate: decision.approvalGate,
            externalActionsEnabled: false,
          }
        : null,
      decision,
    }
  })

  const summary = {
    total: candidates.length,
    readyForReview: candidates.filter((candidate) => candidate.status === 'ready_for_review').length,
    duplicateReplay: candidates.filter((candidate) => candidate.status === 'duplicate_replay').length,
    unmatched: candidates.filter((candidate) => candidate.status === 'unmatched_manual_review').length,
    ambiguous: candidates.filter((candidate) => candidate.status === 'ambiguous_manual_review').length,
    suppressed: candidates.filter((candidate) => candidate.status === 'blocked_suppressed').length,
    existingResponse: candidates.filter((candidate) => candidate.status === 'blocked_existing_response').length,
    providerDisabled: candidates.filter((candidate) => candidate.status === 'provider_disabled').length,
  }
  const state: WarmOutreachGmailResponseImportPlan['state'] =
    !dryRunImportEnabled
      ? 'provider_disabled'
      : summary.readyForReview > 0
        ? 'dry_run_ready'
        : summary.total === 0
          ? 'blocked'
          : 'manual_review_required'

  return {
    version: 'warm-outreach-gmail-response-import/v1',
    provider: 'gmail',
    dryRun: true,
    dryRunImportEnabled,
    liveProviderImportEnabled: false,
    providerPollingEnabled: false,
    gmailApiCalled: false,
    externalActionsEnabled: false,
    gmailDraftCreationEnabled: false,
    slackDispatchEnabled: false,
    n8nDispatchEnabled: false,
    state,
    label:
      state === 'dry_run_ready'
        ? 'Gmail response import dry-run ready'
        : state === 'provider_disabled'
          ? 'Gmail response import disabled'
          : state === 'blocked'
            ? 'Gmail response import has no payloads'
            : 'Gmail response import needs human review',
    candidates,
    summary,
    auditNotes: [
      'This planner accepts mocked Gmail reply payloads and local Portfolio rows only.',
      'No Gmail API, Gmail draft, Gmail send, Slack dispatch, n8n dispatch, or provider polling is performed.',
      'Ready candidates must still flow through the existing warm response lifecycle and human QA gate.',
    ],
  }
}
