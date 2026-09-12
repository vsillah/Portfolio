import {
  warmOutreachRelationshipPacketSchema,
  type WarmOutreachChannel,
  type WarmOutreachRelationshipPacket,
} from './warm-outreach-relationship-intelligence'

type RowValue = string | number | boolean | null | undefined | Record<string, unknown> | unknown[]
type PortfolioRow = Record<string, RowValue>

type SourceVisibility = 'public' | 'portfolio_internal' | 'private_sensitive'
type MentionSafety = 'safe_to_mention' | 'summarize_only' | 'do_not_mention'
type SourceStatus = 'present' | 'missing' | 'blocked' | 'suppressed'

type InventorySourceType =
  | 'portfolio_contact'
  | 'meeting_record'
  | 'meeting_action_task'
  | 'prior_outreach'
  | 'imported_reply'

type InventorySourceRef = WarmOutreachRelationshipPacket['sourceRefs'][number]

export type WarmOutreachSourceInventoryRows = {
  contactSubmission?: PortfolioRow | null
  contactCommunications?: PortfolioRow[]
  outreachQueue?: PortfolioRow[]
  emailMessages?: PortfolioRow[]
  meetingSummaries?: PortfolioRow[]
  actionTasks?: PortfolioRow[]
}

export type BuildWarmOutreachSourceInventoryArgs = {
  contactId: string | number
  objective: string
  rows: WarmOutreachSourceInventoryRows
  preferredChannel?: WarmOutreachChannel
}

const sourceLabels: Record<InventorySourceType, string> = {
  portfolio_contact: 'contact_submissions',
  meeting_record: 'meeting_records',
  meeting_action_task: 'meeting_action_tasks',
  prior_outreach: 'outreach_queue/contact_communications',
  imported_reply: 'email_messages/contact_communications',
}

function text(value: RowValue): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
}

function bool(value: RowValue): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function asRows(rows: PortfolioRow[] | undefined): PortfolioRow[] {
  return Array.isArray(rows) ? rows : []
}

function record(value: RowValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function isManualSocialEvidenceRow(row: PortfolioRow): boolean {
  const metadata = record(row.metadata)
  const nested = record(metadata.warm_manual_social_handoff_evidence as RowValue)
  const evidence = Object.keys(nested).length > 0 ? nested : metadata
  return evidence.version === 'warm-outreach-manual-social-evidence/v1'
}

function rowId(row: PortfolioRow, fallback: string): string {
  return text(row.id) ?? text(row.source_id) ?? fallback
}

function truncate(value: string, max = 220): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trim()}...`
}

function contactName(row: PortfolioRow | null | undefined): string | undefined {
  if (!row) return undefined
  return text(row.name) ?? text(row.full_name) ?? text(row.contact_name) ?? undefined
}

function contactEmail(row: PortfolioRow | null | undefined): string | null {
  if (!row) return null
  return text(row.email) ?? text(row.email_address)
}

function hasValue(row: PortfolioRow | null | undefined, keys: string[]): boolean {
  if (!row) return false
  return keys.some((key) => Boolean(text(row[key]) ?? (bool(row[key]) ? 'true' : null)))
}

function sourceStatus(sourceType: InventorySourceType, rows: PortfolioRow[]): {
  sourceType: string
  status: SourceStatus
  detail: string
} {
  return {
    sourceType: sourceLabels[sourceType],
    status: rows.length > 0 ? 'present' : 'missing',
    detail:
      rows.length > 0
        ? `${rows.length} local Portfolio row${rows.length === 1 ? '' : 's'} available.`
        : 'No local Portfolio row was provided for this source.',
  }
}

function sourceRef(args: {
  sourceType: InventorySourceType
  sourceId: string
  summary: string
  privateSource?: boolean
  visibility: SourceVisibility
  mentionSafety: MentionSafety
  sourceStatus?: SourceStatus
}): InventorySourceRef {
  return {
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    summary: truncate(args.summary, 500),
    privateSource: args.privateSource ?? args.visibility !== 'public',
    visibility: args.visibility,
    mentionSafety: args.mentionSafety,
    sourceStatus: args.sourceStatus ?? 'present',
  }
}

function summarizeContact(row: PortfolioRow, contactId: string): InventorySourceRef {
  const name = contactName(row)
  const company = text(row.company) ?? text(row.organization)
  const source = text(row.source) ?? text(row.lead_source) ?? text(row.submission_source)
  const parts = [
    name ? `Portfolio contact ${name}` : 'Portfolio contact record',
    company ? `company ${company}` : null,
    source ? `source ${source}` : null,
  ].filter(Boolean)

  return sourceRef({
    sourceType: 'portfolio_contact',
    sourceId: contactId,
    summary: `${parts.join('; ')}.`,
    privateSource: false,
    visibility: 'portfolio_internal',
    mentionSafety: 'summarize_only',
  })
}

function summarizeCommunication(row: PortfolioRow, index: number): InventorySourceRef {
  const direction = text(row.direction)
  const channel = text(row.channel)
  const messageType = text(row.message_type) ?? text(row.email_kind)
  const status = text(row.status)
  const subject = text(row.subject)
  const sentAt = text(row.sent_at) ?? text(row.created_at)
  const label = [direction, channel, messageType, status].filter(Boolean).join(' ')

  return sourceRef({
    sourceType: direction === 'inbound' ? 'imported_reply' : 'prior_outreach',
    sourceId: rowId(row, `communication-${index + 1}`),
    summary: truncate(
      `${label || 'Communication'}${subject ? ` about "${subject}"` : ''}${
        sentAt ? ` recorded ${sentAt}` : ''
      }. Private body content is available only as internal context.`,
    ),
    privateSource: true,
    visibility: 'private_sensitive',
    mentionSafety: direction === 'inbound' ? 'summarize_only' : 'do_not_mention',
  })
}

function summarizeOutreachQueue(row: PortfolioRow, index: number): InventorySourceRef {
  const channel = text(row.channel) ?? text(row.preferred_channel)
  const status = text(row.status) ?? text(row.email_status)
  const topic = text(row.campaign_name) ?? text(row.template_key) ?? text(row.subject)

  return sourceRef({
    sourceType: 'prior_outreach',
    sourceId: rowId(row, `outreach-${index + 1}`),
    summary: `${channel ?? 'Outreach'} queue row${status ? ` with status ${status}` : ''}${
      topic ? ` tied to ${topic}` : ''
    }.`,
    privateSource: false,
    visibility: 'portfolio_internal',
    mentionSafety: 'summarize_only',
  })
}

function summarizeMeeting(row: PortfolioRow, index: number): InventorySourceRef {
  const meetingType = text(row.meeting_type) ?? 'meeting'
  const meetingDate = text(row.meeting_date) ?? text(row.created_at)
  const title = text(row.title) ?? text(row.meeting_title)
  const summary = text(row.summary) ?? text(row.structured_summary)

  return sourceRef({
    sourceType: 'meeting_record',
    sourceId: rowId(row, `meeting-${index + 1}`),
    summary: `${title ?? meetingType}${meetingDate ? ` on ${meetingDate}` : ''}${
      summary ? `: ${summary}` : ''
    }. Raw notes/transcripts remain private.`,
    privateSource: true,
    visibility: 'private_sensitive',
    mentionSafety: 'summarize_only',
  })
}

function summarizeActionTask(row: PortfolioRow, index: number): InventorySourceRef {
  const title = text(row.title) ?? 'Meeting action task'
  const status = text(row.status)
  const dueDate = text(row.due_date)

  return sourceRef({
    sourceType: 'meeting_action_task',
    sourceId: rowId(row, `task-${index + 1}`),
    summary: `${title}${status ? ` (${status})` : ''}${dueDate ? ` due ${dueDate}` : ''}.`,
    privateSource: true,
    visibility: 'portfolio_internal',
    mentionSafety: 'summarize_only',
  })
}

function suppressionFromContact(row: PortfolioRow | null | undefined) {
  const removedAt = row ? text(row.removed_at) ?? text(row.removedAt) : null
  const doNotContact = row
    ? bool(row.do_not_contact) || bool(row.doNotContact) || bool(row.dnc)
    : false
  const unsubscribed = row
    ? bool(row.unsubscribed) || bool(row.email_unsubscribed) || bool(row.suppressed)
    : false
  const suppressionReason = row
    ? text(row.suppression_reason) ??
      text(row.suppressionReason) ??
      (doNotContact ? 'Contact is marked do not contact in Portfolio.' : undefined)
    : undefined

  return {
    doNotContact,
    unsubscribed,
    removedAt: removedAt ?? undefined,
    suppressionReason,
  }
}

function channelCapabilities(row: PortfolioRow | null | undefined) {
  const hasEmail = Boolean(contactEmail(row))
  const hasLinkedIn = hasValue(row, ['linkedin_url', 'linkedin', 'linkedin_profile'])
  const hasFacebook = hasValue(row, [
    'facebook_url',
    'facebook',
    'facebook_profile',
    'facebook_profile_url',
  ])
  const hasPhone = hasValue(row, ['phone', 'phone_number', 'mobile'])

  return {
    email: {
      available: hasEmail,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: false,
      reason: hasEmail
        ? 'Email is draft-only in this inventory contract; no provider send is enabled.'
        : 'No email address is present in the provided Portfolio contact row.',
    },
    linkedin: {
      available: hasLinkedIn,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: false,
      reason: hasLinkedIn
        ? 'LinkedIn is draft-only in this inventory contract; no provider action is enabled.'
        : 'No LinkedIn profile is present in the provided Portfolio contact row.',
    },
    facebook: {
      available: hasFacebook,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: true,
      reason: 'Facebook outreach remains manual-only; no DM provider action is enabled.',
    },
    phone_contact: {
      available: hasPhone,
      providerConfigured: false,
      supportsExternalSend: false,
      manualOnly: true,
      reason: 'Phone contact outreach remains manual-only; no SMS or call action is enabled.',
    },
  }
}

function relationshipSignals(refs: InventorySourceRef[]): string[] {
  const signals = new Set<string>()
  if (refs.some((ref) => ref.sourceType === 'meeting_record')) {
    signals.add('prior meeting context')
  }
  if (refs.some((ref) => ref.sourceType === 'meeting_action_task')) {
    signals.add('open follow-up task')
  }
  if (refs.some((ref) => ref.sourceType === 'prior_outreach')) {
    signals.add('prior outreach history')
  }
  if (refs.some((ref) => ref.sourceType === 'imported_reply')) {
    signals.add('prior inbound reply')
  }
  return [...signals]
}

function choosePreferredChannel(
  requested: WarmOutreachChannel | undefined,
  capabilities: ReturnType<typeof channelCapabilities>,
): WarmOutreachChannel | undefined {
  if (requested && capabilities[requested].available) return requested
  if (capabilities.email.available) return 'email'
  if (capabilities.linkedin.available) return 'linkedin'
  if (capabilities.facebook.available) return 'facebook'
  if (capabilities.phone_contact.available) return 'phone_contact'
  return requested
}

export function buildWarmOutreachSourceInventoryPacket(
  args: BuildWarmOutreachSourceInventoryArgs,
): WarmOutreachRelationshipPacket {
  const contactId = String(args.contactId)
  const contact = args.rows.contactSubmission ?? null
  const contactCommunications = asRows(args.rows.contactCommunications)
    .filter((row) => !isManualSocialEvidenceRow(row))
  const refs: InventorySourceRef[] = []

  if (contact) refs.push(summarizeContact(contact, contactId))
  refs.push(...contactCommunications.map(summarizeCommunication))
  refs.push(...asRows(args.rows.outreachQueue).map(summarizeOutreachQueue))
  refs.push(...asRows(args.rows.emailMessages).map(summarizeCommunication))
  refs.push(...asRows(args.rows.meetingSummaries).map(summarizeMeeting))
  refs.push(...asRows(args.rows.actionTasks).map(summarizeActionTask))

  const contactCompany = contact ? text(contact.company) : null
  const contactIndustry = contact ? text(contact.industry) : null
  const safeCommonalities = [
    contactCompany ? `Their company context: ${contactCompany}.` : null,
    contactIndustry ? `Their industry context: ${contactIndustry}.` : null,
  ].filter(Boolean) as string[]
  const safeToMention = refs
    .filter((ref) => ref.mentionSafety === 'safe_to_mention')
    .map((ref) => ref.summary)
    .concat(safeCommonalities)
  const summarizeOnly = refs
    .filter((ref) => ref.mentionSafety === 'summarize_only')
    .map((ref) => ref.summary)
  const doNotMention = refs
    .filter((ref) => ref.mentionSafety === 'do_not_mention')
    .map((ref) => ref.summary)
  const sourceRows = {
    portfolio_contact: contact ? [contact] : [],
    meeting_record: asRows(args.rows.meetingSummaries),
    meeting_action_task: asRows(args.rows.actionTasks),
    prior_outreach: [
      ...asRows(args.rows.outreachQueue),
      ...contactCommunications.filter((row) => text(row.direction) !== 'inbound'),
    ],
    imported_reply: [
      ...asRows(args.rows.emailMessages),
      ...contactCommunications.filter((row) => text(row.direction) === 'inbound'),
    ],
  }
  const suppression = suppressionFromContact(contact)
  const capabilities = channelCapabilities(contact)
  const signals = relationshipSignals(refs)
  const commonalities = [
    contactCompany,
    contactIndustry,
    ...signals,
  ].filter(Boolean) as string[]
  const relationshipBasis =
    signals.length > 0
      ? `Portfolio shows ${signals.join(', ')} for this contact.`
      : 'Portfolio has limited local relationship evidence for this contact.'

  return warmOutreachRelationshipPacketSchema.parse({
    contactId: args.contactId,
    contactName: contactName(contact),
    objective: args.objective,
    relationshipBasis,
    sourceRefs:
      refs.length > 0
        ? refs
        : [
            sourceRef({
              sourceType: 'portfolio_contact',
              sourceId: contactId,
              summary: 'No local Portfolio relationship rows were provided for this contact.',
              privateSource: false,
              visibility: 'portfolio_internal',
              mentionSafety: 'do_not_mention',
              sourceStatus: 'missing',
            }),
          ],
    relationshipSignals: signals,
    commonalities,
    riskFlags: [
      ...(suppression.doNotContact ? ['Contact is marked do not contact.'] : []),
      ...(suppression.removedAt ? ['Contact was removed from outreach.'] : []),
      ...(suppression.unsubscribed ? ['Contact is unsubscribed.'] : []),
      ...(doNotMention.length > 0 ? ['Some private prior outreach context is not safe to mention.'] : []),
    ],
    sourceInventory: {
      sourceStatus: (Object.keys(sourceRows) as InventorySourceType[]).map((sourceType) =>
        sourceStatus(sourceType, sourceRows[sourceType]),
      ),
      safeToMention,
      summarizeOnly,
      doNotMention,
    },
    openingPitchGuidance: {
      safeCommonalities: commonalities.slice(0, 5),
      openingAngle:
        signals.length > 0
          ? `Open with the strongest local relationship signal, then connect it to: ${args.objective}`
          : `Use a light reintroduction and avoid implying a relationship that Portfolio has not evidenced.`,
      channelNotes: {
        email: capabilities.email.reason,
        linkedin: capabilities.linkedin.reason,
        facebook: capabilities.facebook.reason,
        phone_contact: capabilities.phone_contact.reason,
      },
    },
    suggestedNextStep:
      'Prepare a human-reviewed email or LinkedIn draft from this packet; keep Facebook and phone contact outreach manual.',
    avoidContext: [
      'Do not quote private email bodies, meeting transcripts, raw notes, phone numbers, or internal task text.',
      'Do not imply provider authorization, scheduling, reply monitoring, or external send capability.',
      ...doNotMention,
    ],
    responseMonitoringPlan: {
      enabled: false,
      plan: 'Response monitoring is not activated by this inventory packet. A future workflow must request explicit approval before any monitoring or provider action.',
      externalActivationRequired: true,
    },
    confidence: refs.length >= 3 || signals.length >= 2 ? 'medium' : 'low',
    suppression,
    channelCapabilities: capabilities,
    preferredChannel: choosePreferredChannel(args.preferredChannel, capabilities),
  })
}
