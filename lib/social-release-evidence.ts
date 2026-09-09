import { createHash } from 'node:crypto'
import { confirmedSocialPlatforms, socialReleaseGate } from './social-release-safety'

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

export function hasCurrentSocialReleaseApproval(item: Record<string, unknown>): boolean {
  const gate = socialReleaseGate(item.rag_context)
  return gate.status === 'approved' && gate.approved_fingerprint === socialReleaseFingerprint(item)
}

/** Continuing a release requires the original reviewed content AND every retained receipt. */
export function hasIntactSocialReleaseReceipts(item: Record<string, unknown>, rows: Record<string, unknown>[]): boolean {
  const confirmed = confirmedSocialPlatforms(item.rag_context)
  const published = rows.filter(row => row.status === 'published')
  return Object.keys(confirmed).length > 0
    && socialReleaseGate(item.rag_context).approved_fingerprint === socialReleaseFingerprint(item)
    && published.length === Object.keys(confirmed).length
    && Object.entries(confirmed).every(([platform, id]) => typeof id === 'string' && id.length > 0
      && published.filter(row => row.platform === platform && row.platform_post_id === id).length === 1)
}
