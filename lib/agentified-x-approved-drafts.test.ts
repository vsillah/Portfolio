import { describe, expect, it } from 'vitest'
import { AGENTIFIED_X_APPROVED_DRAFTS } from './agentified-x-approved-drafts'

describe('AGENTIFIED_X_APPROVED_DRAFTS', () => {
  it('keeps the approved four X assets ready for thread publishing', () => {
    expect(AGENTIFIED_X_APPROVED_DRAFTS.map((draft) => draft.assetId)).toEqual([
      'AGT-X-01',
      'AGT-X-02',
      'AGT-X-03',
      'AGT-X-04',
    ])

    for (const draft of AGENTIFIED_X_APPROVED_DRAFTS) {
      expect(draft.threadPosts.length).toBeGreaterThan(1)
      expect(draft.threadPosts.every((post) => post.length <= 280)).toBe(true)
    }
  })

  it('keeps the final offer CTA on the approved Agentified release route', () => {
    const offer = AGENTIFIED_X_APPROVED_DRAFTS.find((draft) => draft.assetId === 'AGT-X-04')

    expect(offer).toMatchObject({
      ctaText: 'Follow the Agentified release',
      ctaUrl: 'https://amadutown.com/agentified',
    })
  })
})
