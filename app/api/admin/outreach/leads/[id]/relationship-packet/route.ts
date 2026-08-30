import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildWarmOutreachSourceInventoryPacket,
  type WarmOutreachSourceInventoryRows,
} from '@/lib/warm-outreach-source-inventory'
import {
  buildWarmOutreachContextSummary,
  evaluateWarmOutreachReadiness,
  warmOutreachChannels,
  type WarmOutreachChannel,
} from '@/lib/warm-outreach-relationship-intelligence'
import { buildWarmOutreachResponseMonitoring } from '@/lib/warm-outreach-response-monitoring'
import { buildWarmSmsReadiness } from '@/lib/warm-outreach-sms-readiness'
import type { WarmSmsCandidateQueueRow } from '@/lib/warm-outreach-sms-candidate'

export const dynamic = 'force-dynamic'

const CHANNELS = new Set<string>(warmOutreachChannels)
const DEFAULT_OBJECTIVE =
  'Prepare channel-aware warm outreach draft context from existing Portfolio data.'

type InventoryRow = NonNullable<WarmOutreachSourceInventoryRows['contactCommunications']>[number]

function listData<T extends InventoryRow>(result: { data?: T[] | null }): T[] {
  return Array.isArray(result.data) ? result.data : []
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim()
    return text || null
  }

  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function contactIdValue(value: unknown): WarmSmsCandidateQueueRow['contact_submission_id'] {
  if (typeof value === 'string' || typeof value === 'number') return value
  return null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function recordValue(value: unknown): WarmSmsCandidateQueueRow['generation_inputs'] {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as WarmSmsCandidateQueueRow['generation_inputs']
    : null
}

function smsCandidateQueueRows(rows: InventoryRow[]): WarmSmsCandidateQueueRow[] {
  return rows.flatMap((row) => {
    const id = stringValue(row.id)
    if (!id) return []

    return [{
      id,
      contact_submission_id: contactIdValue(row.contact_submission_id),
      channel: stringValue(row.channel),
      status: stringValue(row.status),
      subject: stringValue(row.subject),
      sequence_step: numberValue(row.sequence_step),
      thread_id: stringValue(row.thread_id),
      message_id: stringValue(row.message_id),
      sent_at: stringValue(row.sent_at),
      replied_at: stringValue(row.replied_at),
      generation_inputs: recordValue(row.generation_inputs),
      created_at: stringValue(row.created_at),
    }]
  })
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

function parsePreferredChannel(value: string | null): WarmOutreachChannel | undefined {
  if (value && CHANNELS.has(value)) return value as WarmOutreachChannel
  return undefined
}

/**
 * GET /api/admin/outreach/leads/[id]/relationship-packet
 *
 * Builds a warm outreach relationship packet from existing local Portfolio rows.
 * This endpoint is read-only: it does not create drafts, call providers, dispatch
 * n8n, notify Slack, or activate response monitoring.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      )
    }

    const { id: idParam } = await params
    const contactId = parseInt(idParam, 10)
    if (Number.isNaN(contactId) || contactId < 1) {
      return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const objective = searchParams.get('objective')?.trim() || DEFAULT_OBJECTIVE
    const preferredChannel = parsePreferredChannel(searchParams.get('preferred_channel'))

    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contact_submissions')
      .select(
        'id, name, email, company, industry, lead_source, outreach_status, do_not_contact, removed_at, phone_number, linkedin_url, facebook_profile_url, relationship_strength, warm_source_detail, created_at',
      )
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const [
      contactCommunicationsRes,
      outreachQueueRes,
      emailMessagesRes,
      meetingSummariesRes,
      actionTasksRes,
    ] = await Promise.all([
      supabaseAdmin
        .from('contact_communications')
        .select(
          'id, contact_submission_id, channel, direction, message_type, subject, source_system, source_id, status, sent_at, metadata, created_at',
        )
        .eq('contact_submission_id', contactId)
        .order('sent_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('outreach_queue')
        .select(
          'id, contact_submission_id, channel, subject, sequence_step, status, thread_id, message_id, sent_at, replied_at, generation_inputs, created_at',
        )
        .eq('contact_submission_id', contactId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('email_messages')
        .select(
          'id, contact_submission_id, email_kind, channel, direction, status, subject, source_system, source_id, sent_at, metadata, created_at',
        )
        .eq('contact_submission_id', contactId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('meeting_records')
        .select(
          'id, contact_submission_id, meeting_type, meeting_date, structured_notes, key_decisions, created_at',
        )
        .eq('contact_submission_id', contactId)
        .order('meeting_date', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('meeting_action_tasks')
        .select(
          'id, contact_submission_id, meeting_record_id, title, status, due_date, task_category, outreach_queue_id, created_at',
        )
        .eq('contact_submission_id', contactId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const contactCommunications = listData(contactCommunicationsRes)
    const outreachQueue = listData(outreachQueueRes)
    const emailMessages = listData(emailMessagesRes)
    const meetingSummaries = listData(meetingSummariesRes)
    const actionTasks = listData(actionTasksRes)
    const unsubscribed = hasSuppressedStatus([
      contact as InventoryRow,
      ...contactCommunications,
      ...outreachQueue,
      ...emailMessages,
    ])

    const rows: WarmOutreachSourceInventoryRows = {
      contactSubmission: {
        ...(contact as InventoryRow),
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
      contactId,
      objective,
      preferredChannel,
      rows,
    })
    const readiness = evaluateWarmOutreachReadiness(packet)
    const contextSummary = buildWarmOutreachContextSummary(packet)
    const responseMonitoring = buildWarmOutreachResponseMonitoring({
      contactId,
      packet,
      readiness,
      rows: {
        contactCommunications,
        outreachQueue,
        emailMessages,
        actionTasks,
      },
    })
    const smsReadiness = buildWarmSmsReadiness({
      packet,
      readiness,
      queueRows: smsCandidateQueueRows(outreachQueue),
    })

    return NextResponse.json({
      packet,
      readiness,
      contextSummary,
      responseMonitoring,
      smsReadiness,
      sendReadiness: responseMonitoring.sendReadiness,
      executionBoundary: {
        source: 'local_portfolio_rows',
        readOnly: true,
        providerCalls: false,
        createsDraft: false,
        externalSend: false,
        n8nDispatch: false,
        slackAction: false,
        responseMonitoring: false,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/admin/outreach/leads/[id]/relationship-packet:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
