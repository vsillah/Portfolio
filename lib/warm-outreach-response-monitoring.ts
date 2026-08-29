import { createHash } from 'crypto'

import type {
  WarmOutreachChannel,
  WarmOutreachReadiness,
  WarmOutreachRelationshipPacket,
} from './warm-outreach-relationship-intelligence'
import {
  buildWarmOutreachGmailResponseImportCanaryReadiness,
  buildWarmOutreachGmailResponseImportActivationReadiness,
  type WarmOutreachGmailResponseImportActivationReadiness,
  type WarmOutreachGmailResponseImportCanaryReadiness,
} from './warm-outreach-gmail-response-import'
import {
  buildWarmGmailOperatingLoop,
  type WarmGmailOperatingLoop,
} from './warm-outreach-gmail-operating-loop'

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
    | 'eligible_for_execution'
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
    execution: {
      state:
        | 'approval_needed'
        | 'approval_requested'
        | 'approved_for_send'
        | 'eligible_for_execution'
        | 'sent'
        | 'blocked'
        | 'failed'
      sourceIds: string[]
      detail: string
    }
  }
  blockers: string[]
  auditReceipt?: {
    version: 'warm-gmail-canary-proof-receipt/v1'
    queueRow: {
      sourceId: string | null
      contactId: number
      relationshipPacketReference: string
      messageVersionKey: string
      sendQueueIdempotencyKey: string
      submittedEvidenceKey: string
    }
    recipientIdentity: {
      channel: 'email'
      requiredSender: string | null
      connectedAs: string | null
      senderState: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['senderMatch']['state']
    }
    approvalEvidence: {
      slackApprovalStatus: WarmOutreachRealRecipientGmailRolloutReadiness['slackApprovalContract']['status']
      slackDispatchStatus: WarmOutreachRealRecipientGmailRolloutReadiness['slackApprovalContract']['slackDispatchStatus']
      portfolioAuthorizationState: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['authorization']['state']
      decisionKey: string | null
      recordsAuthorizationIntentOnly: true
      gmailSendCalledByApproval: false
    }
    draftEvidence: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['draftEvidence']
    suppressionAndIdempotency: {
      suppressionState: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['suppression']['state']
      suppressionReasons: string[]
      duplicateDetected: boolean
      submittedEvidenceRecorded: boolean
    }
    gmailCapability: {
      providerState: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['provider']['state']
      providerDetail: string
      senderDetail: string
    }
    finalSendAuthority: {
      state:
        | 'blocked'
        | 'awaiting_authorization'
        | 'authorization_recorded_execution_blocked'
        | 'eligible_for_exact_execution'
        | 'sent_do_not_resend'
        | 'repair_required_do_not_resend'
      liveSendActionEnabled: false
      detail: string
      nextStep: string
    }
    lastActionEvidence: {
      status: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['execution']['state']
      sourceIds: string[]
      detail: string
      repairRequired: boolean
    }
  }
  slackApprovalContract: {
    route: string
    method: 'POST'
    dispatchEnabled: false
    actionIds: ['warm_gmail_send.approve', 'warm_gmail_send.reject', 'warm_gmail_send.revise']
    payloadDedupeKey: string
    status: 'not_sent' | 'pending' | 'approved' | 'rejected' | 'revision_requested'
    requestKey: string | null
    slackDispatchStatus: 'not_sent'
    recordsAuthorizationIntentOnly: true
    gmailSendCalled: false
    providerExecutionEnabled: false
    approvalRequestRecovery: {
      status: 'portfolio_request_available_slack_dispatch_disabled'
      label: string
      detail: string
      nextAction: string
    }
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

export type WarmOutreachGmailProviderExecutionReadiness = {
  version: 'warm-outreach-gmail-provider-execution-readiness/v1'
  state:
    | 'blocked'
    | 'approval_needed'
    | 'approval_recorded_activation_required'
    | 'eligible_when_admin_activation_enabled'
    | 'sent_do_not_resend'
  label: string
  liveExecutionEnabled: false
  providerCallsEnabled: false
  externalSendEnabled: false
  adminActivationGate: {
    key: 'ENABLE_WARM_GMAIL_SEND_EXECUTION'
    state: 'disabled'
    detail: string
  }
  operatorDecision: {
    status: WarmOutreachRealRecipientGmailRolloutReadiness['slackApprovalContract']['status']
    nextAction: string
    approvalRoute: string
    recordsAuthorizationIntentOnly: true
  }
  exactExecutionGate: {
    route: '/api/admin/outreach/[id]/gmail-user-send'
    method: 'POST'
    enabledOnThisSurface: false
    sendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient'
    messageVersionKey: string
    sendQueueIdempotencyKey: string
    submittedEvidenceKey: string
    detail: string
  }
  canaryTrace: {
    queueId: string | null
    status: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['execution']['state']
    sentEvidenceRecorded: boolean
    gmailMessageId: string | null
    gmailThreadId: string | null
    detail: string
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
  gmailProviderExecutionReadiness: WarmOutreachGmailProviderExecutionReadiness
  gmailOperatingLoop: WarmGmailOperatingLoop
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

export type WarmOutreachGmailResponseImportReadiness = {
  version: 'warm-outreach-gmail-response-import-readiness/v1'
  state: 'dry_run_ready' | 'response_evidence_ready' | 'manual_recovery_required' | 'blocked'
  label: string
  provider: 'gmail'
  dryRunImportEnabled: true
  liveProviderImportEnabled: false
  providerPollingEnabled: false
  gmailApiCalled: false
  externalActionsEnabled: false
  gmailDraftCreationEnabled: false
  slackDispatchEnabled: false
  n8nDispatchEnabled: false
  activationReadiness?: WarmOutreachGmailResponseImportActivationReadiness
  matchBasis: Array<{
    key:
      | 'gmail_thread_id'
      | 'gmail_message_id'
      | 'queue_id'
      | 'contact_id'
      | 'normalized_recipient'
      | 'subject_fingerprint'
    label: string
    available: boolean
    detail: string
  }>
  latestCandidate: {
    status:
      | 'ready_for_mock_import'
      | 'imported_response_recorded'
      | 'manual_recovery_required'
      | 'blocked'
    confidence: 'none' | 'low' | 'medium' | 'high'
    providerThreadId: string | null
    providerMessageId: string | null
    matchedOutreachQueueId: string | null
    matchedContactId: number
    provenanceSourceId: string | null
    nextAction: string
    recoveryPath: string
  }
  dedupe: {
    provider: 'gmail'
    keys: string[]
    duplicateReplayBlocked: true
    detail: string
  }
  canaryReadiness: WarmOutreachGmailResponseImportCanaryReadiness
  auditNotes: string[]
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
  providerCaptureReadiness: {
    version: 'warm-outreach-provider-response-capture-readiness/v1'
    state: 'manual_capture_ready' | 'provider_assisted_readiness' | 'blocked'
    label: string
    responseCaptureKey: string
    supportedClassifications: Array<{
      key:
        | 'interested'
        | 'question'
        | 'referral'
        | 'objection'
        | 'not_now'
        | 'unsubscribe_do_not_contact'
        | 'negative_sensitive'
        | 'ambiguous'
      label: string
      humanReviewRequired: true
    }>
    providers: Array<{
      provider: 'gmail' | 'linkedin' | 'facebook' | 'phone_contact'
      channel: WarmOutreachChannel
      state: 'readiness_metadata_only' | 'manual_capture_only' | 'blocked_provider_gate'
      label: string
      detail: string
      manualCaptureEnabled: boolean
      providerIngestionEnabled: false
      providerPollingEnabled: false
      externalMonitoringEnabled: false
      externalActionEnabled: false
    }>
    slackAlertReadiness: {
      state: 'metadata_deeplink_only'
      label: string
      deepLinkReady: boolean
      dispatchEnabled: false
      slackActionEnabled: false
      route: '/admin/contacts/[id]'
      detail: string
    }
  }
  operatorDecisionPaths: Array<{
    key:
      | 'capture_response'
      | 'review_reply_draft'
      | 'suppression_proposal'
      | 'interested_task'
      | 'next_touch_timing'
      | 'slack_alert_metadata'
    label: string
    state: 'available' | 'pending_human_qa' | 'blocked' | 'readiness_only'
    description: string
    requiresHumanApproval: true
    externalActionEnabled: false
    idempotencyKey: string
  }>
  blockedReasons: string[]
  auditNotes: string[]
  gmailResponseImportReadiness: WarmOutreachGmailResponseImportReadiness
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

function rowSourceId(row: PortfolioRow): string | null {
  return text(row.source_id) ?? text(metadata(row).source_id)
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

function supportedResponseClassifications(): WarmOutreachResponseMonitoring['providerCaptureReadiness']['supportedClassifications'] {
  return [
    ['interested', 'Interested'],
    ['question', 'Question'],
    ['referral', 'Referral'],
    ['objection', 'Objection'],
    ['not_now', 'Not now'],
    ['unsubscribe_do_not_contact', 'Unsubscribe / do not contact'],
    ['negative_sensitive', 'Negative / sensitive'],
    ['ambiguous', 'Ambiguous'],
  ].map(([key, label]) => ({
    key: key as WarmOutreachResponseMonitoring['providerCaptureReadiness']['supportedClassifications'][number]['key'],
    label,
    humanReviewRequired: true,
  }))
}

function buildProviderCaptureReadiness(args: {
  contactId: number
  packet: WarmOutreachRelationshipPacket
  status: WarmOutreachResponseMonitoringStatus
  blockedReasons: string[]
  latestOutboundAt: string | null
  latestResponseAt: string | null
}): WarmOutreachResponseMonitoring['providerCaptureReadiness'] {
  const responseCaptureKey = `warm-outreach:response-capture:v1:${stableHash({
    contactId: args.contactId,
    latestOutboundAt: args.latestOutboundAt,
    latestResponseAt: args.latestResponseAt,
  })}`
  const providerRows: WarmOutreachResponseMonitoring['providerCaptureReadiness']['providers'] = [
    ['gmail', 'email'],
    ['linkedin', 'linkedin'],
    ['facebook', 'facebook'],
    ['phone_contact', 'phone_contact'],
  ].map(([provider, channel]) => {
    const typedChannel = channel as WarmOutreachChannel
    const capability = args.packet.channelCapabilities[typedChannel]
    const manualOnly = capability?.manualOnly || typedChannel === 'facebook' || typedChannel === 'phone_contact'
    const providerConfigured = capability?.providerConfigured === true && !manualOnly
    const state =
      args.blockedReasons.length > 0
        ? 'blocked_provider_gate'
        : providerConfigured
          ? 'readiness_metadata_only'
          : manualOnly
            ? 'manual_capture_only'
            : 'blocked_provider_gate'
    const label =
      state === 'readiness_metadata_only'
        ? `${CHANNEL_LABELS[typedChannel]} metadata ready`
      : state === 'manual_capture_only'
          ? typedChannel === 'phone_contact'
            ? 'Phone manual capture only'
            : typedChannel === 'facebook'
              ? 'Facebook manual capture only'
              : `${CHANNEL_LABELS[typedChannel]} manual capture only`
          : `${CHANNEL_LABELS[typedChannel]} provider gate blocked`

    return {
      provider: provider as WarmOutreachResponseMonitoring['providerCaptureReadiness']['providers'][number]['provider'],
      channel: typedChannel,
      state,
      label,
      detail:
        state === 'readiness_metadata_only'
          ? 'Provider identifiers may be stored on a manually reviewed capture, but provider polling and import jobs remain disabled.'
          : state === 'manual_capture_only'
            ? 'Capture the response manually in Portfolio and link it to the contact or outreach queue row.'
            : args.blockedReasons[0] ?? capability?.reason ?? 'A provider capability gate must clear before provider-assisted response capture can be represented.',
      manualCaptureEnabled: args.blockedReasons.length === 0,
      providerIngestionEnabled: false,
      providerPollingEnabled: false,
      externalMonitoringEnabled: false,
      externalActionEnabled: false,
    }
  })
  const hasProviderReadiness = providerRows.some((provider) => provider.state === 'readiness_metadata_only')
  const state: WarmOutreachResponseMonitoring['providerCaptureReadiness']['state'] =
    args.blockedReasons.length > 0
      ? 'blocked'
      : hasProviderReadiness
        ? 'provider_assisted_readiness'
        : 'manual_capture_ready'

  return {
    version: 'warm-outreach-provider-response-capture-readiness/v1',
    state,
    label:
      state === 'blocked'
        ? 'Response capture blocked by contact readiness'
        : state === 'provider_assisted_readiness'
          ? 'Provider-assisted metadata ready; polling disabled'
          : 'Manual response capture ready',
    responseCaptureKey,
    supportedClassifications: supportedResponseClassifications(),
    providers: providerRows,
    slackAlertReadiness: {
      state: 'metadata_deeplink_only',
      label: 'Slack alert metadata only',
      deepLinkReady: true,
      dispatchEnabled: false,
      slackActionEnabled: false,
      route: '/admin/contacts/[id]',
      detail:
        'Response alerts may store a Portfolio contact deep link for later review, but this surface does not post Slack messages.',
    },
  }
}

function buildOperatorDecisionPaths(args: {
  contactId: number
  status: WarmOutreachResponseMonitoringStatus
  hasResponse: boolean
  blockedReasons: string[]
  latestResponseAt: string | null
  proposedFollowUp: WarmOutreachResponseMonitoring['proposedFollowUp']
  providerCaptureReadiness: WarmOutreachResponseMonitoring['providerCaptureReadiness']
}): WarmOutreachResponseMonitoring['operatorDecisionPaths'] {
  const baseKey = {
    contactId: args.contactId,
    status: args.status,
    latestResponseAt: args.latestResponseAt,
    responseCaptureKey: args.providerCaptureReadiness.responseCaptureKey,
  }
  const blocked = args.blockedReasons.length > 0
  const paths: Array<Omit<
    WarmOutreachResponseMonitoring['operatorDecisionPaths'][number],
    'requiresHumanApproval' | 'externalActionEnabled' | 'idempotencyKey'
  >> = [
    {
      key: 'capture_response',
      label: 'Capture response',
      state: blocked ? 'blocked' : 'available',
      description: blocked
        ? args.blockedReasons[0]
        : 'Record a manual or provider-assisted response as Portfolio contact communication evidence.',
    },
    {
      key: 'review_reply_draft',
      label: 'Review reply draft',
      state: args.hasResponse ? 'pending_human_qa' as const : 'readiness_only' as const,
      description: args.hasResponse
        ? 'Review, revise, approve, or reject the local draft reply before any outbound channel is used.'
        : 'A local draft decision becomes available after response evidence is captured.',
    },
    {
      key: 'suppression_proposal',
      label: 'Suppression proposal',
      state: blocked || args.hasResponse ? 'pending_human_qa' as const : 'readiness_only' as const,
      description:
        'Unsubscribe or do-not-contact replies create a human-gated suppression proposal; this path does not mutate suppression directly.',
    },
    {
      key: 'interested_task',
      label: 'Interested task path',
      state: args.hasResponse ? 'pending_human_qa' as const : 'readiness_only' as const,
      description:
        'Interested or sales-intent replies can create a local outreach task for the next decision; no provider execution is enabled.',
    },
    {
      key: 'next_touch_timing',
      label: 'Next-touch timing',
      state: args.status === 'stale_no_response' || args.hasResponse ? 'pending_human_qa' : 'readiness_only',
      description: args.proposedFollowUp.description,
    },
    {
      key: 'slack_alert_metadata',
      label: 'Slack alert metadata',
      state: 'readiness_only' as const,
      description:
        'A future alert may deep-link to this contact workroom, but Slack dispatch and Slack actions stay disabled.',
    },
  ]

  return paths.map((path) => ({
    ...path,
    requiresHumanApproval: true as const,
    externalActionEnabled: false as const,
    idempotencyKey: `warm-outreach:operator-decision:v1:${path.key}:${stableHash(baseKey)}`,
  }))
}

function providerThreadFromRow(row: PortfolioRow | null): string | null {
  if (!row) return null
  const provenance = record(metadata(row).source_provenance)
  const draft = gmailDraftCreationEvidence(row)
  return (
    text(firstValue(row, ['provider_thread_id', 'providerThreadId', 'thread_id', 'threadId'])) ??
    text(provenance.provider_thread_id) ??
    text(provenance.providerThreadId) ??
    text(draft.thread_id) ??
    text(draft.threadId)
  )
}

function providerMessageFromRow(row: PortfolioRow | null): string | null {
  if (!row) return null
  const provenance = record(metadata(row).source_provenance)
  const draft = gmailDraftCreationEvidence(row)
  return (
    text(firstValue(row, ['provider_message_id', 'providerMessageId', 'message_id', 'messageId'])) ??
    text(provenance.provider_message_id) ??
    text(provenance.providerMessageId) ??
    text(draft.message_id) ??
    text(draft.messageId)
  )
}

function normalizedSubjectFingerprint(value: unknown): string | null {
  const subject = text(value)
  if (!subject) return null
  return stableHash(subject.replace(/^\s*(re|fw|fwd)\s*:\s*/i, '').replace(/\s+/g, ' ').trim().toLowerCase())
}

function buildGmailResponseImportReadiness(args: {
  contactId: number
  status: WarmOutreachResponseMonitoringStatus
  rows: WarmOutreachMonitoringRows
  blockedReasons: string[]
  latestResponse: PortfolioRow | null
  latestOutbound: PortfolioRow | null
}): WarmOutreachGmailResponseImportReadiness {
  const latestResponse = args.latestResponse
  const latestOutbound = args.latestOutbound
  const responseMetadata = latestResponse ? metadata(latestResponse) : {}
  const responseProvenance = record(responseMetadata.source_provenance)
  const providerThreadId =
    text(responseProvenance.provider_thread_id) ??
    text(responseProvenance.providerThreadId) ??
    providerThreadFromRow(latestResponse) ??
    providerThreadFromRow(latestOutbound)
  const providerMessageId =
    text(responseProvenance.provider_message_id) ??
    text(responseProvenance.providerMessageId) ??
    providerMessageFromRow(latestResponse) ??
    providerMessageFromRow(latestOutbound)
  const matchedOutreachQueueId = latestOutbound && isEmailRow(latestOutbound)
    ? sourceId(latestOutbound, 'outreach-queue')
    : null
  const provenanceSourceId =
    rowSourceId(latestResponse ?? {}) ??
    text(responseProvenance.source_id) ??
    text(responseProvenance.sourceId)
  const subjectKey = normalizedSubjectFingerprint(latestResponse?.subject ?? latestOutbound?.subject)
  const responseIsImportedGmail =
    Boolean(latestResponse) &&
    isEmailRow(latestResponse as PortfolioRow) &&
    !isManualResponse(latestResponse as PortfolioRow)
  const hasQueueBasis = Boolean(matchedOutreachQueueId)
  const candidateStatus: WarmOutreachGmailResponseImportReadiness['latestCandidate']['status'] =
    args.blockedReasons.length > 0
      ? 'blocked'
      : responseIsImportedGmail
        ? 'imported_response_recorded'
        : hasQueueBasis
          ? 'ready_for_mock_import'
          : 'manual_recovery_required'
  const state: WarmOutreachGmailResponseImportReadiness['state'] =
    candidateStatus === 'blocked'
      ? 'blocked'
      : candidateStatus === 'imported_response_recorded'
        ? 'response_evidence_ready'
        : candidateStatus === 'ready_for_mock_import'
          ? 'dry_run_ready'
          : 'manual_recovery_required'
  const confidence: WarmOutreachGmailResponseImportReadiness['latestCandidate']['confidence'] =
    providerThreadId && matchedOutreachQueueId
      ? 'high'
      : providerThreadId || matchedOutreachQueueId
        ? 'medium'
        : subjectKey
          ? 'low'
          : 'none'
  const dedupeKeys = [
    providerThreadId ? `gmail_thread:${providerThreadId}` : null,
    providerMessageId ? `gmail_message:${providerMessageId}` : null,
    matchedOutreachQueueId ? `queue:${matchedOutreachQueueId}` : null,
    `contact:${args.contactId}`,
    subjectKey ? `subject:${subjectKey}` : null,
    provenanceSourceId,
  ].filter(Boolean) as string[]
  const manualRecoveryRequired =
    candidateStatus === 'blocked' ||
    candidateStatus === 'imported_response_recorded' ||
    candidateStatus === 'manual_recovery_required'
  const activationReadiness = buildWarmOutreachGmailResponseImportActivationReadiness({
    manualRecoveryRequired,
    manualRecoveryReasons:
      args.blockedReasons.length > 0
        ? args.blockedReasons
        : candidateStatus === 'imported_response_recorded'
          ? ['Existing Gmail response evidence is already recorded in Portfolio.']
          : candidateStatus === 'manual_recovery_required'
            ? ['Local Gmail response import evidence needs queue, thread, message, or contact repair.']
            : [],
  })
  const canaryReadiness = buildWarmOutreachGmailResponseImportCanaryReadiness({
    activationReadiness,
    contactId: args.contactId,
    queueId: matchedOutreachQueueId,
    gmailThreadId: providerThreadId,
    gmailMessageId: providerMessageId,
    dedupeKey: dedupeKeys[0] ?? null,
    observedAt: rowTimestamp(latestResponse ?? latestOutbound ?? {}),
    hasDryRunPayload: false,
    dryRunImportEnabled: true,
    state:
      candidateStatus === 'imported_response_recorded'
        ? 'imported_response_found'
        : candidateStatus === 'manual_recovery_required' || candidateStatus === 'blocked'
          ? 'error_retry'
          : 'ready_for_dry_run',
  })

  return {
    version: 'warm-outreach-gmail-response-import-readiness/v1',
    state,
    label:
      state === 'response_evidence_ready'
        ? 'Gmail response evidence recorded'
        : state === 'dry_run_ready'
          ? 'Mock Gmail response import ready'
          : state === 'blocked'
            ? 'Gmail response import blocked'
            : 'Gmail response import needs manual recovery',
    provider: 'gmail',
    dryRunImportEnabled: true,
    liveProviderImportEnabled: false,
    providerPollingEnabled: false,
    gmailApiCalled: false,
    externalActionsEnabled: false,
    gmailDraftCreationEnabled: false,
    slackDispatchEnabled: false,
    n8nDispatchEnabled: false,
    activationReadiness,
    matchBasis: [
      {
        key: 'gmail_thread_id',
        label: 'Gmail thread',
        available: Boolean(providerThreadId),
        detail: providerThreadId ?? 'No Gmail thread id is recorded on local response or queue evidence.',
      },
      {
        key: 'gmail_message_id',
        label: 'Gmail message',
        available: Boolean(providerMessageId),
        detail: providerMessageId ?? 'No Gmail message id is recorded on local response or queue evidence.',
      },
      {
        key: 'queue_id',
        label: 'Queue row',
        available: Boolean(matchedOutreachQueueId),
        detail: matchedOutreachQueueId ?? 'No email outreach queue row is available for durable matching.',
      },
      {
        key: 'contact_id',
        label: 'Contact',
        available: true,
        detail: `contact_submission:${args.contactId}`,
      },
      {
        key: 'normalized_recipient',
        label: 'Recipient identity',
        available: true,
        detail: 'The dry-run importer also compares mocked reply sender against the Portfolio contact email.',
      },
      {
        key: 'subject_fingerprint',
        label: 'Subject fingerprint',
        available: Boolean(subjectKey),
        detail: subjectKey ?? 'No subject is available for fallback matching.',
      },
    ],
    latestCandidate: {
      status: candidateStatus,
      confidence,
      providerThreadId,
      providerMessageId,
      matchedOutreachQueueId,
      matchedContactId: args.contactId,
      provenanceSourceId,
      nextAction:
        candidateStatus === 'imported_response_recorded'
          ? 'Review existing Gmail response evidence and local follow-up state before any outbound action.'
          : candidateStatus === 'ready_for_mock_import'
            ? 'Run the dry-run admin test path with mocked Gmail payloads, then import through the existing response lifecycle after human review.'
            : candidateStatus === 'blocked'
              ? args.blockedReasons[0] ?? 'Resolve suppression or readiness blockers before import.'
              : 'Add a queue id, Gmail thread/message id, or contact identity before importing a Gmail reply.',
      recoveryPath:
        candidateStatus === 'ready_for_mock_import'
          ? 'POST mocked payloads to the dry-run route; ready candidates still create only local response evidence through the existing lifecycle.'
          : candidateStatus === 'imported_response_recorded'
            ? 'Use the contact workroom to review classification, reply draft, suppression proposal, and local task evidence.'
            : candidateStatus === 'blocked'
              ? 'Clear or approve suppression/recovery in Portfolio before any response import.'
              : 'Resolve unmatched or ambiguous provider evidence manually in the contact workroom.',
    },
    dedupe: {
      provider: 'gmail',
      keys: [...new Set(dedupeKeys)],
      duplicateReplayBlocked: true,
      detail:
        'Replay checks use provider, Gmail thread/message id, queue id, contact id, normalized recipient, subject fingerprint, and existing warm response source ids.',
    },
    canaryReadiness,
    auditNotes: [
      'This readiness packet is local Portfolio metadata only.',
      'Live Gmail polling/import remains disabled; mocked dry-run planning is the only import path represented here.',
      'No Gmail draft, Gmail send, Slack dispatch, n8n dispatch, or provider action is enabled.',
    ],
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

function firstValue(row: PortfolioRow, keys: string[]): unknown {
  for (const key of keys) {
    const value = metadataValue(row, key)
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function mergedEvidence(row: PortfolioRow, snakeKey: string, camelKey: string): PortfolioRow {
  const generationInputs = record(row.generation_inputs)
  return {
    ...record(generationInputs[snakeKey]),
    ...record(generationInputs[camelKey]),
    ...nestedMetadata(row, snakeKey),
    ...nestedMetadata(row, camelKey),
  }
}

function gmailDraftCreationEvidence(row: PortfolioRow): PortfolioRow {
  return mergedEvidence(row, 'gmail_draft_creation', 'gmailDraftCreation')
}

function warmGmailSendAuthorizationEvidence(row: PortfolioRow): PortfolioRow {
  return mergedEvidence(row, 'warm_gmail_send_authorization', 'warmGmailSendAuthorization')
}

function warmGmailSlackApprovalRequestEvidence(row: PortfolioRow): PortfolioRow {
  return mergedEvidence(
    row,
    'warm_gmail_send_slack_approval_request',
    'warmGmailSendSlackApprovalRequest',
  )
}

function warmGmailSendExecutionEvidence(row: PortfolioRow): PortfolioRow {
  return mergedEvidence(row, 'warm_gmail_send_execution', 'warmGmailSendExecution')
}

function firstGmailDraftEvidence(rows: PortfolioRow[]): WarmOutreachGmailProviderActivationReadiness['duplicateDraftEvidence'] {
  for (const row of rows) {
    const draftCreation = gmailDraftCreationEvidence(row)
    const authorization = mergedEvidence(
      row,
      'warm_outreach_gmail_draft_authorization',
      'warmOutreachGmailDraftAuthorization',
    )
    const draftId =
      text(firstValue(row, ['gmail_user_draft_id', 'gmailUserDraftId'])) ??
      text(firstValue(row, ['gmail_draft_id', 'gmailDraftId'])) ??
      text(draftCreation.draft_id) ??
      text(draftCreation.draftId)
    const threadId =
      text(firstValue(row, ['gmail_user_thread_id', 'gmailUserThreadId'])) ??
      text(firstValue(row, ['thread_id', 'threadId'])) ??
      text(draftCreation.thread_id) ??
      text(draftCreation.threadId)
    const messageId =
      text(firstValue(row, ['gmail_user_message_id', 'gmailUserMessageId'])) ??
      text(firstValue(row, ['message_id', 'messageId'])) ??
      text(draftCreation.message_id) ??
      text(draftCreation.messageId)
    const idempotencyKey =
      text(firstValue(row, ['gmail_draft_idempotency_key', 'gmailDraftIdempotencyKey'])) ??
      text(draftCreation.idempotency_key) ??
      text(draftCreation.idempotencyKey) ??
      text(authorization.idempotency_key) ??
      text(authorization.idempotencyKey)

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
    const draftCreation = gmailDraftCreationEvidence(row)
    const draftId =
      text(firstValue(row, ['gmail_user_draft_id', 'gmailUserDraftId'])) ??
      text(firstValue(row, ['gmail_draft_id', 'gmailDraftId'])) ??
      text(draftCreation.draft_id) ??
      text(draftCreation.draftId)
    const threadId =
      text(firstValue(row, ['gmail_user_thread_id', 'gmailUserThreadId'])) ??
      text(firstValue(row, ['thread_id', 'threadId'])) ??
      text(draftCreation.thread_id) ??
      text(draftCreation.threadId)
    const messageId =
      text(firstValue(row, ['gmail_user_message_id', 'gmailUserMessageId'])) ??
      text(firstValue(row, ['message_id', 'messageId'])) ??
      text(draftCreation.message_id) ??
      text(draftCreation.messageId)
    const idempotencyKey =
      text(firstValue(row, ['gmail_draft_idempotency_key', 'gmailDraftIdempotencyKey'])) ??
      text(draftCreation.idempotency_key) ??
      text(draftCreation.idempotencyKey)

    if (draftId || threadId || messageId || idempotencyKey) {
      return {
        draftId,
        threadId,
        messageId,
        sourceIds: [sourceId(row, 'gmail-draft-evidence')],
        connectedAs: normalizeEmail(
          draftCreation.connected_as ??
          draftCreation.connectedAs ??
          firstValue(row, ['connected_as', 'connectedAs']),
        ),
        requiredSender: normalizeEmail(
          draftCreation.required_sender ??
          draftCreation.requiredSender ??
          firstValue(row, ['required_sender', 'requiredSender']),
        ),
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
    const authorization = warmGmailSendAuthorizationEvidence(row)
    const status = text(authorization.status)?.toLowerCase()
    if (status === 'approved' || status === 'rejected' || status === 'revision_requested') {
      return {
        status: status as 'approved' | 'rejected' | 'revision_requested',
        decisionKey: text(authorization.decision_key) ?? text(authorization.decisionKey),
      }
    }
  }

  return {
    status: null,
    decisionKey: null,
  }
}

function firstWarmGmailSlackApprovalRequest(rows: PortfolioRow[]) {
  for (const row of rows) {
    const request = warmGmailSlackApprovalRequestEvidence(row)
    const status = text(request.status)?.toLowerCase()
    if (
      status === 'pending' ||
      status === 'approved' ||
      status === 'rejected' ||
      status === 'revision_requested'
    ) {
      return {
        status: status as 'pending' | 'approved' | 'rejected' | 'revision_requested',
        requestKey:
          text(request.request_key) ??
          text(request.requestKey) ??
          text(request.payload_dedupe_key) ??
          text(request.payloadDedupeKey),
      }
    }
  }

  return {
    status: null,
    requestKey: null,
  }
}

function firstSubmittedWarmGmailEvidence(rows: PortfolioRow[], input: {
  sendQueueIdempotencyKey: string
  submittedEvidenceKey: string
}) {
  const sourceIds: string[] = []
  for (const row of rows) {
    const execution = warmGmailSendExecutionEvidence(row)
    const rowMetadata = metadata(row)
    const status = text(row.status)?.toLowerCase()
    const executionStatus = text(execution.status)?.toLowerCase()
    const inboundResponse = isInboundResponse(row)
    const submittedEvidenceKey =
      text(rowMetadata.submitted_evidence_key) ??
      text(rowMetadata.submittedEvidenceKey) ??
      text(execution.submitted_evidence_key) ??
      text(execution.submittedEvidenceKey)
    const sendQueueKey =
      text(rowMetadata.send_queue_idempotency_key) ??
      text(rowMetadata.sendQueueIdempotencyKey) ??
      text(execution.send_queue_idempotency_key) ??
      text(execution.sendQueueIdempotencyKey) ??
      text(execution.idempotency_key) ??
      text(execution.idempotencyKey)
    const submitted =
      (!inboundResponse && ['sent', 'submitted', 'delivered'].includes(status ?? '')) ||
      executionStatus === 'sent' ||
      execution.gmail_send_called === true ||
      execution.gmailSendCalled === true ||
      execution.external_send_performed === true ||
      execution.externalSendPerformed === true ||
      (sendQueueKey === input.sendQueueIdempotencyKey && executionStatus === 'sent')

    if (submitted) sourceIds.push(sourceId(row, 'submitted-gmail-send-evidence'))
  }

  return {
    submitted: sourceIds.length > 0,
    sourceIds: [...new Set(sourceIds)],
  }
}

function firstWarmGmailExecutionState(rows: PortfolioRow[], input: {
  sendQueueIdempotencyKey: string
  submittedEvidenceKey: string
}) {
  for (const row of rows) {
    const execution = warmGmailSendExecutionEvidence(row)
    const executionStatus = text(execution.status)?.toLowerCase()
    const communicationLog = record(execution.communication_log ?? execution.communicationLog)
    const secondaryLogStatus =
      text(execution.secondary_log_status)?.toLowerCase() ??
      text(execution.secondaryLogStatus)?.toLowerCase() ??
      text(communicationLog.status)?.toLowerCase()
    const submittedEvidenceKey =
      text(execution.submitted_evidence_key) ??
      text(execution.submittedEvidenceKey)
    const sendQueueKey =
      text(execution.send_queue_idempotency_key) ??
      text(execution.sendQueueIdempotencyKey) ??
      text(execution.idempotency_key) ??
      text(execution.idempotencyKey)
    const matchesScope =
      submittedEvidenceKey === input.submittedEvidenceKey ||
      sendQueueKey === input.sendQueueIdempotencyKey
    if (!matchesScope || !executionStatus) continue

    const evidenceSource = sourceId(row, 'warm-gmail-send-execution')
    if (
      executionStatus === 'sent_secondary_log_repair_required' ||
      secondaryLogStatus === 'repair_required' ||
      execution.secondary_log_repair_required === true ||
      execution.secondaryLogRepairRequired === true
    ) {
      return {
        state: 'sent' as const,
        sourceIds: [evidenceSource],
        detail:
          'Gmail send evidence exists, but the secondary communication timeline log needs repair. Do not resend; repair the communication log from queue evidence.',
        repairRequired: true,
      }
    }
    if (
      executionStatus === 'failed' ||
      executionStatus === 'failed_provider_call' ||
      executionStatus === 'failed_before_provider_call' ||
      executionStatus === 'tracking_failed_after_send'
    ) {
      return {
        state: 'failed' as const,
        sourceIds: [evidenceSource],
        detail: text(execution.failure_reason) ??
          'A prior execution attempt failed. Repair the failure before another send attempt.',
        repairRequired: false,
      }
    }
    if (executionStatus === 'sent') {
      return {
        state: 'sent' as const,
        sourceIds: [evidenceSource],
        detail: 'Portfolio has sent execution evidence for this recipient and message version.',
        repairRequired: false,
      }
    }
    if (executionStatus === 'eligible_for_execution') {
      return {
        state: 'eligible_for_execution' as const,
        sourceIds: [evidenceSource],
        detail: 'Portfolio verified approval, draft, sender, suppression, and idempotency evidence. Gmail remains unsent until the exact execution gate is enabled and submitted.',
        repairRequired: false,
      }
    }
    if (executionStatus === 'sending') {
      return {
        state: 'eligible_for_execution' as const,
        sourceIds: [evidenceSource],
        detail: 'Portfolio already has an active execution claim for this recipient and message version. Do not submit a duplicate.',
        repairRequired: false,
      }
    }
  }

  return {
    state: null,
    sourceIds: [] as string[],
    detail: null as string | null,
    repairRequired: false,
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
  const slackApprovalRequest = firstWarmGmailSlackApprovalRequest(args.localEmailRows)
  const submitted = firstSubmittedWarmGmailEvidence(args.localEmailRows, args.lifecycle)
  const execution = firstWarmGmailExecutionState(args.localEmailRows, args.lifecycle)
  const hasDraftEvidence = Boolean(draft.draftId || draft.threadId || draft.messageId)
  const senderState: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['senderMatch']['state'] =
    !draft.requiredSender || !draft.connectedAs
      ? 'missing'
      : draft.requiredSender === draft.connectedAs
        ? 'matched'
        : 'mismatch'
  const providerConfigured =
    args.providerSmoke.providerConfigured ||
    (hasDraftEvidence && senderState === 'matched')
  const authorizationState: WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['authorization']['state'] =
    authorization.status ?? 'missing'
  const slackDecisionWithoutPortfolioAuthorization =
    slackApprovalRequest.status &&
    slackApprovalRequest.status !== 'pending' &&
    authorizationState === 'missing'

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
    slackDecisionWithoutPortfolioAuthorization
      ? 'Slack approval status exists without matching Portfolio Gmail send authorization evidence.'
      : null,
  ].filter(Boolean) as string[]
  const executionState:
    WarmOutreachRealRecipientGmailRolloutReadiness['requirements']['execution']['state'] =
      submitted.submitted
        ? 'sent'
        : execution.state === 'failed'
          ? 'failed'
          : blockers.length > 0
            ? 'blocked'
            : execution.state === 'eligible_for_execution'
              ? 'eligible_for_execution'
              : authorizationState === 'approved'
                ? 'approved_for_send'
                : slackApprovalRequest.status === 'pending'
                  ? 'approval_requested'
                  : 'approval_needed'

  const state: WarmOutreachRealRecipientGmailRolloutReadiness['state'] =
    submitted.submitted
      ? 'already_sent'
      : execution.state === 'failed'
        ? 'blocked'
        : blockers.length > 0
          ? 'blocked'
          : execution.state === 'eligible_for_execution'
            ? 'eligible_for_execution'
            : authorizationState === 'approved'
              ? 'authorization_recorded_execution_blocked'
              : 'ready_for_send_request'
  const actionLabel =
    state === 'already_sent'
      ? 'Do not resend'
      : state === 'blocked'
        ? 'Resolve blocker'
        : state === 'eligible_for_execution'
          ? 'Ready for exact execution gate'
          : state === 'authorization_recorded_execution_blocked'
          ? 'Captain can run exact execution gate'
          : 'Approve send request'
  const exactNextAction: WarmOutreachRealRecipientGmailRolloutReadiness['exactNextAction'] =
    state === 'already_sent'
      ? 'do_not_send_duplicate'
      : state === 'blocked'
        ? 'resolve_blocker'
        : state === 'eligible_for_execution' || state === 'authorization_recorded_execution_blocked'
          ? 'captain_enable_exact_execution'
          : 'approve_send_request'
  const slackApprovalStatus = authorization.status ?? slackApprovalRequest.status ?? 'not_sent'
  const finalSendAuthorityState:
    NonNullable<WarmOutreachRealRecipientGmailRolloutReadiness['auditReceipt']>['finalSendAuthority']['state'] =
      submitted.submitted
        ? execution.repairRequired
          ? 'repair_required_do_not_resend'
          : 'sent_do_not_resend'
        : state === 'eligible_for_execution'
          ? 'eligible_for_exact_execution'
          : state === 'authorization_recorded_execution_blocked'
            ? 'authorization_recorded_execution_blocked'
            : state === 'ready_for_send_request'
              ? 'awaiting_authorization'
              : 'blocked'
  const finalSendNextStep =
    finalSendAuthorityState === 'repair_required_do_not_resend'
      ? 'Repair the secondary communication timeline log from queue evidence; do not send this Gmail draft again.'
      : finalSendAuthorityState === 'sent_do_not_resend'
        ? 'No send action remains. Review sent evidence only; do not replay this message.'
        : exactNextAction === 'approve_send_request'
          ? 'Request send approval for this exact queue row from the relationship packet; Portfolio records intent only and Gmail send stays disabled.'
          : exactNextAction === 'captain_enable_exact_execution'
            ? 'Captain must use the exact per-recipient execution gate with the send flag enabled; this contact surface keeps the live send action disabled.'
            : blockers[0] ?? 'Resolve blockers before requesting or executing a one-recipient Gmail canary.'
  const auditReceipt: NonNullable<WarmOutreachRealRecipientGmailRolloutReadiness['auditReceipt']> = {
    version: 'warm-gmail-canary-proof-receipt/v1',
    queueRow: {
      sourceId: draft.sourceIds[0] ?? execution.sourceIds[0] ?? submitted.sourceIds[0] ?? null,
      contactId: args.contactId,
      relationshipPacketReference: args.handoff.contactReference.reference,
      messageVersionKey: args.lifecycle.messageVersionKey,
      sendQueueIdempotencyKey: args.lifecycle.sendQueueIdempotencyKey,
      submittedEvidenceKey: args.lifecycle.submittedEvidenceKey,
    },
    recipientIdentity: {
      channel: 'email',
      requiredSender: draft.requiredSender,
      connectedAs: draft.connectedAs,
      senderState,
    },
    approvalEvidence: {
      slackApprovalStatus,
      slackDispatchStatus: 'not_sent',
      portfolioAuthorizationState: authorizationState,
      decisionKey: authorization.decisionKey,
      recordsAuthorizationIntentOnly: true,
      gmailSendCalledByApproval: false,
    },
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
    suppressionAndIdempotency: {
      suppressionState: args.suppressionReasons.length > 0 ? 'blocked' : 'clear',
      suppressionReasons: args.suppressionReasons,
      duplicateDetected: submitted.submitted || execution.state === 'sent',
      submittedEvidenceRecorded: submitted.submitted,
    },
    gmailCapability: {
      providerState: providerConfigured ? 'configured' : 'missing',
      providerDetail: providerConfigured
        ? 'Gmail provider configuration is present for readiness review; this contract still does not call Gmail.'
        : 'Reconnect or verify Gmail provider readiness before asking for real-recipient approval.',
      senderDetail:
        senderState === 'matched'
          ? 'Tracked draft sender matches the required AmaduTown sender.'
          : senderState === 'missing'
            ? 'Sender identity must be recorded on the tracked Gmail draft evidence.'
            : 'Tracked draft sender does not match the required sender.',
    },
    finalSendAuthority: {
      state: finalSendAuthorityState,
      liveSendActionEnabled: false,
      detail:
        finalSendAuthorityState === 'eligible_for_exact_execution'
          ? 'All local gates are prepared, but this UI still does not execute Gmail sends.'
          : finalSendAuthorityState === 'authorization_recorded_execution_blocked'
            ? 'Per-recipient authorization is recorded; execution still requires the captain flag and exact send route.'
            : finalSendAuthorityState === 'sent_do_not_resend' || finalSendAuthorityState === 'repair_required_do_not_resend'
              ? 'Submitted Gmail send evidence already exists for this recipient and message version.'
              : finalSendAuthorityState === 'awaiting_authorization'
                ? 'Readiness is prepared for an approval request, not Gmail execution.'
                : blockers[0] ?? 'Real-recipient send remains blocked.',
      nextStep: finalSendNextStep,
    },
    lastActionEvidence: {
      status: executionState,
      sourceIds: [...new Set([...execution.sourceIds, ...submitted.sourceIds])],
      detail:
        execution.detail ??
        (submitted.submitted
          ? 'Submitted Gmail send evidence already exists. Do not replay this message.'
          : 'No prior execution evidence is recorded for this contact, channel, and message version.'),
      repairRequired: execution.repairRequired,
    },
  }

  return {
    version: 'warm-outreach-real-gmail-rollout-readiness/v1',
    state,
    label:
      state === 'already_sent'
        ? 'Real Gmail send already recorded'
        : state === 'blocked'
          ? 'Real Gmail send request blocked'
          : state === 'eligible_for_execution'
            ? 'Eligible for exact send execution'
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
      execution: {
        state: executionState,
        sourceIds: execution.sourceIds,
        detail:
          executionState === 'sent'
            ? 'Sent evidence is recorded. Do not resend.'
            : executionState === 'failed'
              ? execution.detail ?? 'Execution failed. Repair the failed state before another attempt.'
              : executionState === 'blocked'
                ? blockers[0] ?? 'Resolve blockers before execution eligibility.'
                : executionState === 'eligible_for_execution'
                  ? execution.detail ?? 'Portfolio has prepared exact execution eligibility evidence. Gmail remains unsent until the execution gate is explicitly enabled and submitted.'
                  : executionState === 'approved_for_send'
                    ? 'Portfolio approval evidence matches this contact, queue row, and message version. Record the local execution eligibility receipt before any send.'
                    : executionState === 'approval_requested'
                      ? 'Approval has been requested for this exact recipient/message. Wait for Portfolio approval before execution eligibility.'
                      : 'No send approval is recorded yet. Build the one-recipient approval request first.',
      },
    },
    blockers: [...new Set(blockers)],
    auditReceipt,
    slackApprovalContract: {
      route: `/api/admin/outreach/[id]/slack-send-approval`,
      method: 'POST',
      dispatchEnabled: false,
      actionIds: ['warm_gmail_send.approve', 'warm_gmail_send.reject', 'warm_gmail_send.revise'],
      payloadDedupeKey: `warm-outreach:slack-gmail-send-card:v1:${stableHash({
        contactId: args.contactId,
        channel: 'email',
        outreachQueueId: draft.sourceIds[0] ?? null,
        messageVersionKey: args.lifecycle.messageVersionKey,
      })}`,
      status: slackApprovalStatus,
      requestKey: slackApprovalRequest.requestKey,
      slackDispatchStatus: 'not_sent',
      recordsAuthorizationIntentOnly: true,
      gmailSendCalled: false,
      providerExecutionEnabled: false,
      approvalRequestRecovery: {
        status: 'portfolio_request_available_slack_dispatch_disabled',
        label: 'Portfolio recovery path',
        detail:
          'Slack dispatch is disabled. The relationship packet can still record a local one-recipient approval request without posting to Slack or calling Gmail.',
        nextAction:
          'Use Request send approval in this contact workroom, then record approve, reject, or revise before any separate Gmail send execution gate.',
      },
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

function buildGmailProviderExecutionReadiness(args: {
  rollout: WarmOutreachRealRecipientGmailRolloutReadiness
  lifecycle: {
    messageVersionKey: string
    sendQueueIdempotencyKey: string
    submittedEvidenceKey: string
  }
}): WarmOutreachGmailProviderExecutionReadiness {
  const receipt = args.rollout.auditReceipt
  const executionState = args.rollout.requirements.execution.state
  const sentEvidenceRecorded = args.rollout.state === 'already_sent'
  const state: WarmOutreachGmailProviderExecutionReadiness['state'] =
    sentEvidenceRecorded
      ? 'sent_do_not_resend'
      : args.rollout.state === 'eligible_for_execution'
        ? 'eligible_when_admin_activation_enabled'
        : args.rollout.state === 'authorization_recorded_execution_blocked'
          ? 'approval_recorded_activation_required'
          : args.rollout.state === 'ready_for_send_request'
            ? 'approval_needed'
            : 'blocked'
  const label =
    state === 'sent_do_not_resend'
      ? 'Canary send recorded; do not resend'
      : state === 'eligible_when_admin_activation_enabled'
        ? 'Eligible after admin provider activation'
        : state === 'approval_recorded_activation_required'
          ? 'Approval recorded; admin activation required'
          : state === 'approval_needed'
            ? 'One-recipient approval needed'
            : 'Execution blocked'
  const nextAction =
    state === 'sent_do_not_resend'
      ? 'Review the sent evidence only. Do not replay this Gmail draft.'
      : args.rollout.exactNextAction === 'approve_send_request'
        ? 'Review the recipient, relationship context, and draft, then approve, reject, or request revision from Portfolio or Slack.'
        : args.rollout.exactNextAction === 'captain_enable_exact_execution'
          ? 'Keep the UI no-send. An admin must intentionally enable the provider execution gate and submit the exact per-recipient send route.'
          : args.rollout.blockers[0] ?? 'Resolve blockers before requesting or executing a one-recipient Gmail send.'

  return {
    version: 'warm-outreach-gmail-provider-execution-readiness/v1',
    state,
    label,
    liveExecutionEnabled: false,
    providerCallsEnabled: false,
    externalSendEnabled: false,
    adminActivationGate: {
      key: 'ENABLE_WARM_GMAIL_SEND_EXECUTION',
      state: 'disabled',
      detail:
        'The relationship packet and workroom never enable Gmail execution. If production execution is required, this admin/provider gate must be intentionally enabled outside the operator review surface and then disabled again after the exact one-recipient run.',
    },
    operatorDecision: {
      status: args.rollout.slackApprovalContract.status,
      nextAction,
      approvalRoute: args.rollout.slackApprovalContract.route,
      recordsAuthorizationIntentOnly: true,
    },
    exactExecutionGate: {
      route: '/api/admin/outreach/[id]/gmail-user-send',
      method: 'POST',
      enabledOnThisSurface: false,
      sendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient',
      messageVersionKey: args.lifecycle.messageVersionKey,
      sendQueueIdempotencyKey: args.lifecycle.sendQueueIdempotencyKey,
      submittedEvidenceKey: args.lifecycle.submittedEvidenceKey,
      detail:
        'The execution route still requires exact per-recipient request keys, approved Portfolio authorization, draft evidence, sender match, suppression clearance, idempotency checks, and the admin activation gate.',
    },
    canaryTrace: {
      queueId: receipt?.queueRow.sourceId ?? null,
      status: executionState,
      sentEvidenceRecorded,
      gmailMessageId: sentEvidenceRecorded ? receipt?.draftEvidence.messageId ?? null : null,
      gmailThreadId: sentEvidenceRecorded ? receipt?.draftEvidence.threadId ?? null : null,
      detail: receipt?.lastActionEvidence.detail ??
        'No Gmail execution evidence is recorded for this contact, channel, and message version.',
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
  responseMonitoringAttached?: boolean
  responseMonitoringStatus?: WarmOutreachResponseMonitoringStatus
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
  const gmailProviderExecutionReadiness = buildGmailProviderExecutionReadiness({
    rollout: realRecipientRolloutReadiness,
    lifecycle: {
      messageVersionKey,
      sendQueueIdempotencyKey,
      submittedEvidenceKey,
    },
  })
  const emailQueueRow = asRows(args.rows?.outreachQueue).find(isEmailRow)
  const queueId = text(emailQueueRow?.id)
  const gmailOperatingLoop = buildWarmGmailOperatingLoop({
    contactId: args.contactId,
    queueId,
    recipientLabel: text(args.packet.contactName),
    recipientEmail: normalizeEmail(firstValue(emailQueueRow ?? {}, [
      'recipient_email',
      'recipientEmail',
      'email',
    ])),
    gmailDraftId: realRecipientRolloutReadiness.requirements.draftEvidence.draftId,
    gmailThreadId: realRecipientRolloutReadiness.requirements.draftEvidence.threadId,
    approvalDecisionKey: realRecipientRolloutReadiness.requirements.authorization.decisionKey,
    messageVersionKey,
    sendQueueIdempotencyKey,
    submittedEvidenceKey,
    internalDraftReady: gmailDraftHandoffPacket.internalHandoffReady,
    draftTracked: realRecipientRolloutReadiness.requirements.draftEvidence.state === 'tracked',
    providerConfigured: realRecipientRolloutReadiness.requirements.provider.state === 'configured',
    senderMatched: realRecipientRolloutReadiness.requirements.senderMatch.state === 'matched',
    approvalRequestStatus: realRecipientRolloutReadiness.slackApprovalContract.status,
    authorizationStatus: realRecipientRolloutReadiness.requirements.authorization.state,
    executionState: realRecipientRolloutReadiness.requirements.execution.state,
    submittedEvidenceRecorded:
      realRecipientRolloutReadiness.auditReceipt?.suppressionAndIdempotency.submittedEvidenceRecorded ?? false,
    secondaryLogRepairRequired:
      realRecipientRolloutReadiness.auditReceipt?.lastActionEvidence.repairRequired ?? false,
    responseMonitoringAttached: args.responseMonitoringAttached === true,
    responseMonitoringStatus: args.responseMonitoringStatus,
    hardBlockers: [
      ...hardBlockers,
      ...(realRecipientRolloutReadiness.state === 'blocked'
        ? realRecipientRolloutReadiness.blockers
        : []),
      ...(args.mode === 'warm_1_to_many'
        ? ['Batch Gmail actions remain per-recipient only. Open one warm contact before continuing.']
        : []),
    ],
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
    gmailProviderExecutionReadiness,
    gmailOperatingLoop,
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
  responseMonitoringAttached?: boolean
  responseMonitoringStatus?: WarmOutreachResponseMonitoringStatus
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
          responseMonitoringAttached: args.responseMonitoringAttached,
          responseMonitoringStatus: args.responseMonitoringStatus,
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
          responseMonitoringAttached: args.responseMonitoringAttached,
          responseMonitoringStatus: args.responseMonitoringStatus,
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
          responseMonitoringAttached: args.responseMonitoringAttached,
          responseMonitoringStatus: args.responseMonitoringStatus,
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
        responseMonitoringAttached: args.responseMonitoringAttached,
        responseMonitoringStatus: args.responseMonitoringStatus,
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
  responseMonitoringAttached?: boolean
  responseMonitoringStatus?: WarmOutreachResponseMonitoringStatus
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
            responseMonitoringAttached: args.responseMonitoringAttached,
            responseMonitoringStatus: args.responseMonitoringStatus,
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
  const providerCaptureReadiness = buildProviderCaptureReadiness({
    contactId: args.contactId,
    packet: args.packet,
    status,
    blockedReasons,
    latestOutboundAt,
    latestResponseAt,
  })
  const operatorDecisionPaths = buildOperatorDecisionPaths({
    contactId: args.contactId,
    status,
    hasResponse,
    blockedReasons,
    latestResponseAt,
    proposedFollowUp,
    providerCaptureReadiness,
  })
  const gmailResponseImportReadiness = buildGmailResponseImportReadiness({
    contactId: args.contactId,
    status,
    rows: args.rows,
    blockedReasons,
    latestResponse,
    latestOutbound,
  })

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
    providerCaptureReadiness,
    operatorDecisionPaths,
    blockedReasons,
    auditNotes: [
      'Monitoring is derived from local Portfolio rows only.',
      'Manual/imported response evidence can be reviewed; provider polling remains disabled.',
      'No external send, provider action, Gmail draft, Slack action, n8n dispatch, or schedule is executed.',
    ],
    gmailResponseImportReadiness,
    sendReadiness: buildWarmOutreachSendReadiness({
      contactId: args.contactId,
      packet: args.packet,
      readiness: args.readiness,
      rows: args.rows,
      responseMonitoringAttached: true,
      responseMonitoringStatus: status,
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
