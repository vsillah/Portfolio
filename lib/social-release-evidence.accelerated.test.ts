import { describe, expect, it } from 'vitest'
import { ACCELERATED_ACTIVATION_ITEMS, ACCELERATED_EXCLUDED_X_ID } from './accelerated-campaign-activation'
import { hasMatchingSocialReleaseFingerprint, socialReleaseFingerprint } from './social-release-evidence'

const ids = Object.keys(ACCELERATED_ACTIVATION_ITEMS) as Array<keyof typeof ACCELERATED_ACTIVATION_ITEMS>

function scheduledRow(id: keyof typeof ACCELERATED_ACTIVATION_ITEMS, scheduledFor: string) {
  const expected = ACCELERATED_ACTIVATION_ITEMS[id]
  return {
    id, status: 'scheduled', platform: expected.channel, target_platforms: [expected.channel],
    scheduled_for: scheduledFor, created_at: '2026-11-17T12:00:00+00:00',
    updated_at: '2026-11-18T12:00:00+00:00', post_text: 'Synthetic reviewed copy',
    cta_text: 'Explore Accelerated', cta_url: 'https://amadutown.com/accelerated',
    hashtags: ['Accelerated'], image_url: 'https://amadutown.com/campaigns/accelerated/2026-11/slide-01.png',
    carousel_slide_urls: null, published_at: null, platform_post_id: null, admin_notes: null,
    rag_context: { campaign_id: 'synthetic-campaign', platform_submission_gate: { status: 'approved', approved_fingerprint: '' } },
  }
}

describe('exact Accelerated release fingerprint timestamp equivalence', () => {
  it.each(ids)('recognizes both approved UTC spellings for %s without accepting content drift', id => {
    const iso = ACCELERATED_ACTIVATION_ITEMS[id].scheduledFor
    const offset = iso.replace('.000Z', '+00:00')
    const original = scheduledRow(id, iso)
    const approved = { ...original, rag_context: { ...original.rag_context,
      platform_submission_gate: { status: 'approved', approved_fingerprint: socialReleaseFingerprint(original) } } }
    const persisted = { ...approved, scheduled_for: offset }
    expect(hasMatchingSocialReleaseFingerprint(persisted)).toBe(true)

    const offsetApproved = { ...persisted, rag_context: { ...persisted.rag_context,
      platform_submission_gate: { status: 'approved', approved_fingerprint: socialReleaseFingerprint(persisted) } } }
    expect(hasMatchingSocialReleaseFingerprint({ ...offsetApproved, scheduled_for: iso })).toBe(true)
    expect(hasMatchingSocialReleaseFingerprint({ ...approved, post_text: 'Changed after approval', scheduled_for: offset })).toBe(false)
    expect(hasMatchingSocialReleaseFingerprint({ ...approved, image_url: 'https://example.com/changed.png', scheduled_for: offset })).toBe(false)
    expect(hasMatchingSocialReleaseFingerprint({ ...approved, scheduled_for: new Date(Date.parse(iso) + 1000).toISOString() })).toBe(false)
  })

  it('keeps the excluded X draft and unrelated records on exact fingerprint matching', () => {
    const iso = ACCELERATED_ACTIVATION_ITEMS[ids[0]].scheduledFor
    const row = scheduledRow(ids[0], iso)
    for (const id of [ACCELERATED_EXCLUDED_X_ID, 'unrelated-record']) {
      const draft = { ...row, id, status: 'draft', platform: 'x', target_platforms: ['x'] }
      const candidate = { ...draft, rag_context: { ...draft.rag_context,
        platform_submission_gate: { status: 'approved', approved_fingerprint: socialReleaseFingerprint(draft) } } }
      expect(hasMatchingSocialReleaseFingerprint({ ...candidate, scheduled_for: iso.replace('.000Z', '+00:00') })).toBe(false)
    }
  })
})
