import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  logCommunication,
  type CommChannel,
  type CommDirection,
  type CommMessageType,
  type CommSourceSystem,
  type CommStatus,
} from '@/lib/communications'

export const dynamic = 'force-dynamic'

const VALID_CHANNELS: CommChannel[] = ['email', 'linkedin', 'sms', 'chat', 'voice']
const VALID_DIRECTIONS: CommDirection[] = ['outbound', 'inbound']
const VALID_MESSAGE_TYPES: CommMessageType[] = ['cold_outreach', 'asset_delivery', 'proposal', 'follow_up', 'nurture', 'reply', 'manual']
const VALID_SOURCE_SYSTEMS: CommSourceSystem[] = ['outreach_queue', 'delivery_email', 'proposal', 'nurture', 'heygen', 'manual']
const VALID_STATUSES: CommStatus[] = ['draft', 'queued', 'sent', 'failed', 'bounced', 'replied']

/**
 * POST /api/admin/communications/log
 * General-purpose communication logging endpoint.
 * Used by: proposal email logging, future n8n callbacks, manual logging from admin UI.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    contactSubmissionId,
    channel,
    direction,
    messageType,
    subject,
    body: messageBody,
    sourceSystem,
    sourceId,
    promptKey,
    status,
    sentAt,
    metadata,
  } = body as Record<string, unknown>

  if (!contactSubmissionId || !channel || !direction || !messageType || !messageBody || !sourceSystem) {
    return NextResponse.json(
      { error: 'Missing required fields: contactSubmissionId, channel, direction, messageType, body, sourceSystem' },
      { status: 400 }
    )
  }

  if (!VALID_CHANNELS.includes(channel as CommChannel)) {
    return NextResponse.json({ error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(', ')}` }, { status: 400 })
  }
  if (!VALID_DIRECTIONS.includes(direction as CommDirection)) {
    return NextResponse.json({ error: `Invalid direction. Must be one of: ${VALID_DIRECTIONS.join(', ')}` }, { status: 400 })
  }
  if (!VALID_MESSAGE_TYPES.includes(messageType as CommMessageType)) {
    return NextResponse.json({ error: `Invalid messageType. Must be one of: ${VALID_MESSAGE_TYPES.join(', ')}` }, { status: 400 })
  }
  if (!VALID_SOURCE_SYSTEMS.includes(sourceSystem as CommSourceSystem)) {
    return NextResponse.json({ error: `Invalid sourceSystem. Must be one of: ${VALID_SOURCE_SYSTEMS.join(', ')}` }, { status: 400 })
  }
  if (status && !VALID_STATUSES.includes(status as CommStatus)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const result = await logCommunication({
    contactSubmissionId: contactSubmissionId as number,
    channel: channel as CommChannel,
    direction: direction as CommDirection,
    messageType: messageType as CommMessageType,
    subject: (subject as string) ?? null,
    body: messageBody as string,
    sourceSystem: sourceSystem as CommSourceSystem,
    sourceId: (sourceId as string) ?? null,
    promptKey: (promptKey as string) ?? null,
    status: (status as CommStatus) ?? 'sent',
    sentAt: (sentAt as string) ?? null,
    sentBy: auth.user.id,
    metadata: (metadata as Record<string, unknown>) ?? {},
  })

  if (!result) {
    return NextResponse.json({ error: 'Failed to log communication' }, { status: 500 })
  }

  return NextResponse.json({ id: result.id }, { status: 201 })
}
