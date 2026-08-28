import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  WARM_OUTREACH_RESPONSE_CHANNELS,
  buildWarmOutreachResponseLifecycleDecision,
  communicationChannelForWarmResponse,
  type WarmOutreachResponseChannel,
  type WarmOutreachResponseRelationshipContext,
} from '@/lib/warm-outreach-response-lifecycle'
import {
  buildWarmOutreachContextSummary,
  evaluateWarmOutreachReadiness,
} from '@/lib/warm-outreach-relationship-intelligence'
import {
  buildWarmOutreachSourceInventoryPacket,
  type WarmOutreachSourceInventoryRows,
} from '@/lib/warm-outreach-source-inventory'

export const dynamic = 'force-dynamic'

const CHANNELS = new Set<string>(WARM_OUTREACH_RESPONSE_CHANNELS)
const MAX_RESPONSE_TEXT_CHARS = 12_000

type ContactRow = {
  id: number
  name: string | null
  email: string | null
  do_not_contact?: boolean | null
  removed_at?: string | null
}

type OutreachQueueRow = {
  id: string
  contact_submission_id: number
  channel: string
  subject: string | null
  status: string
  thread_id: string | null
  message_id: string | null
}

type CommunicationRow = {
  id: string
  source_id: string | null
  metadata: Record<string, unknown> | null
  created_at?: string | null
}

type FollowUpTaskResult = {
  outcome: 'created' | 'existing'
  id: string
}

type InventoryRow = NonNullable<WarmOutreachSourceInventoryRows['contactCommunications']>[number]

function parseContactId(value: string) {
  const contactId = Number.parseInt(value, 10)
  return Number.isFinite(contactId) && contactId > 0 ? contactId : null
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function stringOrNull(value: unknown) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

function receivedAtOrNow(value: unknown) {
  const raw = stringOrNull(value)
  if (!raw) return new Date().toISOString()
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function listData<T extends InventoryRow>(result: { data?: T[] | null }): T[] {
  return Array.isArray(result.data) ? result.data : []
}

function hasSuppressedStatus(rows: InventoryRow[]): boolean {
  return rows.some((row) => {
    const status = typeof row.status === 'string' ? row.status.toLowerCase() : ''
    const outreachStatus =
      typeof row.outreach_status === 'string' ? row.outreach_status.toLowerCase() : ''
    const metadata = row.metadata && typeof row.metadata === 'object'
      ? row.metadata as InventoryRow
      : null
    const metadataStatus =
      typeof metadata?.status === 'string' ? metadata.status.toLowerCase() : ''
    const metadataSuppressed =
      metadata?.unsubscribed === true ||
      metadata?.do_not_contact === true ||
      metadata?.suppressed === true

    return (
      metadataSuppressed ||
      status === 'opted_out' ||
      status === 'unsubscribed' ||
      status === 'suppressed' ||
      outreachStatus === 'opted_out' ||
      outreachStatus === 'unsubscribed' ||
      metadataStatus === 'opted_out' ||
      metadataStatus === 'unsubscribed' ||
      metadataStatus === 'suppressed'
    )
  })
}

async function loadWarmRelationshipContext(input: {
  contactId: number
  contact: ContactRow
  preferredChannel: WarmOutreachResponseChannel
}): Promise<WarmOutreachResponseRelationshipContext> {
  const [
    contactCommunicationsRes,
    outreachQueueRes,
    emailMessagesRes,
    meetingSummariesRes,
    actionTasksRes,
  ] = await Promise.all([
    supabaseAdmin!
      .from('contact_communications')
      .select(
        'id, contact_submission_id, channel, direction, message_type, subject, source_system, source_id, status, sent_at, metadata, created_at',
      )
      .eq('contact_submission_id', input.contactId)
      .order('sent_at', { ascending: false })
      .limit(20),
    supabaseAdmin!
      .from('outreach_queue')
      .select(
        'id, contact_submission_id, channel, subject, sequence_step, status, thread_id, sent_at, replied_at, created_at',
      )
      .eq('contact_submission_id', input.contactId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin!
      .from('email_messages')
      .select(
        'id, contact_submission_id, email_kind, channel, direction, status, subject, source_system, source_id, sent_at, metadata, created_at',
      )
      .eq('contact_submission_id', input.contactId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin!
      .from('meeting_records')
      .select(
        'id, contact_submission_id, meeting_type, meeting_date, structured_notes, key_decisions, created_at',
      )
      .eq('contact_submission_id', input.contactId)
      .order('meeting_date', { ascending: false })
      .limit(10),
    supabaseAdmin!
      .from('meeting_action_tasks')
      .select(
        'id, contact_submission_id, meeting_record_id, title, status, due_date, task_category, outreach_queue_id, created_at',
      )
      .eq('contact_submission_id', input.contactId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const contactCommunications = listData(contactCommunicationsRes)
  const outreachQueue = listData(outreachQueueRes)
  const emailMessages = listData(emailMessagesRes)
  const meetingSummaries = listData(meetingSummariesRes)
  const actionTasks = listData(actionTasksRes)
  const unsubscribed = hasSuppressedStatus([
    input.contact as InventoryRow,
    ...contactCommunications,
    ...outreachQueue,
    ...emailMessages,
  ])

  const rows: WarmOutreachSourceInventoryRows = {
    contactSubmission: {
      ...(input.contact as InventoryRow),
      unsubscribed,
      suppression_reason: unsubscribed
        ? 'Contact has an unsubscribed, opted-out, or suppressed local Portfolio status.'
        : undefined,
    },
    contactCommunications,
    outreachQueue,
    emailMessages,
    meetingSummaries,
    actionTasks,
  }

  const packet = buildWarmOutreachSourceInventoryPacket({
    contactId: input.contactId,
    objective: 'Interpret a captured warm outreach response and prepare local review-only next steps.',
    preferredChannel: input.preferredChannel,
    rows,
  })
  const readiness = evaluateWarmOutreachReadiness(packet)
  const contextSummary = buildWarmOutreachContextSummary(packet)

  return {
    relationshipBasis: contextSummary.relationship_basis,
    openingAngle: contextSummary.opening_pitch_guidance?.openingAngle ?? null,
    suggestedNextStep: contextSummary.suggested_next_step,
    safeToMention: contextSummary.source_inventory?.safeToMention ?? [],
    summarizeOnly: contextSummary.source_inventory?.summarizeOnly ?? [],
    doNotMention: contextSummary.source_inventory?.doNotMention ?? [],
    commonalities: contextSummary.commonalities,
    riskFlags: contextSummary.risk_flags,
    warnings: readiness.warnings,
    blockers: readiness.blockers,
    readinessStatus: readiness.status,
  }
}

async function findCommunicationBySourceId(contactId: number, sourceId: string) {
  const { data, error } = await supabaseAdmin!
    .from('contact_communications')
    .select('id, source_id, metadata, created_at')
    .eq('contact_submission_id', contactId)
    .eq('source_system', 'manual')
    .eq('source_id', sourceId)
    .maybeSingle()

  if (error) throw new Error(`Failed to read communication: ${error.message}`)
  return (data as CommunicationRow | null) ?? null
}

async function insertCommunication(input: {
  contactId: number
  channel: ReturnType<typeof communicationChannelForWarmResponse>
  direction: 'inbound' | 'outbound'
  messageType: 'reply' | 'follow_up'
  subject: string | null
  body: string
  sourceId: string
  status: 'replied' | 'draft'
  sentAt: string | null
  sentBy: string | null
  metadata: Record<string, unknown>
}) {
  const { data, error } = await supabaseAdmin!
    .from('contact_communications')
    .insert({
      contact_submission_id: input.contactId,
      channel: input.channel,
      direction: input.direction,
      message_type: input.messageType,
      subject: input.subject,
      body: input.body,
      source_system: 'manual',
      source_id: input.sourceId,
      status: input.status,
      sent_at: input.sentAt,
      sent_by: input.sentBy,
      metadata: input.metadata,
    })
    .select('id, source_id, metadata, created_at')
    .single()

  if (error) throw new Error(`Failed to insert communication: ${error.message}`)
  return data as CommunicationRow
}

async function maybeCreateFollowUpTask(input: {
  contactId: number
  responseCommunicationId: string
  proposal: NonNullable<ReturnType<typeof buildWarmOutreachResponseLifecycleDecision>['followUpTaskProposal']>
}): Promise<FollowUpTaskResult> {
  const { data: existing, error: existingError } = await supabaseAdmin!
    .from('meeting_action_tasks')
    .select('id')
    .eq('external_id', input.proposal.idempotencyKey)
    .maybeSingle()

  if (existingError) throw new Error(`Failed to read follow-up task: ${existingError.message}`)
  if (existing?.id) return { outcome: 'existing' as const, id: String(existing.id) }

  const { data, error } = await supabaseAdmin!
    .from('meeting_action_tasks')
    .insert({
      meeting_record_id: null,
      contact_submission_id: input.contactId,
      title: input.proposal.title,
      description: `${input.proposal.description} Response communication: ${input.responseCommunicationId}.`,
      status: 'pending',
      task_category: input.proposal.taskCategory,
      due_date: input.proposal.dueDate,
      external_id: input.proposal.idempotencyKey,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to create follow-up task: ${error.message}`)
  return { outcome: 'created' as const, id: String(data.id) }
}

async function maybeCreateReplyDraft(input: {
  contactId: number
  channel: ReturnType<typeof communicationChannelForWarmResponse>
  responseCommunicationId: string
  responseSourceId: string
  originalChannel: WarmOutreachResponseChannel
  decision: ReturnType<typeof buildWarmOutreachResponseLifecycleDecision>
  sentBy: string
}) {
  const existingReplyDraft = await findCommunicationBySourceId(
    input.contactId,
    input.decision.idempotency.replyDraftKey,
  )
  if (existingReplyDraft) {
    return { outcome: 'existing' as const, row: existingReplyDraft }
  }

  const row = await insertCommunication({
    contactId: input.contactId,
    channel: input.channel,
    direction: 'outbound',
    messageType: 'follow_up',
    subject: input.decision.replyDraft.subject,
    body: input.decision.replyDraft.body,
    sourceId: input.decision.idempotency.replyDraftKey,
    status: 'draft',
    sentAt: null,
    sentBy: input.sentBy,
    metadata: {
      lifecycle: 'warm_outreach_reply_draft',
      response_communication_id: input.responseCommunicationId,
      response_source_id: input.responseSourceId,
      response_class: input.decision.responseClass,
      response_class_label: input.decision.interpretation.classificationLabel,
      original_channel: input.originalChannel,
      interpretation: input.decision.interpretation,
      recommended_next_action: input.decision.interpretation.recommendedNextAction,
      next_touch_decision_required:
        input.decision.interpretation.recommendedNextAction.requiresNextTouchDecision,
      approval_gate: input.decision.approvalGate,
      approval_state: input.decision.replyDraft.approvalState,
      reviewer_notes: input.decision.replyDraft.reviewerNotes,
      human_qa_required: true,
      human_qa_reasons: input.decision.humanQaReasons,
      execution_boundary: input.decision.executionBoundary,
      source_use_boundary: input.decision.sourceUseBoundary,
    },
  })

  return { outcome: 'created' as const, row }
}

async function markOutreachQueueReplied(input: {
  contactId: number
  outreachQueueId: string
  receivedAt: string
  responseText: string
}) {
  const { data, error } = await supabaseAdmin!
    .from('outreach_queue')
    .update({
      status: 'replied',
      replied_at: input.receivedAt,
      reply_content: input.responseText,
    })
    .eq('id', input.outreachQueueId)
    .eq('contact_submission_id', input.contactId)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false as const, reason: error.message }
  }

  if (!data?.id) {
    return {
      ok: false as const,
      reason: 'Linked outreach queue row could not be marked replied.',
    }
  }

  return { ok: true as const, id: String(data.id) }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return jsonError(auth.error, auth.status)

  const contactId = parseContactId(params.id)
  if (!contactId) return jsonError('Invalid lead ID', 400)
  if (!supabaseAdmin) return jsonError('Database not available', 500)

  const { data, error } = await supabaseAdmin
    .from('contact_communications')
    .select('id, channel, direction, message_type, subject, body, source_id, status, sent_at, metadata, created_at')
    .eq('contact_submission_id', contactId)
    .eq('source_system', 'manual')
    .like('source_id', 'warm-outreach:%')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return jsonError('Failed to load warm outreach responses', 500)

  return NextResponse.json({
    responses: data ?? [],
    executionBoundary: {
      providerIngestionEnabled: false,
      externalMonitoringEnabled: false,
      replySubmissionEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      slackActionEnabled: false,
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return jsonError(auth.error, auth.status)

  const contactId = parseContactId(params.id)
  if (!contactId) return jsonError('Invalid lead ID', 400)
  if (!supabaseAdmin) return jsonError('Database not available', 500)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return jsonError('Invalid JSON body', 400)

  const channel = stringOrNull(body.channel)
  if (!channel || !CHANNELS.has(channel)) {
    return jsonError(`channel must be one of: ${WARM_OUTREACH_RESPONSE_CHANNELS.join(', ')}`, 400)
  }

  const responseText = stringOrNull(body.responseText)
  if (!responseText) return jsonError('responseText is required', 400)
  if (responseText.length > MAX_RESPONSE_TEXT_CHARS) {
    return jsonError(`responseText must be ${MAX_RESPONSE_TEXT_CHARS} characters or fewer`, 400)
  }

  const receivedAt = receivedAtOrNow(body.receivedAt)
  if (!receivedAt) return jsonError('receivedAt must be a valid date when provided', 400)

  const { data: contact, error: contactError } = await supabaseAdmin
    .from('contact_submissions')
    .select('id, name, email, do_not_contact, removed_at')
    .eq('id', contactId)
    .single()

  if (contactError || !contact) return jsonError('Lead not found', 404)

  const outreachQueueId = stringOrNull(body.outreachQueueId)
  let outreachQueue: OutreachQueueRow | null = null
  if (outreachQueueId) {
    const { data: queueRow, error: queueError } = await supabaseAdmin
      .from('outreach_queue')
      .select('id, contact_submission_id, channel, subject, status, thread_id, message_id')
      .eq('id', outreachQueueId)
      .single()

    if (queueError || !queueRow) return jsonError('Linked outreach queue row was not found', 404)
    if (Number(queueRow.contact_submission_id) !== contactId) {
      return jsonError('Linked outreach queue row does not belong to this lead', 400)
    }
    outreachQueue = queueRow as OutreachQueueRow
  }

  const decision = buildWarmOutreachResponseLifecycleDecision({
    contactId,
    contactName: (contact as ContactRow).name,
    channel: channel as WarmOutreachResponseChannel,
    responseText,
    receivedAt,
    outreachQueueId,
    provider: stringOrNull(body.provider),
    providerThreadId: stringOrNull(body.providerThreadId) ?? outreachQueue?.thread_id ?? null,
    providerMessageId: stringOrNull(body.providerMessageId),
    messageKey: stringOrNull(body.messageKey),
    originalSubject: stringOrNull(body.originalSubject) ?? outreachQueue?.subject ?? null,
    relationshipContext: await loadWarmRelationshipContext({
      contactId,
      contact: contact as ContactRow,
      preferredChannel: channel as WarmOutreachResponseChannel,
    }),
  })

  const existingResponse = await findCommunicationBySourceId(
    contactId,
    decision.idempotency.responseKey,
  )
  if (existingResponse) {
    const commChannel = communicationChannelForWarmResponse(channel as WarmOutreachResponseChannel)
    const replyDraft = await maybeCreateReplyDraft({
      contactId,
      channel: commChannel,
      responseCommunicationId: existingResponse.id,
      responseSourceId: decision.idempotency.responseKey,
      originalChannel: channel as WarmOutreachResponseChannel,
      decision,
      sentBy: auth.user.id,
    })
    const followUpTask = decision.followUpTaskProposal
      ? await maybeCreateFollowUpTask({
          contactId,
          responseCommunicationId: existingResponse.id,
          proposal: decision.followUpTaskProposal,
        })
      : null

    return NextResponse.json({
      outcome: 'existing',
      responseCommunicationId: existingResponse.id,
      replyDraftCommunicationId: replyDraft.row.id,
      replyDraftOutcome: replyDraft.outcome,
      followUpTask,
      suppressionProposal: decision.suppressionProposal,
      decision,
      executionBoundary: decision.executionBoundary,
    })
  }

  if (outreachQueueId) {
    const queueUpdate = await markOutreachQueueReplied({
      contactId,
      outreachQueueId,
      receivedAt,
      responseText,
    })

    if (!queueUpdate.ok) {
      return NextResponse.json(
        {
          outcome: 'blocked_linked_queue_update_failed',
          error:
            'Linked outreach queue row could not be marked replied. No response draft or follow-up task was created.',
          detail: queueUpdate.reason,
          decision,
          executionBoundary: decision.executionBoundary,
        },
        { status: 409 },
      )
    }
  }

  const commChannel = communicationChannelForWarmResponse(channel as WarmOutreachResponseChannel)
  const responseCommunication = await insertCommunication({
    contactId,
    channel: commChannel,
    direction: 'inbound',
    messageType: 'reply',
    subject:
      stringOrNull(body.originalSubject) ??
      outreachQueue?.subject ??
      `Warm outreach response: ${decision.responseClass.replace(/_/g, ' ')}`,
    body: responseText,
    sourceId: decision.idempotency.responseKey,
    status: 'replied',
    sentAt: receivedAt,
    sentBy: auth.user.id,
    metadata: {
      lifecycle: 'warm_outreach_response',
      original_channel: channel,
      outreach_queue_id: outreachQueueId,
      response_class: decision.responseClass,
      response_class_label: decision.interpretation.classificationLabel,
      classification_confidence: decision.confidence,
      interpretation: decision.interpretation,
      recommended_next_action: decision.interpretation.recommendedNextAction,
      next_touch_decision_required:
        decision.interpretation.recommendedNextAction.requiresNextTouchDecision,
      approval_gate: decision.approvalGate,
      human_qa_required: decision.humanQaRequired,
      human_qa_reasons: decision.humanQaReasons,
      provider: stringOrNull(body.provider) ?? 'manual',
      provider_thread_id: stringOrNull(body.providerThreadId) ?? outreachQueue?.thread_id ?? null,
      provider_message_id: stringOrNull(body.providerMessageId),
      manual_message_key: stringOrNull(body.messageKey),
      suppression_proposal: decision.suppressionProposal,
      follow_up_task_proposal: decision.followUpTaskProposal,
      local_draft_recommendation: decision.replyDraft,
      execution_boundary: decision.executionBoundary,
      source_use_boundary: decision.sourceUseBoundary,
    },
  })

  let replyDraftCommunication: CommunicationRow | null = null
  const replyDraft = await maybeCreateReplyDraft({
    contactId,
    channel: commChannel,
    responseCommunicationId: responseCommunication.id,
    responseSourceId: decision.idempotency.responseKey,
    originalChannel: channel as WarmOutreachResponseChannel,
    decision,
    sentBy: auth.user.id,
  })
  replyDraftCommunication = replyDraft.row

  let followUpTask: { outcome: 'created' | 'existing'; id: string } | null = null
  if (decision.followUpTaskProposal) {
    followUpTask = await maybeCreateFollowUpTask({
      contactId,
      responseCommunicationId: responseCommunication.id,
      proposal: decision.followUpTaskProposal,
    })
  }

  return NextResponse.json(
    {
      outcome: 'created',
      responseCommunicationId: responseCommunication.id,
      replyDraftCommunicationId: replyDraftCommunication?.id ?? null,
      replyDraftOutcome: replyDraft.outcome,
      followUpTask,
      suppressionProposal: decision.suppressionProposal,
      decision,
      executionBoundary: decision.executionBoundary,
    },
    { status: 201 },
  )
}
