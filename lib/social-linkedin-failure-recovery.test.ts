import { describe, expect, it } from 'vitest'
import { releaseFixture } from './social-release-safety.test-fixtures'
import { socialReleaseFingerprint } from './social-release-evidence'
import { hasAmbiguousPublishRowsForRelease, historicalLinkedInFailureCandidate, isRetryableLinkedInFailure } from './social-linkedin-failure-recovery'
import { socialReleaseReview } from './social-release-review-ui'

function failedRelease() {
  const item = releaseFixture()
  item.status = 'scheduled'
  item.image_url = '/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png'
  const fingerprint = socialReleaseFingerprint(item)
  const error = 'LinkedIn image upload failed; approved media must not be dropped'
  item.rag_context.platform_submission_gate = {
    status: 'approved', release_id: 'release-1', approved_fingerprint: fingerprint,
    approved_by: 'admin-1', approved_at: '2026-10-30T11:00:00.000Z', platforms: ['linkedin'],
    reconciliation_required: false,
    deterministic_failure: { release_id: 'release-1', platform: 'linkedin',
      publish_row_id: 'publish-1', approved_fingerprint: fingerprint, error },
  }
  const rows = [{ id: 'publish-1', platform: 'linkedin', status: 'failed', error_message: error,
    platform_post_id: null, platform_post_url: null, published_at: null }]
  return { item, rows }
}

describe('deterministic LinkedIn failure recovery', () => {
  it('reconciles a historical pending row only from one exact pre-post recovery receipt', () => {
    const { item } = failedRelease()
    item.rag_context.platform_submission_gate.status = 'uncertain'
    item.rag_context.platform_submission_gate.reconciliation_required = true
    item.rag_context.platform_submission_gate.release_platforms = ['linkedin']
    item.rag_context.platform_submission_gate.claimed_at = '2026-10-30T12:00:01.000Z'
    item.scheduled_for = '2026-10-30T12:00:00.000Z'
    item.rag_context.platform_submission_gate.approved_fingerprint = socialReleaseFingerprint(item)
    const row = { id: 'publish-1', platform: 'linkedin', status: 'pending', updated_at: '2026-10-30T12:00:00.000Z' }
    const receipt = { id: 'work-1', status: 'queued', updated_at: '2026-10-30T12:01:00.000Z', source_type: 'social_content_scheduled_publish_recovery',
      source_id: item.id, metadata: { recovery_kind: 'publish_blocked', scheduled_for: item.scheduled_for,
        provider_failures: { linkedin: 'LinkedIn image upload failed; approved media must not be dropped' } } }
    expect(historicalLinkedInFailureCandidate(item, [row], [receipt])).toMatchObject({
      work_item_id: 'work-1', publish_row_id: 'publish-1', error: receipt.metadata.provider_failures.linkedin,
    })
    expect(historicalLinkedInFailureCandidate(item, [row], [receipt, { ...receipt, id: 'work-2' }])).toBeNull()
    expect(historicalLinkedInFailureCandidate(item, [{ ...row, platform_post_url: 'https://linkedin.com/post' }], [receipt])).toBeNull()
    expect(historicalLinkedInFailureCandidate({ ...item, image_url: '/review-assets/other.png' }, [row], [receipt])).toBeNull()
    expect(historicalLinkedInFailureCandidate(item, [row], [{ ...receipt, metadata: { ...receipt.metadata,
      provider_failures: { linkedin: 'LinkedIn outcome is uncertain. Reconcile the existing release; do not retry.' } } }])).toBeNull()
  })
  it('exposes exactly one governed retry for the exact approved asset and provider error', () => {
    const { item, rows } = failedRelease()
    expect(isRetryableLinkedInFailure(item, rows)).toBe(true)
    expect(hasAmbiguousPublishRowsForRelease(item, rows)).toBe(false)
    expect(socialReleaseReview({ ...item, publishes: rows, release_retry: ['linkedin'] }, 'linkedin').locked).toBe(false)
    expect(socialReleaseReview({ ...item, publishes: rows }, 'linkedin').locked).toBe(true)
  })

  it('fails closed for stale pending rows, duplicate rows, and any post identity', () => {
    const { item, rows } = failedRelease()
    for (const changed of [
      [{ ...rows[0], status: 'pending' }],
      [...rows, { ...rows[0], id: 'publish-2' }],
      [{ ...rows[0], platform_post_id: 'urn:li:share:existing' }],
      [{ ...rows[0], error_message: 'different error' }],
    ]) expect(isRetryableLinkedInFailure(item, changed)).toBe(false)
  })

  it('fails closed when approved copy, visual, receipt, or approval gate changes', () => {
    const { item, rows } = failedRelease()
    for (const changed of [
      { ...item, post_text: 'Different copy' },
      { ...item, image_url: '/review-assets/other.png' },
      { ...item, rag_context: { ...item.rag_context, platform_submission_gate: {
        ...item.rag_context.platform_submission_gate, status: 'uncertain',
      } } },
      { ...item, rag_context: { ...item.rag_context, platform_submission_gate: {
        ...item.rag_context.platform_submission_gate, deterministic_failure: {
          ...item.rag_context.platform_submission_gate.deterministic_failure, publish_row_id: 'other',
        },
      } } },
    ]) expect(isRetryableLinkedInFailure(changed, rows)).toBe(false)
  })
})
