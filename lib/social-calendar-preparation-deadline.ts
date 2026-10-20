import { parseMetadata } from '@/lib/social-content-calendar'

// The editorial scheduler is intended to have a full three-day interval to
// recover a source gap before the calendar event. Six days leaves one interval
// for evidence work and another for the complete review packet.
export const DEFAULT_PREPARATION_LEAD_DAYS = 6
export const MIN_PREPARATION_LEAD_DAYS = 4
export const MAX_PREPARATION_LEAD_DAYS = 30
export const PREPARATION_SCAN_LEAD_DAYS = MAX_PREPARATION_LEAD_DAYS

export function preparationDeadline(input: { scheduled_for: string; metadata?: unknown }): string | null {
  const scheduledAt = Date.parse(input.scheduled_for)
  if (!Number.isFinite(scheduledAt)) return null
  const metadata = parseMetadata(input.metadata)
  const configured = metadata.preparation_lead_days
  const leadDays = Number.isInteger(configured)
    && Number(configured) >= MIN_PREPARATION_LEAD_DAYS
    && Number(configured) <= MAX_PREPARATION_LEAD_DAYS
    ? Number(configured)
    : DEFAULT_PREPARATION_LEAD_DAYS
  const derived = scheduledAt - leadDays * 86400000
  const explicit = [metadata.review_trigger_at, metadata.review_due_at]
    .filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)))
    .map(value => Date.parse(value))
  return new Date(Math.min(derived, ...explicit)).toISOString()
}

export function preparationAttempt(input: {
  previous?: unknown
  evidenceVersion: string
  ready: boolean
}): { shouldCheck: boolean; retryCount: number } {
  const previous = parseMetadata(input.previous)
  if (input.ready) return { shouldCheck: false, retryCount: Number(previous.retry_count) || 0 }
  if (previous.status === 'blocked' && previous.evidence_version === input.evidenceVersion) {
    return { shouldCheck: false, retryCount: Number(previous.retry_count) || 0 }
  }
  return {
    shouldCheck: true,
    retryCount: previous.status === 'blocked' ? (Number(previous.retry_count) || 0) + 1 : 0,
  }
}
