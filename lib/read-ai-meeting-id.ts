/**
 * Extract Read.ai analytics meeting id from pasted text / Slack recap (stable dedupe key).
 * Example URL segment: app.read.ai/analytics/meetings/01KNHYS5S4P7J9ZE8XF6ZGQEB1
 */
const READ_AI_ANALYTICS_RE = /read\.ai\/analytics\/meetings\/([A-Za-z0-9]+)/i

export function extractReadAiMeetingId(text: string | null | undefined): string | null {
  if (text == null || typeof text !== 'string') return null
  const m = text.match(READ_AI_ANALYTICS_RE)
  const id = m?.[1]?.trim()
  return id || null
}
