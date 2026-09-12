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

export type WarmOutreachGmailResponseImportCanaryState =
  | 'not_connected'
  | 'disabled'
  | 'ready_for_dry_run'
  | 'live_read_approval_required'
  | 'imported_response_found'
  | 'no_response_found'
  | 'duplicate_deduped'
  | 'error_retry'

export type WarmOutreachGmailResponseImportDecisionState =
  | 'dry_run_only'
  | 'provider_read_approval_required'
  | 'candidate_ready_for_import'
  | 'duplicate_blocked'
  | 'no_response_found'
  | 'error_retry'
  | 'blocked'

export const WARM_OUTREACH_GMAIL_RESPONSE_IMPORT_REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
] as const

export type WarmOutreachGmailResponseImportActivationState =
  | 'ready_for_mock_import'
  | 'live_import_disabled'
  | 'provider_disabled'
  | 'provider_missing'
  | 'missing_gmail_token'
  | 'missing_gmail_scope'
  | 'blocked_manual_recovery'

export type WarmOutreachGmailResponseImportActivationInput = {
  dryRunImportEnabled?: boolean
  providerDisabled?: boolean
  providerConfigured?: boolean
  gmailTokenAvailable?: boolean
  grantedScopes?: string[] | string | null
  requiredScopes?: string[]
  liveImportRequested?: boolean
  manualRecoveryRequired?: boolean
  manualRecoveryReasons?: string[]
}

export type WarmOutreachGmailResponseImportActivationReadiness = {
  version: 'warm-outreach-gmail-response-import-activation/v1'
  provider: 'gmail'
  state: WarmOutreachGmailResponseImportActivationState
  label: string
  canRunMockImport: boolean
  canRunLiveImport: false
  dryRunImportEnabled: boolean
  liveProviderImportEnabled: false
  providerPollingEnabled: false
  gmailApiCalled: false
  databaseWritesEnabled: false
  providerConfigured: boolean | null
  gmailTokenAvailable: boolean | null
  requiredScopes: string[]
  grantedScopes: string[]
  missingScopes: string[]
  blockedReasons: string[]
  nextOperatorAction: string
  recoveryPath: string
  futureLiveSwitch: {
    key: 'ENABLE_WARM_GMAIL_RESPONSE_IMPORT'
    enabled: false
    detail: string
  }
  gateRows: Array<{
    key:
      | 'mock_import'
      | 'live_import'
      | 'provider_config'
      | 'gmail_token'
      | 'gmail_scope'
      | 'manual_recovery'
    label: string
    state: 'ready' | 'disabled' | 'missing' | 'blocked' | 'not_checked'
    detail: string
    nextAction: string
  }>
}

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
  activationReadiness: WarmOutreachGmailResponseImportActivationReadiness
  canaryReadiness: WarmOutreachGmailResponseImportCanaryReadiness
  auditNotes: string[]
}

export type WarmOutreachGmailResponseImportCanaryReadiness = {
  version: 'warm-outreach-gmail-response-import-canary-readiness/v1'
  provider: 'gmail'
  state: WarmOutreachGmailResponseImportCanaryState
  label: string
  detail: string
  canRunDryRun: boolean
  liveReadApprovalRequired: boolean
  liveReadApproved: false
  liveProviderImportEnabled: false
  providerPollingEnabled: false
  gmailApiCalled: false
  databaseWritesEnabled: false
  externalActionsEnabled: false
  gmailDraftCreationEnabled: false
  gmailSendEnabled: false
  slackDispatchEnabled: false
  n8nDispatchEnabled: false
  responseDraftCreated: false
  retryAvailable: boolean
  latestOutcome: {
    status:
      | 'not_checked'
      | 'mock_response_found'
      | 'no_response_found'
      | 'duplicate_deduped'
      | 'error'
      | 'blocked'
    detail: string
  }
  provenance: {
    version: 'warm-outreach-gmail-response-import-provenance/v1'
    importRunId: string
    queueId: string | null
    contactId: number | null
    gmailThreadId: string | null
    gmailMessageId: string | null
    importRunTimestamp: string | null
    actor: string
    decisionState: WarmOutreachGmailResponseImportDecisionState
    dedupeKey: string
  }
  gates: Array<{
    key:
      | 'dry_run_fixture'
      | 'one_recipient_scope'
      | 'live_gmail_read_approval'
      | 'dedupe'
      | 'response_lifecycle'
      | 'reply_send_boundary'
    label: string
    state: 'ready' | 'required' | 'blocked' | 'disabled' | 'passed'
    detail: string
  }>
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

function scopeList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean) as string[]
  }
  const raw = text(value)
  return raw ? raw.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean) : []
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

function activationLabel(state: WarmOutreachGmailResponseImportActivationState) {
  switch (state) {
    case 'ready_for_mock_import':
      return 'Ready for mock import'
    case 'live_import_disabled':
      return 'Live import disabled'
    case 'provider_disabled':
      return 'Provider disabled'
    case 'provider_missing':
      return 'Gmail provider missing'
    case 'missing_gmail_token':
      return 'Gmail token missing'
    case 'missing_gmail_scope':
      return 'Gmail read scope missing'
    case 'blocked_manual_recovery':
    default:
      return 'Blocked for manual recovery'
  }
}

function activationNextAction(state: WarmOutreachGmailResponseImportActivationState) {
  switch (state) {
    case 'ready_for_mock_import':
      return 'Run the dry-run route with mocked Gmail replies and local Portfolio rows.'
    case 'live_import_disabled':
      return 'Use mocked dry-run planning only; live Gmail reads require a future captain-authorized activation switch.'
    case 'provider_disabled':
      return 'Leave Gmail response import disabled and use manual Portfolio response capture.'
    case 'provider_missing':
      return 'Configure the Gmail response-import provider before any future live-read smoke.'
    case 'missing_gmail_token':
      return 'Reconnect Gmail from Admin Credentials before any future live-read smoke.'
    case 'missing_gmail_scope':
      return 'Reconnect Gmail with gmail.readonly before any future response polling/import activation.'
    case 'blocked_manual_recovery':
    default:
      return 'Resolve duplicate, ambiguous, suppressed, or existing-evidence states in Portfolio before import.'
  }
}

function activationRecoveryPath(state: WarmOutreachGmailResponseImportActivationState) {
  switch (state) {
    case 'ready_for_mock_import':
      return 'Mock planning can run now; approved evidence still goes through the existing warm response lifecycle.'
    case 'live_import_disabled':
      return 'Keep the provider-read path off; review mock candidates and request a separate captain gate for any live Gmail read.'
    case 'provider_disabled':
      return 'Do not poll Gmail; capture responses manually in the contact workroom.'
    case 'provider_missing':
      return 'Add provider configuration evidence without enabling polling or importing live messages.'
    case 'missing_gmail_token':
      return 'Use the existing Admin -> Credentials Gmail profile flow; stop at OAuth, SSO, OTP, or account gates.'
    case 'missing_gmail_scope':
      return 'Confirm the stored OAuth scope includes the readonly Gmail scope before any future provider read.'
    case 'blocked_manual_recovery':
    default:
      return 'Open the relationship packet and repair the local match/evidence state before any import attempt.'
  }
}

export function buildWarmOutreachGmailResponseImportActivationReadiness(
  input: WarmOutreachGmailResponseImportActivationInput = {},
): WarmOutreachGmailResponseImportActivationReadiness {
  const dryRunImportEnabled = input.dryRunImportEnabled !== false
  const requiredScopes = input.requiredScopes?.length
    ? input.requiredScopes
    : [...WARM_OUTREACH_GMAIL_RESPONSE_IMPORT_REQUIRED_SCOPES]
  const grantedScopes = scopeList(input.grantedScopes)
  const grantedScopeSet = new Set(grantedScopes)
  const missingScopes = requiredScopes.filter((scope) => !grantedScopeSet.has(scope))
  const providerConfiguredKnown = typeof input.providerConfigured === 'boolean'
  const tokenKnown = typeof input.gmailTokenAvailable === 'boolean'
  const scopeKnown = input.grantedScopes !== undefined
  const manualRecoveryReasons = input.manualRecoveryReasons?.filter(Boolean) ?? []

  const state: WarmOutreachGmailResponseImportActivationState =
    input.providerDisabled || !dryRunImportEnabled
      ? 'provider_disabled'
      : input.manualRecoveryRequired
        ? 'blocked_manual_recovery'
        : providerConfiguredKnown && !input.providerConfigured
          ? 'provider_missing'
          : tokenKnown && !input.gmailTokenAvailable
            ? 'missing_gmail_token'
            : scopeKnown && missingScopes.length > 0
              ? 'missing_gmail_scope'
              : input.liveImportRequested || providerConfiguredKnown || tokenKnown || scopeKnown
                ? 'live_import_disabled'
                : 'ready_for_mock_import'
  const canRunMockImport =
    dryRunImportEnabled &&
    state !== 'provider_disabled' &&
    state !== 'blocked_manual_recovery'
  const blockedReasons = [
    state === 'provider_disabled' ? 'Gmail response import provider is disabled.' : null,
    state === 'provider_missing' ? 'Gmail response import provider configuration is missing.' : null,
    state === 'missing_gmail_token' ? 'No connected Gmail token is available for this admin.' : null,
    state === 'missing_gmail_scope' ? `Stored Gmail OAuth scope is missing: ${missingScopes.join(', ')}.` : null,
    state === 'live_import_disabled' ? 'Live Gmail response reads are disabled by default.' : null,
    ...manualRecoveryReasons,
  ].filter(Boolean) as string[]
  const providerConfigState = providerConfiguredKnown
    ? input.providerConfigured ? 'ready' : 'missing'
    : 'not_checked'
  const gmailTokenState = tokenKnown
    ? input.gmailTokenAvailable ? 'ready' : 'missing'
    : 'not_checked'
  const gmailScopeState = scopeKnown
    ? missingScopes.length === 0 ? 'ready' : 'missing'
    : 'not_checked'

  return {
    version: 'warm-outreach-gmail-response-import-activation/v1',
    provider: 'gmail',
    state,
    label: activationLabel(state),
    canRunMockImport,
    canRunLiveImport: false,
    dryRunImportEnabled,
    liveProviderImportEnabled: false,
    providerPollingEnabled: false,
    gmailApiCalled: false,
    databaseWritesEnabled: false,
    providerConfigured: providerConfiguredKnown ? Boolean(input.providerConfigured) : null,
    gmailTokenAvailable: tokenKnown ? Boolean(input.gmailTokenAvailable) : null,
    requiredScopes,
    grantedScopes,
    missingScopes: scopeKnown ? missingScopes : [],
    blockedReasons,
    nextOperatorAction: activationNextAction(state),
    recoveryPath: activationRecoveryPath(state),
    futureLiveSwitch: {
      key: 'ENABLE_WARM_GMAIL_RESPONSE_IMPORT',
      enabled: false,
      detail:
        'Reserved for a future captain-authorized live Gmail read. This readiness layer never enables it.',
    },
    gateRows: [
      {
        key: 'mock_import',
        label: 'Mock import',
        state: canRunMockImport ? 'ready' : 'blocked',
        detail: canRunMockImport
          ? 'Dry-run planning can use mocked Gmail payloads and local Portfolio rows.'
          : 'Dry-run planning is blocked by provider or manual recovery state.',
        nextAction: canRunMockImport
          ? 'Run the admin dry-run route with fixture payloads.'
          : 'Resolve the blocker before dry-run planning.',
      },
      {
        key: 'live_import',
        label: 'Live import',
        state: 'disabled',
        detail: 'Gmail polling/import remains disabled in default tests, preview QA, and route rendering.',
        nextAction: 'Request a separate captain authorization before any live Gmail read is added.',
      },
      {
        key: 'provider_config',
        label: 'Provider',
        state: providerConfigState,
        detail: providerConfiguredKnown
          ? input.providerConfigured
            ? 'Gmail response-import provider configuration is present.'
            : 'Gmail response-import provider configuration is missing.'
          : 'Provider configuration was not checked for this no-egress dry-run request.',
        nextAction: providerConfiguredKnown && !input.providerConfigured
          ? 'Configure provider metadata before live-read smoke.'
          : 'Keep provider reads disabled.',
      },
      {
        key: 'gmail_token',
        label: 'Gmail token',
        state: gmailTokenState,
        detail: tokenKnown
          ? input.gmailTokenAvailable
            ? 'A connected Gmail token is present in readiness metadata.'
            : 'No connected Gmail token is present in readiness metadata.'
          : 'Token presence was not checked for this no-egress dry-run request.',
        nextAction: tokenKnown && !input.gmailTokenAvailable
          ? 'Reconnect Gmail from Admin Credentials.'
          : 'Do not read Gmail until a separate activation gate exists.',
      },
      {
        key: 'gmail_scope',
        label: 'Gmail scope',
        state: gmailScopeState,
        detail: scopeKnown
          ? missingScopes.length === 0
            ? 'Stored scope evidence includes gmail.readonly.'
            : `Missing scope evidence: ${missingScopes.join(', ')}.`
          : 'Scope evidence was not checked for this no-egress dry-run request.',
        nextAction: scopeKnown && missingScopes.length > 0
          ? 'Reconnect Gmail with readonly scope before live-read smoke.'
          : 'Keep mock planning separate from live provider authority.',
      },
      {
        key: 'manual_recovery',
        label: 'Manual recovery',
        state: input.manualRecoveryRequired ? 'blocked' : 'ready',
        detail: input.manualRecoveryRequired
          ? manualRecoveryReasons.join(' ') || 'The latest candidate needs manual recovery.'
          : 'No duplicate, ambiguous, suppressed, or existing-evidence blocker is active.',
        nextAction: input.manualRecoveryRequired
          ? 'Resolve the contact or queue evidence state in Portfolio.'
          : 'Review ready candidates through the existing warm response lifecycle.',
      },
    ],
  }
}

function canaryStateLabel(state: WarmOutreachGmailResponseImportCanaryState) {
  switch (state) {
    case 'not_connected':
      return 'Gmail response import not connected'
    case 'disabled':
      return 'Gmail response import disabled'
    case 'ready_for_dry_run':
      return 'Ready for dry-run response import'
    case 'live_read_approval_required':
      return 'Live Gmail read approval required'
    case 'imported_response_found':
      return 'Imported response found in dry-run'
    case 'no_response_found':
      return 'No Gmail response found'
    case 'duplicate_deduped':
      return 'Duplicate Gmail response deduped'
    case 'error_retry':
    default:
      return 'Gmail response import retry required'
  }
}

function canaryDecisionState(
  state: WarmOutreachGmailResponseImportCanaryState,
): WarmOutreachGmailResponseImportDecisionState {
  switch (state) {
    case 'live_read_approval_required':
      return 'provider_read_approval_required'
    case 'imported_response_found':
      return 'candidate_ready_for_import'
    case 'duplicate_deduped':
      return 'duplicate_blocked'
    case 'no_response_found':
      return 'no_response_found'
    case 'error_retry':
      return 'error_retry'
    case 'not_connected':
    case 'disabled':
      return 'blocked'
    case 'ready_for_dry_run':
    default:
      return 'dry_run_only'
  }
}

function canaryOutcome(
  state: WarmOutreachGmailResponseImportCanaryState,
  detail: string,
): WarmOutreachGmailResponseImportCanaryReadiness['latestOutcome'] {
  if (state === 'imported_response_found') return { status: 'mock_response_found', detail }
  if (state === 'no_response_found') return { status: 'no_response_found', detail }
  if (state === 'duplicate_deduped') return { status: 'duplicate_deduped', detail }
  if (state === 'error_retry') return { status: 'error', detail }
  if (state === 'not_connected' || state === 'disabled') return { status: 'blocked', detail }
  return { status: 'not_checked', detail }
}

function deriveCanaryState(args: {
  activationReadiness: WarmOutreachGmailResponseImportActivationReadiness
  candidates?: WarmOutreachGmailResponseImportCandidate[]
  hasDryRunPayload?: boolean
  dryRunImportEnabled?: boolean
  errorMessage?: string | null
  liveReadApprovalRequested?: boolean
  state?: WarmOutreachGmailResponseImportCanaryState
}): WarmOutreachGmailResponseImportCanaryState {
  if (args.state) return args.state
  if (text(args.errorMessage)) return 'error_retry'
  if (!args.dryRunImportEnabled) return 'disabled'
  if (
    args.activationReadiness.state === 'provider_missing' ||
    args.activationReadiness.state === 'missing_gmail_token' ||
    args.activationReadiness.state === 'missing_gmail_scope'
  ) {
    return 'not_connected'
  }
  if (args.activationReadiness.state === 'provider_disabled') return 'disabled'
  if (args.liveReadApprovalRequested || args.activationReadiness.state === 'live_import_disabled') {
    return 'live_read_approval_required'
  }

  const candidates = args.candidates ?? []
  if (args.hasDryRunPayload && candidates.length === 0) return 'no_response_found'
  if (
    candidates.some((candidate) =>
      candidate.status === 'duplicate_replay' ||
      candidate.status === 'blocked_existing_response'
    )
  ) {
    return 'duplicate_deduped'
  }
  if (candidates.some((candidate) => candidate.status === 'ready_for_review')) {
    return 'imported_response_found'
  }
  if (candidates.length > 0 && candidates.every((candidate) => candidate.status !== 'ready_for_review')) {
    return 'error_retry'
  }
  return 'ready_for_dry_run'
}

export function buildWarmOutreachGmailResponseImportCanaryReadiness(args: {
  activationReadiness?: WarmOutreachGmailResponseImportActivationReadiness
  candidates?: WarmOutreachGmailResponseImportCandidate[]
  contactId?: number | string | null
  queueId?: string | null
  gmailThreadId?: string | null
  gmailMessageId?: string | null
  dedupeKey?: string | null
  actor?: string | null
  observedAt?: string | null
  hasDryRunPayload?: boolean
  dryRunImportEnabled?: boolean
  errorMessage?: string | null
  liveReadApprovalRequested?: boolean
  state?: WarmOutreachGmailResponseImportCanaryState
} = {}): WarmOutreachGmailResponseImportCanaryReadiness {
  const activationReadiness =
    args.activationReadiness ?? buildWarmOutreachGmailResponseImportActivationReadiness()
  const firstCandidate = args.candidates?.[0]
  const queueId = text(args.queueId) ?? firstCandidate?.matchedOutreachQueueId ?? null
  const contactId = numberValue(args.contactId) ?? firstCandidate?.matchedContactId ?? null
  const gmailThreadId = text(args.gmailThreadId) ?? firstCandidate?.providerThreadId ?? null
  const gmailMessageId = text(args.gmailMessageId) ?? firstCandidate?.providerMessageId ?? null
  const dedupeKey =
    text(args.dedupeKey) ??
    firstCandidate?.duplicateKeys[0] ??
    `gmail-response-import:${stableHash({ queueId, contactId, gmailThreadId, gmailMessageId })}`
  const state = deriveCanaryState({
    activationReadiness,
    candidates: args.candidates,
    hasDryRunPayload: args.hasDryRunPayload,
    dryRunImportEnabled: args.dryRunImportEnabled !== false,
    errorMessage: args.errorMessage,
    liveReadApprovalRequested: args.liveReadApprovalRequested,
    state: args.state,
  })
  const decisionState = canaryDecisionState(state)
  const importRunId = `warm-outreach:gmail-response-import-canary:v1:${stableHash({
    state,
    queueId,
    contactId,
    gmailThreadId,
    gmailMessageId,
    dedupeKey,
  })}`
  const baseDetail =
    text(args.errorMessage) ??
    (state === 'imported_response_found'
      ? 'A mocked Gmail reply matched the warm outreach queue and is ready for local response lifecycle review.'
      : state === 'duplicate_deduped'
        ? 'A mocked Gmail reply matched existing response evidence and was blocked from replay.'
        : state === 'no_response_found'
          ? 'The dry-run completed with no mocked Gmail reply candidates.'
          : state === 'live_read_approval_required'
            ? 'Provider readiness is present, but a live Gmail read requires a separate explicit approval gate.'
            : state === 'not_connected'
              ? activationReadiness.blockedReasons[0] ?? 'Gmail provider readiness is incomplete.'
              : state === 'disabled'
                ? 'Gmail response import is disabled; use manual response capture or mock planning only.'
                : 'The operator can run the fixture-based dry-run planner without provider access.')

  return {
    version: 'warm-outreach-gmail-response-import-canary-readiness/v1',
    provider: 'gmail',
    state,
    label: canaryStateLabel(state),
    detail: baseDetail,
    canRunDryRun: activationReadiness.canRunMockImport && state !== 'disabled',
    liveReadApprovalRequired: true,
    liveReadApproved: false,
    liveProviderImportEnabled: false,
    providerPollingEnabled: false,
    gmailApiCalled: false,
    databaseWritesEnabled: false,
    externalActionsEnabled: false,
    gmailDraftCreationEnabled: false,
    gmailSendEnabled: false,
    slackDispatchEnabled: false,
    n8nDispatchEnabled: false,
    responseDraftCreated: false,
    retryAvailable: state === 'error_retry' || state === 'no_response_found',
    latestOutcome: canaryOutcome(state, baseDetail),
    provenance: {
      version: 'warm-outreach-gmail-response-import-provenance/v1',
      importRunId,
      queueId,
      contactId,
      gmailThreadId,
      gmailMessageId,
      importRunTimestamp: text(args.observedAt),
      actor: text(args.actor) ?? 'portfolio_operator',
      decisionState,
      dedupeKey,
    },
    gates: [
      {
        key: 'dry_run_fixture',
        label: 'Dry-run fixture',
        state: state === 'disabled' ? 'blocked' : 'ready',
        detail: 'Fixture payloads and local Portfolio rows can prove matching without Gmail API reads.',
      },
      {
        key: 'one_recipient_scope',
        label: 'One-recipient scope',
        state: contactId && queueId ? 'ready' : 'required',
        detail: contactId && queueId
          ? 'The canary is tied to one contact and one warm outreach queue row.'
          : 'Pick one contact and one queue row before live provider-read approval.',
      },
      {
        key: 'live_gmail_read_approval',
        label: 'Live Gmail read approval',
        state: 'required',
        detail: 'A future live Gmail read requires explicit current approval; a generic proceed is not enough.',
      },
      {
        key: 'dedupe',
        label: 'Dedupe',
        state: state === 'duplicate_deduped' ? 'passed' : 'ready',
        detail: 'Replay checks use provider, thread id, message id, contact id, queue id, and response key.',
      },
      {
        key: 'response_lifecycle',
        label: 'Response lifecycle',
        state: state === 'imported_response_found' ? 'ready' : 'required',
        detail: 'Import review feeds the existing response lifecycle; it does not create a reply automatically.',
      },
      {
        key: 'reply_send_boundary',
        label: 'Reply/send boundary',
        state: 'disabled',
        detail: 'Importing a response cannot create a Gmail draft, Slack action, n8n dispatch, or external send.',
      },
    ],
  }
}

export function planWarmOutreachGmailResponseImport(args: {
  replies: WarmOutreachGmailReplyPayload[]
  rows: WarmOutreachGmailImportPortfolioRows
  dryRunImportEnabled?: boolean
  activation?: WarmOutreachGmailResponseImportActivationInput
  actor?: string | null
  observedAt?: string | null
  liveReadApprovalRequested?: boolean
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
  const manualRecoveryReasons = candidates
    .filter((candidate) => candidate.status !== 'ready_for_review')
    .flatMap((candidate) => candidate.blockers.length > 0
      ? candidate.blockers
      : [candidate.statusLabel])
  const activationReadiness = buildWarmOutreachGmailResponseImportActivationReadiness({
    ...args.activation,
    dryRunImportEnabled,
    manualRecoveryRequired:
      dryRunImportEnabled &&
      candidates.length > 0 &&
      candidates.every((candidate) => candidate.status !== 'ready_for_review'),
    manualRecoveryReasons,
  })
  const primaryCandidate = candidates[0]
  const canaryReadiness = buildWarmOutreachGmailResponseImportCanaryReadiness({
    activationReadiness,
    candidates,
    contactId: primaryCandidate?.matchedContactId ?? primaryCandidate?.captureRequest?.contactId ?? null,
    queueId: primaryCandidate?.matchedOutreachQueueId ?? primaryCandidate?.captureRequest?.outreachQueueId ?? null,
    gmailThreadId: primaryCandidate?.providerThreadId ?? primaryCandidate?.captureRequest?.providerThreadId ?? null,
    gmailMessageId: primaryCandidate?.providerMessageId ?? primaryCandidate?.captureRequest?.providerMessageId ?? null,
    dedupeKey: primaryCandidate?.duplicateKeys[0] ?? null,
    actor: args.actor,
    observedAt: args.observedAt,
    hasDryRunPayload: true,
    dryRunImportEnabled,
    liveReadApprovalRequested: args.liveReadApprovalRequested,
  })

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
    activationReadiness,
    canaryReadiness,
    auditNotes: [
      'This planner accepts mocked Gmail reply payloads and local Portfolio rows only.',
      'No Gmail API, Gmail draft, Gmail send, Slack dispatch, n8n dispatch, or provider polling is performed.',
      'Ready candidates must still flow through the existing warm response lifecycle and human QA gate.',
    ],
  }
}
