import { describe, expect, it } from 'vitest'
import { getSocialCampaignReviewPacket, SOCIAL_CAMPAIGN_REVIEW_IDS } from './social-campaign-review-assets'

describe('social campaign review asset projection', () => {
  it.each([
    SOCIAL_CAMPAIGN_REVIEW_IDS.jevLinkedIn,
    SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn,
    SOCIAL_CAMPAIGN_REVIEW_IDS.auditLinkedIn,
  ])('projects a differentiated, source-bound LinkedIn visual for %s', (id) => {
    const packet = getSocialCampaignReviewPacket(id)
    expect(packet?.kind).toBe('linkedin_visual')
    if (!packet || packet.kind !== 'linkedin_visual') return
    expect(packet.visual.publicPath).toMatch(/^\/review-assets\/social-content\/campaign-review\/.+\.png$/)
    expect(packet.visual.sha256).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(packet.sources.every((source) => source.receipt && source.supports && source.limitation)).toBe(true)
    expect(packet.externalGates).toBe('closed')
  })

  it.each([
    SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube,
    SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube,
  ])('fails closed when qualifying YouTube description evidence is absent for %s', (id) => {
    const packet = getSocialCampaignReviewPacket(id)
    expect(packet?.kind).toBe('youtube_packaging')
    if (!packet || packet.kind !== 'youtube_packaging') return
    expect(packet.status).toBe('blocked_missing_description_evidence')
    expect(packet.descriptionEvidence).toMatchObject({ state: 'unscored', qualified: 0, required: 3, attribution: [] })
    expect(packet.title).not.toBe(packet.thumbnailTeaser)
    expect(packet.storyboard.length).toBeGreaterThanOrEqual(4)
    expect(packet.productProof.length).toBeGreaterThan(0)
    expect(packet.externalGates).toBe('closed')
  })

  it('reuses the exact approved Jev title-thumbnail pair without changing its Unscored performance boundary', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.jevYouTube)
    expect(packet).toMatchObject({
      kind: 'youtube_packaging',
      status: 'reused_approved_pair',
      title: 'AI Scored It. Who Makes the Call?',
      thumbnailTeaser: 'WHEN SHOULD AI STOP?',
      thumbnailPath: '/review-assets/social-content/jev-youtube-short-thumbnail-v5.png',
      externalGates: 'closed',
    })
    if (!packet || packet.kind !== 'youtube_packaging') return
    expect(packet.descriptionEvidence.attribution[0]?.receipt).toBe('thumbnail:jev:youtube-shorts:20261018:v5')
    expect(packet.descriptionEvidence.attribution[0]?.limitation).toContain('no comparative performance claim')
  })
})
