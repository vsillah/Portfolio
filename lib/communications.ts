/**
 * Unified contact communications logger.
 * Every outbound/inbound message across all systems logs here.
 * This is a write-behind layer — domain tables (outreach_queue, contact_deliveries)
 * retain their own lifecycle; this table provides the unified timeline.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { inferTransportFromCommunication, type EmailTransport } from '@/lib/email-message-utils'
import { insertEmailMessageFromCommunication } from '@/lib/email-messages'

export type CommChannel = 'email' | 'linkedin' | 'sms' | 'chat' | 'voice'
export type CommDirection = 'outbound' | 'inbound'
export type CommMessageType = 'cold_outreach' | 'asset_delivery' | 'proposal' | 'follow_up' | 'nurture' | 'reply' | 'manual'
export type CommSourceSystem = 'outreach_queue' | 'delivery_email' | 'proposal' | 'nurture' | 'heygen' | 'manual'
export type CommStatus = 'draft' | 'queued' | 'sent' | 'failed' | 'bounced' | 'replied'

export interface LogCommunicationInput {
  contactSubmissionId: number | string
  channel: CommChannel
  direction: CommDirection
  messageType: CommMessageType
  subject?: string | null
  body: string
  sourceSystem: CommSourceSystem
  sourceId?: string | null
  promptKey?: string | null
  status?: CommStatus
  sentAt?: string | null
  sentBy?: string | null
  metadata?: Record<string, unknown>
  /** Optional — improves Email Center recipient column */
  recipientEmail?: string | null
  /** Override inferred transport (gmail_smtp / n8n / logged_only) */
  emailTransport?: EmailTransport
}

/**
 * Log a communication to the unified contact_communications table.
 * Fire-and-forget safe: catches and logs errors, never throws.
 */
export async function logCommunication(
  input: LogCommunicationInput
): Promise<{ id: string } | null> {
  if (!supabaseAdmin) {
    console.error('[Communications] supabaseAdmin not available')
    return null
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('contact_communications')
      .insert({
        contact_submission_id: Number(input.contactSubmissionId),
        channel: input.channel,
        direction: input.direction,
        message_type: input.messageType,
        subject: input.subject ?? null,
        body: input.body,
        source_system: input.sourceSystem,
        source_id: input.sourceId ?? null,
        prompt_key: input.promptKey ?? null,
        status: input.status ?? 'sent',
        sent_at: input.sentAt ?? new Date().toISOString(),
        sent_by: input.sentBy ?? null,
        metadata: input.metadata ?? {},
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Communications] Failed to log:', error.message)
      return null
    }

    const commId = data?.id
    if (commId) {
      const meta = input.metadata ?? {}
      const recipientFromMeta =
        typeof meta.recipient_email === 'string' ? meta.recipient_email : undefined
      const recipient =
        input.recipientEmail ?? recipientFromMeta ?? null
      const transport = inferTransportFromCommunication({
        sourceSystem: input.sourceSystem,
        messageType: input.messageType,
        status: input.status ?? 'sent',
        emailTransport: input.emailTransport,
      })
      void insertEmailMessageFromCommunication({
        contactCommunicationId: commId,
        contactSubmissionId: Number(input.contactSubmissionId),
        emailKind: input.messageType,
        channel: input.channel,
        recipientEmail: recipient,
        subject: input.subject ?? null,
        body: input.body,
        direction: input.direction,
        status: input.status ?? 'sent',
        transport,
        sourceSystem: input.sourceSystem,
        sourceId: input.sourceId ?? null,
        metadata: input.metadata ?? {},
        sentAt: input.sentAt ?? null,
        sentBy: input.sentBy ?? null,
      })
    }

    return data ? { id: data.id } : null
  } catch (err) {
    console.error('[Communications] Unexpected error:', err)
    return null
  }
}
