import { socialReleaseFingerprint } from '@/lib/social-release-evidence'
import { socialReleaseGate } from '@/lib/social-release-safety'

type Row = Record<string, unknown>

function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function hasApprovalEvidence(item: Row, gate: Row): boolean {
  const reviews = record(record(item.rag_context).section_gate_reviews)
  return typeof gate.approved_by === 'string' && gate.approved_by.length > 0
    && typeof gate.approved_at === 'string' && Number.isFinite(Date.parse(gate.approved_at))
    && Array.isArray(gate.platforms) && gate.platforms.includes('linkedin')
    && ['visual_assets', 'asset_packet', 'privacy'].every(key => record(reviews[key]).status === 'approved')
}

/** A failed row is reusable only when its exact release and approved content were proven safe. */
export function isRetryableLinkedInFailure(item: Row, rows: Row[]): boolean {
  const gate = socialReleaseGate(item.rag_context)
  const receipt = record(gate.deterministic_failure)
  const linkedin = rows.filter(row => row.platform === 'linkedin')
  const row = linkedin[0]
  return ['approved', 'scheduled'].includes(String(item.status))
    && gate.status === 'approved'
    && hasApprovalEvidence(item, gate)
    && gate.reconciliation_required !== true
    && typeof gate.release_id === 'string' && gate.release_id === receipt.release_id
    && typeof gate.approved_fingerprint === 'string'
    && gate.approved_fingerprint === socialReleaseFingerprint(item)
    && receipt.approved_fingerprint === gate.approved_fingerprint
    && receipt.platform === 'linkedin'
    && receipt.publish_row_id === row?.id
    && typeof receipt.error === 'string' && receipt.error.length > 0
    && linkedin.length === 1 && rows.length === 1
    && row.status === 'failed' && row.error_message === receipt.error
    && !row.platform_post_id && !row.platform_post_url && !row.published_at
    && !item.platform_post_id && !item.published_at
    && !item.video_url
    && Object.keys(record(gate.confirmed_platforms)).length === 0
}

export function hasAmbiguousPublishRowsForRelease(item: Row, rows: Row[]): boolean {
  const safeFailure = isRetryableLinkedInFailure(item, rows)
  return rows.some(row => row.status === 'published'
    ? typeof row.platform_post_id !== 'string' || !row.platform_post_id
    : (row.status !== 'pending' && !(safeFailure && row.platform === 'linkedin' && row.status === 'failed'))
      || Boolean(row.platform_post_id || row.platform_post_url || row.published_at))
}

const PRE_POST_ERRORS = new Set([
  'LinkedIn image upload failed; approved media must not be dropped',
  'LinkedIn image registration failed; approved media must not be dropped',
  'LinkedIn approved media URL is unsafe or unapproved.',
])

/** Historical recovery requires a canonical receipt with an error emitted before post creation. */
export function historicalLinkedInFailureCandidate(item: Row, rows: Row[], workItems: Row[]) {
  const gate = socialReleaseGate(item.rag_context)
  const active = workItems.filter(work => work.source_type === 'social_content_scheduled_publish_recovery'
    && work.source_id === item.id && record(work.metadata).recovery_kind === 'publish_blocked'
    && !['cancelled', 'merged', 'deployed'].includes(String(work.status)))
  const candidates = active.filter(work => {
    const metadata = record(work.metadata)
    const failures = record(metadata.provider_failures)
    const error = failures.linkedin
    return work.source_type === 'social_content_scheduled_publish_recovery'
      && work.source_id === item.id && metadata.recovery_kind === 'publish_blocked'
      && metadata.scheduled_for === item.scheduled_for
      && !['cancelled', 'merged', 'deployed'].includes(String(work.status))
      && typeof error === 'string'
      && (PRE_POST_ERRORS.has(error) || /^LinkedIn multi-image upload failed on slide [1-9][0-9]*$/.test(error))
  })
  const row = rows[0]
  if (item.status !== 'scheduled' || item.video_url || item.platform_post_id || item.published_at
    || rows.length !== 1 || row.platform !== 'linkedin' || !['pending', 'failed'].includes(String(row.status))
    || row.platform_post_id || row.platform_post_url || row.published_at
    || gate.status !== 'uncertain' || gate.reconciliation_required !== true || !hasApprovalEvidence(item, gate)
    || typeof gate.claimed_at !== 'string' || !Number.isFinite(Date.parse(gate.claimed_at))
    || typeof candidates[0]?.updated_at !== 'string'
    || Date.parse(candidates[0].updated_at) < Date.parse(gate.claimed_at)
    || !gate.release_id || !Array.isArray(gate.release_platforms)
    || gate.release_platforms.length !== 1 || gate.release_platforms[0] !== 'linkedin'
    || gate.approved_fingerprint !== socialReleaseFingerprint(item)
    || Object.keys(record(gate.confirmed_platforms)).length !== 0 || active.length !== 1 || candidates.length !== 1
    || typeof row.id !== 'string' || typeof row.updated_at !== 'string'
    || (row.status === 'failed' && row.error_message !== record(record(candidates[0].metadata).provider_failures).linkedin)) return null
  return { work_item_id: candidates[0].id as string, publish_row_id: row.id,
    error: record(record(candidates[0].metadata).provider_failures).linkedin as string,
    release_id: gate.release_id as string, approved_fingerprint: gate.approved_fingerprint as string }
}
