import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  WARM_OUTREACH_RESPONSE_CHANNELS,
  buildWarmOutreachResponseLifecycleDecision,
  communicationChannelForWarmResponse,
  type WarmOutreachResponseChannel,
} from '@/lib/warm-outreach-response-lifecycle'

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
}) {
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
    originalSubject: stringOrNull(body.originalSubject) ?? outreachQueue?.subject ?? null,
  })

  const existingResponse = await findCommunicationBySourceId(
    contactId,
    decision.idempotency.responseKey,
  )
  if (existingResponse) {
    return NextResponse.json({
      outcome: 'existing',
      responseCommunicationId: existingResponse.id,
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
      classification_confidence: decision.confidence,
      human_qa_required: decision.humanQaRequired,
      human_qa_reasons: decision.humanQaReasons,
      provider: stringOrNull(body.provider) ?? 'manual',
      provider_thread_id: stringOrNull(body.providerThreadId) ?? outreachQueue?.thread_id ?? null,
      provider_message_id: stringOrNull(body.providerMessageId),
      suppression_proposal: decision.suppressionProposal,
      follow_up_task_proposal: decision.followUpTaskProposal,
      execution_boundary: decision.executionBoundary,
    },
  })

  let replyDraftCommunication: CommunicationRow | null = null
  const existingReplyDraft = await findCommunicationBySourceId(
    contactId,
    decision.idempotency.replyDraftKey,
  )
  if (!existingReplyDraft) {
    replyDraftCommunication = await insertCommunication({
      contactId,
      channel: commChannel,
      direction: 'outbound',
      messageType: 'follow_up',
      subject: decision.replyDraft.subject,
      body: decision.replyDraft.body,
      sourceId: decision.idempotency.replyDraftKey,
      status: 'draft',
      sentAt: null,
      sentBy: auth.user.id,
      metadata: {
        lifecycle: 'warm_outreach_reply_draft',
        response_communication_id: responseCommunication.id,
        response_source_id: decision.idempotency.responseKey,
        response_class: decision.responseClass,
        original_channel: channel,
        approval_state: decision.replyDraft.approvalState,
        human_qa_required: true,
        human_qa_reasons: decision.humanQaReasons,
        execution_boundary: decision.executionBoundary,
      },
    })
  } else {
    replyDraftCommunication = existingReplyDraft
  }

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
      followUpTask,
      suppressionProposal: decision.suppressionProposal,
      decision,
      executionBoundary: decision.executionBoundary,
    },
    { status: 201 },
  )
}
