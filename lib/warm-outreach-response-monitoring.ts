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

function baseSendBlockers(args: {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  mode: WarmOutreachSendMode
}) {
  const blockers = [...new Set(suppressionBlockers(args.packet, args.readiness))]
  if (weakRelationshipBasis(args.packet)) {
    blockers.push('Relationship basis is too weak for send readiness.')
  }
  if (args.mode === 'warm_1_to_many' && args.readiness.status !== 'draft_ready') {
    blockers.push('Batch recipients require per-contact review before any send-readiness state.')
  }
  return blockers
}

function buildChannelReadiness(args: {
  contactId: number
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  channel: WarmOutreachChannel
  mode: WarmOutreachSendMode
}): WarmOutreachChannelSendReadiness {
  const capability = args.packet.channelCapabilities[args.channel]
  const blockers = baseSendBlockers(args)
  const gatesRemaining = [
    'human_reply_or_draft_approval',
    'external_send_authority',
    'provider_execution_gate',
  ]
  const auditNotes = [
    `${args.mode} ${CHANNEL_LABELS[args.channel]} readiness is scaffold-only.`,
    'No provider, scheduling, draft creation, or external send execution is enabled.',
  ]

  if (!capability?.available) {
    blockers.push(`${CHANNEL_LABELS[args.channel]} is not available for this contact.`)
    return {
      mode: args.mode,
      channel: args.channel,
      label: `${CHANNEL_LABELS[args.channel]} unavailable`,
      state: 'unavailable',
      sendReady: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      humanApprovalRequired: true,
      idempotencyKey: `warm-outreach:send-readiness:v1:${stableHash({ contactId: args.contactId, mode: args.mode, channel: args.channel })}`,
      blockers,
      gatesRemaining,
      auditNotes,
    }
  }

  if (blockers.length > 0) {
    return {
      mode: args.mode,
      channel: args.channel,
      label: `${CHANNEL_LABELS[args.channel]} blocked`,
      state: 'blocked',
      sendReady: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      humanApprovalRequired: true,
      idempotencyKey: `warm-outreach:send-readiness:v1:${stableHash({ contactId: args.contactId, mode: args.mode, channel: args.channel })}`,
      blockers,
      gatesRemaining,
      auditNotes,
    }
  }

  if (capability.manualOnly || args.channel === 'facebook' || args.channel === 'phone_contact') {
    return {
      mode: args.mode,
      channel: args.channel,
      label: `${CHANNEL_LABELS[args.channel]} manual review only`,
      state: 'manual_review_only',
      sendReady: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
      humanApprovalRequired: true,
      idempotencyKey: `warm-outreach:send-readiness:v1:${stableHash({ contactId: args.contactId, mode: args.mode, channel: args.channel })}`,
      blockers,
      gatesRemaining: [...gatesRemaining, 'manual_operator_action_outside_portfolio'],
      auditNotes,
    }
  }

  return {
    mode: args.mode,
    channel: args.channel,
    label: `${CHANNEL_LABELS[args.channel]} provider gate required`,
    state: 'provider_gate_required',
    sendReady: false,
    externalSendEnabled: false,
    providerExecutionEnabled: false,
    humanApprovalRequired: true,
    idempotencyKey: `warm-outreach:send-readiness:v1:${stableHash({ contactId: args.contactId, mode: args.mode, channel: args.channel })}`,
    blockers,
    gatesRemaining,
    auditNotes,
  }
}

export function buildWarmOutreachSendReadiness(args: {
  contactId: number
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
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
