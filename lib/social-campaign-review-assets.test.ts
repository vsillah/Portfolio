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
      ['dark-castle-linkedin-remember-why.png', '71f838f13abc747f1cd56fd7b381ee341396f4801c48a69714e85cc47224084b'],
      ['ai-audit-linkedin-hidden-bill.png', '73263abe49dc749383050e91cf10cab3266451eba866bf0b661d8bb88aa9efd5'],
    ])
    for (const [name, digest] of expected) {
      expect(createHash('sha256').update(readFileSync(`public/review-assets/social-content/campaign-review/${name}`)).digest('hex')).toBe(digest)
    }
  })

  it('keeps the Dark Castle JIT decision blocked on the expired exact content version', () => {
    const packet = getSocialCampaignReviewPacket(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn)
    expect(packet?.kind).toBe('linkedin_visual')
    if (!packet || packet.kind !== 'linkedin_visual') return
    expect(packet.jit).toMatchObject({
      contentVersion: 'sha256:585addaef15349ec135a57dd67308492110f6e97aecac2585e5936737d21918b',
      expiresAt: '2026-10-20T15:08:19Z',
      status: 'blocked_stale_jit',
    })
    expect(packet.sources.map((source) => source.receipt)).toContain('sha256:896dce9162e815c1138dfbecacd24e0a63d05e99901f98b89022ddeee225f9df')
    const fixture = socialCampaignReviewQaFixture(SOCIAL_CAMPAIGN_REVIEW_IDS.darkCastleLinkedIn)
    expect(fixture.post_text).toContain('A player opens with e4.')
    expect(fixture.post_text).toContain('Those are visible product states, not a measured result.')
    expect(fixture.cta_text).toBe('What does your product give people after they get an answer right?')
    expect(packet.externalGates).toBe('closed')
  })

  it('keeps the Dark Castle board clear of the explanatory caption', () => {
    const generator = readFileSync('scripts/generate-dark-castle-linkedin-review-visual.mjs', 'utf8')
    expect(generator).toContain("{ input: position, left: 75, top: 390 }")
    expect(generator).toContain('<rect x="75" y="390" width="650" height="725"')
    expect(generator).toContain('<rect x="75" y="1135" width="650" height="155"')
    expect(generator).not.toContain('<rect x="75" y="1012" width="650" height="261"')
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
  ])('fails closed while fewer than three YouTube descriptions qualify for %s', (id) => {
    const packet = getSocialCampaignReviewPacket(id)
    expect(packet?.kind).toBe('youtube_packaging')
    if (!packet || packet.kind !== 'youtube_packaging') return
    expect(packet.status).toBe('blocked_missing_description_evidence')
    expect(packet.descriptionEvidence).toMatchObject({ state: 'unscored', qualified: 1, required: 3 })
    expect(packet.descriptionEvidence.attribution).toHaveLength(1)
    expect(packet.descriptionEvidence.attribution[0].href).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/)
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
    expect(packet.descriptionEvidence).toMatchObject({ state: 'unscored', qualified: 1, required: 3 })
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
