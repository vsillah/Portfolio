/**
 * Pure heuristic helpers for meeting_action_tasks.task_category.
 *
 * Kept in its own file (no DB imports) so backfill/one-off scripts can
 * import it before dotenv has populated process.env — lib/supabase.ts
 * validates Supabase env vars at module-load time and would otherwise
 * throw before the script's dotenv.config() runs.
 */

export type TaskCategory = 'internal' | 'outreach'

/**
 * Heuristic: infer whether an extracted action item should default to
 * 'outreach' (client-facing) or 'internal' (team). Admins can always flip
 * this in the UI, so false positives are acceptable as long as the signal
 * is clear (email/message/follow up/schedule a call with the client).
 */
const OUTREACH_PATTERNS: RegExp[] = [
  /\bemail\b/i,
  /\bsend\b[^.]{0,40}\b(proposal|report|summary|follow[- ]?up|recap|email|message|note|link|invite)\b/i,
  /\bfollow[- ]?up\b/i,
  /\breach\s+out\b/i,
  /\boutreach\b/i,
  /\b(schedule|book)\b[^.]{0,40}\b(call|meeting)\b/i,
  /\bshare\b[^.]{0,40}\b(proposal|report|summary|deck|pricing|quote|update)\b/i,
  /\b(nudge|ping|dm|message)\b.*(them|client|prospect|lead)\b/i,
]

export function inferTaskCategory(title: string, description: string | null): TaskCategory {
  const haystack = `${title} ${description ?? ''}`.trim()
  if (!haystack) return 'internal'
  for (const re of OUTREACH_PATTERNS) {
    if (re.test(haystack)) return 'outreach'
  }
  return 'internal'
}
