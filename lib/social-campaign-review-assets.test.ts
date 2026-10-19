import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateYouTubePackagingEvidence, type ThumbnailDecisionReceipt } from './artifact-evidence-manifest'
import { getSocialCampaignReviewPacket, SOCIAL_CAMPAIGN_REVIEW_IDS, SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY, socialCampaignReviewQaFixture } from './social-campaign-review-assets'

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

  it('renders YouTube thumbnails only from version-bound upstream decision receipts', () => {
    const generator = readFileSync('scripts/qa/build-social-campaign-youtube-thumbnails.mjs', 'utf8')
    expect(generator).toContain('decisionReceiptPath')
    expect(generator).toContain('youtube-thumbnail-decision-receipt/v1')
    expect(generator).toContain('social-content-outlier-decision/v1')
    expect(generator).not.toContain('cohortPath:')
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
    expect(packet.thumbnailReceipt).toMatch(/^thumbnail:.+:youtube-long-form:20261018:v6$/)
    expect(packet.thumbnailEvidence).toMatchObject({ ready: true, target: 'youtube', pairBound: true })
    expect(packet.thumbnailEvidence?.thumbnail?.research_cohort).toMatchObject({ minimum_sample_size: 6 })
    expect(packet.thumbnailEvidence?.thumbnail?.research_cohort?.composition).toMatchObject({ version: 'youtube-thumbnail-composition/v1', batch_identity: 'social-campaign-youtube:20261018:v6' })
    expect(packet.thumbnailDiversity).toMatchObject({ ready: true, candidateCount: 2 })
    expect(packet.storyboard.length).toBeGreaterThanOrEqual(4)
    expect(packet.productProof.length).toBeGreaterThan(0)
    expect(packet.externalGates).toBe('closed')
  })

  it('keeps the two YouTube candidates in distinct source-bound composition families', () => {
    expect(SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY).toMatchObject({ ready: true, candidateCount: 2 })
    expect(new Set(SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY.layoutFamilies).size).toBe(2)
    expect(new Set(SOCIAL_CAMPAIGN_YOUTUBE_THUMBNAIL_DIVERSITY.compositionSignatures).size).toBe(2)
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

  it('fails closed when a manual cohort is injected without the upstream Social Content decision receipt', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleYouTube)
    expect(packet?.kind).toBe('youtube_packaging')
    if (!packet || packet.kind !== 'youtube_packaging' || !packet.thumbnailEvidenceManifest) return
    const manifest = structuredClone(packet.thumbnailEvidenceManifest)
    delete manifest.elements.find((element) => element.category === 'thumbnail')!.research_cohort!.decision_receipt

    const validation = validateYouTubePackagingEvidence(manifest, packet.contentVersion, 'youtube', '2026-10-18T20:00:00.000Z')

    expect(validation.ready).toBe(false)
    expect(validation.blockers).toContain('Thumbnail evidence is not bound to a versioned Social Content outlier decision receipt.')
  })

  it('keeps playlist-only taste evidence Unscored when live topic evidence is absent', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube)
    expect(packet?.kind).toBe('youtube_packaging')
    if (!packet || packet.kind !== 'youtube_packaging' || !packet.thumbnailEvidenceManifest) return
    const manifest = structuredClone(packet.thumbnailEvidenceManifest)
    const research = manifest.elements.find((element) => element.category === 'thumbnail')!.research_cohort!
    research.samples = []
    research.decision_receipt!.live_evidence.comparisons = []
    research.decision_receipt!.selection.status = 'unscored'

    const validation = validateYouTubePackagingEvidence(manifest, packet.contentVersion, 'youtube', '2026-10-18T20:00:00.000Z')

    expect(research.decision_receipt!.user_preference_signals[0]).toMatchObject({ evidence_role: 'taste_calibration_only', performance_weight: 0, performance_status: 'unscored' })
    expect(validation.ready).toBe(false)
    expect(validation.blockers).toContain('The decision receipt does not contain a qualifying normalized live cohort and declared minimum sample size.')
    expect(validation.blockers).toContain('The live decision receipt has no qualifying outlier at its declared numerical threshold.')
  })

  it('fails closed when the receipt-backed live cohort is stale', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube)
    expect(packet?.kind).toBe('youtube_packaging')
    if (!packet || packet.kind !== 'youtube_packaging' || !packet.thumbnailEvidenceManifest) return
    const manifest = structuredClone(packet.thumbnailEvidenceManifest)
    manifest.elements.find((element) => element.category === 'thumbnail')!.research_cohort!.decision_receipt!.live_evidence.fresh_until = '2026-10-17T00:00:00.000Z'

    const validation = validateYouTubePackagingEvidence(manifest, packet.contentVersion, 'youtube', '2026-10-18T20:00:00.000Z')

    expect(validation.ready).toBe(false)
    expect(validation.blockers).toContain('The live comparable-content evidence is missing or stale for this decision receipt.')
  })

  it('fails review readiness when canonical decision inputs are tampered without regenerating input_version', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube)
    expect(packet?.kind).toBe('youtube_packaging')
    if (!packet || packet.kind !== 'youtube_packaging' || !packet.thumbnailEvidenceManifest) return
    const tamperCases: Array<{ label: string; mutate: (receipt: ThumbnailDecisionReceipt) => void }> = [
      {
        label: 'live cohort metric',
        mutate: (receipt) => { receipt.live_evidence.comparisons[0].view_count! += 1 },
      },
      {
        label: 'playlist preference trait',
        mutate: (receipt) => { receipt.user_preference_signals[0].applied_traits.push('tampered trait') },
      },
      {
        label: 'candidate identity',
        mutate: (receipt) => { receipt.candidate_identity.content_id = 'tampered-content-id' },
      },
      {
        label: 'product-proof binding',
        mutate: (receipt) => { receipt.candidate_identity.product_proof_receipt_id = 'sha256:tampered' },
      },
    ]

    for (const tamperCase of tamperCases) {
      const manifest = structuredClone(packet.thumbnailEvidenceManifest)
      const receipt = manifest.elements.find((element) => element.category === 'thumbnail')!.research_cohort!.decision_receipt!
      tamperCase.mutate(receipt)

      const validation = validateYouTubePackagingEvidence(manifest, packet.contentVersion, 'youtube', '2026-10-18T20:00:00.000Z')

      expect(validation.ready, tamperCase.label).toBe(false)
      expect(validation.blockers, tamperCase.label).toContain('The Social Content thumbnail decision receipt input fingerprint does not match its canonical evidence payload.')
    }
  })

  it('advances a fully receipt-backed live path while keeping playlist taste evidence non-performance', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.auditYouTube)
    expect(packet?.kind).toBe('youtube_packaging')
    if (!packet || packet.kind !== 'youtube_packaging') return

    expect(packet.thumbnailEvidence?.ready).toBe(true)
    expect(packet.thumbnailEvidence?.thumbnail?.research_cohort?.decision_receipt).toMatchObject({
      route: 'social-content-outlier-decision/v1',
      selection: { status: 'ready' },
      user_preference_signals: [{ evidence_role: 'taste_calibration_only', performance_weight: 0, performance_status: 'unscored' }],
    })
    expect(packet.descriptionEvidence).toMatchObject({ state: 'unscored', qualified: 0, required: 3 })
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
