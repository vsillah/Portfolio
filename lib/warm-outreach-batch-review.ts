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
import type { OutreachChannel } from './constants/prompt-keys'

type PortfolioRow = NonNullable<WarmOutreachSourceInventoryRows['contactSubmission']>

export type WarmBatchReviewRecipientStatus =
  | 'ready_for_review'
  | 'existing_draft'
  | 'blocked'

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

export function buildWarmBatchReview(args: {
  contacts: WarmBatchReviewContactInput[]
  objective: string
  cohortLabel?: string | null
  preferredChannel?: WarmOutreachChannel
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

  const recipients = args.contacts.map((entry): WarmBatchReviewRecipient => {
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
      packet,
      readiness,
      contextSummary,
    }
  })

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
