import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateYouTubePackagingEvidence } from './artifact-evidence-manifest'
import { getSocialCampaignReviewPacket, SOCIAL_CAMPAIGN_REVIEW_IDS, socialCampaignReviewQaFixture } from './social-campaign-review-assets'

describe('social campaign review asset projection', () => {
  it('keeps the LinkedIn generator scoped to the three unchanged LinkedIn outputs', () => {
    const generator = readFileSync('scripts/generate-social-campaign-review-visuals.mjs', 'utf8')
    expect(generator).not.toContain('youtubeJobs')
    expect(generator).not.toContain('youtubeOverlaySvg')
    const expected = new Map([
      ['jev-linkedin-decision-system.png', '5927f3b90b7895145464fb3c95d3c0d962214c2257379766bc892e43aa7bb141'],
      ['dark-castle-linkedin-remember-why.png', 'f31f4dd07484c769c7dfd3b43c95269540facd387ca82a02fea2a15ff19c8334'],
      ['ai-audit-linkedin-hidden-bill.png', '73263abe49dc749383050e91cf10cab3266451eba866bf0b661d8bb88aa9efd5'],
    ])
    for (const [name, digest] of expected) {
      expect(createHash('sha256').update(readFileSync(`public/review-assets/social-content/campaign-review/${name}`)).digest('hex')).toBe(digest)
    }
  })

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
    expect(packet.thumbnailPath).toMatch(/^\/review-assets\/social-content\/youtube-packaging\/.+\.png$/)
    expect(packet.thumbnailReceipt).toMatch(/^thumbnail:.+:youtube-long-form:20261018:v1$/)
    expect(packet.thumbnailEvidence).toMatchObject({ ready: true, target: 'youtube', pairBound: true })
    expect(packet.thumbnailEvidence?.thumbnail?.research_cohort).toMatchObject({ minimum_sample_size: 6 })
    expect(packet.storyboard.length).toBeGreaterThanOrEqual(4)
    expect(packet.productProof.length).toBeGreaterThan(0)
    expect(packet.externalGates).toBe('closed')
  })

  it('does not expose a thumbnail when a copied manifest has only the PNG, SHA, and no cohort binding', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube)
    expect(packet?.kind).toBe('youtube_packaging')
    if (!packet || packet.kind !== 'youtube_packaging' || !packet.thumbnailEvidenceManifest) return
    const manifest = structuredClone(packet.thumbnailEvidenceManifest)
    delete manifest.elements.find((element) => element.category === 'thumbnail')!.research_cohort

    const validation = validateYouTubePackagingEvidence(manifest, packet.contentVersion, 'youtube', '2026-10-18T20:00:00.000Z')

    expect(validation.ready).toBe(false)
    expect(validation.pairBound).toBe(true)
    expect(validation.blockers).toContain('Thumbnail evidence is missing its attributable research cohort and candidate bindings.')
  })

  it('reuses the exact approved Jev title-thumbnail pair without changing its Unscored performance boundary', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.jevYouTube)
    expect(packet).toMatchObject({
      kind: 'youtube_packaging',
      status: 'reused_approved_pair',
      title: 'AI Scored It. Who Makes the Call?',
      thumbnailTeaser: 'WHEN SHOULD AI STOP?',
      thumbnailPath: '/review-assets/social-content/jev-youtube-short-thumbnail-v5.png',
      thumbnailReceipt: 'thumbnail:jev:youtube-shorts:20261018:v5',
      externalGates: 'closed',
    })
    if (!packet || packet.kind !== 'youtube_packaging') return
    expect(packet.descriptionEvidence.attribution[0]?.receipt).toBe('thumbnail:jev:youtube-shorts:20261018:v5')
    expect(packet.descriptionEvidence.attribution[0]?.limitation).toContain('no comparative performance claim')
  })

  it.each(Object.values(SOCIAL_CAMPAIGN_REVIEW_IDS))('builds a read-only repository fixture for %s', (id) => {
    const fixture = socialCampaignReviewQaFixture(id)
    expect(fixture.id).toBe(id)
    expect(fixture.rag_context?.qa_fixture).toMatchObject({
      kind: 'social_campaign_review_assets',
      read_only: true,
    })
    expect(fixture.rag_context?.side_effects).toMatchObject({
      production_write: false,
      provider_generation: false,
      platform_draft: false,
      publish: false,
      external_send: false,
    })
  })
})
