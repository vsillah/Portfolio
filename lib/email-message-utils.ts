/** Pure helpers for Email Center — no Supabase import (safe for unit tests). */

export type EmailTransport = 'gmail_smtp' | 'n8n' | 'logged_only' | 'unknown' | 'resend'

export function previewFromBody(body: string, maxLen = 500): string {
  const stripped = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (stripped.length <= maxLen) return stripped
  return `${stripped.slice(0, maxLen)}…`
}

export function inferTransportFromCommunication(input: {
  sourceSystem: string
  messageType?: string
  status?: string
  emailTransport?: EmailTransport
}): EmailTransport {
  if (input.emailTransport) return input.emailTransport
  if (input.sourceSystem === 'delivery_email') return 'gmail_smtp'
  if (input.sourceSystem === 'outreach_queue') {
    if (input.messageType === 'manual') return 'unknown'
    return 'n8n'
  }
  if (input.sourceSystem === 'proposal' || input.sourceSystem === 'manual') return 'logged_only'
  return 'unknown'
}
