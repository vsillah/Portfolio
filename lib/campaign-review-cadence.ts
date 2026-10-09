import { parseMetadata } from '@/lib/social-content-calendar'

export const REVIEW_SIDE_EFFECTS = Object.freeze({ approve: false, publish: false, upload: false, provider_calls: false, provider_generation: false, schedule: false, external_schedule: false, external_post: false, slack_send: false, sms: false, gmail: false })
export const DEFAULT_REVIEW_CADENCE = { horizon_days: 14, target_ready: 10, timezone: 'America/New_York', review_time: '08:00', primary_limit: 5, revision_limit: 3, refresh_time: '17:00' }
export type ReviewCadence = typeof DEFAULT_REVIEW_CADENCE
export type ReviewWindow = { at: string; key: string; kind: 'primary' | 'revision' | 'refresh'; limit: number }

export function reviewCadence(value: unknown): ReviewCadence {
  const v = parseMetadata(value), c = { ...DEFAULT_REVIEW_CADENCE, ...v }
  for (const [key, max] of [['horizon_days', 60], ['target_ready', 50], ['primary_limit', 10], ['revision_limit', 10]] as const) {
    if (!Number.isInteger(c[key]) || c[key] < 1 || c[key] > max) throw new Error(`Invalid ${key}: use 1–${max}.`)
  }
  for (const key of ['review_time', 'refresh_time'] as const) if (typeof c[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c[key])) throw new Error(`Invalid ${key}.`)
  try { new Intl.DateTimeFormat('en', { timeZone: c.timezone }).format() } catch { throw new Error('Invalid review timezone.') }
  return { horizon_days: c.horizon_days, target_ready: c.target_ready, timezone: c.timezone, review_time: c.review_time, primary_limit: c.primary_limit, revision_limit: c.revision_limit, refresh_time: c.refresh_time }
}

function parts(date: Date, timezone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]))
}
// Convert each local date independently so a horizon crossing DST never drifts an hour.
function localInstant(day: string, time: string, timezone: string) {
  const target = Date.parse(`${day}T${time}:00Z`)
  let utc = target
  for (let i = 0; i < 4; i++) {
    const p = parts(new Date(utc), timezone)
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`)
    const correction = target - represented
    if (!correction) return new Date(utc).toISOString()
    utc += correction
  }
  // Nonexistent local times during spring-forward are skipped, not silently shifted.
  return null
}
export function reviewWindows(now: Date, config: ReviewCadence): ReviewWindow[] {
  const p = parts(now, config.timezone), today = `${p.year}-${p.month}-${p.day}`
  const result: ReviewWindow[] = []
  for (let i = 0; i <= config.horizon_days + 7; i++) {
    const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + i)
    const day = date.toISOString().slice(0, 10), weekday = date.getUTCDay()
    if (weekday === 6) continue
    const kind = weekday === 0 ? 'refresh' : [1, 3, 5].includes(weekday) ? 'primary' : 'revision'
    const at = localInstant(day, kind === 'refresh' ? config.refresh_time : config.review_time, config.timezone)
    if (at) result.push({ at, key: `${day}:${kind}`, kind, limit: kind === 'refresh' ? config.target_ready : kind === 'primary' ? config.primary_limit : config.revision_limit })
  }
  return result
}
export function nextReviewWindow(now: Date, config: ReviewCadence) {
  return reviewWindows(now, config).find(w => w.kind !== 'refresh' && Date.parse(w.at) >= now.getTime())!
}
export type ReviewPriority = 'urgent' | 'high' | 'medium' | 'low'
export type ReviewRow = { id: string; title: string; channel: string; phase: string; scheduled_for: string; trigger_at: string; priority: ReviewPriority; state: 'ready' | 'eligible' | 'blocked' | 'reviewed'; reason: string; href: string; work_item_id: string | null; social_content_id: string | null; evidence_ids: string[]; lineage: string; prepared_window: string | null; content_version: string | null }
export type ReviewProjection = { campaign: { id: string; name: string; status: string }; config: ReviewCadence; anchor_id: string | null; rows: ReviewRow[]; ready: number; blocked: number; eligible: number; gap: number; coverage_days: number; batch_remaining: number; horizon_end: string; next_batch: ReviewWindow; next_refresh: ReviewWindow; side_effects: typeof REVIEW_SIDE_EFFECTS }
