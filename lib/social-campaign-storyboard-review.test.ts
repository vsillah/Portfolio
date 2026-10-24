import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import jevSource from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev.json'
import { socialCampaignApprovedAdaptationQaProjection } from '@/lib/social-campaign-approved-adaptation-qa-fixture'
import type { SocialVideoAdaptationInput } from '@/lib/social-video-adaptation'
import { buildCampaignHeroThumbnailReview, buildCampaignStoryboardReview, type CampaignStoryboardReviewConfig } from '@/lib/social-campaign-storyboard-review'

function fileHash(publicPath: string) {
  return `sha256:${createHash('sha256').update(readFileSync(`public${publicPath}`)).digest('hex')}`
}

describe('review-only Social Content storyboard review', () => {
  const review = socialCampaignApprovedAdaptationQaProjection()

  it('binds exact review-only 16:9 assets to each existing campaign identity and content input', () => {
    expect(review.adaptations).toHaveLength(2)
    for (const adaptation of review.adaptations) {
      const packet = adaptation.storyboard_review
      expect(packet.assets).toHaveLength(2)
      for (const asset of packet.assets) {
        expect(asset).toMatchObject({
          width: 1280,
          height: 720,
          aspect_ratio: '16:9',
          provider: 'openai-imagegen',
          review_only: true,
          customer_facing: true,
          title_thumbnail_distinct: true,
          logo_path: '/amadutown-logo-upscaled.png',
          logo_aspect_ratio: 'natural_portrait',
        })
        expect(asset.title).not.toBe(asset.teaser)
        expect(fileHash(asset.public_path)).toBe(asset.sha256)
      }
      expect(packet.calendar_item_id).toBe(adaptation.calendar_item_id)
      expect(packet.social_content_id).toBe(adaptation.social_content_id)
      expect(packet.content_version).toBe(adaptation.current_content_version)
      expect(packet.script_input_version).toBe(adaptation.source_input_version)
      expect(new Set(Object.values(packet.external_gates))).toEqual(new Set([false]))
    }
    const jev = review.adaptations.find((adaptation) => adaptation.storyboard_review.campaign_identity === 'jev')!.storyboard_review
    expect(jev.hero_evidence).toMatchObject({ status: 'passed' })
    expect(jev.selection_decision).toMatchObject({
      receipt_id: 'human-qa:jev:thumbnail-selection:20261019:v1',
      status: 'human_qa_approved',
      content_version: jev.content_version,
      selected_asset_id: 'thumbnail:jev:reveal-scene:20261019:v3',
      selected_asset_path: '/review-assets/social-content/jev-hero-thumbnail-review/jev-score-isnt-the-call-hero-v1.png',
      rejected_asset_ids: ['thumbnail:jev:override-scene:20261019:v3'],
    })
    expect(new Set(jev.assets.map((asset) => asset.hero_asset_id))).toEqual(new Set(jev.hero_evidence?.hero_assets.map((hero) => hero.asset_id)))
    expect(jev.assets.every((asset) => asset.feed_preview_path && asset.evidence_trace?.length === 6)).toBe(true)
    expect(jev.assets.every((asset) => asset.fixture_label === 'New campaign-specific generation · review only' && asset.composition_intent)).toBe(true)
    expect(jev.assets[0]).toMatchObject({ approval_status: 'human_qa_rejected', selection_status: 'rejected', final_use_eligible: false, rejection_reason_code: 'anatomy_quality_failure' })
    expect(jev.assets[1]).toMatchObject({ approval_status: 'human_qa_selected', selection_status: 'selected', final_use_eligible: true })
    const darkCastle = review.adaptations.find((adaptation) => adaptation.storyboard_review.campaign_identity === 'dark-castle-chess')!.storyboard_review
    expect(darkCastle.selection_decision).toMatchObject({
      receipt_id: 'human-qa:dark-castle-chess:thumbnail-selection:20261019:v1',
      status: 'human_qa_approved',
      selected_asset_id: 'thumbnail:dark-castle-chess:decision-table:20261019:v1',
      selected_asset_path: '/review-assets/social-content/dark-castle-hero-thumbnail-review/dark-castle-remember-the-why-hero-v1.png',
      rejected_asset_ids: ['thumbnail:dark-castle-chess:rook-reveal:20261019:v1'],
    })
    expect(darkCastle.assets[0]).toMatchObject({ approval_status: 'human_qa_selected', selection_status: 'selected', final_use_eligible: true })
    expect(darkCastle.assets[1]).toMatchObject({ approval_status: 'human_qa_rejected', selection_status: 'rejected', final_use_eligible: false, rejection_reason_code: 'artifact_quality_failure', rejection_reason: 'The rook piece is visibly disfigured.' })
    expect(jev.assets.map((asset) => asset.teaser)).toEqual(['WHO OVERRIDES AI?', 'SCORE ≠ DECISION'])
  })

  it('projects one selected and one rejected candidate per primary campaign with fresh evidence and closed side effects', () => {
    expect(review.primary_thumbnail_reviews).toHaveLength(2)
    expect(review.primary_thumbnail_reviews.map((item) => [item.campaign_identity, item.assets.length, item.status])).toEqual([
      ['dark-castle-chess', 2, 'ready'],
      ['ai-audit-calculator', 2, 'ready'],
    ])
    expect(review.primary_thumbnail_reviews.flatMap((item) => item.assets)).toHaveLength(4)
    for (const item of review.primary_thumbnail_reviews) {
      expect(item.assets[0]).toMatchObject({ selection_status: 'selected', final_use_eligible: true, approval_status: 'human_qa_selected' })
      expect(item.assets[1]).toMatchObject({ selection_status: 'rejected', final_use_eligible: false, approval_status: 'human_qa_rejected' })
      expect(item.assets.every((asset) => asset.feed_preview_path && fileHash(asset.feed_preview_path) === asset.feed_preview_sha256)).toBe(true)
      expect(item.hero_evidence.outlier_evidence.included_video_ids.length).toBeGreaterThanOrEqual(6)
      expect(item.hero_evidence.outlier_evidence.qualified_outlier_video_ids.length).toBeGreaterThan(0)
      expect(item.selection_decision).toMatchObject({ status: 'human_qa_approved', selected_asset_id: item.assets[0].asset_id, rejected_asset_ids: [item.assets[1].asset_id] })
      expect(item.generation.cost).toMatchObject({ provider_calls: 4, successful_generation_jobs: 4, retries: 0, uncertain_results: 0, hard_ceiling: 9, ceiling_relation: 'strictly_below' })
      expect(new Set(Object.values(item.external_gates))).toEqual(new Set([false]))
    }
    expect(review.primary_thumbnail_reviews[0].assets[1]).toMatchObject({ rejection_reason_code: 'artifact_quality_failure', rejection_reason: 'The rook piece is visibly disfigured.' })
    expect(review.primary_thumbnail_reviews[1].assets[1]).toMatchObject({ rejection_reason_code: 'concept_clarity_preference', rejection_reason: 'Candidate A presents the clearer integrated receipt-pull concept.' })
  })

  it('provides complete, non-overlapping long-form and Shorts scene contracts', () => {
    for (const adaptation of review.adaptations) {
      const scenes = adaptation.storyboard_review.scenes
      expect(scenes).toHaveLength(9)
      for (const target of ['youtube_long_form', 'youtube_shorts'] as const) {
        const targetScenes = scenes.filter((scene) => scene.target === target)
        expect(targetScenes).toHaveLength(target === 'youtube_long_form' ? 6 : 3)
        expect(targetScenes[0].start_seconds).toBe(0)
        expect(targetScenes.at(-1)?.end_seconds).toBe(target === 'youtube_long_form' ? 240 : 45)
        targetScenes.forEach((scene, index) => {
          expect(scene.end_seconds).toBeGreaterThan(scene.start_seconds)
          if (index) expect(scene.start_seconds).toBeGreaterThanOrEqual(targetScenes[index - 1].end_seconds)
          expect(scene.spoken_beat).toBeTruthy()
          expect(scene.customer_facing_copy.length).toBeGreaterThan(0)
          expect(scene.customer_facing_copy.join(' ')).not.toMatch(/provider|receipt|source|fixture|sample data|prompt|code logic|hold/i)
          expect(scene.proof.length).toBeGreaterThan(0)
          expect(scene.shot.type).toBeTruthy()
          expect(scene.shot.framing).toBeTruthy()
          expect(scene.shot.camera_angle).toBeTruthy()
          expect(scene.shot.camera_movement).toBeTruthy()
          expect(scene.avatar_environment_direction).toContain('provider-free review')
          expect(scene.asset_animation).toContain('Preserve the source pixels')
          expect(scene.transition).toBeTruthy()
          expect(scene.continuity).toHaveLength(3)
          expect(scene.b_roll_cue).toBeTruthy()
          expect(scene.music_ducking_note).toContain('duck')
          expect(scene.proof_source_binding.content_version).toBe(adaptation.current_content_version)
          expect(scene.proof_source_binding.script_input_version).toBe(adaptation.source_input_version)
        })
        expect(targetScenes.at(-1)?.cta_delivery).toMatchObject({ required: true, exception_receipt_id: null })
        expect(targetScenes.at(-1)?.cta_delivery.spoken_line).toMatch(/Subscribe to AmaduTown/i)
      }
    }
  })

  it('fails closed on exact thumbnail, description, script, and stale-version gaps with recovery links', () => {
    const [jev, darkCastle] = review.adaptations.map((adaptation) => adaptation.storyboard_review)
    expect(jev.status).toBe('review_direction_blocked')
    expect(jev.evidence_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'outlier', status: 'passed' }),
      expect.objectContaining({ key: 'description', status: 'blocked' }),
      expect.objectContaining({ key: 'hero', status: 'passed' }),
      expect.objectContaining({ key: 'thumbnail', status: 'passed' }),
      expect.objectContaining({ key: 'script', status: 'blocked' }),
      expect.objectContaining({ key: 'freshness', status: 'stale' }),
    ]))
    expect(darkCastle.status).toBe('review_direction_blocked')
    expect(darkCastle.evidence_gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'outlier', status: 'passed' }),
      expect.objectContaining({ key: 'description', status: 'blocked' }),
      expect.objectContaining({ key: 'hero', status: 'passed' }),
      expect.objectContaining({ key: 'thumbnail', status: 'passed' }),
      expect.objectContaining({ key: 'script', status: 'blocked' }),
      expect.objectContaining({ key: 'freshness', status: 'passed' }),
    ]))
    expect([...jev.recovery_actions, ...darkCastle.recovery_actions].every((action) => action.href.startsWith('/admin/social-content?workflow=evidence'))).toBe(true)
    expect([...jev.evidence_gates, ...darkCastle.evidence_gates]).toHaveLength(22)
  })

  it('advances freshness only when the exact version matches and every dated receipt is still inside its window', () => {
    const ready = buildCampaignStoryboardReview(alignedJevInput(), jevReviewConfig())
    expect(ready.status).toBe('ready_for_human_review')
    expect(ready.blockers).toEqual([])
    expect(gate(ready, 'freshness')).toMatchObject({ status: 'passed' })
    expect(Object.values(ready.external_gates).every((open) => open === false)).toBe(true)

    const atDeadline = alignedJevInput()
    for (const receipt of Object.values(atDeadline.receipts)) {
      if (receipt) receipt.valid_until = EVALUATED_AT
    }
    expect(gate(buildCampaignStoryboardReview(atDeadline, jevReviewConfig()), 'freshness')?.status).toBe('passed')

    const justExpired = alignedJevInput()
    justExpired.receipts.source!.valid_until = '2026-10-19T20:29:59.999Z'
    const expiredReview = buildCampaignStoryboardReview(justExpired, jevReviewConfig())
    expect(expiredReview.status).toBe('review_direction_blocked')
    expect(gate(expiredReview, 'freshness')).toMatchObject({
      status: 'stale',
      detail: '1 required receipt expired before this review.',
      receipt_ids: ['source:jev:approved-composite-20261014'],
    })

    const twoExpired = alignedJevInput()
    twoExpired.receipts.source!.valid_until = '2026-10-19T20:29:59.999Z'
    twoExpired.receipts.privacy!.valid_until = '2026-10-18T00:00:00.000Z'
    expect(gate(buildCampaignStoryboardReview(twoExpired, jevReviewConfig()), 'freshness')?.detail).toBe('2 required receipts expired before this review.')

    const versionWins = structuredClone(jevSource) as SocialVideoAdaptationInput
    versionWins.receipts.source!.valid_until = '2026-10-19T20:29:59.999Z'
    expect(gate(buildCampaignStoryboardReview(versionWins, jevReviewConfig()), 'freshness')?.detail).toBe('The approved adaptation input no longer matches the current Social Content version. The storyboard remains visible as a review direction, but it cannot advance.')
  })

  it('fails closed when a required receipt is not approved or a product proof binding is missing', () => {
    for (const status of ['approved', 'passed', 'complete'] as const) {
      const input = alignedJevInput()
      input.receipts.source!.status = status
      expect(gate(buildCampaignStoryboardReview(input, jevReviewConfig()), 'source')?.status).toBe('passed')
    }

    const pending = alignedJevInput()
    pending.receipts.source!.status = 'pending'
    expect(gate(buildCampaignStoryboardReview(pending, jevReviewConfig()), 'source')).toMatchObject({
      status: 'blocked',
      detail: 'A passed source receipt is required.',
      receipt_ids: ['source:jev:approved-composite-20261014'],
    })

    const unbound = alignedJevInput()
    unbound.evidence_assets[0].privacy_receipt_id = ''
    expect(gate(buildCampaignStoryboardReview(unbound, jevReviewConfig()), 'product_proof')).toMatchObject({
      status: 'blocked',
      detail: 'Every visible product artifact needs a source, privacy, and rights binding.',
    })
  })

  it('drops internal production lines from customer-facing scene copy and blocks an unknown hero', () => {
    const mixed = alignedJevInput()
    mixed.draft.scenes[0].on_screen_text = ['provider receipt', 'Score the decision']
    const mixedReview = buildCampaignStoryboardReview(mixed, jevReviewConfig())
    expect(mixedReview.scenes.find((scene) => scene.scene_id === mixed.draft.scenes[0].scene_id)?.customer_facing_copy).toEqual(['Score the decision'])

    const leaked = alignedJevInput()
    leaked.draft.scenes[0].on_screen_text = ['sample data prompt']
    expect(buildCampaignStoryboardReview(leaked, jevReviewConfig()).scenes.find((scene) => scene.scene_id === leaked.draft.scenes[0].scene_id)?.customer_facing_copy).toEqual(['Score · rule · human decision'])

    const unknown = buildCampaignStoryboardReview(alignedJevInput(), jevReviewConfig('unknown-product'))
    expect(unknown.hero_evidence).toBeNull()
    expect(unknown.selection_decision).toBeNull()
    expect(unknown.assets).toEqual([])
    expect(gate(unknown, 'hero')).toMatchObject({
      status: 'blocked',
      detail: 'This YouTube campaign has no current campaign-specific hero evidence receipt. A product screenshot or text-first template cannot substitute for the hero.',
    })
    expect(gate(unknown, 'thumbnail')?.status).toBe('blocked')
    expect(() => buildCampaignHeroThumbnailReview({
      campaign_identity: 'unknown-product',
      product_label: 'Unknown product',
      calendar_item_id: 'bb1d68b7-cef7-44a0-b907-5e6431167a0f',
      current_content_version: CURRENT_VERSION,
      evaluated_at: EVALUATED_AT,
      recovery_href: '/admin/social-content?workflow=evidence&campaign=unknown-product',
    })).toThrow('No campaign-specific hero receipt exists for unknown-product.')
  })
})

const CURRENT_VERSION = 'sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2'
const EVALUATED_AT = '2026-10-19T20:30:00.000Z'

function passedGate(detail: string): CampaignStoryboardReviewConfig['outlier_gate'] {
  return {
    status: 'passed',
    detail,
    receipt_ids: ['receipt:storyboard-test'],
    observed_at: '2026-10-17T12:00:00.000Z',
    fresh_until: '2026-10-24T12:00:00.000Z',
  }
}

function jevReviewConfig(campaignIdentity = 'jev'): CampaignStoryboardReviewConfig {
  return {
    campaign_identity: campaignIdentity,
    product_label: 'Jev',
    calendar_item_id: 'bb1d68b7-cef7-44a0-b907-5e6431167a0f',
    social_content_id: '939b01e3-d1af-42c8-805e-0379f09efd60',
    current_content_version: CURRENT_VERSION,
    evaluated_at: EVALUATED_AT,
    title: 'AI Scored It. Who Makes the Call?',
    teaser: 'WHEN SHOULD AI STOP?',
    outlier_gate: passedGate('outlier'),
    description_gate: passedGate('description'),
    thumbnail_gate: passedGate('thumbnail'),
    script_gate: passedGate('script'),
    conclusion: 'A model score becomes useful when the surrounding system makes authority, exceptions, and evidence visible.',
    spoken_cta: 'Subscribe to AmaduTown for practical ways to decide where AI should stop and people should step in.',
    recovery_href: '/admin/social-content?workflow=evidence&campaign=jev',
    value_summary: 'Source-bound storyboard.',
  }
}

function alignedJevInput() {
  const input = structuredClone(jevSource) as SocialVideoAdaptationInput
  input.input_version = CURRENT_VERSION
  return input
}

function gate(packet: ReturnType<typeof buildCampaignStoryboardReview>, key: string) {
  return packet.evidence_gates.find((entry) => entry.key === key)
}
