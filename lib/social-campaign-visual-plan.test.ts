import { describe, expect, it } from 'vitest'
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
  it('builds a version-bound, channel-native KickLab plan with ten inspectable dimensions', () => {
    const projection = projectCampaignVisualPlan(socialCampaignPackageQaCandidates()[0], NOW)
    expect(projection.ready).toBe(true)
    expect(projection.plan?.beats.map((beat) => beat.channel)).toEqual(expect.arrayContaining(['linkedin', 'youtube_thumbnail', 'youtube_long_form', 'short_form']))
    expect(projection.plan?.beats.every((beat) => beat.copy_section_id && beat.copy_excerpt && beat.source_ids.length && beat.intended_takeaway)).toBe(true)
    expect(projection.plan?.exact_sources.some((source) => source.kind === 'owned_product_screenshot')).toBe(true)
    expect(projection.plan?.benchmark_logic).toMatchObject({ playlist_role: 'taste_only_zero_performance_weight', playlist_similarity: { status: 'unscored', score: null, receipt_id: null }, live_topic_score: 84, live_topic_threshold: 75 })
    expect(projection.evaluation).toMatchObject({ status: 'passed', approval_ready: true })
    expect(projection.evaluation.dimensions).toHaveLength(10)
    expect(projection.evaluation.dimensions.every((dimension) => dimension.status === 'passed' && typeof dimension.score === 'number')).toBe(true)
    expect(projection.evaluation.dimensions.every((dimension) => dimension.score === Math.round((dimension.calculation.numerator! / dimension.calculation.denominator!) * 100))).toBe(true)
    expect(projection.evaluation.overall_score).toBe(Math.round(projection.evaluation.dimensions.reduce((sum, dimension) => sum + dimension.score!, 0) / projection.evaluation.dimensions.length))
    expect(new Set(Object.values(projection.plan!.external_gates))).toEqual(new Set([false]))
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
    expect(first).toMatchObject({ total: 12, scanned: 12, prepared_count: 1, blocked_count: 11, remaining: 0, chunks_processed: 2 })
    expect(first.prepared.map((entry) => entry.campaign_identity)).toEqual(['kicklab'])
    expect(first.blocked.map((entry) => entry.campaign_identity)).toEqual(expect.arrayContaining(['reversr', 'kinflo']))
    expect(first.batch_id).toBe(second.batch_id)
    expect(campaignVisualBatchIdempotencyKey(first)).toBe(campaignVisualBatchIdempotencyKey(second))
  })
})
