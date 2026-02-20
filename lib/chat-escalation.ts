/**
 * Chat escalation: persist escalation events and notify Slack.
 * Source of truth is chat_escalations table; Slack is fire-and-forget.
 */

import { supabaseAdmin } from '@/lib/supabase'

const TRANSCRIPT_MAX_CHARS = 8000

/** Minimal message shape for transcript formatting (role + content only). */
export type TranscriptMessage = { role: string; content: string }

export type EscalationSource = 'text' | 'voice'
export type EscalationReason = 'user_requested_human' | 'fallback' | 'transfer_to_human' | string

export interface CreateChatEscalationParams {
  sessionId: string
  source: EscalationSource
  reason?: EscalationReason
  visitorName?: string | null
  visitorEmail?: string | null
  /** Formatted transcript (will be truncated if over limit) */
  transcript: string
}

/**
 * Format conversation history into a single transcript string.
 * Truncates to TRANSCRIPT_MAX_CHARS (keeps tail).
 */
export function formatTranscriptFromHistory(history: TranscriptMessage[]): string {
  const lines = history.map((m) => {
    const label = m.role === 'user' ? 'User' : m.role === 'support' ? 'Support' : 'Assistant'
    return `${label}: ${m.content}`
  })
  const full = lines.join('\n\n')
  if (full.length <= TRANSCRIPT_MAX_CHARS) return full
  return '...[truncated]\n\n' + full.slice(-(TRANSCRIPT_MAX_CHARS - 100))
}

/**
 * Truncate a transcript string to the max length we store/send.
 */
export function truncateTranscript(transcript: string): string {
  if (transcript.length <= TRANSCRIPT_MAX_CHARS) return transcript
  return '...[truncated]\n\n' + transcript.slice(-(TRANSCRIPT_MAX_CHARS - 100))
}

/**
 * Look up contact_submissions by email; return id if exactly one match (latest), else null.
 */
async function autoLinkContactByEmail(visitorEmail: string | null | undefined): Promise<number | null> {
  if (!visitorEmail || typeof visitorEmail !== 'string' || !visitorEmail.trim()) return null
  const email = visitorEmail.trim().toLowerCase()
  const { data: rows } = await supabaseAdmin
    .from('contact_submissions')
    .select('id')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(2)
  if (!rows || rows.length !== 1) return null
  return rows[0].id as number
}

/**
 * Notify Slack via Incoming Webhook. Fire-and-forget; never throws.
 * Returns true if webhook URL was set and POST succeeded.
 */
export async function notifySlackChatEscalation(params: {
  sessionId: string
  source: EscalationSource
  reason?: EscalationReason
  visitorName?: string | null
  visitorEmail?: string | null
  transcript: string
}): Promise<boolean> {
  const webhookUrl = process.env.SLACK_CHAT_ESCALATION_WEBHOOK_URL
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return false
  }

  const name = params.visitorName?.trim() || 'Not provided'
  const email = params.visitorEmail?.trim() || 'Not provided'
  const reason = params.reason || 'escalation'
  const transcript = truncateTranscript(params.transcript)

  const text = [
    `*Chat escalation* (${params.source})`,
    `*Reason:* ${reason}`,
    `*Contact:* ${name} | ${email}`,
    `*Session:* ${params.sessionId}`,
    '',
    '*Transcript:*',
    '```',
    transcript,
    '```',
  ].join('\n')

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      console.warn('[chat-escalation] Slack webhook failed:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.warn('[chat-escalation] Slack webhook error:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Create a chat_escalations row, auto-link to contact by email if possible,
 * and notify Slack (fire-and-forget). Does not throw; logs errors.
 * Returns the new row id or null on insert failure.
 */
export async function createChatEscalation(params: CreateChatEscalationParams): Promise<number | null> {
  try {
    const contactSubmissionId = await autoLinkContactByEmail(params.visitorEmail)
    const transcript = truncateTranscript(params.transcript)

    const { data: row, error } = await supabaseAdmin
      .from('chat_escalations')
      .insert({
        session_id: params.sessionId,
        source: params.source,
        reason: params.reason ?? null,
        visitor_name: params.visitorName ?? null,
        visitor_email: params.visitorEmail ?? null,
        transcript,
        contact_submission_id: contactSubmissionId ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[chat-escalation] Insert failed:', error.message)
      return null
    }

    const id = row?.id as number | undefined
    if (id == null) return null

    // Notify Slack (fire-and-forget); optionally update slack_sent_at
    notifySlackChatEscalation({
      sessionId: params.sessionId,
      source: params.source,
      reason: params.reason,
      visitorName: params.visitorName,
      visitorEmail: params.visitorEmail,
      transcript: params.transcript,
    }).then((ok) => {
      if (ok && id != null) {
        supabaseAdmin
          .from('chat_escalations')
          .update({ slack_sent_at: new Date().toISOString() })
          .eq('id', id)
          .then(() => {})
          .catch((e: unknown) => console.warn('[chat-escalation] Update slack_sent_at failed:', e))
      }
    })

    return id
  } catch (err) {
    console.error('[chat-escalation] createChatEscalation error:', err instanceof Error ? err.message : err)
    return null
  }
}
