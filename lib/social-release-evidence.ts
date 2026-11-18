import { createHash } from 'node:crypto'
import { confirmedSocialPlatforms, socialReleaseGate } from './social-release-safety'
import { isAcceleratedVisualId } from './accelerated-visual-ids'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
  return value
}

/** Timestamp triggers can replace the requested updated_at. Bind approval to actual content instead. */
export function socialReleaseFingerprint(item: Record<string, unknown>): string {
  const { updated_at: _updated, rag_context: context, ...row } = item
  const { platform_submission_gate: _gate, ...rag } = context && typeof context === 'object' ? context as Record<string, unknown> : {}
  return createHash('sha256').update(JSON.stringify(canonical({ ...row, rag_context: rag }))).digest('hex')
}

/** The three approved raster releases may be stored with either UTC timestamp spelling. */
export function hasMatchingSocialReleaseFingerprint(item: Record<string, unknown>): boolean {
  const approved = socialReleaseGate(item.rag_context).approved_fingerprint
  if (typeof approved !== 'string') return false
  if (approved === socialReleaseFingerprint(item)) return true
  if (!isAcceleratedVisualId(String(item.id ?? '')) || typeof item.scheduled_for !== 'string') return false
  const timestamp = Date.parse(item.scheduled_for)
  if (!Number.isFinite(timestamp)) return false
  const iso = new Date(timestamp).toISOString()
  const utcOffset = iso.replace(/\.000Z$/, '+00:00')
  return [iso, utcOffset].some(scheduled_for => approved === socialReleaseFingerprint({ ...item, scheduled_for }))
}

export function hasCurrentSocialReleaseApproval(item: Record<string, unknown>): boolean {
  const gate = socialReleaseGate(item.rag_context)
  return gate.status === 'approved' && hasMatchingSocialReleaseFingerprint(item)
}

/** Continuing a release requires the original reviewed content AND every retained receipt. */
export function hasIntactSocialReleaseReceipts(item: Record<string, unknown>, rows: Record<string, unknown>[]): boolean {
  const confirmed = confirmedSocialPlatforms(item.rag_context)
  const published = rows.filter(row => row.status === 'published')
  return Object.keys(confirmed).length > 0
    && hasMatchingSocialReleaseFingerprint(item)
    && published.length === Object.keys(confirmed).length
    && Object.entries(confirmed).every(([platform, id]) => typeof id === 'string' && id.length > 0
      && published.filter(row => row.platform === platform && row.platform_post_id === id).length === 1)
}
