import { createHash } from 'crypto'

import {
  buildWarmOutreachContextSummary,
  evaluateWarmOutreachReadiness,
  type WarmOutreachChannel,
  type WarmOutreachContextSummary,
  type WarmOutreachReadiness,
  type WarmOutreachRelationshipPacket,
  type WarmOutreachTemplateFamily,
} from './warm-outreach-relationship-intelligence'
import {
  buildWarmOutreachSourceInventoryPacket,
  type WarmOutreachSourceInventoryRows,
} from './warm-outreach-source-inventory'
import {
  buildWarmOutreachResponseMonitoring,
  type WarmOutreachResponseMonitoring,
  type WarmOutreachSendReadiness,
} from './warm-outreach-response-monitoring'
import type { OutreachChannel } from './constants/prompt-keys'

type PortfolioRow = NonNullable<WarmOutreachSourceInventoryRows['contactSubmission']>

export type WarmBatchReviewRecipientStatus =
  | 'ready_for_review'
  | 'existing_draft'
  | 'blocked'

export type WarmGmailBatchDraftPlanReadinessKey =
  | 'missing_email'
  | 'weak_relationship_basis'
  | 'suppression_risk'
  | 'provider_not_connected'
  | 'approval_needed'
  | 'submitted_evidence_exists'
  | 'sms_unavailable'

export type WarmGmailBatchDraftPlanRowStatus =
  | 'ready_for_local_planning'
  | 'approval_required'
  | 'blocked_review'
  | 'excluded_submitted'

export type WarmGmailBatchDraftPlanCtaKey =
  | 'prepare_local_draft_plan'
  | 'create_gmail_draft_records'
  | 'draft_records_created'
  | 'review_approval_requests'
  | 'resolve_blocked_rows'

export type WarmGmailBatchDraftCreationStatus =
  | 'eligible'
  | 'blocked'
  | 'excluded'
  | 'draft_already_exists'
  | 'provider_not_connected'
  | 'approval_required'
  | 'draft_created'

export type WarmGmailBatchDraftPlanReadinessItem = {
  key: WarmGmailBatchDraftPlanReadinessKey
  label: string
  state: 'clear' | 'needs_review' | 'blocked' | 'unavailable'
}

export type WarmGmailBatchDraftCreationState = {
  status: WarmGmailBatchDraftCreationStatus
  statusLabel: string
  actionEnabled: boolean
  blocker: string | null
  draftOnly: true
  draftRecordKey: string
  localDraftRecordId: string | null
  providerDraftId: null
  createdAt: string | null
  externalRequests: []
}

export type WarmGmailBatchDraftPlanRow = {
  contactId: number
  contactName: string
  company: string | null
  status: WarmGmailBatchDraftPlanRowStatus
  statusLabel: string
  relationshipBasis: string
  relationshipSignalCount: number
  readiness: WarmGmailBatchDraftPlanReadinessItem[]
  blockers: string[]
  nextAction: 'local_draft_planning' | 'approval_request' | 'blocked_review' | 'excluded_review'
  nextActionLabel: string
  existingQueueId: string | null
  draftCreation: WarmGmailBatchDraftCreationState
  draftIntent: {
    channel: 'gmail'
    templateFamily: WarmOutreachTemplateFamily
    promptTemplateKey: string | null
    queueIntent: 'draft_only_planned'
    createsOutreachQueueRow: false
    createsGmailDraft: false
    callsProvider: false
    externalSend: false
  }
}

export type WarmGmailBatchDraftPlan = {
  version: 'warm-outreach-gmail-batch-draft-plan/v1'
  status:
    | 'ready_for_local_planning'
    | 'draft_creation_ready'
    | 'draft_records_created'
    | 'approval_review_needed'
    | 'blocked_review'
  currentCta: {
    key: WarmGmailBatchDraftPlanCtaKey
    label: string
    enabled: boolean
    blocker: string | null
  }
  summary: {
    selectedCount: number
    readyForLocalPlanningCount: number
    approvalRequiredCount: number
    blockedReviewCount: number
    excludedSubmittedCount: number
    providerNotConnectedCount: number
    smsUnavailableCount: number
    draftCreationEligibleCount: number
    draftAlreadyExistsCount: number
    draftCreatedCount: number
  }
  rows: WarmGmailBatchDraftPlanRow[]
  executionReceipt: {
    action: 'create_gmail_draft_records'
    createdAt: string
    createdCount: number
    externalRequests: []
  } | null
  executionBoundary: {
    localPortfolioPlanOnly: true
    createsOutreachQueueRows: false
    createsGmailDrafts: false
    gmailProviderCalls: false
    gmailSend: false
    slackDispatch: false
    smsDelivery: false
    n8nDispatch: false
    productionDataMutation: false
    genericApprovalAuthorizesSend: false
  }
}

export type WarmBatchReviewRecipient = {
  contactId: number
  contactName: string
  company: string | null
  relationshipBasis: string
  relationshipSignalCount: number
  selectedChannel: WarmOutreachChannel | null
  selectedTemplate: WarmOutreachTemplateFamily
  promptTemplateKey: string | null
  suppressionStatus: 'clear' | 'blocked'
  suppressionReasons: string[]
  weakBasis: boolean
  blockers: string[]
  warnings: string[]
  status: WarmBatchReviewRecipientStatus
  draftIdempotencyKey: string
  existingQueueId: string | null
  individualizedDraftPreview: string
  responseMonitoring: WarmOutreachResponseMonitoring
  sendReadiness: WarmOutreachSendReadiness
  gmailDraftPlan: WarmGmailBatchDraftPlanRow
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  contextSummary: WarmOutreachContextSummary
}

export type WarmBatchReview = {
  mode: 'warm_1_to_many'
  batchIdempotencyKey: string
  cohort: {
    label: string
    recipientCount: number
    source: 'selected_outreach_leads'
    provenance: string
  }
  summary: {
    readyCount: number
    existingDraftCount: number
    blockedCount: number
    weakBasisCount: number
    suppressionBlockedCount: number
  }
  samplePreview: WarmBatchReviewRecipient | null
  recipients: WarmBatchReviewRecipient[]
  gmailDraftPlan: WarmGmailBatchDraftPlan
  executionBoundary: {
    source: 'local_portfolio_rows'
    readOnly: true
    providerCalls: false
    createsDraft: false
    externalSend: false
    scheduling: false
    gmailDraft: false
    linkedinAction: false
    facebookAction: false
    phoneAction: false
    n8nDispatch: false
    slackAction: false
    responseMonitoring: false
  }
}

export type WarmBatchReviewContactInput = {
  contact: PortfolioRow
  rows: WarmOutreachSourceInventoryRows
  existingOutreachRows?: PortfolioRow[]
}

const MAX_PREVIEW_CHARS = 520
const SUBMITTED_STATUSES = new Set(['sent', 'submitted', 'delivered'])
const APPROVAL_REVIEW_STATUSES = new Set([
  'draft',
  'queued',
  'approval_requested',
  'pending_approval',
  'approved',
  'send_authorized',
  'authorized',
])

const GMAIL_DRAFT_PLAN_READINESS_LABELS: Record<WarmGmailBatchDraftPlanReadinessKey, string> = {
  missing_email: 'Missing email',
  weak_relationship_basis: 'Weak relationship basis',
  suppression_risk: 'Suppression risk',
  provider_not_connected: 'Provider not connected',
  approval_needed: 'Approval needed',
  submitted_evidence_exists: 'Submitted evidence exists',
  sms_unavailable: 'SMS unavailable',
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

function stableHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 20)
}

function promptTemplateKeyFor(
  channel: WarmOutreachChannel | null,
  template: WarmOutreachTemplateFamily,
): string | null {
  if (channel === 'linkedin') return 'linkedin_cold_outreach'
  if (channel !== 'email') return null

  if (template === 'follow_up' || template === 'response_follow_up') {
    return 'email_follow_up'
  }
  if (template === 'product_relevance') return 'email_proposal_delivery'
  if (template === 'value_first_note') return 'email_asset_delivery'
  return 'email_cold_outreach'
}

function isExternalDraftChannel(channel: WarmOutreachChannel | null): channel is OutreachChannel {
  return channel === 'email' || channel === 'linkedin'
}

function relationshipBasisIsWeak(packet: WarmOutreachRelationshipPacket): boolean {
  const relationshipBasis = packet.relationshipBasis.toLowerCase()
  const evidencedSources = packet.sourceRefs.filter((source) => {
    if (source.sourceStatus === 'missing' || source.sourceStatus === 'blocked') return false
    return source.sourceType !== 'portfolio_contact'
  })

  return (
    packet.relationshipSignals.length === 0 ||
    evidencedSources.length === 0 ||
    relationshipBasis.includes('limited local relationship evidence')
  )
}

function suppressionReasons(packet: WarmOutreachRelationshipPacket, readiness: WarmOutreachReadiness): string[] {
  const reasons = [
    packet.suppression.doNotContact
      ? packet.suppression.suppressionReason ?? 'Contact is marked do not contact.'
      : null,
    packet.suppression.unsubscribed ? 'Contact is unsubscribed.' : null,
    packet.suppression.removedAt ? 'Contact was removed from outreach.' : null,
    ...readiness.blockers.filter((blocker) =>
      /contact|unsubscribe|removed|suppression/i.test(blocker),
    ),
  ].filter(Boolean) as string[]

  return [...new Set(reasons)]
}

function truncate(value: string): string {
  if (value.length <= MAX_PREVIEW_CHARS) return value
  return `${value.slice(0, MAX_PREVIEW_CHARS - 3).trim()}...`
}

function buildIndividualizedPreview(args: {
  contactName: string
  company: string | null
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  weakBasis: boolean
}): string {
  if (args.readiness.status === 'blocked') {
    return `Blocked for ${args.contactName}: ${args.readiness.blockers[0] ?? 'relationship review must resolve blockers first.'}`
  }
  if (args.weakBasis) {
    return `Blocked for ${args.contactName}: local relationship evidence is too thin for a batch draft. Add a meeting, prior message, task, reply, or manual relationship note before drafting.`
  }

  const safeMention = args.packet.sourceInventory?.safeToMention[0]
  const relationshipSignal = args.packet.relationshipSignals[0]
  const nextStep = args.packet.suggestedNextStep ?? 'prepare a human-reviewed internal draft.'

  return truncate(
    [
      `Hi ${args.contactName.split(' ')[0] || args.contactName},`,
      args.company ? `I was reviewing the ${args.company} context in Portfolio.` : null,
      relationshipSignal ? `The warm basis is ${relationshipSignal}.` : args.packet.relationshipBasis,
      safeMention ? `Safe mention: ${safeMention}` : null,
      `Draft direction: ${args.readiness.recommendedTemplate.replace(/_/g, ' ')} via ${args.readiness.selectedChannel ?? 'manual review'}.`,
      `Next step: ${nextStep}`,
    ].filter(Boolean).join(' '),
  )
}

function existingDraftFor(args: {
  rows: PortfolioRow[]
  contactId: number
  channel: WarmOutreachChannel | null
  templateKey: string | null
}): string | null {
  if (!isExternalDraftChannel(args.channel) || !args.templateKey) return null

  const match = args.rows.find((row) => {
    const generationInputs = row.generation_inputs && typeof row.generation_inputs === 'object'
      ? row.generation_inputs as Record<string, unknown>
      : {}
    return (
      text(row.id) &&
      Number(row.contact_submission_id) === args.contactId &&
      text(row.status) === 'draft' &&
      text(row.channel) === args.channel &&
      text(generationInputs.template_key) === args.templateKey
    )
  })

  return text(match?.id)
}

function rowStatus(row: PortfolioRow): string | null {
  return text(row.status)?.toLowerCase() ?? null
}

function rowChannel(row: PortfolioRow): string | null {
  return text(row.channel)?.toLowerCase() ?? text(row.email_kind)?.toLowerCase() ?? null
}

function isEmailRow(row: PortfolioRow): boolean {
  const channel = rowChannel(row)
  return !channel || channel === 'email' || channel === 'gmail'
}

function hasSubmittedEmailEvidence(rows: WarmOutreachSourceInventoryRows): boolean {
  const localRows = [
    ...(rows.outreachQueue ?? []),
    ...(rows.emailMessages ?? []),
    ...(rows.contactCommunications ?? []),
  ]

  return localRows.some((row) => {
    if (!isEmailRow(row)) return false
    const status = rowStatus(row)
    return Boolean(
      (status && SUBMITTED_STATUSES.has(status)) ||
        text(row.sent_at) ||
        text(row.submitted_at),
    )
  })
}

function needsApprovalReview(rows: WarmOutreachSourceInventoryRows): boolean {
  return (rows.outreachQueue ?? []).some((row) => {
    if (!isEmailRow(row)) return false
    const status = rowStatus(row)
    return Boolean(status && APPROVAL_REVIEW_STATUSES.has(status))
  })
}

function readinessItem(
  key: WarmGmailBatchDraftPlanReadinessKey,
  state: WarmGmailBatchDraftPlanReadinessItem['state'],
): WarmGmailBatchDraftPlanReadinessItem {
  return {
    key,
    label: GMAIL_DRAFT_PLAN_READINESS_LABELS[key],
    state,
  }
}

function gmailDraftPlanStatusLabel(status: WarmGmailBatchDraftPlanRowStatus): string {
  if (status === 'ready_for_local_planning') return 'Plan ready'
  if (status === 'approval_required') return 'Approval review'
  if (status === 'excluded_submitted') return 'Submitted'
  return 'Blocked'
}

function gmailDraftCreationStatusLabel(status: WarmGmailBatchDraftCreationStatus): string {
  if (status === 'eligible') return 'Eligible'
  if (status === 'provider_not_connected') return 'Provider not connected'
  if (status === 'approval_required') return 'Approval required'
  if (status === 'draft_already_exists') return 'Draft already exists'
  if (status === 'draft_created') return 'Draft created'
  if (status === 'excluded') return 'Excluded'
  return 'Blocked'
}

function buildGmailDraftPlanRow(args: {
  recipient: Omit<WarmBatchReviewRecipient, 'gmailDraftPlan'>
  contact: PortfolioRow
  rows: WarmOutreachSourceInventoryRows
  batchIdempotencyKey: string
  draftCreationReceiptAt?: string | null
}): WarmGmailBatchDraftPlanRow {
  const email = text(args.contact.email)
  const phone = text(args.contact.phone_number)
  const providerConnected = args.recipient.packet.channelCapabilities.email?.providerConfigured === true
  const submittedEvidenceExists = hasSubmittedEmailEvidence(args.rows)
  const approvalNeeded = Boolean(args.recipient.existingQueueId) || needsApprovalReview(args.rows)
  const selectedEmail = args.recipient.selectedChannel === 'email'
  const hardBlockers = [
    !email ? 'Missing email address for Gmail draft planning.' : null,
    args.recipient.weakBasis ? 'Relationship basis is too weak for a batch Gmail draft plan.' : null,
    args.recipient.suppressionStatus === 'blocked'
      ? args.recipient.suppressionReasons[0] ?? 'Suppression review is required before planning a Gmail draft.'
      : null,
    !selectedEmail ? 'Gmail is not the selected outreach channel for this recipient.' : null,
    submittedEvidenceExists ? 'Submitted email evidence already exists; exclude this recipient from batch drafting.' : null,
  ].filter(Boolean) as string[]

  const status: WarmGmailBatchDraftPlanRowStatus =
    submittedEvidenceExists
      ? 'excluded_submitted'
      : hardBlockers.length > 0
        ? 'blocked_review'
        : approvalNeeded
          ? 'approval_required'
          : 'ready_for_local_planning'

  const nextAction: WarmGmailBatchDraftPlanRow['nextAction'] =
    status === 'ready_for_local_planning'
      ? 'local_draft_planning'
      : status === 'approval_required'
        ? 'approval_request'
        : status === 'excluded_submitted'
          ? 'excluded_review'
          : 'blocked_review'
  const draftRecordKey = `warm-outreach:gmail-draft-record:v1:${stableHash({
    batchIdempotencyKey: args.batchIdempotencyKey,
    draftIdempotencyKey: args.recipient.draftIdempotencyKey,
    contactId: args.recipient.contactId,
    promptTemplateKey: args.recipient.promptTemplateKey,
  })}`
  const draftCreationStatus: WarmGmailBatchDraftCreationStatus = args.draftCreationReceiptAt &&
    status === 'ready_for_local_planning'
      ? 'draft_created'
      : args.recipient.existingQueueId
        ? 'draft_already_exists'
        : status === 'excluded_submitted'
          ? 'excluded'
          : hardBlockers.length > 0
            ? 'blocked'
            : approvalNeeded
              ? 'approval_required'
              : providerConnected
                ? 'eligible'
                : 'provider_not_connected'
  const draftCreationBlocker =
    draftCreationStatus === 'provider_not_connected'
      ? 'Connect and verify Gmail before creating provider drafts. Local records remain draft-only.'
      : draftCreationStatus === 'approval_required'
        ? 'Existing local draft state requires approval review before another Gmail draft record.'
        : draftCreationStatus === 'draft_already_exists'
          ? 'A local email draft already exists for this recipient and template.'
          : draftCreationStatus === 'excluded'
            ? 'Submitted email evidence already exists; this recipient is excluded from batch drafting.'
            : draftCreationStatus === 'blocked'
              ? hardBlockers[0] ?? 'Resolve recipient blockers before Gmail draft creation.'
              : null

  return {
    contactId: args.recipient.contactId,
    contactName: args.recipient.contactName,
    company: args.recipient.company,
    status,
    statusLabel: gmailDraftPlanStatusLabel(status),
    relationshipBasis: args.recipient.relationshipBasis,
    relationshipSignalCount: args.recipient.relationshipSignalCount,
    readiness: [
      readinessItem('missing_email', email ? 'clear' : 'blocked'),
      readinessItem('weak_relationship_basis', args.recipient.weakBasis ? 'blocked' : 'clear'),
      readinessItem('suppression_risk', args.recipient.suppressionStatus === 'blocked' ? 'blocked' : 'clear'),
      readinessItem('provider_not_connected', providerConnected ? 'clear' : 'needs_review'),
      readinessItem('approval_needed', approvalNeeded ? 'needs_review' : 'clear'),
      readinessItem('submitted_evidence_exists', submittedEvidenceExists ? 'blocked' : 'clear'),
      readinessItem('sms_unavailable', phone ? 'unavailable' : 'clear'),
    ],
    blockers: hardBlockers,
    nextAction,
    nextActionLabel:
      draftCreationStatus === 'draft_created'
        ? 'Draft record created'
        : draftCreationStatus === 'draft_already_exists'
          ? 'Open existing draft'
          : nextAction === 'local_draft_planning'
            ? 'Create Gmail draft record'
            : nextAction === 'approval_request'
          ? 'Review approval request'
          : nextAction === 'excluded_review'
            ? 'Review submitted evidence'
            : 'Resolve blocker',
    existingQueueId: args.recipient.existingQueueId,
    draftCreation: {
      status: draftCreationStatus,
      statusLabel: gmailDraftCreationStatusLabel(draftCreationStatus),
      actionEnabled: draftCreationStatus === 'eligible' || draftCreationStatus === 'provider_not_connected',
      blocker: draftCreationBlocker,
      draftOnly: true,
      draftRecordKey,
      localDraftRecordId: draftCreationStatus === 'draft_created' ? draftRecordKey : null,
      providerDraftId: null,
      createdAt: draftCreationStatus === 'draft_created' ? args.draftCreationReceiptAt ?? null : null,
      externalRequests: [],
    },
    draftIntent: {
      channel: 'gmail',
      templateFamily: args.recipient.selectedTemplate,
      promptTemplateKey: args.recipient.promptTemplateKey,
      queueIntent: 'draft_only_planned',
      createsOutreachQueueRow: false,
      createsGmailDraft: false,
      callsProvider: false,
      externalSend: false,
    },
  }
}

function buildGmailDraftPlan(
  rows: WarmGmailBatchDraftPlanRow[],
  draftCreationReceiptAt?: string | null,
): WarmGmailBatchDraftPlan {
  const readyForLocalPlanningCount = rows.filter((row) => row.status === 'ready_for_local_planning').length
  const approvalRequiredCount = rows.filter((row) => row.status === 'approval_required').length
  const blockedReviewCount = rows.filter((row) => row.status === 'blocked_review').length
  const excludedSubmittedCount = rows.filter((row) => row.status === 'excluded_submitted').length
  const providerNotConnectedCount = rows.filter((row) =>
    row.readiness.some((item) => item.key === 'provider_not_connected' && item.state !== 'clear'),
  ).length
  const smsUnavailableCount = rows.filter((row) =>
    row.readiness.some((item) => item.key === 'sms_unavailable' && item.state === 'unavailable'),
  ).length
  const draftCreationEligibleCount = rows.filter((row) =>
    row.draftCreation.status === 'eligible' || row.draftCreation.status === 'provider_not_connected',
  ).length
  const draftAlreadyExistsCount = rows.filter((row) => row.draftCreation.status === 'draft_already_exists').length
  const draftCreatedCount = rows.filter((row) => row.draftCreation.status === 'draft_created').length

  const currentCta: WarmGmailBatchDraftPlan['currentCta'] =
    draftCreatedCount > 0 && draftCreationEligibleCount === 0
      ? {
          key: 'draft_records_created',
          label: 'Gmail draft records created',
          enabled: false,
          blocker: null,
        }
      : draftCreationEligibleCount > 0
      ? {
          key: 'create_gmail_draft_records',
          label: `Create Gmail draft records (${draftCreationEligibleCount})`,
          enabled: true,
          blocker: null,
        }
      : approvalRequiredCount > 0
      ? {
          key: 'review_approval_requests',
          label: 'Review approval requests',
            enabled: true,
            blocker: null,
          }
        : {
            key: 'resolve_blocked_rows',
            label: 'Resolve blocked rows',
            enabled: false,
            blocker:
              rows[0]?.blockers[0] ??
              'No selected recipient is ready for local Gmail draft planning.',
          }

  return {
    version: 'warm-outreach-gmail-batch-draft-plan/v1',
    status:
      draftCreatedCount > 0 && draftCreationEligibleCount === 0
        ? 'draft_records_created'
        : draftCreationEligibleCount > 0
          ? 'draft_creation_ready'
          : readyForLocalPlanningCount > 0
            ? 'ready_for_local_planning'
        : approvalRequiredCount > 0
          ? 'approval_review_needed'
          : 'blocked_review',
    currentCta,
    summary: {
      selectedCount: rows.length,
      readyForLocalPlanningCount,
      approvalRequiredCount,
      blockedReviewCount,
      excludedSubmittedCount,
      providerNotConnectedCount,
      smsUnavailableCount,
      draftCreationEligibleCount,
      draftAlreadyExistsCount,
      draftCreatedCount,
    },
    rows,
    executionReceipt: draftCreationReceiptAt && draftCreatedCount > 0
      ? {
          action: 'create_gmail_draft_records',
          createdAt: draftCreationReceiptAt,
          createdCount: draftCreatedCount,
          externalRequests: [],
        }
      : null,
    executionBoundary: {
      localPortfolioPlanOnly: true,
      createsOutreachQueueRows: false,
      createsGmailDrafts: false,
      gmailProviderCalls: false,
      gmailSend: false,
      slackDispatch: false,
      smsDelivery: false,
      n8nDispatch: false,
      productionDataMutation: false,
      genericApprovalAuthorizesSend: false,
    },
  }
}

export function buildWarmBatchReview(args: {
  contacts: WarmBatchReviewContactInput[]
  objective: string
  cohortLabel?: string | null
  preferredChannel?: WarmOutreachChannel
  draftCreationReceiptAt?: string | null
}): WarmBatchReview {
  const sortedContactIds = args.contacts
    .map((entry) => Number(entry.contact.id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((a, b) => a - b)
  const cohortLabel = args.cohortLabel?.trim() || 'Selected warm outreach leads'
  const batchHash = stableHash({
    mode: 'warm_1_to_many',
    objective: args.objective,
    cohortLabel,
    preferredChannel: args.preferredChannel ?? null,
    contactIds: sortedContactIds,
  })
  const batchIdempotencyKey = `warm-outreach:batch-review:v1:${batchHash}`

  const recipientsWithoutGmailPlan = args.contacts.map((entry): Omit<WarmBatchReviewRecipient, 'gmailDraftPlan'> => {
    const contactId = Number(entry.contact.id)
    const contactName = text(entry.contact.name) ?? `Contact ${contactId}`
    const company = text(entry.contact.company)
    const packet = buildWarmOutreachSourceInventoryPacket({
      contactId,
      objective: args.objective,
      preferredChannel: args.preferredChannel,
      rows: entry.rows,
    })
    const readiness = evaluateWarmOutreachReadiness(packet)
    const contextSummary = buildWarmOutreachContextSummary(packet)
    const responseMonitoring = buildWarmOutreachResponseMonitoring({
      contactId,
      packet,
      readiness,
      rows: {
        contactCommunications: entry.rows.contactCommunications,
        outreachQueue: entry.rows.outreachQueue,
        emailMessages: entry.rows.emailMessages,
        actionTasks: entry.rows.actionTasks,
      },
    })
    const weakBasis = relationshipBasisIsWeak(packet)
    const promptTemplateKey = promptTemplateKeyFor(
      readiness.selectedChannel,
      readiness.recommendedTemplate,
    )
    const suppressions = suppressionReasons(packet, readiness)
    const existingQueueId = existingDraftFor({
      rows: entry.existingOutreachRows ?? entry.rows.outreachQueue ?? [],
      contactId,
      channel: readiness.selectedChannel,
      templateKey: promptTemplateKey,
    })
    const blockers = [
      ...readiness.blockers,
      ...(weakBasis ? ['Relationship basis is too weak for batch draft generation.'] : []),
      ...(!isExternalDraftChannel(readiness.selectedChannel)
        ? ['Batch draft review currently supports email and LinkedIn only.']
        : []),
      ...(!promptTemplateKey ? ['No supported prompt template is available for this recipient.'] : []),
    ]
    const status: WarmBatchReviewRecipientStatus =
      blockers.length > 0
        ? 'blocked'
        : existingQueueId
          ? 'existing_draft'
          : 'ready_for_review'
    const draftHash = stableHash({
      batchIdempotencyKey,
      contactId,
      channel: readiness.selectedChannel,
      templateKey: promptTemplateKey,
      relationshipEventId: packet.relationshipEventId ?? null,
    })

    return {
      contactId,
      contactName,
      company,
      relationshipBasis: packet.relationshipBasis,
      relationshipSignalCount: packet.relationshipSignals.length,
      selectedChannel: readiness.selectedChannel,
      selectedTemplate: readiness.recommendedTemplate,
      promptTemplateKey,
      suppressionStatus: suppressions.length > 0 ? 'blocked' : 'clear',
      suppressionReasons: suppressions,
      weakBasis,
      blockers,
      warnings: readiness.warnings,
      status,
      draftIdempotencyKey: `warm-outreach:batch-draft:v1:${draftHash}`,
      existingQueueId,
      individualizedDraftPreview: buildIndividualizedPreview({
        contactName,
        company,
        packet,
        readiness,
        weakBasis,
      }),
      responseMonitoring,
      sendReadiness: responseMonitoring.sendReadiness,
      packet,
      readiness,
      contextSummary,
    }
  })

  const recipients: WarmBatchReviewRecipient[] = recipientsWithoutGmailPlan.map((recipient, index) => ({
    ...recipient,
    gmailDraftPlan: buildGmailDraftPlanRow({
      recipient,
      contact: args.contacts[index].contact,
      rows: args.contacts[index].rows,
      batchIdempotencyKey,
      draftCreationReceiptAt: args.draftCreationReceiptAt,
    }),
  }))
  const gmailDraftPlan = buildGmailDraftPlan(
    recipients.map((recipient) => recipient.gmailDraftPlan),
    args.draftCreationReceiptAt,
  )
  const readyRecipients = recipients.filter((recipient) => recipient.status === 'ready_for_review')
  const existingDraftRecipients = recipients.filter((recipient) => recipient.status === 'existing_draft')
  const blockedRecipients = recipients.filter((recipient) => recipient.status === 'blocked')
  const suppressionBlockedRecipients = recipients.filter((recipient) => recipient.suppressionStatus === 'blocked')
  const weakBasisRecipients = recipients.filter((recipient) => recipient.weakBasis)

  return {
    mode: 'warm_1_to_many',
    batchIdempotencyKey,
    cohort: {
      label: cohortLabel,
      recipientCount: recipients.length,
      source: 'selected_outreach_leads',
      provenance: `Selected ${recipients.length} existing /admin/outreach lead${recipients.length === 1 ? '' : 's'} from local Portfolio rows.`,
    },
    summary: {
      readyCount: readyRecipients.length,
      existingDraftCount: existingDraftRecipients.length,
      blockedCount: blockedRecipients.length,
      weakBasisCount: weakBasisRecipients.length,
      suppressionBlockedCount: suppressionBlockedRecipients.length,
    },
    samplePreview: readyRecipients[0] ?? existingDraftRecipients[0] ?? blockedRecipients[0] ?? null,
    recipients,
    gmailDraftPlan,
    executionBoundary: {
      source: 'local_portfolio_rows',
      readOnly: true,
      providerCalls: false,
      createsDraft: false,
      externalSend: false,
      scheduling: false,
      gmailDraft: false,
      linkedinAction: false,
      facebookAction: false,
      phoneAction: false,
      n8nDispatch: false,
      slackAction: false,
      responseMonitoring: false,
    },
  }
}

export function parseWarmBatchContactIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  for (const item of value) {
    const id = typeof item === 'number' ? item : Number.parseInt(String(item), 10)
    if (Number.isInteger(id) && id > 0) seen.add(id)
  }
  return [...seen].sort((a, b) => a - b)
}

export function rowContactId(row: PortfolioRow): number | null {
  const id = Number(row.contact_submission_id ?? row.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function hasSuppressedWarmBatchStatus(row: PortfolioRow): boolean {
  const status = text(row.status)?.toLowerCase()
  const outreachStatus = text(row.outreach_status)?.toLowerCase()
  const metadata = row.metadata && typeof row.metadata === 'object'
    ? row.metadata as PortfolioRow
    : null
  const metadataStatus = text(metadata?.status)?.toLowerCase()

  return (
    bool(row.do_not_contact) ||
    bool(row.unsubscribed) ||
    bool(row.suppressed) ||
    bool(metadata?.do_not_contact) ||
    bool(metadata?.unsubscribed) ||
    bool(metadata?.suppressed) ||
    status === 'opted_out' ||
    status === 'unsubscribed' ||
    status === 'suppressed' ||
    outreachStatus === 'opted_out' ||
    outreachStatus === 'unsubscribed' ||
    metadataStatus === 'opted_out' ||
    metadataStatus === 'unsubscribed' ||
    metadataStatus === 'suppressed'
  )
}
