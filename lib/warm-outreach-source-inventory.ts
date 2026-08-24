import { supabaseAdmin } from '@/lib/supabase'
import {
  buildWarmOutreachContextSummary,
  evaluateWarmOutreachReadiness,
  type WarmOutreachChannel,
  type WarmOutreachRelationshipPacket,
  type WarmOutreachReadiness,
} from '@/lib/warm-outreach-relationship-intelligence'

type DbLike = {
  from: (table: string) => any
}

type SourceRef = WarmOutreachRelationshipPacket['sourceRefs'][number]

type ContactRow = {
  id: number
  name: string | null
  email: string | null
  company: string | null
  company_domain: string | null
  job_title: string | null
  industry: string | null
  phone_number: string | null
  linkedin_url: string | null
  facebook_profile_url: string | null
  message: string | null
  lead_source: string | null
  relationship_strength: string | null
  warm_source_detail: string | null
  quick_wins: string | null
  rep_pain_points: string | null
  do_not_contact: boolean | null
  removed_at: string | null
  outreach_status: string | null
}

type ContactCommunicationRow = {
  id: string
  channel: string
  direction: 'outbound' | 'inbound'
  message_type: string
  subject: string | null
  source_system: string
  source_id: string | null
  status: string
  sent_at: string | null
  created_at: string
}

type OutreachQueueRow = {
  id: string
  channel: string
  subject: string | null
  sequence_step: number | null
  status: string
  reply_content: string | null
  sent_at: string | null
  replied_at: string | null
  created_at: string
}

type EmailMessageRow = {
  id: string
  channel: string
  direction: 'outbound' | 'inbound'
  status: string
  transport: string
  source_system: string
  source_id: string | null
  external_id: string | null
  subject: string | null
  sent_at: string | null
  created_at: string
}

type MeetingRecordRow = {
  id: string
  meeting_type: string | null
  meeting_date: string
  structured_notes: unknown
  raw_notes: string | null
  transcript: string | null
}

type MeetingActionTaskRow = {
  id: string
  title: string
  status: string
  due_date: string | null
  task_category: string | null
  created_at: string
}

export type WarmOutreachSourceInventory = {
  packet: WarmOutreachRelationshipPacket
  readiness: WarmOutreachReadiness
  contextSummary: ReturnType<typeof buildWarmOutreachContextSummary>
  dataGaps: string[]
  providerCallsAttempted: false
  externalExecutionEnabled: false
  queriedTables: string[]
}

export type WarmOutreachSourceInventoryResult =
  | ({ status: 'ready' | 'blocked' } & WarmOutreachSourceInventory)
  | {
      status: 'blocked'
      error: string
      dataGaps: string[]
      providerCallsAttempted: false
      externalExecutionEnabled: false
      queriedTables: string[]
    }

const CONTACT_SELECT = [
  'id',
  'name',
  'email',
  'company',
  'company_domain',
  'job_title',
  'industry',
  'phone_number',
  'linkedin_url',
  'facebook_profile_url',
  'message',
  'lead_source',
  'relationship_strength',
  'warm_source_detail',
  'quick_wins',
  'rep_pain_points',
  'do_not_contact',
  'removed_at',
  'outreach_status',
].join(', ')

const LOCAL_TABLES = [
  'contact_submissions',
  'contact_communications',
  'outreach_queue',
  'email_messages',
  'meeting_records',
  'meeting_action_tasks',
] as const

function compact(value: string | null | undefined, max = 120) {
  const cleaned = value?.replace(/\s+/g, ' ').trim()
  if (!cleaned) return null
  return cleaned.length > max ? `${cleaned.slice(0, max - 3)}...` : cleaned
}

function displayDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function sourceLabel(value: string | null | undefined) {
  return value?.replace(/_/g, ' ').trim() || 'Portfolio contact'
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const value = String(row[key] ?? 'unknown')
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].map(([value, count]) => `${value}: ${count}`).join(', ')
}

function normalizeNotes(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return null

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function contactSourceStatus(contact: ContactRow): SourceRef['sourceStatus'] {
  if (contact.removed_at || contact.do_not_contact) return 'blocked'
  if (contact.lead_source?.startsWith('warm_')) return 'verified'
  return 'manual'
}

function buildContactRefs(contact: ContactRow): SourceRef[] {
  const refs: SourceRef[] = []
  const roleParts = [compact(contact.job_title, 80), compact(contact.company, 80)].filter(Boolean)

  refs.push({
    sourceType: 'portfolio_contact',
    sourceId: String(contact.id),
    summary: `${sourceLabel(contact.lead_source)} record${roleParts.length ? ` for ${roleParts.join(' at ')}` : ''}.`,
    privateSource: false,
    visibility: 'private_summary',
    sourceStatus: contactSourceStatus(contact),
    safeToMention: false,
  })

  if (contact.warm_source_detail || contact.relationship_strength) {
    refs.push({
      sourceType: 'portfolio_contact',
      sourceId: String(contact.id),
      summary: [
        contact.relationship_strength ? `Relationship strength: ${contact.relationship_strength}.` : null,
        contact.warm_source_detail ? 'Warm source detail is recorded in Portfolio.' : null,
      ].filter(Boolean).join(' '),
      privateSource: true,
      visibility: 'private_summary',
      sourceStatus: 'verified',
      safeToMention: false,
      avoidInDraftReason: 'Use as operator context only unless the relationship detail is explicitly approved for the draft.',
    })
  }

  if (contact.message || contact.quick_wins || contact.rep_pain_points) {
    refs.push({
      sourceType: 'manual_note',
      sourceId: String(contact.id),
      summary: 'Portfolio lead notes, quick wins, or pain points are present and summarized for operator review.',
      privateSource: true,
      visibility: 'operator_only',
      sourceStatus: 'manual',
      safeToMention: false,
      avoidInDraftReason: 'Do not quote private notes or internal pain-point wording in outreach copy.',
    })
  }

  if (contact.linkedin_url) {
    refs.push({
      sourceType: 'linkedin',
      sourceId: contact.linkedin_url,
      summary: 'LinkedIn profile URL is recorded on the Portfolio contact.',
      privateSource: false,
      visibility: 'public_profile',
      sourceStatus: 'verified',
      safeToMention: true,
    })
  }

  if (contact.facebook_profile_url || contact.lead_source?.startsWith('warm_facebook')) {
    refs.push({
      sourceType: 'facebook',
      sourceId: contact.facebook_profile_url ?? String(contact.id),
      summary: 'Facebook relationship/source reference is recorded in Portfolio.',
      privateSource: true,
      visibility: 'operator_only',
      sourceStatus: 'manual',
      safeToMention: false,
      avoidInDraftReason: 'Facebook remains manual-only; do not imply provider access or send capability.',
    })
  }

  if (contact.phone_number) {
    refs.push({
      sourceType: 'phone_contact',
      sourceId: String(contact.id),
      summary: 'Phone contact detail is present in Portfolio for manual operator review.',
      privateSource: true,
      visibility: 'operator_only',
      sourceStatus: 'manual',
      safeToMention: false,
      avoidInDraftReason: 'Phone contact data must not be copied into prompts or public-facing draft copy.',
    })
  }

  return refs
}

function buildCommunicationRefs(rows: ContactCommunicationRow[]): SourceRef[] {
  if (rows.length === 0) return []
  return [{
    sourceType: 'contact_communication',
    sourceId: rows[0].id,
    summary: [
      `${rows.length} contact communication record(s) are present.`,
      `Directions: ${countBy(rows, 'direction')}.`,
      `Channels: ${countBy(rows, 'channel')}.`,
      `Latest status: ${rows[0].status}.`,
    ].join(' '),
    privateSource: true,
    visibility: 'private_summary',
    sourceStatus: 'verified',
    safeToMention: false,
    avoidInDraftReason: 'Summarize communication history; do not quote private messages.',
  }]
}

function buildOutreachRefs(rows: OutreachQueueRow[]): SourceRef[] {
  if (rows.length === 0) return []
  const replyCount = rows.filter((row) => row.reply_content || row.replied_at).length
  return [{
    sourceType: 'outreach_queue',
    sourceId: rows[0].id,
    summary: [
      `${rows.length} outreach queue row(s) are present.`,
      `Statuses: ${countBy(rows, 'status')}.`,
      `Channels: ${countBy(rows, 'channel')}.`,
      replyCount ? `${replyCount} row(s) indicate a reply.` : 'No replied outreach row is summarized.',
    ].join(' '),
    privateSource: true,
    visibility: 'private_summary',
    sourceStatus: 'verified',
    safeToMention: false,
    avoidInDraftReason: 'Use as outreach-history context only; do not quote reply content.',
  }]
}

function buildEmailRefs(rows: EmailMessageRow[]): SourceRef[] {
  if (rows.length === 0) return []
  return [{
    sourceType: 'email_message',
    sourceId: rows[0].id,
    summary: [
      `${rows.length} Email Center row(s) are present.`,
      `Directions: ${countBy(rows, 'direction')}.`,
      `Statuses: ${countBy(rows, 'status')}.`,
      `Transports: ${countBy(rows, 'transport')}.`,
    ].join(' '),
    privateSource: true,
    visibility: 'private_summary',
    sourceStatus: 'verified',
    safeToMention: false,
    avoidInDraftReason: 'Email Center rows can guide the operator but private email content must not be quoted.',
  }]
}

function buildMeetingRefs(rows: MeetingRecordRow[]): SourceRef[] {
  if (rows.length === 0) return []
  const latest = rows[0]
  const latestDate = displayDate(latest.meeting_date)
  const hasStructuredSummary = rows.some((row) => {
    const notes = normalizeNotes(row.structured_notes)
    return Boolean(notes && Object.keys(notes).length > 0)
  })

  return [{
    sourceType: 'meeting_record',
    sourceId: latest.id,
    summary: [
      `${rows.length} meeting record(s) are present.`,
      latest.meeting_type ? `Latest meeting type: ${latest.meeting_type}.` : null,
      latestDate ? `Latest meeting date: ${latestDate}.` : null,
      hasStructuredSummary ? 'Structured summary material is available.' : null,
    ].filter(Boolean).join(' '),
    privateSource: true,
    visibility: 'private_summary',
    sourceStatus: 'verified',
    safeToMention: true,
    avoidInDraftReason: 'Mention only the existence and approved summary of the meeting; do not quote transcripts or raw notes.',
  }]
}

function buildMeetingTaskRefs(rows: MeetingActionTaskRow[]): SourceRef[] {
  if (rows.length === 0) return []
  const latestDue = rows.map((row) => displayDate(row.due_date)).filter(Boolean)[0]
  return [{
    sourceType: 'meeting_action_task',
    sourceId: rows[0].id,
    summary: [
      `${rows.length} meeting action task(s) are linked to this contact.`,
      `Statuses: ${countBy(rows, 'status')}.`,
      latestDue ? `Nearest due date: ${latestDue}.` : null,
    ].filter(Boolean).join(' '),
    privateSource: true,
    visibility: 'private_summary',
    sourceStatus: 'verified',
    safeToMention: false,
    avoidInDraftReason: 'Treat task titles and operational follow-ups as internal context unless approved.',
  }]
}

function selectPreferredChannel(contact: ContactRow): WarmOutreachChannel | undefined {
  if (contact.email) return 'email'
  if (contact.linkedin_url) return 'linkedin'
  if (contact.facebook_profile_url || contact.lead_source?.startsWith('warm_facebook')) return 'facebook'
  if (contact.phone_number) return 'phone_contact'
  return undefined
}

function buildChannelCapabilities(contact: ContactRow): WarmOutreachRelationshipPacket['channelCapabilities'] {
  const hasFacebook = Boolean(contact.facebook_profile_url || contact.lead_source?.startsWith('warm_facebook'))

  return {
    email: {
      available: Boolean(contact.email),
      providerConfigured: false,
      supportsExternalSend: false,
      supportsDraftCreation: Boolean(contact.email),
      supportsReplyMonitoring: false,
      manualOnly: false,
      provider: 'portfolio_email_center',
      reason: contact.email
        ? 'Email is available for draft-only generation; no external send is enabled by this inventory.'
        : 'No email address is recorded.',
    },
    linkedin: {
      available: Boolean(contact.linkedin_url),
      providerConfigured: false,
      supportsExternalSend: false,
      supportsDraftCreation: Boolean(contact.linkedin_url),
      supportsReplyMonitoring: false,
      manualOnly: true,
      provider: 'manual_linkedin',
      reason: contact.linkedin_url
        ? 'LinkedIn draft guidance is available for manual operator use only.'
        : 'No LinkedIn profile URL is recorded.',
    },
    facebook: {
      available: hasFacebook,
      providerConfigured: false,
      supportsExternalSend: false,
      supportsDraftCreation: false,
      supportsReplyMonitoring: false,
      manualOnly: true,
      provider: 'manual_facebook',
      reason: hasFacebook
        ? 'Facebook is manual-only; no DM draft or provider execution is enabled.'
        : 'No Facebook relationship reference is recorded.',
    },
    phone_contact: {
      available: Boolean(contact.phone_number),
      providerConfigured: false,
      supportsExternalSend: false,
      supportsDraftCreation: false,
      supportsReplyMonitoring: false,
      manualOnly: true,
      provider: 'manual_phone_contact',
      reason: contact.phone_number
        ? 'Phone contact remains manual-only; no call, SMS, or provider execution is enabled.'
        : 'No phone contact detail is recorded.',
    },
  }
}

function relationshipBasis(contact: ContactRow, refs: SourceRef[]) {
  if (contact.do_not_contact) return 'Portfolio contact is marked do not contact.'
  if (contact.removed_at) return 'Portfolio contact has been removed from active outreach.'
  if (contact.warm_source_detail || contact.relationship_strength) {
    return `Existing Portfolio relationship from ${sourceLabel(contact.lead_source)}.`
  }
  if (refs.some((ref) => ref.sourceType === 'meeting_record')) {
    return 'Portfolio meeting history is available for relationship-aware follow-up.'
  }
  if (refs.some((ref) => ref.sourceType === 'contact_communication')) {
    return 'Portfolio communication history is available for relationship-aware follow-up.'
  }
  return 'Portfolio contact record exists, but relationship context needs operator review.'
}

function openingPitchGuidance(refs: SourceRef[]) {
  if (refs.some((ref) => ref.sourceType === 'meeting_record')) {
    return 'Open by referencing the prior meeting at a high level, then connect the follow-up to the contact objective.'
  }
  if (refs.some((ref) => ref.sourceType === 'contact_communication' || ref.sourceType === 'email_message')) {
    return 'Open by acknowledging prior communication without quoting it, then bridge to the current AmaduTown reason for outreach.'
  }
  if (refs.some((ref) => ref.sourceType === 'linkedin')) {
    return 'Open with a concise LinkedIn-context note and keep the ask lightweight for manual review.'
  }
  return 'Open with a simple relationship-first reconnect note and keep the first ask low-pressure.'
}

function suggestedNextStep(refs: SourceRef[]) {
  if (refs.some((ref) => ref.sourceType === 'meeting_action_task')) {
    return 'Review linked action-task context in Agent Ops before generating any outreach draft.'
  }
  if (refs.some((ref) => ref.sourceType === 'email_message' || ref.sourceType === 'outreach_queue')) {
    return 'Review Email Center and Outreach history before approving a draft.'
  }
  return 'Review the Lead Pipeline relationship packet before any draft generation.'
}

function buildAvoidContext(refs: SourceRef[], contact: ContactRow) {
  return [
    contact.phone_number ? 'Do not include phone number or phone-contact details in draft copy.' : null,
    contact.message || contact.quick_wins || contact.rep_pain_points
      ? 'Do not quote private lead notes, quick wins, or internal pain-point language.'
      : null,
    refs.some((ref) => ref.sourceType === 'email_message' || ref.sourceType === 'contact_communication')
      ? 'Do not quote private email, DM, or communication content.'
      : null,
    refs.some((ref) => ref.sourceType === 'meeting_record')
      ? 'Do not quote transcripts or raw meeting notes.'
      : null,
    refs.some((ref) => ref.sourceType === 'facebook')
      ? 'Do not imply Facebook DM automation or provider access.'
      : null,
  ].filter(Boolean) as string[]
}

function buildResponseMonitoringPlan(contact: ContactRow): WarmOutreachRelationshipPacket['responseMonitoringPlan'] {
  const channels = [
    contact.email ? 'email' : null,
    contact.linkedin_url ? 'linkedin' : null,
  ].filter(Boolean) as WarmOutreachChannel[]

  return {
    enabled: false,
    status: 'provider_gate_required',
    summary: 'Response monitoring is not enabled by this read-only inventory. A later phase must add a separate human-approved provider/thread tracking gate before any reply monitoring or response drafting runs.',
    channels,
    humanApprovalRequired: true,
  }
}

async function safeList<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  dataGaps: string[],
) {
  const { data, error } = await query
  if (error) {
    dataGaps.push(`${label}: ${error.message ?? 'read failed'}`)
    return []
  }
  return data ?? []
}

export async function buildWarmOutreachSourceInventory(args: {
  contactId: number
  db?: DbLike | null
}): Promise<WarmOutreachSourceInventoryResult> {
  const db = args.db ?? supabaseAdmin
  const queriedTables = [...LOCAL_TABLES]

  if (!db) {
    return {
      status: 'blocked',
      error: 'Supabase admin client is unavailable.',
      dataGaps: ['supabase_admin_unavailable'],
      providerCallsAttempted: false,
      externalExecutionEnabled: false,
      queriedTables,
    }
  }

  const { data: contact, error: contactError } = await db
    .from('contact_submissions')
    .select(CONTACT_SELECT)
    .eq('id', args.contactId)
    .maybeSingle()

  if (contactError || !contact) {
    return {
      status: 'blocked',
      error: contactError?.message ?? 'Portfolio contact not found.',
      dataGaps: ['contact_submissions'],
      providerCallsAttempted: false,
      externalExecutionEnabled: false,
      queriedTables,
    }
  }

  const dataGaps: string[] = []
  const [communications, outreachRows, emailMessages, meetings, tasks] = await Promise.all([
    safeList<ContactCommunicationRow>(
      'contact_communications',
      db.from('contact_communications')
        .select('id, channel, direction, message_type, subject, source_system, source_id, status, sent_at, created_at')
        .eq('contact_submission_id', args.contactId)
        .order('created_at', { ascending: false })
        .limit(20),
      dataGaps,
    ),
    safeList<OutreachQueueRow>(
      'outreach_queue',
      db.from('outreach_queue')
        .select('id, channel, subject, sequence_step, status, reply_content, sent_at, replied_at, created_at')
        .eq('contact_submission_id', args.contactId)
        .order('created_at', { ascending: false })
        .limit(20),
      dataGaps,
    ),
    safeList<EmailMessageRow>(
      'email_messages',
      db.from('email_messages')
        .select('id, channel, direction, status, transport, source_system, source_id, external_id, subject, sent_at, created_at')
        .eq('contact_submission_id', args.contactId)
        .order('created_at', { ascending: false })
        .limit(20),
      dataGaps,
    ),
    safeList<MeetingRecordRow>(
      'meeting_records',
      db.from('meeting_records')
        .select('id, meeting_type, meeting_date, structured_notes, raw_notes, transcript')
        .eq('contact_submission_id', args.contactId)
        .order('meeting_date', { ascending: false })
        .limit(10),
      dataGaps,
    ),
    safeList<MeetingActionTaskRow>(
      'meeting_action_tasks',
      db.from('meeting_action_tasks')
        .select('id, title, status, due_date, task_category, created_at')
        .eq('contact_submission_id', args.contactId)
        .in('status', ['pending', 'in_progress', 'blocked'])
        .order('created_at', { ascending: false })
        .limit(20),
      dataGaps,
    ),
  ])

  const typedContact = contact as ContactRow
  const sourceRefs = [
    ...buildContactRefs(typedContact),
    ...buildCommunicationRefs(communications),
    ...buildOutreachRefs(outreachRows),
    ...buildEmailRefs(emailMessages),
    ...buildMeetingRefs(meetings),
    ...buildMeetingTaskRefs(tasks),
  ]

  const relationshipSignals = [
    typedContact.lead_source?.startsWith('warm_') ? 'warm lead source' : 'existing Portfolio contact',
    typedContact.relationship_strength ? `relationship strength: ${typedContact.relationship_strength}` : null,
    communications.length ? `${communications.length} communication record(s)` : null,
    outreachRows.length ? `${outreachRows.length} outreach queue row(s)` : null,
    emailMessages.length ? `${emailMessages.length} Email Center row(s)` : null,
    meetings.length ? `${meetings.length} meeting record(s)` : null,
    tasks.length ? `${tasks.length} open meeting task(s)` : null,
  ].filter(Boolean) as string[]

  const commonalities = [
    typedContact.company ? `company: ${typedContact.company}` : null,
    typedContact.industry ? `industry: ${typedContact.industry}` : null,
    typedContact.company_domain ? `domain: ${typedContact.company_domain}` : null,
  ].filter(Boolean) as string[]

  const riskFlags = [
    typedContact.do_not_contact ? 'Contact is marked do not contact.' : null,
    typedContact.removed_at ? 'Contact has been removed from active outreach.' : null,
    dataGaps.length ? 'Some local Portfolio source tables could not be read.' : null,
    sourceRefs.some((ref) => ref.privateSource) ? 'Private source context present.' : null,
  ].filter(Boolean) as string[]

  const packet: WarmOutreachRelationshipPacket = {
    version: 'warm-outreach-relationship/v1',
    contactId: typedContact.id,
    contactName: typedContact.name ?? undefined,
    objective: 'Prepare a warm outreach relationship inventory for draft-only human review.',
    relationshipBasis: relationshipBasis(typedContact, sourceRefs),
    sourceRefs,
    relationshipSignals,
    commonalities,
    riskFlags,
    confidence: typedContact.do_not_contact || typedContact.removed_at
      ? 'low'
      : sourceRefs.some((ref) => ref.sourceType === 'meeting_record' || ref.sourceType === 'contact_communication')
        ? 'high'
        : typedContact.lead_source?.startsWith('warm_')
          ? 'medium'
          : 'low',
    suppression: {
      doNotContact: Boolean(typedContact.do_not_contact),
      unsubscribed: typedContact.outreach_status === 'opted_out',
      removedAt: typedContact.removed_at ?? null,
      suppressionReason: typedContact.do_not_contact
        ? 'Contact is marked do not contact in Portfolio.'
        : typedContact.outreach_status === 'opted_out'
          ? 'Contact outreach status is opted out.'
          : undefined,
    },
    channelCapabilities: buildChannelCapabilities(typedContact),
    preferredChannel: selectPreferredChannel(typedContact),
    relationshipEventId: meetings[0]?.id ?? outreachRows[0]?.id ?? communications[0]?.id,
    openingPitchGuidance: openingPitchGuidance(sourceRefs),
    suggestedNextStep: suggestedNextStep(sourceRefs),
    avoidContext: buildAvoidContext(sourceRefs, typedContact),
    responseMonitoringPlan: buildResponseMonitoringPlan(typedContact),
  }

  const readiness = evaluateWarmOutreachReadiness(packet)
  return {
    status: readiness.status === 'blocked' ? 'blocked' : 'ready',
    packet,
    readiness,
    contextSummary: buildWarmOutreachContextSummary(packet),
    dataGaps,
    providerCallsAttempted: false,
    externalExecutionEnabled: false,
    queriedTables,
  }
}
