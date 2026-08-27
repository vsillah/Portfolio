import { createHash } from 'crypto'

import type {
  WarmOutreachChannel,
  WarmOutreachReadiness,
  WarmOutreachRelationshipPacket,
} from './warm-outreach-relationship-intelligence'

type PortfolioRow = Record<string, unknown>

export type WarmOutreachResponseMonitoringMode =
  | 'manual'
  | 'imported'
  | 'pending'
  | 'blocked'

export type WarmOutreachResponseMonitoringStatus =
  | 'manual_response_captured'
  | 'imported_response_captured'
  | 'awaiting_response'
  | 'stale_no_response'
  | 'blocked'

export type WarmOutreachSendMode = 'warm_1_to_1' | 'warm_1_to_many'

export type WarmOutreachSendAuthorityGateKey =
  | 'target_source_provenance'
  | 'relationship_basis'
  | 'consent_suppression'
  | 'personalization'
  | 'human_approval'
  | 'provider_capability'
  | 'idempotency'
  | 'send_scheduling'
  | 'outcome_tracking'
  | 'response_follow_up'

export type WarmOutreachSendAuthorityGate = {
  key: WarmOutreachSendAuthorityGateKey
  label: string
  status: 'satisfied' | 'blocked' | 'manual_required' | 'future_gate'
  requiredForActivation: true
  detail: string
  externalExecutionEnabled: false
}

export type WarmOutreachSendAuthority = {
  version: 'warm-outreach-send-authority/v1'
  mode: WarmOutreachSendMode
  channel: WarmOutreachChannel
  label: string
  state: 'eligible_for_future_activation' | 'blocked' | 'manual_only'
  futureActivationEligible: boolean
  externalSendApproved: false
  externalSendEnabled: false
  providerExecutionEnabled: false
  gmailDraftCreationEnabled: false
  schedulingEnabled: false
  outcomeTrackingEnabled: false
  humanApprovalRequired: true
  idempotencyKey: string
  gates: WarmOutreachSendAuthorityGate[]
  blockers: string[]
  manualSteps: string[]
  nextReviewAction: string
}

export type WarmOutreachEmailSendLifecycleStageKey =
  | 'draft_packet'
  | 'human_reply_or_draft_approval'
  | 'send_authority_review'
  | 'provider_capability_smoke'
  | 'scheduled_send_queue'
  | 'submitted_sent_evidence'

export type WarmOutreachEmailSendLifecycleStage = {
  key: WarmOutreachEmailSendLifecycleStageKey
  label: string
  status: 'ready_for_review' | 'blocked' | 'future_gate' | 'disabled' | 'evidence_required'
  detail: string
  externalExecutionEnabled: false
}

export type WarmOutreachExternalSendReadiness = {
  version: 'warm-outreach-external-send-readiness/v1'
  state: 'blocked_pending_authority'
  label: string
  senderIdentity: {
    state: 'not_verified' | 'verified_for_draft_only'
    requiredSender: string | null
    connectedAs: string | null
    detail: string
  }
  recipientApproval: {
    state: 'required'
    contactId: number
    approved: false
    detail: string
  }
  draftEvidence: {
    state: 'missing' | 'tracked'
    gmailDraftExists: boolean
    draftId: string | null
    threadId: string | null
    messageId: string | null
    sourceIds: string[]
    detail: string
  }
  suppressionConsent: {
    state: 'clear' | 'blocked'
    reasons: string[]
    detail: string
  }
  idempotency: {
    messageVersionKey: string
    sendQueueIdempotencyKey: string
    submittedEvidenceKey: string
    duplicateDetected: boolean
    detail: string
  }
  externalSend: {
    enabled: false
    approved: false
    blocked: true
    detail: string
    nextStep: string
  }
}

export type WarmOutreachGmailDraftHandoffPacket = {
  version: 'warm-outreach-gmail-draft-handoff/v1'
  state: 'ready_for_internal_handoff' | 'blocked' | 'per_recipient_gate_required'
  label: string
  internalHandoffReady: boolean
  channel: 'email'
  contactReference: {
    contactId: number
    contactName: string | null
    reference: string
  }
  messageVersionKey: string
  templateDraftBasis: {
    recommendedTemplate: WarmOutreachReadiness['recommendedTemplate']
    selectedChannel: WarmOutreachReadiness['selectedChannel']
    relationshipEventId: string | null
    detail: string
  }
  provenanceSummary: {
    relationshipSourceCount: number
    relationshipSignalCount: number
    safeToMentionCount: number
    summarizeOnlyCount: number
    commonalityCount: number
    detail: string
  }
  suppressionStatus: 'clear' | 'blocked'
  suppressionReasons: string[]
  idempotencyKey: string
  futureApprovalGates: string[]
  gmailProviderActivated: false
  gmailDraftCreationEnabled: false
  providerCallsEnabled: false
  externalSendBlocked: true
  detail: string
}

export type WarmOutreachGmailProviderCapabilitySmokeState =
  | 'not_configured'
  | 'waiting_read_only_smoke_authority'
  | 'ready_for_read_only_smoke'
  | 'smoke_passed'
  | 'smoke_failed'
  | 'blocked'

export type WarmOutreachGmailProviderCapabilitySmokeReadiness = {
  version: 'warm-outreach-gmail-provider-smoke/v1'
  provider: 'gmail'
  status: WarmOutreachGmailProviderCapabilitySmokeState
  label: string
  smokeKey: string
  oauthConfigured: boolean
  connectedProfileAvailable: boolean
  providerConfigured: boolean
  readOnlySmokeReady: boolean
  readOnlySmokeEnabled: false
  providerCallsEnabled: false
  externalSendEnabled: false
  gmailDraftCreationEnabled: false
  requiredConfig: string[]
  blockedReasons: string[]
  lastSmokeAt: string | null
  lastSmokeError: string | null
  futureActivationGate: string
  notes: string[]
}

export type WarmOutreachGmailDraftCreationGateState =
  | 'handoff_blocked'
  | 'provider_smoke_required'
  | 'draft_creation_authority_required'
  | 'ready_for_disabled_activation'
  | 'blocked'

export type WarmOutreachGmailDraftCreationGate = {
  version: 'warm-outreach-gmail-draft-creation-gate/v1'
  status: WarmOutreachGmailDraftCreationGateState
  label: string
  draftCreationKey: string
  internalHandoffReady: boolean
  providerSmokeStatus: WarmOutreachGmailProviderCapabilitySmokeState
  providerSmokePassed: boolean
  draftCreationAuthority: boolean
  gmailDraftCreationEnabled: false
  providerCallsEnabled: false
  externalSendEnabled: false
  externalSendBlocked: true
  blockedReasons: string[]
  requiredGates: string[]
  notes: string[]
}

export type WarmOutreachGmailProviderActivationReadiness = {
  version: 'warm-outreach-gmail-provider-activation-readiness/v1'
  localDraftReadiness: {
    state: 'ready' | 'blocked'
    label: string
    detail: string
    idempotencyKey: string
  }
  connectedSenderReadiness: {
    state: 'requires_no_send_canary' | 'ready' | 'blocked'
    label: string
    requiredSender: string | null
    connectedAs: string | null
    recoveryAction: string
  }
  liveDraftCanaryReadiness: {
    state: 'ready_for_no_send_canary' | 'passed_no_send' | 'blocked_no_send'
    label: string
    detail: string
    providerCallsEnabled: false
    gmailDraftCreated: false
    trackingPersisted: false
    externalSendEnabled: false
  }
  duplicateDraftEvidence: {
    createdOnce: boolean
    duplicatePrevented: boolean
    draftId: string | null
    threadId: string | null
    messageId: string | null
    sourceIds: string[]
    noSendStatus: 'no_send'
    detail: string
  }
  externalSendBoundary: {
    blocked: true
    label: string
    detail: string
  }
  remainingHumanGates: string[]
}

export type WarmOutreachRealRecipientGmailRolloutReadiness = {
  version: 'warm-outreach-real-gmail-rollout-readiness/v1'
  state:
    | 'ready_for_send_request'
    | 'authorization_recorded_execution_blocked'
    | 'blocked'
    | 'already_sent'
  label: string
  eligibleForSendApprovalRequest: boolean
  canBuildSlackApprovalPayload: boolean
  exactNextAction:
    | 'approve_send_request'
    | 'resolve_blocker'
    | 'do_not_send_duplicate'
    | 'captain_enable_exact_execution'
  actionLabel: string
  requirements: {
    draftEvidence: {
      state: 'tracked' | 'missing'
      draftId: string | null
      threadId: string | null
      messageId: string | null
      sourceIds: string[]
      detail: string
    }
    senderMatch: {
      state: 'matched' | 'missing' | 'mismatch'
      requiredSender: string | null
      connectedAs: string | null
      detail: string
    }
    suppression: {
      state: 'clear' | 'blocked'
      reasons: string[]
      detail: string
    }
    provider: {
      state: 'configured' | 'missing'
      detail: string
    }
    authorization: {
      state: 'missing' | 'approved' | 'rejected' | 'revision_requested'
      decisionKey: string | null
      detail: string
    }
    submittedEvidence: {
      state: 'missing' | 'submitted'
      sourceIds: string[]
      detail: string
    }
  }
  blockers: string[]
  slackApprovalContract: {
    route: string
    method: 'POST'
    dispatchEnabled: false
    actionIds: ['warm_gmail_send.approve', 'warm_gmail_send.reject', 'warm_gmail_send.revise']
    payloadDedupeKey: string
    recordsAuthorizationIntentOnly: true
    gmailSendCalled: false
    providerExecutionEnabled: false
  }
  executionBoundary: {
    slackDispatch: false
    gmailSend: false
    providerCalls: false
    productionEnvChange: false
    perRecipientExecutionAuthorizationRequired: true
    captainFlagRequiredForExecution: true
  }
}

export type WarmOutreachEmailSendLifecycle = {
  version: 'warm-outreach-email-send-lifecycle/v1'
  contactId: number
  mode: WarmOutreachSendMode
  channel: 'email'
  label: string
  state:
    | 'blocked'
    | 'blocked_before_provider_activation'
    | 'per_recipient_gate_required'
  firstCandidateChannel: true
  sendReady: false
  providerExecutionEnabled: false
  externalSendEnabled: false
  gmailDraftCreationEnabled: false
  schedulingEnabled: false
  messageVersionKey: string
  sendQueueIdempotencyKey: string
  providerCapabilitySmokeKey: string
  gmailDraftCreationGateKey: string
  submittedEvidenceKey: string
  gmailDraftHandoffPacket: WarmOutreachGmailDraftHandoffPacket
  providerCapabilitySmoke: WarmOutreachGmailProviderCapabilitySmokeReadiness
  gmailDraftCreationGate: WarmOutreachGmailDraftCreationGate
  gmailProviderActivationReadiness: WarmOutreachGmailProviderActivationReadiness
  externalSendReadiness: WarmOutreachExternalSendReadiness
  realRecipientRolloutReadiness: WarmOutreachRealRecipientGmailRolloutReadiness
  duplicatePrevention: {
    scope: 'contact_channel_message_version'
    duplicateDetected: boolean
    existingEvidenceIds: string[]
    requiredUniqueKeys: string[]
    detail: string
  }
  suppressionCheck: {
    status: 'clear' | 'blocked'
    reasons: string[]
  }
  relationshipProvenance: {
    status: 'present' | 'missing'
    sourceCount: number
    signalCount: number
    relationshipEventId: string | null
    detail: string
  }
  personalizationProvenance: {
    status: 'present' | 'missing'
    safeToMentionCount: number
    summarizeOnlyCount: number
    commonalityCount: number
    detail: string
  }
  auditState: {
    status: 'scaffold_only'
    notes: string[]
  }
  stages: WarmOutreachEmailSendLifecycleStage[]
}

export type WarmOutreachChannelSendReadiness = {
  mode: WarmOutreachSendMode
  channel: WarmOutreachChannel
  label: string
  state:
    | 'blocked'
    | 'provider_gate_required'
    | 'manual_review_only'
    | 'unavailable'
  sendReady: false
  externalSendEnabled: false
  providerExecutionEnabled: false
  humanApprovalRequired: true
  idempotencyKey: string
  blockers: string[]
  gatesRemaining: string[]
  auditNotes: string[]
  sendAuthority: WarmOutreachSendAuthority
  emailSendLifecycle: WarmOutreachEmailSendLifecycle | null
}

export type WarmOutreachSendReadiness = {
  version: 'warm-outreach-send-readiness/v1'
  contactId: number
  perRecipientIdempotencyKey: string
  modes: Record<WarmOutreachSendMode, WarmOutreachChannelSendReadiness[]>
  executionBoundary: {
    gmailEmailSend: false
    linkedinAction: false
    facebookAction: false
    phoneAction: false
    providerExecution: false
    scheduling: false
    externalMonitoring: false
    gmailDraftCreation: false
    outcomeTracking: false
  }
}

export type WarmOutreachResponseMonitoring = {
  version: 'warm-outreach-response-monitoring/v1'
  contactId: number
  status: WarmOutreachResponseMonitoringStatus
  mode: WarmOutreachResponseMonitoringMode
  label: string
  expectedReplyBy: string | null
  latestOutboundAt: string | null
  latestResponseAt: string | null
  staleAfterDays: number
  perRecipientIdempotencyKey: string
  evidence: Array<{
    sourceType: 'contact_communications' | 'email_messages' | 'outreach_queue' | 'meeting_action_tasks'
    sourceId: string
    status: string
    summary: string
    evidenceType: 'expected_reply' | 'manual_response' | 'imported_response' | 'local_follow_up'
  }>
  proposedFollowUp: {
    state: 'review_response' | 'manual_import' | 'stale_follow_up_review' | 'blocked_review'
    label: string
    description: string
    requiresHumanApproval: true
    idempotencyKey: string
  }
  blockedReasons: string[]
  auditNotes: string[]
  sendReadiness: WarmOutreachSendReadiness
  executionBoundary: {
    localRowsOnly: true
    manualImportEnabled: true
    providerResponseImportEnabled: false
    providerPollingEnabled: false
    externalMonitoringEnabled: false
    externalSendEnabled: false
    gmailDraftCreationEnabled: false
    linkedinActionEnabled: false
    facebookActionEnabled: false
    phoneActionEnabled: false
    slackActionEnabled: false
    n8nDispatchEnabled: false
  }
}

export type WarmOutreachMonitoringRows = {
  contactCommunications?: PortfolioRow[]
  outreachQueue?: PortfolioRow[]
  emailMessages?: PortfolioRow[]
  actionTasks?: PortfolioRow[]
}

const CHANNEL_LABELS: Record<WarmOutreachChannel, string> = {
  email: 'Gmail / email',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  phone_contact: 'Phone / manual',
}

function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function metadata(row: PortfolioRow): PortfolioRow {
  return record(row.metadata)
}

function record(value: unknown): PortfolioRow {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as PortfolioRow
    : {}
}

function stableHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 20)
}

function asRows(rows: PortfolioRow[] | undefined): PortfolioRow[] {
  return Array.isArray(rows) ? rows : []
}

function rowTimestamp(row: PortfolioRow): string | null {
  return text(row.replied_at) ?? text(row.sent_at) ?? text(row.created_at) ?? text(row.due_date)
}

function rowTime(row: PortfolioRow): number {
  const timestamp = rowTimestamp(row)
  const value = timestamp ? Date.parse(timestamp) : Number.NaN
  return Number.isFinite(value) ? value : 0
}

function newestRow(rows: PortfolioRow[]): PortfolioRow | null {
  return [...rows].sort((a, b) => rowTime(b) - rowTime(a))[0] ?? null
}

function sourceId(row: PortfolioRow, fallback: string): string {
  return text(row.id) ?? text(row.source_id) ?? fallback
}

function isInboundResponse(row: PortfolioRow): boolean {
  const direction = text(row.direction)?.toLowerCase()
  const messageType = text(row.message_type)?.toLowerCase() ?? text(row.email_kind)?.toLowerCase()
  const status = text(row.status)?.toLowerCase()
  const source = text(row.source_id)?.toLowerCase()
  const rowMetadata = metadata(row)
  const lifecycle = text(rowMetadata.lifecycle)

  return (
    direction === 'inbound' ||
    messageType === 'reply' ||
    status === 'replied' ||
    Boolean(source?.startsWith('warm-outreach:reply:')) ||
    lifecycle === 'warm_outreach_response'
  )
}

function isEmailRow(row: PortfolioRow): boolean {
  const channel = text(row.channel)?.toLowerCase()
  const provider = text(row.provider)?.toLowerCase() ?? text(metadata(row).provider)?.toLowerCase()
  return channel === 'email' || provider === 'gmail'
}

function statusIsActiveSendState(status: string | null): boolean {
  return Boolean(status && ['queued', 'scheduled', 'submitted', 'sending', 'ready_to_send'].includes(status))
}

function isManualResponse(row: PortfolioRow): boolean {
  const sourceSystem = text(row.source_system)?.toLowerCase()
  const provider = text(row.provider)?.toLowerCase() ?? text(metadata(row).provider)?.toLowerCase()
  const source = text(row.source_id)?.toLowerCase()
  return sourceSystem === 'manual' || provider === 'manual' || Boolean(source?.includes(':manual:'))
}

function summarizeResponseEvidence(row: PortfolioRow, sourceType: 'contact_communications' | 'email_messages') {
  const channel = text(row.channel) ?? 'channel'
  const subject = text(row.subject)
  const status = text(row.status) ?? 'captured'
  const timestamp = rowTimestamp(row)
  return {
    sourceType,
    sourceId: sourceId(row, `${sourceType}-response`),
    status,
    summary: `${isManualResponse(row) ? 'Manual' : 'Imported'} ${channel} response${subject ? ` about "${subject}"` : ''}${timestamp ? ` recorded ${timestamp}` : ''}.`,
    evidenceType: isManualResponse(row) ? 'manual_response' as const : 'imported_response' as const,
  }
}

function outboundEvidence(row: PortfolioRow) {
  const channel = text(row.channel) ?? 'outreach'
  const status = text(row.status) ?? 'queued'
  const subject = text(row.subject)
  const timestamp = rowTimestamp(row)
  return {
    sourceType: 'outreach_queue' as const,
    sourceId: sourceId(row, 'outreach-queue'),
    status,
    summary: `${channel} outreach queue row ${status}${subject ? ` for "${subject}"` : ''}${timestamp ? ` recorded ${timestamp}` : ''}.`,
    evidenceType: 'expected_reply' as const,
  }
}

function taskEvidence(row: PortfolioRow) {
  const title = text(row.title) ?? 'Follow-up task'
  const status = text(row.status) ?? 'pending'
  return {
    sourceType: 'meeting_action_tasks' as const,
    sourceId: sourceId(row, 'meeting-action-task'),
    status,
    summary: `${title} (${status}).`,
    evidenceType: 'local_follow_up' as const,
  }
}

function weakRelationshipBasis(packet: WarmOutreachRelationshipPacket): boolean {
  return (
    packet.relationshipSignals.length === 0 ||
    packet.relationshipBasis.toLowerCase().includes('limited local relationship evidence')
  )
}

function hasSourceProvenance(packet: WarmOutreachRelationshipPacket): boolean {
  return packet.sourceRefs.some((source) => {
    if (
      source.sourceStatus === 'missing' ||
      source.sourceStatus === 'blocked' ||
      source.sourceStatus === 'suppressed'
    ) {
      return false
    }
    return source.sourceType !== 'portfolio_contact'
  })
}

function hasPersonalizationBasis(packet: WarmOutreachRelationshipPacket): boolean {
  const inventory = packet.sourceInventory
  return Boolean(
    packet.relationshipSignals.length > 0 ||
      packet.commonalities.length > 0 ||
      inventory?.safeToMention.length ||
      inventory?.summarizeOnly.length,
  )
}

function suppressionBlockers(packet: WarmOutreachRelationshipPacket, readiness: WarmOutreachReadiness): string[] {
  return [
    packet.suppression.doNotContact
      ? packet.suppression.suppressionReason ?? 'Contact is marked do not contact.'
      : null,
    packet.suppression.unsubscribed ? 'Contact is unsubscribed.' : null,
    packet.suppression.removedAt ? 'Contact was removed from outreach.' : null,
    ...readiness.blockers,
  ].filter(Boolean) as string[]
}

function gate(args: {
  key: WarmOutreachSendAuthorityGateKey
  label: string
  status: WarmOutreachSendAuthorityGate['status']
  detail: string
}): WarmOutreachSendAuthorityGate {
  return {
    ...args,
    requiredForActivation: true,
    externalExecutionEnabled: false,
  }
}

function baseSendBlockers(args: {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  mode: WarmOutreachSendMode
}) {
  const blockers = [...new Set(suppressionBlockers(args.packet, args.readiness))]
  if (weakRelationshipBasis(args.packet)) {
    blockers.push('Relationship basis is too weak for send readiness.')
  }
  if (!hasSourceProvenance(args.packet)) {
    blockers.push('Target/source provenance is missing or only uses the contact record.')
  }
  if (!hasPersonalizationBasis(args.packet)) {
    blockers.push('Personalization basis is missing from local relationship evidence.')
  }
  if (args.mode === 'warm_1_to_many') {
    blockers.push('Batch recipients require per-contact review before any send-readiness state.')
    blockers.push('Batch email sends require individual readiness and future explicit send authority per recipient.')
  }
  return blockers
}

function lifecycleStage(args: {
  key: WarmOutreachEmailSendLifecycleStageKey
  label: string
  status: WarmOutreachEmailSendLifecycleStage['status']
  detail: string
}): WarmOutreachEmailSendLifecycleStage {
  return {
    ...args,
    externalExecutionEnabled: false,
  }
}

function isBatchModeGateBlocker(blocker: string): boolean {
  return (
    blocker === 'Batch recipients require per-contact review before any send-readiness state.' ||
    blocker === 'Batch email sends require individual readiness and future explicit send authority per recipient.'
  )
}

function metadataValue(row: PortfolioRow, key: string): unknown {
  const direct = row[key]
  if (direct !== undefined && direct !== null) return direct
  return metadata(row)[key]
}

function nestedMetadata(row: PortfolioRow, key: string): PortfolioRow {
  return record(metadata(row)[key])
}

function firstGmailDraftEvidence(rows: PortfolioRow[]): WarmOutreachGmailProviderActivationReadiness['duplicateDraftEvidence'] {
  for (const row of rows) {
    const generationInputs = record(row.generation_inputs)
    const draftCreation = {
      ...record(generationInputs.gmail_draft_creation),
      ...nestedMetadata(row, 'gmail_draft_creation'),
    }
    const authorization = {
      ...record(generationInputs.warm_outreach_gmail_draft_authorization),
      ...nestedMetadata(row, 'warm_outreach_gmail_draft_authorization'),
    }
    const draftId =
      text(metadataValue(row, 'gmail_user_draft_id')) ??
      text(metadataValue(row, 'gmail_draft_id')) ??
      text(draftCreation.draft_id)
    const threadId =
      text(metadataValue(row, 'gmail_user_thread_id')) ??
      text(metadataValue(row, 'thread_id')) ??
      text(draftCreation.thread_id)
    const messageId =
      text(metadataValue(row, 'gmail_user_message_id')) ??
      text(metadataValue(row, 'message_id')) ??
      text(draftCreation.message_id)
    const idempotencyKey =
      text(metadataValue(row, 'gmail_draft_idempotency_key')) ??
      text(draftCreation.idempotency_key) ??
      text(authorization.idempotency_key)

    if (draftId || threadId || messageId || idempotencyKey) {
      return {
        createdOnce: true,
        duplicatePrevented: true,
        draftId,
        threadId,
        messageId,
        sourceIds: [sourceId(row, 'gmail-draft-evidence')],
        noSendStatus: 'no_send',
        detail:
          'Existing Gmail draft metadata is present for this contact/channel/message path. Reuse the existing evidence instead of creating another provider draft.',
      }
    }
  }

  return {
    createdOnce: false,
    duplicatePrevented: false,
    draftId: null,
    threadId: null,
    messageId: null,
    sourceIds: [],
    noSendStatus: 'no_send',
    detail:
      'No prior Gmail draft metadata was found in local Portfolio rows for this contact/channel/message path.',
  }
}

function normalizeEmail(value: unknown): string | null {
  const email = text(value)?.toLowerCase()
  return email && email.includes('@') ? email : null
}

function firstGmailDraftRolloutEvidence(rows: PortfolioRow[]) {
  for (const row of rows) {
    const generationInputs = record(row.generation_inputs)
    const draftCreation = {
      ...record(generationInputs.gmail_draft_creation),
      ...nestedMetadata(row, 'gmail_draft_creation'),
    }
    const draftId =
      text(metadataValue(row, 'gmail_user_draft_id')) ??
      text(metadataValue(row, 'gmail_draft_id')) ??
      text(draftCreation.draft_id)
    const threadId =
      text(metadataValue(row, 'gmail_user_thread_id')) ??
      text(metadataValue(row, 'thread_id')) ??
      text(draftCreation.thread_id)
    const messageId =
      text(metadataValue(row, 'gmail_user_message_id')) ??
      text(metadataValue(row, 'message_id')) ??
      text(draftCreation.message_id)
    const idempotencyKey =
      text(metadataValue(row, 'gmail_draft_idempotency_key')) ??
      text(draftCreation.idempotency_key)

    if (draftId || threadId || messageId || idempotencyKey) {
      return {
        draftId,
        threadId,
        messageId,
        sourceIds: [sourceId(row, 'gmail-draft-evidence')],
        connectedAs: normalizeEmail(draftCreation.connected_as ?? metadataValue(row, 'connected_as')),
        requiredSender: normalizeEmail(draftCreation.required_sender ?? metadataValue(row, 'required_sender')),
      }
    }
  }

  return {
    draftId: null,
    threadId: null,
    messageId: null,
    sourceIds: [] as string[],
    connectedAs: null,
    requiredSender: null,
  }
}

function firstWarmGmailAuthorization(rows: PortfolioRow[]) {
  for (const row of rows) {
    const generationInputs = record(row.generation_inputs)
    const authorization = {
      ...record(generationInputs.warm_gmail_send_authorization),
      ...nestedMetadata(row, 'warm_gmail_send_authorization'),
    }
    const status = text(authorization.status)?.toLowerCase()
    if (status === 'approved' || status === 'rejected' || status === 'revision_requested') {
      return {
        status: status as 'approved' | 'rejected' | 'revision_requested',
        decisionKey: text(authorization.decision_key),
      }
    }
  }

  return {
    status: null,
    decisionKey: null,
  }
}

function firstSubmittedWarmGmailEvidence(rows: PortfolioRow[], input: {
  sendQueueIdempotencyKey: string
  submittedEvidenceKey: string
}) {
  const sourceIds: string[] = []
  for (const row of rows) {
    const generationInputs = record(row.generation_inputs)
    const execution = {
      ...record(generationInputs.warm_gmail_send_execution),
      ...nestedMetadata(row, 'warm_gmail_send_execution'),
    }
    const rowMetadata = metadata(row)
    const status = text(row.status)?.toLowerCase()
    const executionStatus = text(execution.status)?.toLowerCase()
    const submittedEvidenceKey =
      text(rowMetadata.submitted_evidence_key) ??
      text(execution.submitted_evidence_key)
    const sendQueueKey =
      text(rowMetadata.send_queue_idempotency_key) ??
      text(execution.send_queue_idempotency_key) ??
      text(execution.idempotency_key)
    const submitted =
      ['sent', 'submitted', 'delivered'].includes(status ?? '') ||
      executionStatus === 'sent' ||
      execution.gmail_send_called === true ||
      execution.external_send_performed === true ||
      submittedEvidenceKey === input.submittedEvidenceKey ||
      sendQueueKey === input.sendQueueIdempotencyKey && executionStatus === 'sent'

    if (submitted) sourceIds.push(sourceId(row, 'submitted-gmail-send-evidence'))
  }

  return {
    submitted: sourceIds.length > 0,
    sourceIds: [...new Set(sourceIds)],
  }
}

function buildRealRecipientGmailRolloutReadiness(args: {
  contactId: number
  handoff: WarmOutreachGmailDraftHandoffPacket
  providerSmoke: WarmOutreachGmailProviderCapabilitySmokeReadiness
  lifecycle: {
    messageVersionKey: string
    sendQueueIdempotencyKey: string
    submittedEvidenceKey: string
  }
  localEmailRows: PortfolioRow[]
  hardBlockers: string[]
  suppressionReasons: string[]
}): WarmOutreachRealRecipientGmailRolloutReadiness {
  const draft = firstGmailDraftRolloutEvidence(args.localEmailRows)
  const authorization = firstWarmGmailAuthorization(args.localEmailRows)
  const submitted = firstSubmittedWarmGmailEvidence(args.localEmailRows, args.lifecycle)
  const hasDraftEvidence = Boolean(draft.draftId || draft.threadId || draft.messageId)
  const senderState: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['senderMatch']['state'] =
    !draft.requiredSender || !draft.connectedAs
      ? 'missing'
      : draft.requiredSender === draft.connectedAs
        ? 'matched'
        : 'mismatch'
  const providerConfigured = args.providerSmoke.providerConfigured
  const authorizationState: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['authorization']['state'] =
    authorization.status ?? 'missing'

  const blockers = [
    ...args.hardBlockers,
    hasDraftEvidence ? null : 'Tracked Gmail draft evidence is required before a real-recipient send request.',
    providerConfigured ? null : 'Gmail provider configuration or connected profile evidence is missing.',
    senderState === 'matched'
      ? null
      : senderState === 'missing'
        ? 'Tracked Gmail draft sender evidence is missing.'
        : `Tracked Gmail draft sender must match ${draft.requiredSender}; current sender is ${draft.connectedAs}.`,
    args.suppressionReasons.length === 0 ? null : args.suppressionReasons[0],
    authorizationState === 'rejected'
      ? 'Prior send authorization was rejected; revise before requesting another approval.'
      : authorizationState === 'revision_requested'
        ? 'Prior send authorization requested revision; update the draft before approval.'
        : null,
  ].filter(Boolean) as string[]

  const state: WarmOutreachRealRecipientGmailRolloutReadiness['state'] =
    submitted.submitted
      ? 'already_sent'
      : blockers.length > 0
        ? 'blocked'
        : authorizationState === 'approved'
          ? 'authorization_recorded_execution_blocked'
          : 'ready_for_send_request'
  const actionLabel =
    state === 'already_sent'
      ? 'Do not resend'
      : state === 'blocked'
        ? 'Resolve blocker'
        : state === 'authorization_recorded_execution_blocked'
          ? 'Captain can run exact execution gate'
          : 'Approve send request'
  const exactNextAction: WarmOutreachRealRecipientGmailRolloutReadiness['exactNextAction'] =
    state === 'already_sent'
      ? 'do_not_send_duplicate'
      : state === 'blocked'
        ? 'resolve_blocker'
        : state === 'authorization_recorded_execution_blocked'
          ? 'captain_enable_exact_execution'
          : 'approve_send_request'

  return {
    version: 'warm-outreach-real-gmail-rollout-readiness/v1',
    state,
    label:
      state === 'already_sent'
        ? 'Real Gmail send already recorded'
        : state === 'blocked'
          ? 'Real Gmail send request blocked'
          : state === 'authorization_recorded_execution_blocked'
            ? 'Send authorization recorded; execution still gated'
            : 'Ready for one-step send approval request',
    eligibleForSendApprovalRequest: state === 'ready_for_send_request',
    canBuildSlackApprovalPayload: state === 'ready_for_send_request',
    exactNextAction,
    actionLabel,
    requirements: {
      draftEvidence: {
        state: hasDraftEvidence ? 'tracked' : 'missing',
        draftId: draft.draftId,
        threadId: draft.threadId,
        messageId: draft.messageId,
        sourceIds: draft.sourceIds,
        detail: hasDraftEvidence
          ? 'Tracked Gmail draft evidence is present. This is the message to approve; it is not a send.'
          : 'Create and track the per-recipient Gmail draft before requesting real-recipient send approval.',
      },
      senderMatch: {
        state: senderState,
        requiredSender: draft.requiredSender,
        connectedAs: draft.connectedAs,
        detail:
          senderState === 'matched'
            ? 'Tracked draft sender matches the required AmaduTown sender.'
            : senderState === 'missing'
              ? 'Sender identity must be recorded on the tracked Gmail draft evidence.'
              : 'Tracked draft sender does not match the required sender.',
      },
      suppression: {
        state: args.suppressionReasons.length > 0 ? 'blocked' : 'clear',
        reasons: args.suppressionReasons,
        detail: args.suppressionReasons[0] ?? 'No suppression blocker is recorded.',
      },
      provider: {
        state: providerConfigured ? 'configured' : 'missing',
        detail: providerConfigured
          ? 'Gmail provider configuration is present for readiness review; this contract still does not call Gmail.'
          : 'Reconnect or verify Gmail provider readiness before asking for real-recipient approval.',
      },
      authorization: {
        state: authorizationState,
        decisionKey: authorization.decisionKey,
        detail:
          authorizationState === 'approved'
            ? 'Portfolio has recorded explicit per-recipient send authorization intent.'
            : authorizationState === 'rejected'
              ? 'Portfolio has a rejected send authorization decision for this message version.'
              : authorizationState === 'revision_requested'
                ? 'Portfolio has a revision request for this message version.'
                : 'No Portfolio or Slack send authorization decision is recorded yet.',
      },
      submittedEvidence: {
        state: submitted.submitted ? 'submitted' : 'missing',
        sourceIds: submitted.sourceIds,
        detail: submitted.submitted
          ? 'Submitted Gmail send evidence already exists. Do not replay this message.'
          : 'No submitted send evidence is recorded for this contact, channel, and message version.',
      },
    },
    blockers: [...new Set(blockers)],
    slackApprovalContract: {
      route: `/api/admin/outreach/[id]/slack-send-approval`,
      method: 'POST',
      dispatchEnabled: false,
      actionIds: ['warm_gmail_send.approve', 'warm_gmail_send.reject', 'warm_gmail_send.revise'],
      payloadDedupeKey: `warm-outreach:slack-gmail-send-card:v1:${stableHash({
        contactId: args.contactId,
        messageVersionKey: args.lifecycle.messageVersionKey,
      })}`,
      recordsAuthorizationIntentOnly: true,
      gmailSendCalled: false,
      providerExecutionEnabled: false,
    },
    executionBoundary: {
      slackDispatch: false,
      gmailSend: false,
      providerCalls: false,
      productionEnvChange: false,
      perRecipientExecutionAuthorizationRequired: true,
      captainFlagRequiredForExecution: true,
    },
  }
}

export function buildWarmOutreachGmailProviderActivationReadiness(args: {
  handoff: WarmOutreachGmailDraftHandoffPacket
  providerSmoke: WarmOutreachGmailProviderCapabilitySmokeReadiness
  draftCreationGate: WarmOutreachGmailDraftCreationGate
  duplicateDraftEvidence: WarmOutreachGmailProviderActivationReadiness['duplicateDraftEvidence']
  connectedSender?: {
    state: WarmOutreachGmailProviderActivationReadiness['connectedSenderReadiness']['state']
    label: string
    requiredSender: string | null
    connectedAs: string | null
    recoveryAction: string
  }
  canaryState?: WarmOutreachGmailProviderActivationReadiness['liveDraftCanaryReadiness']['state']
  canaryDetail?: string
}): WarmOutreachGmailProviderActivationReadiness {
  const localReady = args.handoff.internalHandoffReady && args.draftCreationGate.internalHandoffReady
  const canaryState = args.canaryState ?? (
    localReady && !args.duplicateDraftEvidence.createdOnce
      ? 'ready_for_no_send_canary'
      : 'blocked_no_send'
  )

  return {
    version: 'warm-outreach-gmail-provider-activation-readiness/v1',
    localDraftReadiness: {
      state: localReady ? 'ready' : 'blocked',
      label: localReady ? 'Local draft handoff ready' : 'Local draft handoff blocked',
      detail: args.handoff.detail,
      idempotencyKey: args.handoff.idempotencyKey,
    },
    connectedSenderReadiness: args.connectedSender ?? {
      state: 'requires_no_send_canary',
      label: 'Connected sender not checked in relationship packet',
      requiredSender: null,
      connectedAs: null,
      recoveryAction:
        'Run the no-send canary or open Admin Credentials to verify the connected Gmail sender before any live draft canary request.',
    },
    liveDraftCanaryReadiness: {
      state: canaryState,
      label:
        canaryState === 'passed_no_send'
          ? 'No-send canary passed'
          : canaryState === 'ready_for_no_send_canary'
            ? 'Ready for no-send canary'
            : 'No-send canary blocked',
      detail: args.canaryDetail ?? (
        canaryState === 'ready_for_no_send_canary'
          ? 'The operator may run the no-send canary. It verifies local readiness and connected sender gates without calling Gmail.'
          : args.duplicateDraftEvidence.createdOnce
            ? 'Existing Gmail draft metadata is already present; duplicate draft creation remains blocked.'
            : 'Resolve local readiness or sender readiness blockers before canary review.'
      ),
      providerCallsEnabled: false,
      gmailDraftCreated: false,
      trackingPersisted: false,
      externalSendEnabled: false,
    },
    duplicateDraftEvidence: args.duplicateDraftEvidence,
    externalSendBoundary: {
      blocked: true,
      label: 'External send blocked',
      detail:
        'Gmail draft creation and Gmail send authority are separate gates. A draft, smoke, or canary never authorizes sending.',
    },
    remainingHumanGates: [
      'review_local_draft_handoff_packet',
      'verify_connected_sender_identity',
      'captain_authorize_specific_live_draft_canary',
      'explicit_per_recipient_gmail_draft_authorization',
      'separate_external_send_authority',
    ],
  }
}

export function buildWarmOutreachGmailProviderCapabilitySmokeReadiness(args: {
  smokeKey: string
  oauthConfigured?: boolean
  connectedProfileAvailable?: boolean
  providerConfigured?: boolean
  readOnlySmokeAuthority?: boolean
  blockedReasons?: string[]
  lastSmokeStatus?: Extract<WarmOutreachGmailProviderCapabilitySmokeState, 'smoke_passed' | 'smoke_failed'> | null
  lastSmokeAt?: string | null
  lastSmokeError?: string | null
}): WarmOutreachGmailProviderCapabilitySmokeReadiness {
  const oauthConfigured = args.oauthConfigured ?? args.providerConfigured === true
  const connectedProfileAvailable = args.connectedProfileAvailable ?? args.providerConfigured === true
  const providerConfigured = args.providerConfigured ?? (oauthConfigured && connectedProfileAvailable)
  const blockedReasons = [...new Set(args.blockedReasons ?? [])]
  const status: WarmOutreachGmailProviderCapabilitySmokeState =
    blockedReasons.length > 0
      ? 'blocked'
      : args.lastSmokeStatus ?? (
          providerConfigured && args.readOnlySmokeAuthority === true
            ? 'ready_for_read_only_smoke'
            : providerConfigured
              ? 'waiting_read_only_smoke_authority'
              : 'not_configured'
        )

  return {
    version: 'warm-outreach-gmail-provider-smoke/v1',
    provider: 'gmail',
    status,
    label:
      status === 'ready_for_read_only_smoke'
        ? 'Ready for read-only Gmail smoke'
        : status === 'waiting_read_only_smoke_authority'
          ? 'Gmail provider configured, smoke authority required'
        : status === 'smoke_passed'
          ? 'Read-only Gmail smoke passed'
          : status === 'smoke_failed'
            ? 'Read-only Gmail smoke failed'
            : status === 'blocked'
              ? 'Gmail smoke blocked'
              : 'Gmail provider not activated',
    smokeKey: args.smokeKey,
    oauthConfigured,
    connectedProfileAvailable,
    providerConfigured,
    readOnlySmokeReady: status === 'ready_for_read_only_smoke',
    readOnlySmokeEnabled: false,
    providerCallsEnabled: false,
    externalSendEnabled: false,
    gmailDraftCreationEnabled: false,
    requiredConfig: [
      'Gmail OAuth configuration',
      'Connected Gmail profile',
      'Future explicit read-only smoke authority',
    ],
    blockedReasons,
    lastSmokeAt: args.lastSmokeAt ?? null,
    lastSmokeError: status === 'smoke_failed' ? args.lastSmokeError ?? 'Read-only smoke failed.' : null,
    futureActivationGate:
      'A later captain-lane approval must authorize any Gmail provider smoke; this scaffold records readiness only.',
    notes: [
      'This model does not call Gmail.',
      'Read-only smoke readiness is separate from Gmail draft creation and external send authority.',
      'Gmail draft creation, send, scheduling, Slack action, and provider calls remain disabled.',
    ],
  }
}

export function buildWarmOutreachGmailDraftCreationGate(args: {
  draftCreationKey: string
  internalHandoffReady: boolean
  providerSmoke: WarmOutreachGmailProviderCapabilitySmokeReadiness
  draftCreationAuthority?: boolean
  blockedReasons?: string[]
}): WarmOutreachGmailDraftCreationGate {
  const blockedReasons = [...new Set(args.blockedReasons ?? [])]
  const providerSmokePassed = args.providerSmoke.status === 'smoke_passed'
  const draftCreationAuthority = args.draftCreationAuthority === true
  const status: WarmOutreachGmailDraftCreationGateState =
    blockedReasons.length > 0
      ? 'blocked'
      : !args.internalHandoffReady
        ? 'handoff_blocked'
        : !providerSmokePassed
          ? 'provider_smoke_required'
          : !draftCreationAuthority
            ? 'draft_creation_authority_required'
            : 'ready_for_disabled_activation'

  return {
    version: 'warm-outreach-gmail-draft-creation-gate/v1',
    status,
    label:
      status === 'ready_for_disabled_activation'
        ? 'Ready for disabled Gmail draft creation activation'
        : status === 'draft_creation_authority_required'
          ? 'Gmail draft creation authority required'
          : status === 'provider_smoke_required'
            ? 'Gmail provider smoke required before draft creation'
            : status === 'handoff_blocked'
              ? 'Internal handoff blocked before Gmail draft creation'
              : 'Gmail draft creation blocked',
    draftCreationKey: args.draftCreationKey,
    internalHandoffReady: args.internalHandoffReady,
    providerSmokeStatus: args.providerSmoke.status,
    providerSmokePassed,
    draftCreationAuthority,
    gmailDraftCreationEnabled: false,
    providerCallsEnabled: false,
    externalSendEnabled: false,
    externalSendBlocked: true,
    blockedReasons,
    requiredGates: [
      'internal_gmail_draft_handoff',
      'read_only_gmail_provider_smoke',
      'gmail_draft_creation_authority',
      'duplicate_prevention',
      'external_send_authority_separate_future_gate',
    ],
    notes: [
      'This gate does not create Gmail drafts.',
      'Draft creation stays disabled even when readiness evidence is complete.',
      'External send authority remains a separate future gate.',
    ],
  }
}

function buildGmailDraftHandoffPacket(args: {
  contactId: number
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  mode: WarmOutreachSendMode
  messageVersionKey: string
  handoffIdempotencyKey: string
  draftPacketReady: boolean
  relationshipSourceCount: number
  safeToMentionCount: number
  summarizeOnlyCount: number
  commonalityCount: number
  suppressionReasons: string[]
}): WarmOutreachGmailDraftHandoffPacket {
  const state: WarmOutreachGmailDraftHandoffPacket['state'] =
    args.draftPacketReady
      ? args.mode === 'warm_1_to_many'
        ? 'per_recipient_gate_required'
        : 'ready_for_internal_handoff'
      : 'blocked'
  const contactName = text(args.packet.contactName) ?? null

  return {
    version: 'warm-outreach-gmail-draft-handoff/v1',
    state,
    label:
      state === 'ready_for_internal_handoff'
        ? 'Internal Gmail draft handoff ready'
        : state === 'per_recipient_gate_required'
          ? 'Internal draft handoff is per-recipient only'
          : 'Internal Gmail draft handoff blocked',
    internalHandoffReady: state !== 'blocked',
    channel: 'email',
    contactReference: {
      contactId: args.contactId,
      contactName,
      reference: `contact_submission:${args.contactId}${contactName ? `:${contactName}` : ''}`,
    },
    messageVersionKey: args.messageVersionKey,
    templateDraftBasis: {
      recommendedTemplate: args.readiness.recommendedTemplate,
      selectedChannel: args.readiness.selectedChannel,
      relationshipEventId: args.packet.relationshipEventId ?? null,
      detail: `Use ${args.readiness.recommendedTemplate.replace(/_/g, ' ')} as the internal draft basis for the current message version.`,
    },
    provenanceSummary: {
      relationshipSourceCount: args.relationshipSourceCount,
      relationshipSignalCount: args.packet.relationshipSignals.length,
      safeToMentionCount: args.safeToMentionCount,
      summarizeOnlyCount: args.summarizeOnlyCount,
      commonalityCount: args.commonalityCount,
      detail: hasSourceProvenance(args.packet)
        ? 'Portfolio-local relationship provenance is summarized for the handoff packet.'
        : 'Relationship provenance is missing or only uses the contact record.',
    },
    suppressionStatus: args.suppressionReasons.length > 0 ? 'blocked' : 'clear',
    suppressionReasons: args.suppressionReasons,
    idempotencyKey: args.handoffIdempotencyKey,
    futureApprovalGates: [
      'human_reply_or_draft_approval',
      'provider_capability_smoke',
      'gmail_draft_creation_authority',
      'external_send_authority',
      'send_scheduling',
      'submitted_sent_evidence',
    ],
    gmailProviderActivated: false,
    gmailDraftCreationEnabled: false,
    providerCallsEnabled: false,
    externalSendBlocked: true,
    detail:
      state === 'blocked'
        ? 'Resolve relationship, provenance, personalization, suppression, or duplicate blockers before handoff.'
        : state === 'per_recipient_gate_required'
          ? 'Batch review can prepare handoff evidence only one recipient at a time; no batch Gmail drafts can be created.'
          : 'Operator can review the internal Gmail draft handoff packet; Gmail draft creation and send stay blocked.',
  }
}

function buildEmailSendLifecycle(args: {
  contactId: number
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  mode: WarmOutreachSendMode
  blockers: string[]
  rows?: WarmOutreachMonitoringRows
}): WarmOutreachEmailSendLifecycle {
  const relationshipSourceCount = args.packet.sourceRefs.filter((source) => (
    source.sourceStatus !== 'missing' &&
    source.sourceStatus !== 'blocked' &&
    source.sourceStatus !== 'suppressed'
  )).length
  const safeToMentionCount = args.packet.sourceInventory?.safeToMention.length ?? 0
  const summarizeOnlyCount = args.packet.sourceInventory?.summarizeOnly.length ?? 0
  const commonalityCount = args.packet.commonalities.length
  const suppressionReasons = [...new Set(suppressionBlockers(args.packet, args.readiness))]
  const messageVersionKey = `warm-outreach:email-message-version:v1:${stableHash({
    contactId: args.contactId,
    mode: args.mode,
    relationshipEventId: args.packet.relationshipEventId ?? null,
    selectedChannel: args.readiness.selectedChannel,
    recommendedTemplate: args.readiness.recommendedTemplate,
    relationshipBasis: args.packet.relationshipBasis,
    safeToMention: args.packet.sourceInventory?.safeToMention ?? [],
    summarizeOnly: args.packet.sourceInventory?.summarizeOnly ?? [],
    commonalities: args.packet.commonalities,
  })}`
  const sendQueueIdempotencyKey = `warm-outreach:email-send-queue:v1:${stableHash({
    contactId: args.contactId,
    channel: 'email',
    messageVersionKey,
  })}`
  const providerCapabilitySmokeKey = `warm-outreach:gmail-capability-smoke:v1:${stableHash({
    contactId: args.contactId,
    channel: 'email',
    messageVersionKey,
  })}`
  const submittedEvidenceKey = `warm-outreach:email-submitted-evidence:v1:${stableHash({
    contactId: args.contactId,
    channel: 'email',
    messageVersionKey,
  })}`
  const gmailDraftHandoffKey = `warm-outreach:gmail-draft-handoff:v1:${stableHash({
    contactId: args.contactId,
    channel: 'email',
    messageVersionKey,
  })}`
  const gmailDraftCreationGateKey = `warm-outreach:gmail-draft-creation-gate:v1:${stableHash({
    contactId: args.contactId,
    channel: 'email',
    messageVersionKey,
  })}`
  const localEmailRows = [
    ...asRows(args.rows?.outreachQueue),
    ...asRows(args.rows?.emailMessages),
    ...asRows(args.rows?.contactCommunications),
  ].filter(isEmailRow)
  const duplicateDraftEvidence = firstGmailDraftEvidence(localEmailRows)
  const existingEvidenceIds = localEmailRows
    .map((row, index) => sourceId(row, `email-evidence-${index + 1}`))
    .filter(Boolean)
  const duplicateDetected =
    duplicateDraftEvidence.createdOnce ||
    localEmailRows.some((row) =>
      statusIsActiveSendState(text(row.status)?.toLowerCase() ?? null),
    )
  const hardBlockers = args.blockers.filter((blocker) => !isBatchModeGateBlocker(blocker))
  const draftPacketReady = hardBlockers.length === 0
  const providerCapabilitySmoke = buildWarmOutreachGmailProviderCapabilitySmokeReadiness({
    smokeKey: providerCapabilitySmokeKey,
    providerConfigured: args.packet.channelCapabilities.email?.providerConfigured,
    readOnlySmokeAuthority: false,
    blockedReasons: [
      ...hardBlockers,
      ...(args.mode === 'warm_1_to_many'
        ? ['Batch Gmail provider smoke remains per-recipient only and cannot run from the batch surface.']
        : []),
      ...(duplicateDetected
        ? ['Duplicate prevention found an active local email queue/submission state.']
        : []),
    ],
  })
  const gmailDraftHandoffPacket = buildGmailDraftHandoffPacket({
    contactId: args.contactId,
    packet: args.packet,
    readiness: args.readiness,
    mode: args.mode,
    messageVersionKey,
    handoffIdempotencyKey: gmailDraftHandoffKey,
    draftPacketReady,
    relationshipSourceCount,
    safeToMentionCount,
    summarizeOnlyCount,
    commonalityCount,
    suppressionReasons,
  })
  const gmailDraftCreationGate = buildWarmOutreachGmailDraftCreationGate({
    draftCreationKey: gmailDraftCreationGateKey,
    internalHandoffReady: gmailDraftHandoffPacket.internalHandoffReady,
    providerSmoke: providerCapabilitySmoke,
    draftCreationAuthority: false,
    blockedReasons: [
      ...hardBlockers,
      ...(args.mode === 'warm_1_to_many'
        ? ['Batch Gmail draft creation remains per-recipient only and cannot run from the batch surface.']
        : []),
      ...(duplicateDetected
        ? ['Duplicate prevention found an active local email queue/submission state.']
        : []),
    ],
  })
  const gmailProviderActivationReadiness = buildWarmOutreachGmailProviderActivationReadiness({
    handoff: gmailDraftHandoffPacket,
    providerSmoke: providerCapabilitySmoke,
    draftCreationGate: gmailDraftCreationGate,
    duplicateDraftEvidence,
  })
  const externalSendReadiness: WarmOutreachExternalSendReadiness = {
    version: 'warm-outreach-external-send-readiness/v1',
    state: 'blocked_pending_authority',
    label: 'External Gmail send authority blocked',
    senderIdentity: {
      state: gmailProviderActivationReadiness.connectedSenderReadiness.connectedAs
        ? 'verified_for_draft_only'
        : 'not_verified',
      requiredSender: gmailProviderActivationReadiness.connectedSenderReadiness.requiredSender,
      connectedAs: gmailProviderActivationReadiness.connectedSenderReadiness.connectedAs,
      detail:
        'Sender identity must be verified for this contact and message version before a separate external-send authority request.',
    },
    recipientApproval: {
      state: 'required',
      contactId: args.contactId,
      approved: false,
      detail:
        'No per-recipient external-send approval is recorded. Draft approval and draft existence do not authorize sending.',
    },
    draftEvidence: {
      state: duplicateDraftEvidence.createdOnce ? 'tracked' : 'missing',
      gmailDraftExists: duplicateDraftEvidence.createdOnce,
      draftId: duplicateDraftEvidence.draftId,
      threadId: duplicateDraftEvidence.threadId,
      messageId: duplicateDraftEvidence.messageId,
      sourceIds: duplicateDraftEvidence.sourceIds,
      detail: duplicateDraftEvidence.createdOnce
        ? 'A Gmail draft exists as tracking evidence only. It does not grant send authority.'
        : 'No tracked Gmail draft evidence is recorded. External send still remains blocked.',
    },
    suppressionConsent: {
      state: suppressionReasons.length > 0 ? 'blocked' : 'clear',
      reasons: suppressionReasons,
      detail: suppressionReasons[0] ?? 'No suppression blocker is recorded, but explicit per-recipient send approval is still required.',
    },
    idempotency: {
      messageVersionKey,
      sendQueueIdempotencyKey,
      submittedEvidenceKey,
      duplicateDetected,
      detail: duplicateDetected
        ? 'Duplicate prevention found existing local email evidence; do not create another send path.'
        : 'Future external-send review must reuse the stable contact/channel/message-version keys.',
    },
    externalSend: {
      enabled: false,
      approved: false,
      blocked: true,
      detail:
        'Portfolio cannot send this Gmail message from this state. Gmail drafts, canaries, and provider smoke evidence are not send permission.',
      nextStep:
        'Ask the Integration Captain for explicit per-recipient external-send authority after sender identity, suppression, draft evidence, and final copy are reviewed.',
    },
  }
  const realRecipientRolloutReadiness = buildRealRecipientGmailRolloutReadiness({
    contactId: args.contactId,
    handoff: gmailDraftHandoffPacket,
    providerSmoke: providerCapabilitySmoke,
    lifecycle: {
      messageVersionKey,
      sendQueueIdempotencyKey,
      submittedEvidenceKey,
    },
    localEmailRows,
    hardBlockers,
    suppressionReasons,
  })
  const state: WarmOutreachEmailSendLifecycle['state'] =
    args.mode === 'warm_1_to_many' && hardBlockers.length === 0
        ? 'per_recipient_gate_required'
        : hardBlockers.length > 0
          ? 'blocked'
          : 'blocked_before_provider_activation'

  return {
    version: 'warm-outreach-email-send-lifecycle/v1',
    contactId: args.contactId,
    mode: args.mode,
    channel: 'email',
    label:
      state === 'blocked'
        ? 'Email send path blocked'
        : state === 'per_recipient_gate_required'
          ? 'Email is first candidate, per-recipient gate required'
          : 'Email is first candidate, provider/send activation blocked',
    state,
    firstCandidateChannel: true,
    sendReady: false,
    providerExecutionEnabled: false,
    externalSendEnabled: false,
    gmailDraftCreationEnabled: false,
    schedulingEnabled: false,
    messageVersionKey,
    sendQueueIdempotencyKey,
    providerCapabilitySmokeKey,
    gmailDraftCreationGateKey,
    submittedEvidenceKey,
    gmailDraftHandoffPacket,
    providerCapabilitySmoke,
    gmailDraftCreationGate,
    gmailProviderActivationReadiness,
    externalSendReadiness,
    realRecipientRolloutReadiness,
    duplicatePrevention: {
      scope: 'contact_channel_message_version',
      duplicateDetected,
      existingEvidenceIds,
      requiredUniqueKeys: [
        messageVersionKey,
        gmailDraftHandoffKey,
        gmailDraftCreationGateKey,
        sendQueueIdempotencyKey,
        providerCapabilitySmokeKey,
        submittedEvidenceKey,
      ],
      detail: duplicateDetected
        ? 'An active local email queue/submission state already exists; do not create a duplicate send path.'
        : 'Future send activation must reuse these keys to prevent duplicate contact/channel/message-version execution.',
    },
    suppressionCheck: {
      status: suppressionReasons.length > 0 ? 'blocked' : 'clear',
      reasons: suppressionReasons,
    },
    relationshipProvenance: {
      status: hasSourceProvenance(args.packet) ? 'present' : 'missing',
      sourceCount: relationshipSourceCount,
      signalCount: args.packet.relationshipSignals.length,
      relationshipEventId: args.packet.relationshipEventId ?? null,
      detail: hasSourceProvenance(args.packet)
        ? 'Portfolio-local relationship provenance is attached.'
        : 'Relationship provenance must be added before send authority review.',
    },
    personalizationProvenance: {
      status: hasPersonalizationBasis(args.packet) ? 'present' : 'missing',
      safeToMentionCount,
      summarizeOnlyCount,
      commonalityCount,
      detail: hasPersonalizationBasis(args.packet)
        ? 'Personalization context is available from local evidence.'
        : 'Personalization context is missing; add safe-to-mention, summarize-only, or commonality evidence.',
    },
    auditState: {
      status: 'scaffold_only',
      notes: [
        'Email is the first candidate channel for future activation review.',
        'No Gmail draft, Gmail send, provider smoke, schedule, or submitted evidence mutation is enabled.',
        'A later explicit provider/send approval gate is required before any external action.',
      ],
    },
    stages: [
      lifecycleStage({
        key: 'draft_packet',
        label: 'Draft packet',
        status: draftPacketReady ? 'ready_for_review' : 'blocked',
        detail: draftPacketReady
          ? 'Local relationship and personalization context can be reviewed as a draft packet.'
          : hardBlockers[0] ?? 'Resolve readiness blockers before draft packet review.',
      }),
      lifecycleStage({
        key: 'human_reply_or_draft_approval',
        label: 'Human draft approval',
        status: 'future_gate',
        detail: 'A human must approve the exact reply or draft packet before any send authority review.',
      }),
      lifecycleStage({
        key: 'send_authority_review',
        label: 'Send authority review',
        status: gmailDraftCreationGate.status === 'ready_for_disabled_activation' ? 'ready_for_review' : 'future_gate',
        detail:
          gmailDraftCreationGate.status === 'ready_for_disabled_activation'
            ? 'All readiness evidence is present, but Gmail draft creation remains disabled until the feature flag and human gate are approved.'
            : 'Future explicit authority is required for this contact, channel, and message version.',
      }),
      lifecycleStage({
        key: 'provider_capability_smoke',
        label: 'Provider capability smoke',
        status:
          providerCapabilitySmoke.status === 'smoke_passed'
            ? 'ready_for_review'
            : providerCapabilitySmoke.status === 'ready_for_read_only_smoke' || providerCapabilitySmoke.status === 'waiting_read_only_smoke_authority'
              ? 'future_gate'
              : 'blocked',
        detail:
          providerCapabilitySmoke.status === 'smoke_passed'
            ? 'Read-only Gmail provider smoke evidence is present; no draft creation or send authority is implied.'
            : providerCapabilitySmoke.futureActivationGate,
      }),
      lifecycleStage({
        key: 'scheduled_send_queue',
        label: 'Scheduled send queue',
        status: duplicateDetected ? 'blocked' : 'disabled',
        detail: duplicateDetected
          ? 'Duplicate prevention found an active local email queue/submission state.'
          : 'Scheduling is modeled but disabled until provider/send activation.',
      }),
      lifecycleStage({
        key: 'submitted_sent_evidence',
        label: 'Submitted/sent evidence',
        status: 'evidence_required',
        detail: 'Submitted or sent evidence must be recorded after a future approved provider action.',
      }),
    ],
  }
}

function buildSendAuthority(args: {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  channel: WarmOutreachChannel
  mode: WarmOutreachSendMode
  idempotencyKey: string
  blockers: string[]
}): WarmOutreachSendAuthority {
  const capability = args.packet.channelCapabilities[args.channel]
  const channelLabel = CHANNEL_LABELS[args.channel]
  const suppressionReasons = suppressionBlockers(args.packet, args.readiness)
  const manualOnly = Boolean(capability?.manualOnly || args.channel === 'facebook' || args.channel === 'phone_contact')
  const unavailable = !capability?.available
  const providerStatus: WarmOutreachSendAuthorityGate['status'] =
    unavailable ? 'blocked' : manualOnly ? 'manual_required' : 'future_gate'
  const sourceProvenance = hasSourceProvenance(args.packet)
  const relationshipIsWeak = weakRelationshipBasis(args.packet)
  const personalization = hasPersonalizationBasis(args.packet)
  const gates = [
    gate({
      key: 'target_source_provenance',
      label: 'Target and source provenance',
      status: sourceProvenance ? 'satisfied' : 'blocked',
      detail: sourceProvenance
        ? 'Portfolio-local relationship evidence is attached beyond the contact row.'
        : 'Add a meeting, prior outreach row, reply, task, manual note, or approved source record before activation review.',
    }),
    gate({
      key: 'relationship_basis',
      label: 'Relationship basis',
      status: relationshipIsWeak ? 'blocked' : 'satisfied',
      detail: relationshipIsWeak
        ? 'Warm basis is too thin for governed send authority.'
        : 'Warm basis has local supporting evidence.',
    }),
    gate({
      key: 'consent_suppression',
      label: 'Consent and suppression',
      status: suppressionReasons.length > 0 ? 'blocked' : 'satisfied',
      detail: suppressionReasons[0] ?? 'No DNC, unsubscribe, removed, or readiness suppression blocker is recorded.',
    }),
    gate({
      key: 'personalization',
      label: 'Personalization',
      status: personalization ? 'satisfied' : 'blocked',
      detail: personalization
        ? 'Local relationship context can support a personalized review packet.'
        : 'Add safe-to-mention, summarize-only, signal, or commonality context before activation review.',
    }),
    gate({
      key: 'human_approval',
      label: 'Human approval',
      status: 'future_gate',
      detail: 'A future activation request still needs explicit human approval for this channel and mode.',
    }),
    gate({
      key: 'provider_capability',
      label: 'Provider capability',
      status: providerStatus,
      detail: unavailable
        ? `${channelLabel} is not available for this contact.`
        : manualOnly
          ? `${channelLabel} remains a manual operator channel outside Portfolio provider execution.`
          : `${channelLabel} can be reviewed for future provider capability, but provider execution is disabled now.`,
    }),
    gate({
      key: 'idempotency',
      label: 'Idempotency',
      status: 'satisfied',
      detail: `Stable activation-review key: ${args.idempotencyKey}.`,
    }),
    gate({
      key: 'send_scheduling',
      label: 'Send scheduling',
      status: 'future_gate',
      detail: 'Scheduling is modeled as a future gate and is disabled in this scaffold.',
    }),
    gate({
      key: 'outcome_tracking',
      label: 'Outcome tracking',
      status: 'future_gate',
      detail: 'Outcome tracking must connect to local rows before any provider send can be activated.',
    }),
    gate({
      key: 'response_follow_up',
      label: 'Response follow-up',
      status: 'future_gate',
      detail: 'Response follow-up remains local review-only; provider polling and external monitoring are disabled.',
    }),
  ]
  const gateBlockers = gates
    .filter((item) => item.status === 'blocked')
    .map((item) => `${item.label}: ${item.detail}`)
  const blockers = [...new Set([...args.blockers, ...gateBlockers])]
  const state: WarmOutreachSendAuthority['state'] =
    blockers.length > 0 || unavailable
      ? 'blocked'
      : manualOnly
        ? 'manual_only'
        : 'eligible_for_future_activation'
  const futureActivationEligible = state === 'eligible_for_future_activation'

  return {
    version: 'warm-outreach-send-authority/v1',
    mode: args.mode,
    channel: args.channel,
    label:
      state === 'blocked'
        ? `${channelLabel} send authority blocked`
        : state === 'manual_only'
          ? `${channelLabel} manual authority review`
          : `${channelLabel} eligible for future send-authority review`,
    state,
    futureActivationEligible,
    externalSendApproved: false,
    externalSendEnabled: false,
    providerExecutionEnabled: false,
    gmailDraftCreationEnabled: false,
    schedulingEnabled: false,
    outcomeTrackingEnabled: false,
    humanApprovalRequired: true,
    idempotencyKey: args.idempotencyKey,
    gates,
    blockers,
    manualSteps: manualOnly
      ? [
          'Review the relationship packet in Portfolio.',
          `Complete ${channelLabel} contact manually outside provider automation if approved later.`,
          'Record the outcome back into local Portfolio rows.',
        ]
      : [],
    nextReviewAction:
      state === 'blocked'
        ? blockers[0] ?? 'Resolve send-authority blockers before activation review.'
        : state === 'manual_only'
          ? 'Manual-only channel: prepare an operator review packet; no provider action is available.'
          : 'Prepare send packet for a future approval request; external sends remain disabled.',
  }
}

function buildChannelReadiness(args: {
  contactId: number
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  channel: WarmOutreachChannel
  mode: WarmOutreachSendMode
  rows?: WarmOutreachMonitoringRows
}): WarmOutreachChannelSendReadiness {
  const capability = args.packet.channelCapabilities[args.channel]
  const blockers = baseSendBlockers(args)
  const idempotencyKey = `warm-outreach:send-readiness:v1:${stableHash({
    contactId: args.contactId,
    mode: args.mode,
    channel: args.channel,
  })}`
  const gatesRemaining = [
    'target_source_provenance',
    'relationship_basis',
    'consent_suppression',
    'personalization',
    'human_reply_or_draft_approval',
    'external_send_authority',
    'provider_execution_gate',
    'send_scheduling',
    'outcome_tracking',
    'response_follow_up',
  ]
  const auditNotes = [
    `${args.mode} ${CHANNEL_LABELS[args.channel]} readiness is scaffold-only.`,
    'No provider, scheduling, draft creation, or external send execution is enabled.',
  ]
  const readinessBase = {
    mode: args.mode,
    channel: args.channel,
    sendReady: false as const,
    externalSendEnabled: false as const,
    providerExecutionEnabled: false as const,
    humanApprovalRequired: true as const,
    idempotencyKey,
    blockers,
    gatesRemaining,
    auditNotes,
  }

  if (!capability?.available) {
    blockers.push(`${CHANNEL_LABELS[args.channel]} is not available for this contact.`)
    const emailSendLifecycle = args.channel === 'email'
      ? buildEmailSendLifecycle({
          contactId: args.contactId,
          packet: args.packet,
          readiness: args.readiness,
          mode: args.mode,
          blockers,
          rows: args.rows,
        })
      : null
    const sendAuthority = buildSendAuthority({
      packet: args.packet,
      readiness: args.readiness,
      channel: args.channel,
      mode: args.mode,
      idempotencyKey,
      blockers,
    })
    return {
      ...readinessBase,
      label: `${CHANNEL_LABELS[args.channel]} unavailable`,
      state: 'unavailable',
      sendAuthority,
      emailSendLifecycle,
    }
  }

  if (blockers.length > 0) {
    const emailSendLifecycle = args.channel === 'email'
      ? buildEmailSendLifecycle({
          contactId: args.contactId,
          packet: args.packet,
          readiness: args.readiness,
          mode: args.mode,
          blockers,
          rows: args.rows,
        })
      : null
    const sendAuthority = buildSendAuthority({
      packet: args.packet,
      readiness: args.readiness,
      channel: args.channel,
      mode: args.mode,
      idempotencyKey,
      blockers,
    })
    return {
      ...readinessBase,
      label: `${CHANNEL_LABELS[args.channel]} blocked`,
      state: 'blocked',
      sendAuthority,
      emailSendLifecycle,
    }
  }

  if (capability.manualOnly || args.channel === 'facebook' || args.channel === 'phone_contact') {
    const manualGates = [...gatesRemaining, 'manual_operator_action_outside_portfolio']
    const emailSendLifecycle = args.channel === 'email'
      ? buildEmailSendLifecycle({
          contactId: args.contactId,
          packet: args.packet,
          readiness: args.readiness,
          mode: args.mode,
          blockers,
          rows: args.rows,
        })
      : null
    const sendAuthority = buildSendAuthority({
      packet: args.packet,
      readiness: args.readiness,
      channel: args.channel,
      mode: args.mode,
      idempotencyKey,
      blockers,
    })
    return {
      ...readinessBase,
      label: `${CHANNEL_LABELS[args.channel]} manual review only`,
      state: 'manual_review_only',
      gatesRemaining: manualGates,
      sendAuthority,
      emailSendLifecycle,
    }
  }

  const emailSendLifecycle = args.channel === 'email'
    ? buildEmailSendLifecycle({
        contactId: args.contactId,
        packet: args.packet,
        readiness: args.readiness,
        mode: args.mode,
        blockers,
        rows: args.rows,
      })
    : null
  const sendAuthority = buildSendAuthority({
    packet: args.packet,
    readiness: args.readiness,
    channel: args.channel,
    mode: args.mode,
    idempotencyKey,
    blockers,
  })
  return {
    ...readinessBase,
    label: `${CHANNEL_LABELS[args.channel]} provider gate required`,
    state: 'provider_gate_required',
    sendAuthority,
    emailSendLifecycle,
  }
}

export function buildWarmOutreachSendReadiness(args: {
  contactId: number
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  rows?: WarmOutreachMonitoringRows
}): WarmOutreachSendReadiness {
  const channels: WarmOutreachChannel[] = ['email', 'linkedin', 'facebook', 'phone_contact']
  const modes: WarmOutreachSendMode[] = ['warm_1_to_1', 'warm_1_to_many']

  return {
    version: 'warm-outreach-send-readiness/v1',
    contactId: args.contactId,
    perRecipientIdempotencyKey: `warm-outreach:recipient:v1:${stableHash({
      contactId: args.contactId,
      relationshipEventId: args.packet.relationshipEventId ?? null,
      selectedChannel: args.readiness.selectedChannel,
    })}`,
    modes: Object.fromEntries(
      modes.map((mode) => [
        mode,
        channels.map((channel) =>
          buildChannelReadiness({
            contactId: args.contactId,
            packet: args.packet,
            readiness: args.readiness,
            channel,
            mode,
            rows: args.rows,
          }),
        ),
      ]),
    ) as WarmOutreachSendReadiness['modes'],
    executionBoundary: {
      gmailEmailSend: false,
      linkedinAction: false,
      facebookAction: false,
      phoneAction: false,
      providerExecution: false,
      scheduling: false,
      externalMonitoring: false,
      gmailDraftCreation: false,
      outcomeTracking: false,
    },
  }
}

export function buildWarmOutreachResponseMonitoring(args: {
  contactId: number
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  rows: WarmOutreachMonitoringRows
  now?: Date
  staleAfterDays?: number
}): WarmOutreachResponseMonitoring {
  const staleAfterDays = args.staleAfterDays ?? 7
  const now = args.now ?? new Date()
  const inboundCommunicationRows = asRows(args.rows.contactCommunications).filter(isInboundResponse)
  const inboundEmailRows = asRows(args.rows.emailMessages).filter(isInboundResponse)
  const responseRows = [...inboundCommunicationRows, ...inboundEmailRows]
  const latestResponse = newestRow(responseRows)
  const latestOutbound = newestRow(asRows(args.rows.outreachQueue))
  const latestOutboundAt = latestOutbound ? rowTimestamp(latestOutbound) : null
  const latestResponseAt = latestResponse ? rowTimestamp(latestResponse) : null
  const expectedReplyBy = latestOutboundAt
    ? new Date(Date.parse(latestOutboundAt) + staleAfterDays * 24 * 60 * 60_000).toISOString()
    : null
  const blockedReasons = [...new Set(suppressionBlockers(args.packet, args.readiness))]
  const evidence = [
    ...inboundCommunicationRows.map((row) => summarizeResponseEvidence(row, 'contact_communications')),
    ...inboundEmailRows.map((row) => summarizeResponseEvidence(row, 'email_messages')),
    ...asRows(args.rows.outreachQueue).map(outboundEvidence),
    ...asRows(args.rows.actionTasks).map(taskEvidence),
  ]
  const responseIsManual = latestResponse ? isManualResponse(latestResponse) : false
  const hasResponse = Boolean(latestResponse)
  const outboundIsStale =
    Boolean(latestOutboundAt) &&
    !hasResponse &&
    Date.parse(latestOutboundAt as string) + staleAfterDays * 24 * 60 * 60_000 < now.getTime()
  const mode: WarmOutreachResponseMonitoringMode =
    blockedReasons.length > 0
      ? 'blocked'
      : hasResponse
        ? responseIsManual ? 'manual' : 'imported'
        : 'pending'
  const status: WarmOutreachResponseMonitoringStatus =
    mode === 'blocked'
      ? 'blocked'
      : hasResponse
        ? responseIsManual ? 'manual_response_captured' : 'imported_response_captured'
        : outboundIsStale ? 'stale_no_response' : 'awaiting_response'
  const proposedFollowUp =
    status === 'blocked'
      ? {
          state: 'blocked_review' as const,
          label: 'Resolve blocker before follow-up',
          description: blockedReasons[0] ?? 'Resolve relationship or suppression blockers before any follow-up.',
          requiresHumanApproval: true as const,
          idempotencyKey: `warm-outreach:monitoring-follow-up:v1:${stableHash({ contactId: args.contactId, status, blockedReasons })}`,
        }
      : hasResponse
        ? {
            state: 'review_response' as const,
            label: 'Review captured response',
            description: 'Review the captured response, local reply draft, suppression proposal, or follow-up task before any external channel is used.',
            requiresHumanApproval: true as const,
            idempotencyKey: `warm-outreach:monitoring-follow-up:v1:${stableHash({ contactId: args.contactId, status, latestResponseAt })}`,
          }
        : outboundIsStale
          ? {
              state: 'stale_follow_up_review' as const,
              label: 'Review stale no-response follow-up',
              description: 'A local outreach row is past the expected reply window. Review relationship evidence and channel gates before proposing another touch.',
              requiresHumanApproval: true as const,
              idempotencyKey: `warm-outreach:monitoring-follow-up:v1:${stableHash({ contactId: args.contactId, status, latestOutboundAt })}`,
            }
          : {
              state: 'manual_import' as const,
              label: 'Await manual or imported response evidence',
              description: 'No response is recorded yet. Manual import is available; provider polling remains disabled.',
              requiresHumanApproval: true as const,
              idempotencyKey: `warm-outreach:monitoring-follow-up:v1:${stableHash({ contactId: args.contactId, status, latestOutboundAt })}`,
            }

  return {
    version: 'warm-outreach-response-monitoring/v1',
    contactId: args.contactId,
    status,
    mode,
    label: status.replace(/_/g, ' '),
    expectedReplyBy,
    latestOutboundAt,
    latestResponseAt,
    staleAfterDays,
    perRecipientIdempotencyKey: `warm-outreach:monitoring-recipient:v1:${stableHash({
      contactId: args.contactId,
      latestOutboundAt,
      latestResponseAt,
    })}`,
    evidence,
    proposedFollowUp,
    blockedReasons,
    auditNotes: [
      'Monitoring is derived from local Portfolio rows only.',
      'Manual/imported response evidence can be reviewed; provider polling remains disabled.',
      'No external send, provider action, Gmail draft, Slack action, n8n dispatch, or schedule is executed.',
    ],
    sendReadiness: buildWarmOutreachSendReadiness({
      contactId: args.contactId,
      packet: args.packet,
      readiness: args.readiness,
      rows: args.rows,
    }),
    executionBoundary: {
      localRowsOnly: true,
      manualImportEnabled: true,
      providerResponseImportEnabled: false,
      providerPollingEnabled: false,
      externalMonitoringEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      linkedinActionEnabled: false,
      facebookActionEnabled: false,
      phoneActionEnabled: false,
      slackActionEnabled: false,
      n8nDispatchEnabled: false,
    },
  }
}
