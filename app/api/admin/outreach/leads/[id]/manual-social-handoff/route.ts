import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAdmin } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildWarmOutreachSourceInventoryPacket,
  type WarmOutreachSourceInventoryRows,
} from '@/lib/warm-outreach-source-inventory'
import {
  evaluateWarmOutreachReadiness,
  type WarmOutreachChannel,
} from '@/lib/warm-outreach-relationship-intelligence'
import {
  buildWarmManualSocialHandoff,
  findManualSocialEvidence,
  warmManualSocialHandoffChannels,
  type WarmManualSocialHandoffChannel,
} from '@/lib/warm-outreach-manual-social-handoff'

export const dynamic = 'force-dynamic'

const channelSet = new Set<string>(warmManualSocialHandoffChannels)

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

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function parseChannel(value: unknown): WarmManualSocialHandoffChannel | null {
  const channel = stringValue(value)
  return channel && channelSet.has(channel)
    ? channel as WarmManualSocialHandoffChannel
    : null
}

function parsePreferredChannel(value: WarmManualSocialHandoffChannel): WarmOutreachChannel {
  if (value === 'phone_contact') return 'phone_contact'
  return value
}

function storageChannel(channel: WarmManualSocialHandoffChannel) {
  if (channel === 'facebook') return 'chat'
  if (channel === 'phone_contact') return 'voice'
  return 'linkedin'
}

function sanitizeOperatorNote(value: unknown): string {
  const trimmed = stringValue(value)?.slice(0, 500) ?? ''
  return trimmed
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, '[redacted-phone]')
    .replace(/\b\d{3}[-.\s]?\d{4}\b/g, '[redacted-phone]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
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

async function loadManualHandoff(contactId: number, preferredChannel: WarmManualSocialHandoffChannel) {
  if (!supabaseAdmin) throw new Error('Database not available')

  const { data: contact, error: contactError } = await supabaseAdmin
    .from('contact_submissions')
    .select(
      'id, name, email, company, industry, lead_source, outreach_status, do_not_contact, removed_at, phone_number, linkedin_url, facebook_profile_url, relationship_strength, warm_source_detail, created_at',
    )
    .eq('id', contactId)
    .single()

  if (contactError || !contact) return null

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
    objective: 'Record manual LinkedIn, Facebook, or phone-contact handoff evidence from Portfolio.',
    preferredChannel: parsePreferredChannel(preferredChannel),
    rows,
  })
  const readiness = evaluateWarmOutreachReadiness(packet)

  return {
    contact,
    contactCommunications,
    handoff: buildWarmManualSocialHandoff({
      packet,
      readiness,
      evidenceRows: contactCommunications,
    }),
  }
}

export async function POST(
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

    const body = recordValue(await request.json().catch(() => ({})))
    const channel = parseChannel(body.channel)
    const messageVersionKey = stringValue(body.messageVersionKey)
    const manualHandoffKey = stringValue(body.manualHandoffKey)
    const manualEvidenceKey = stringValue(body.manualEvidenceKey)
    const operatorNote = sanitizeOperatorNote(body.operatorNote)

    if (!channel || !messageVersionKey || !manualHandoffKey || !manualEvidenceKey) {
      return NextResponse.json(
        { error: 'channel, messageVersionKey, manualHandoffKey, and manualEvidenceKey are required.' },
        { status: 400 },
      )
    }
    if (!operatorNote) {
      return NextResponse.json({ error: 'A non-sensitive operator note is required.' }, { status: 400 })
    }

    const loaded = await loadManualHandoff(contactId, channel)
    if (!loaded) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const selected = loaded.handoff.channels.find((item) => item.channel === channel)
    if (!selected) {
      return NextResponse.json({ error: 'Manual handoff channel is unavailable.' }, { status: 400 })
    }
    const keyMismatch =
      selected.idempotency.messageVersionKey !== messageVersionKey ||
      selected.idempotency.manualHandoffKey !== manualHandoffKey ||
      selected.idempotency.manualEvidenceKey !== manualEvidenceKey
    if (keyMismatch) {
      return NextResponse.json(
        { error: 'Manual handoff evidence keys are stale. Refresh the relationship packet before recording evidence.' },
        { status: 409 },
      )
    }
    if (selected.state !== 'ready_for_manual_copy' && selected.state !== 'manual_sent_recorded') {
      return NextResponse.json(
        { error: selected.blocker ?? 'Manual handoff is blocked for this channel.' },
        { status: 409 },
      )
    }

    const existingEvidence = selected.durableEvidence ??
      findManualSocialEvidence(loaded.contactCommunications, {
        contactId: String(contactId),
        channel,
        messageVersionKey,
        manualHandoffKey,
        manualEvidenceKey,
      })
    if (existingEvidence) {
      return NextResponse.json({
        outcome: 'existing',
        duplicatePrevented: true,
        evidence: existingEvidence,
        manualSocialHandoff: loaded.handoff,
        executionBoundary: {
          providerCallsEnabled: false,
          externalSendEnabled: false,
          linkedinApiCalled: false,
          facebookApiCalled: false,
          phoneAccessCalled: false,
          smsDeliveryEnabled: false,
          gmailDraftCreated: false,
          slackDispatchEnabled: false,
          n8nDispatchEnabled: false,
          externalRequests: [],
        },
      })
    }

    const recordedAt = new Date().toISOString()
    const metadata = {
      version: 'warm-outreach-manual-social-evidence/v1',
      status: 'manual_sent_recorded',
      contact_submission_id: contactId,
      channel,
      manual_channel: channel,
      message_version_key: messageVersionKey,
      manual_handoff_key: manualHandoffKey,
      manual_evidence_key: manualEvidenceKey,
      duplicate_scope: selected.idempotency.duplicateScope,
      operator_note: operatorNote,
      recorded_by: authResult.user.id,
      recorded_at: recordedAt,
      provider_calls_enabled: false,
      external_send_enabled: false,
      linkedin_api_called: false,
      facebook_api_called: false,
      phone_access_called: false,
      sms_delivery_enabled: false,
      gmail_draft_created: false,
      slack_dispatch_enabled: false,
      n8n_dispatch_enabled: false,
      raw_message_body_stored: false,
      raw_contact_details_stored: false,
      screenshot_stored: false,
      provider_identifiers_stored: false,
      external_requests: [],
    }

    const insertRes = await supabaseAdmin
      .from('contact_communications')
      .insert({
        contact_submission_id: contactId,
        channel: storageChannel(channel),
        direction: 'outbound',
        message_type: 'manual',
        subject: `Manual ${selected.label} outreach evidence`,
        body: 'Manual outreach evidence recorded in Portfolio. Raw message body redacted.',
        source_system: 'manual',
        source_id: manualEvidenceKey,
        status: 'sent',
        sent_at: recordedAt,
        sent_by: authResult.user.id,
        metadata,
      })
      .select('id, contact_submission_id, source_system, source_id, status, sent_at, metadata')
      .single()

    if (insertRes.error || !insertRes.data) {
      return NextResponse.json(
        { error: `Could not record manual handoff evidence: ${insertRes.error?.message ?? 'unknown error'}` },
        { status: 503 },
      )
    }

    const evidence = findManualSocialEvidence([insertRes.data], {
      contactId: String(contactId),
      channel,
      messageVersionKey,
      manualHandoffKey,
      manualEvidenceKey,
    })
    const reloaded = await loadManualHandoff(contactId, channel)

    return NextResponse.json({
      outcome: 'recorded',
      duplicatePrevented: false,
      evidence,
      manualSocialHandoff: reloaded?.handoff ?? loaded.handoff,
      executionBoundary: {
        providerCallsEnabled: false,
        externalSendEnabled: false,
        linkedinApiCalled: false,
        facebookApiCalled: false,
        phoneAccessCalled: false,
        smsDeliveryEnabled: false,
        gmailDraftCreated: false,
        slackDispatchEnabled: false,
        n8nDispatchEnabled: false,
        externalRequests: [],
      },
    })
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/leads/[id]/manual-social-handoff:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
