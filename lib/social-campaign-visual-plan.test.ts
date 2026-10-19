import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { socialCampaignLongFormBatchQaCandidates, socialCampaignPackageQaCandidates } from './social-campaign-package-qa-fixture'
import {
  buildCampaignVisualPlan,
  campaignVisualBatchIdempotencyKey,
  evaluateCampaignVisualPlan,
  projectCampaignVisualBatch,
  projectCampaignVisualPlan,
} from './social-campaign-visual-plan'
import { projectCampaignLongFormDraft } from './social-campaign-long-form-batch'

const NOW = new Date('2026-10-19T12:00:00.000Z')

function passingPlan() {
  const candidate = socialCampaignPackageQaCandidates()[0]
  const script = projectCampaignLongFormDraft(candidate, NOW)
  if (!script.packet) throw new Error('Expected the KickLab long-form fixture to pass.')
  return buildCampaignVisualPlan(candidate, script.packet)
}

describe('evidence-backed social visual plan', () => {
  it('builds a version-bound raster KickLab plan and keeps unsupported typography performance Unscored', () => {
    const projection = projectCampaignVisualPlan(socialCampaignPackageQaCandidates()[0], NOW)
    expect(projection.ready).toBe(false)
    expect(projection.state).toBe('unscored')
    expect(projection.plan?.beats.map((beat) => beat.channel)).toEqual(expect.arrayContaining(['linkedin', 'youtube_thumbnail', 'youtube_long_form', 'short_form']))
    expect(projection.plan?.beats.every((beat) => beat.copy_section_id && beat.copy_excerpt && beat.source_ids.length && beat.intended_takeaway)).toBe(true)
    expect(projection.plan?.exact_sources.some((source) => source.kind === 'owned_product_screenshot')).toBe(true)
    expect(projection.plan?.benchmark_logic).toMatchObject({ playlist_role: 'taste_only_zero_performance_weight', playlist_similarity: { status: 'unscored', score: null, receipt_id: null }, live_topic_score: 84, live_topic_threshold: 75 })
    expect(projection.evaluation).toMatchObject({ status: 'unscored', approval_ready: false, overall_score: null })
    expect(projection.evaluation.dimensions).toHaveLength(13)
    expect(projection.evaluation.dimensions.filter((dimension) => dimension.status === 'passed')).toHaveLength(12)
    expect(projection.evaluation.dimensions.every((dimension) => dimension.status === 'unscored' || dimension.score === Math.round((dimension.calculation.numerator! / dimension.calculation.denominator!) * 100))).toBe(true)
    expect(new Set(Object.values(projection.plan!.external_gates))).toEqual(new Set([false]))
    expect(projection.plan?.beats.filter((beat) => ['youtube_long_form', 'short_form'].includes(beat.channel)).every((beat) => beat.cinematography?.contract_version === 'campaign-scene-cinematography/v1')).toBe(true)
    expect(projection.plan?.beats.every((beat) => beat.typography.contract_version === 'campaign-typography-compositing/v1')).toBe(true)
    expect(projection.plan?.thumbnails[0]).toMatchObject({ href: '/review-assets/kicklab-youtube-thumbnail.png', typography: { integrated_with_focal_subject: true } })
    expect(projection.plan?.typography_style_receipt).toMatchObject({ deterministic_verdict: 'unscored', performance_weight: 0, performance_evidence: { status: 'unscored', sample_size: 2, required_sample_size: 4, matched_style_sample_size: 0, channel_baseline_views: null, observed_normalized_performance: null } })
    expect(projection.plan?.typography_style_receipt?.performance_evidence.public_research_audit).toMatchObject({ channel: 'How Ridiculous', channel_sample_size: 7, matched_style_threshold: 4, matched_style_observed: 0, normalization_result: null })
    expect(projection.plan?.typography_style_receipt?.performance_evidence.public_research_audit.baseline_sample).toHaveLength(10)
    expect(projection.plan?.typography_style_receipt?.performance_evidence.public_research_audit.baseline_sample.filter((entry) => entry.included_in_baseline)).toHaveLength(5)
    expect(projection.plan?.typography_style_receipt?.performance_evidence.public_research_audit.nearest_candidates.every((entry) => !entry.style_match)).toBe(true)
    expect(projection.plan?.typography_style_receipt?.performance_evidence.public_research_audit.channels_screened).toHaveLength(9)
    expect(projection.plan?.typography_style_receipt?.performance_evidence.public_research_audit.channels_screened).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: 'Khan Academy', eligible_baseline_count: 5, baseline_30_day_median_views: 53950 }),
      expect.objectContaining({ channel: 'Science of Sport', topic_domain: 'sports-based STEM' }),
      expect.objectContaining({ channel: 'Bagz Tech', topic_domain: 'gameplay learning / physics games' }),
    ]))
    expect(projection.plan?.typography_style_receipt?.performance_evidence.public_research_audit.nearest_candidates).toHaveLength(11)
    expect(projection.plan?.typography_style_receipt?.performance_evidence.public_research_audit.nearest_candidates.every((entry) => entry.promotion_status && entry.observed_thumbnail_type)).toBe(true)
    expect(projection.plan?.typography_style_receipt).toEqual(JSON.parse(readFileSync('artifacts/research/kicklab-typography-style-receipt-2026-10-19/receipt.json', 'utf8')))
    expect(projection.evaluation.dimensions.find((dimension) => dimension.key === 'typography_style_evidence')).toMatchObject({ status: 'unscored', score: null })
    expect(projection.evaluation.dimensions.find((dimension) => dimension.key === 'typography_style_evidence')).toMatchObject({ calculation: { formula: expect.stringContaining('zero-weight comparables are context-only') }, explanation: expect.stringContaining('approval requires the scored matched-style cohort') })
    expect(projection.evaluation.blockers.map((item) => item.code)).toContain('visual_typography_style_unscored')
    expect(projection.plan?.version).toBe('social-campaign-visual-plan/v4')
  })

  it('binds every YouTube scene to script, source, proof, title/thumbnail, outlier, privacy, and originality receipts', () => {
    const plan = passingPlan()
    const scenes = plan.beats.filter((beat) => beat.channel === 'youtube_long_form')
    expect(scenes).toHaveLength(16)
    expect(scenes.every((beat) => beat.storyboard_traceability?.approved_script_segment_id === beat.copy_section_id)).toBe(true)
    expect(scenes.every((beat) => beat.storyboard_traceability?.owned_artifact_href === beat.asset_href)).toBe(true)
    expect(scenes.every((beat) => beat.source_ids.includes(beat.storyboard_traceability!.product_proof_receipt_id))).toBe(true)
    expect(scenes.every((beat) => beat.storyboard_traceability?.title_thumbnail_distinct)).toBe(true)
    expect(scenes.every((beat) => beat.storyboard_traceability?.audience_research_receipt_id === plan.typography_style_receipt?.receipt_id && beat.storyboard_traceability.audience_source_urls.every((href) => href.startsWith('https://')))).toBe(true)
    expect(scenes.every((beat) => beat.layout.includes('avatar on the left') && beat.layout.includes('right two-thirds'))).toBe(true)
    expect(scenes.every((beat) => beat.presenter_placement && beat.music_ducking_cue)).toBe(true)
    expect(scenes.some((beat) => beat.product_broll_timing?.end_seconds === beat.end_seconds)).toBe(true)
    expect(scenes.at(-1)?.spoken_conclusion_or_cta).toMatch(/subscrib/i)
    const shortFormScenes = plan.beats.filter((beat) => beat.channel === 'short_form')
    expect(shortFormScenes.every((beat) => beat.storyboard_traceability?.source_receipt_ids.includes(beat.storyboard_traceability.product_proof_receipt_id))).toBe(true)
    expect(shortFormScenes.every((beat) => !beat.product_broll_timing || (beat.product_broll_timing.start_seconds === beat.start_seconds && beat.product_broll_timing.end_seconds === beat.end_seconds))).toBe(true)
    expect(evaluateCampaignVisualPlan(plan, NOW).blockers.map((item) => item.code)).not.toContain('visual_storyboard_incomplete')
  })

  it('fails closed when a YouTube scene loses a required trace or spoken CTA', () => {
    const plan = passingPlan()
    const scenes = plan.beats.filter((beat) => beat.channel === 'youtube_long_form')
    scenes[2].storyboard_traceability!.privacy_receipt_id = 'missing-privacy-receipt'
    scenes[3].storyboard_traceability!.audience_source_urls = []
    scenes.at(-1)!.spoken_conclusion_or_cta = null
    const evaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(evaluation.blockers.map((item) => item.code)).toContain('visual_storyboard_incomplete')
  })

  it('uses only a scored matched-style cohort for typography approval', () => {
    const plan = passingPlan()
    const receipt = plan.typography_style_receipt!
    const evidence = receipt.performance_evidence

    evidence.status = 'scored'
    evidence.sample_size = evidence.required_sample_size
    evidence.matched_style_sample_size = evidence.required_sample_size
    evidence.baseline_video_urls = ['https://www.youtube.com/watch?v=test-baseline']
    evidence.channel_baseline_views = 100_000
    evidence.observed_normalized_performance = evidence.normalized_threshold
    receipt.performance_weight = 1
    receipt.deterministic_verdict = 'approved'

    const contextOnlyEvaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(contextOnlyEvaluation.dimensions.find((dimension) => dimension.key === 'typography_style_evidence')?.status).toBe('unscored')

    receipt.comparables = Array.from({ length: evidence.required_sample_size }, (_, index) => ({
      ...receipt.comparables[index % receipt.comparables.length],
      comparable_id: `synthetic-matched-style-${index + 1}`,
      matched_style: true,
      performance_weight: 1 as const,
      channel_baseline_views: 100_000,
      normalized_performance: evidence.normalized_threshold,
    }))
    const cohortEvaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(cohortEvaluation.dimensions.find((dimension) => dimension.key === 'typography_style_evidence')?.status).toBe('passed')
  })

  it('uses a raster thumbnail bound to the owned gameplay capture and photographic provenance', () => {
    const bytes = readFileSync('public/review-assets/kicklab-youtube-thumbnail.png')
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(() => readFileSync('public/review-assets/kicklab-youtube-thumbnail.svg')).toThrow()
    const provenance = JSON.parse(readFileSync('artifacts/research/kicklab-typography-style-receipt-2026-10-19/thumbnail-provenance.json', 'utf8'))
    expect(provenance.product_proof).toMatchObject({
      asset: '/review-assets/social-content/source-proof/kicklab-gameplay-capture-2026-10-17.jpg',
      generated_ui: false,
      fabricated_results: false,
    })
    expect(provenance.self_evaluation).toMatchObject({
      status: 'direction_review_only',
      dated_arcade_type: expect.stringContaining('rejected'),
      typography_performance: expect.stringContaining('Unscored'),
    })
  })

  it('rejects customer-facing SVG thumbnails and dated arcade typography', () => {
    const plan = passingPlan()
    plan.thumbnails[0].href = '/review-assets/kicklab-youtube-thumbnail.svg'
    plan.typography_style_receipt!.selected_style.family = 'KickLab Impact arcade condensed black'
    plan.typography_style_receipt!.performance_evidence.status = 'scored'
    plan.typography_style_receipt!.performance_evidence.sample_size = 4
    plan.typography_style_receipt!.performance_evidence.matched_style_sample_size = 4
    plan.typography_style_receipt!.performance_evidence.baseline_video_urls = ['https://www.youtube.com/watch?v=baseline']
    plan.typography_style_receipt!.performance_evidence.channel_baseline_views = 100000
    plan.typography_style_receipt!.performance_evidence.observed_normalized_performance = 2
    plan.typography_style_receipt!.deterministic_verdict = 'approved'
    const evaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(evaluation.blockers.map((item) => item.code)).toContain('visual_thumbnail_svg_prohibited')
    expect(evaluation.blockers.map((item) => item.code)).toContain('visual_typography_style_rejected')
  })

  it('fails typography style evidence closed when its expiry passes', () => {
    const plan = passingPlan()
    plan.typography_style_receipt!.expires_at = '2026-10-19T11:59:59.000Z'
    const evaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(evaluation).toMatchObject({ status: 'unscored', approval_ready: false })
    expect(evaluation.blockers.map((item) => item.code)).toContain('visual_typography_style_unscored')
  })

  it('blocks a generic repeated template', () => {
    const plan = passingPlan()
    plan.beats[0].format = 'generic_standard_template'
    expect(evaluateCampaignVisualPlan(plan, NOW).blockers.map((item) => item.code)).toContain('visual_template_repetition')
  })

  it('blocks title and thumbnail duplication', () => {
    const plan = passingPlan()
    plan.thumbnails[0].teaser = plan.thumbnails[0].title
    expect(evaluateCampaignVisualPlan(plan, NOW).blockers.map((item) => item.code)).toContain('visual_thumbnail_copy_duplicate')
  })

  it('blocks missing product proof across LinkedIn and YouTube', () => {
    const plan = passingPlan()
    const proofIds = new Set(plan.exact_sources.filter((source) => source.kind === 'owned_product_screenshot').map((source) => source.source_id))
    plan.exact_sources = plan.exact_sources.filter((source) => !proofIds.has(source.source_id))
    plan.beats.forEach((beat) => { beat.source_ids = beat.source_ids.filter((id) => !proofIds.has(id)) })
    expect(evaluateCampaignVisualPlan(plan, NOW).blockers.map((item) => item.code)).toContain('visual_product_proof_missing')
  })

  it('blocks face-text overlap and feed-size failure', () => {
    const plan = passingPlan()
    plan.thumbnails[0].face_text_overlap = true
    plan.thumbnails[0].feed_size_legible = false
    expect(evaluateCampaignVisualPlan(plan, NOW).blockers.map((item) => item.code)).toContain('visual_thumbnail_composition')
  })

  it('blocks unsynchronized or unjustified repeated video assets', () => {
    const plan = passingPlan()
    const video = plan.beats.filter((beat) => beat.channel === 'youtube_long_form')
    video[1].start_seconds = video[1].end_seconds
    video[1].asset_href = video[0].asset_href
    video[1].repeated_asset_rationale = null
    expect(evaluateCampaignVisualPlan(plan, NOW).blockers.map((item) => item.code)).toContain('visual_motion_sync')
  })

  it('blocks overlapping scene windows even when each scene has a positive duration', () => {
    const plan = passingPlan()
    const video = plan.beats.filter((beat) => beat.channel === 'youtube_long_form')
    video[1].start_seconds = video[0].end_seconds! - 1
    expect(evaluateCampaignVisualPlan(plan, NOW).blockers.map((item) => item.code)).toContain('visual_motion_sync')
  })

  it('blocks incomplete or generic repeated cinematography', () => {
    const plan = passingPlan()
    const video = plan.beats.filter((beat) => beat.channel === 'youtube_long_form' || beat.channel === 'short_form')
    const repeated = structuredClone(video[0].cinematography!)
    repeated.shot_type = 'generic standard shot'
    video.forEach((beat) => { beat.cinematography = structuredClone(repeated) })
    const evaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(evaluation.blockers.map((item) => item.code)).toContain('visual_cinematography_contract')
    expect(evaluation.dimensions.find((item) => item.key === 'scene_cinematography')?.status).toBe('blocked')
  })

  it('blocks default or visually detached typography', () => {
    const plan = passingPlan()
    plan.thumbnails[0].typography.type_system = 'plain default font'
    plan.thumbnails[0].typography.composition_placement = 'pasted beside the image and detached from the focal subject'
    const evaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(evaluation.blockers.map((item) => item.code)).toContain('visual_typography_compositing')
    expect(evaluation.dimensions.find((item) => item.key === 'typography_compositing')?.status).toBe('blocked')
  })

  it('blocks internal workflow copy leakage', () => {
    const plan = passingPlan()
    plan.beats[0].customer_facing_copy = 'Synthetic fixture receipt for the review-only Decision Queue.'
    expect(evaluateCampaignVisualPlan(plan, NOW).blockers.map((item) => item.code)).toContain('visual_customer_copy_leak')
  })

  it('marks stale evidence Unscored and fails closed', () => {
    const plan = passingPlan()
    plan.exact_sources[0].fresh_until = '2026-10-19T11:59:59.000Z'
    const evaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(evaluation).toMatchObject({ status: 'unscored', approval_ready: false, overall_score: null })
    expect(evaluation.blockers.map((item) => item.code)).toContain('visual_evidence_unscored')
    expect(evaluation.dimensions.find((item) => item.key === 'evidence_coverage')).toMatchObject({ status: 'unscored', score: null })
  })

  it('does not pass a fabricated playlist similarity number without an attributable current receipt', () => {
    const plan = passingPlan()
    plan.benchmark_logic.playlist_similarity = {
      status: 'scored',
      score: 82,
      receipt_id: null,
      observed_at: null,
      fresh_until: null,
      numerator: 82,
      denominator: 100,
      formula: 'asserted constant',
    }
    const evaluation = evaluateCampaignVisualPlan(plan, NOW)
    expect(evaluation).toMatchObject({ status: 'unscored', approval_ready: false })
    expect(evaluation.blockers.map((item) => item.code)).toContain('visual_playlist_similarity_unscored')
  })

  it('scans the complete backlog deterministically without truncation and keeps weak candidates blocked', () => {
    const candidates = socialCampaignLongFormBatchQaCandidates()
    const first = projectCampaignVisualBatch(candidates, NOW)
    const second = projectCampaignVisualBatch([...candidates].reverse(), NOW)
    expect(first).toMatchObject({ total: 12, scanned: 12, prepared_count: 0, blocked_count: 12, remaining: 0, chunks_processed: 2 })
    expect(first.prepared).toEqual([])
    expect(first.blocked.map((entry) => entry.campaign_identity)).toEqual(expect.arrayContaining(['kicklab', 'reversr', 'kinflo']))
    expect(first.batch_id).toBe(second.batch_id)
    expect(campaignVisualBatchIdempotencyKey(first)).toBe(campaignVisualBatchIdempotencyKey(second))
  })
})
