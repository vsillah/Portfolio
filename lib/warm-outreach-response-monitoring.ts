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
  submittedEvidenceKey: string
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
  const value = row.metadata
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
  const suppressionReasons = suppressionBlockers(args.packet, args.readiness)
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
  const localEmailRows = [
    ...asRows(args.rows?.outreachQueue),
    ...asRows(args.rows?.emailMessages),
    ...asRows(args.rows?.contactCommunications),
  ].filter(isEmailRow)
  const existingEvidenceIds = localEmailRows
    .map((row, index) => sourceId(row, `email-evidence-${index + 1}`))
    .filter(Boolean)
  const duplicateDetected = localEmailRows.some((row) =>
    statusIsActiveSendState(text(row.status)?.toLowerCase() ?? null),
  )
  const hardBlockers = args.blockers.filter((blocker) => !isBatchModeGateBlocker(blocker))
  const draftPacketReady = hardBlockers.length === 0
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
    submittedEvidenceKey,
    duplicatePrevention: {
      scope: 'contact_channel_message_version',
      duplicateDetected,
      existingEvidenceIds,
      requiredUniqueKeys: [
        messageVersionKey,
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
        status: 'future_gate',
        detail: 'Future explicit authority is required for this contact, channel, and message version.',
      }),
      lifecycleStage({
        key: 'provider_capability_smoke',
        label: 'Provider capability smoke',
        status: 'blocked',
        detail: 'Gmail/provider capability smoke is intentionally blocked in this scaffold.',
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
