/**
 * Admin Email Center — index rows for outbound/inbound messages.
 * Written alongside contact_communications (timeline) and transactional sends.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { previewFromBody, type EmailTransport } from '@/lib/email-message-utils'

export type { EmailTransport } from '@/lib/email-message-utils'
export { previewFromBody, inferTransportFromCommunication } from '@/lib/email-message-utils'

export interface InsertEmailMessageFromCommunicationInput {
  contactCommunicationId: string
  contactSubmissionId: number
  emailKind: string
  channel: string
  recipientEmail?: string | null
  subject?: string | null
  body: string
  direction: 'outbound' | 'inbound'
  status: string
  transport: EmailTransport
  sourceSystem: string
  sourceId?: string | null
  metadata?: Record<string, unknown>
  sentAt?: string | null
  sentBy?: string | null
}

/**
 * Inserts an email_messages row linked to contact_communications. Fire-and-forget safe.
 */
export async function insertEmailMessageFromCommunication(
  input: InsertEmailMessageFromCommunicationInput
): Promise<{ id: string } | null> {
  if (!supabaseAdmin) {
    console.error('[email_messages] supabaseAdmin not available')
    return null
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('email_messages')
      .insert({
        contact_communication_id: input.contactCommunicationId,
        contact_submission_id: input.contactSubmissionId,
        email_kind: input.emailKind,
        channel: input.channel,
        recipient_email: input.recipientEmail ?? null,
        subject: input.subject ?? null,
        body_preview: previewFromBody(input.body),
        direction: input.direction,
        status: normalizeStatusForEmailMessages(input.status),
        transport: input.transport,
        source_system: input.sourceSystem,
        source_id: input.sourceId ?? null,
        context_json: {},
        metadata: input.metadata ?? {},
        sent_at: input.sentAt ?? null,
        sent_by: input.sentBy ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[email_messages] insert failed:', error.message)
      return null
    }
    return data ? { id: data.id } : null
  } catch (e) {
    console.error('[email_messages] unexpected:', e)
    return null
  }
}

function normalizeStatusForEmailMessages(s: string): string {
  switch (s) {
    case 'replied':
    case 'bounced':
    case 'failed':
    case 'draft':
    case 'queued':
    case 'sending':
    case 'delivered':
    case 'complained':
    case 'opened':
    case 'clicked':
    case 'delivery_delayed':
      return s
    default:
      return 'sent'
  }
}

function mapResendEventTypeToEmailStatus(eventType: string): string | null {
  switch (eventType) {
    case 'email.sent':
      return 'sent'
    case 'email.delivered':
      return 'delivered'
    case 'email.bounced':
      return 'bounced'
    case 'email.failed':
      return 'failed'
    case 'email.complained':
      return 'complained'
    case 'email.delivery_delayed':
      return 'delivery_delayed'
    case 'email.opened':
      return 'opened'
    case 'email.clicked':
      return 'clicked'
    case 'email.suppressed':
      return 'failed'
    default:
      return null
  }
}

/**
 * Applies a verified Resend webhook event to the Email Center row matched by `external_id`.
 */
export async function updateEmailMessageFromResendWebhook(input: {
  externalId: string
  resendEventType: string
  eventCreatedAt?: string
}): Promise<{ updated: boolean; ignored: boolean }> {
  if (!supabaseAdmin) return { updated: false, ignored: true }

  const status = mapResendEventTypeToEmailStatus(input.resendEventType)
  if (status === null) return { updated: false, ignored: true }

  try {
    const { data: row, error: selErr } = await supabaseAdmin
      .from('email_messages')
      .select('id, metadata')
      .eq('external_id', input.externalId)
      .maybeSingle()

    if (selErr) {
      console.error('[email_messages] webhook select failed:', selErr.message)
      return { updated: false, ignored: false }
    }
    if (!row) return { updated: false, ignored: false }

    const prevMeta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}
    const metadata: Record<string, unknown> = {
      ...prevMeta,
      last_resend_event: input.resendEventType,
      last_resend_event_at: input.eventCreatedAt ?? new Date().toISOString(),
    }

    const { error: upErr } = await supabaseAdmin
      .from('email_messages')
      .update({ status, metadata })
      .eq('id', row.id)

    if (upErr) {
      console.error('[email_messages] webhook update failed:', upErr.message)
      return { updated: false, ignored: false }
    }
    return { updated: true, ignored: false }
  } catch (e) {
    console.error('[email_messages] webhook unexpected:', e)
    return { updated: false, ignored: false }
  }
}

export interface SendEmailTrace {
  emailKind: string
  sourceSystem: string
  sourceId?: string | null
  contactSubmissionId?: number | null
  metadata?: Record<string, unknown>
}

export async function recordTransactionalEmailMessage(input: {
  trace: SendEmailTrace
  recipientEmail: string
  subject: string
  bodyPreview: string
  success: boolean
  transport?: EmailTransport
  externalId?: string | null
}): Promise<void> {
  if (!supabaseAdmin) return

  const transport = input.transport ?? 'gmail_smtp'

  try {
    const { error } = await supabaseAdmin.from('email_messages').insert({
      email_kind: input.trace.emailKind,
      channel: 'email',
      contact_submission_id: input.trace.contactSubmissionId ?? null,
      contact_communication_id: null,
      recipient_email: input.recipientEmail,
      subject: input.subject,
      body_preview: input.bodyPreview.slice(0, 500),
      direction: 'outbound',
      status: input.success ? 'sent' : 'failed',
      transport,
      source_system: input.trace.sourceSystem,
      source_id: input.trace.sourceId ?? null,
      context_json: {},
      metadata: input.trace.metadata ?? {},
      external_id: input.externalId ?? null,
      sent_at: input.success ? new Date().toISOString() : null,
    })
    if (error) console.error('[email_messages] transactional insert failed:', error.message)
  } catch (e) {
    console.error('[email_messages] transactional unexpected:', e)
  }
}
