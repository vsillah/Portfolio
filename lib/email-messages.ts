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
  if (s === 'replied') return 'replied'
  if (s === 'bounced') return 'bounced'
  if (s === 'failed') return 'failed'
  if (s === 'draft') return 'draft'
  if (s === 'queued') return 'queued'
  return 'sent'
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
}): Promise<void> {
  if (!supabaseAdmin) return

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
      transport: 'gmail_smtp',
      source_system: input.trace.sourceSystem,
      source_id: input.trace.sourceId ?? null,
      context_json: {},
      metadata: input.trace.metadata ?? {},
      sent_at: input.success ? new Date().toISOString() : null,
    })
    if (error) console.error('[email_messages] transactional insert failed:', error.message)
  } catch (e) {
    console.error('[email_messages] transactional unexpected:', e)
  }
}
