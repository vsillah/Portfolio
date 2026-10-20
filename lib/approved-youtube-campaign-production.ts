import { createHash } from 'node:crypto'
import production from '@/artifacts/review/approved-youtube-campaign-production-2026-10-19/receipt.json'
import descriptions from '@/artifacts/research/approved-youtube-campaign-descriptions-2026-10-19/receipt.json'
import darkCastleCohort from '@/artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/cohort.json'
import aiAuditCohort from '@/artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/cohort.json'
import darkCastleThumbnail from '@/artifacts/research/dark-castle-hero-thumbnail-candidates-2026-10-19/receipt.json'
import aiAuditThumbnail from '@/artifacts/research/ai-audit-hero-thumbnail-candidates-2026-10-19/receipt.json'
import darkCastleSource from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/dark_castle_chess.json'

export const APPROVED_YOUTUBE_CAMPAIGN_PRODUCTION_VERSION = 'approved-youtube-campaign-production/v1' as const
const MIN_QUALIFIED_DESCRIPTIONS = Math.max(3, descriptions.minimum_qualified_sources)
const MIN_OUTLIER_SCORE = Math.max(75, descriptions.minimum_outlier_score)
const MAX_FRESHNESS_DAYS = Math.min(14, descriptions.freshness_days)

type Packet = (typeof production.packets)[number]
type Cohort = (typeof descriptions.campaigns)[number]
type Source = Cohort['sources'][number]
type IncludedSample = (typeof darkCastleCohort.included)[number] | (typeof aiAuditCohort.included)[number]

const INTERNAL_SPEECH = /\b(?:fixture|sample data|synthetic|prompt instruction|source receipt|input version|review.only|qa note|provider gate|outlier score|thumbnail candidate|script intelligence)\b/i

function percentile(value: number, values: number[]) {
  const lower = values.filter((candidate) => candidate < value).length
  const equal = values.filter((candidate) => candidate === value).length
  return Number((((lower + equal * 0.5) / values.length) * 100).toFixed(2))
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function qualifyingDescriptionSource(source: Source, sample: IncludedSample | undefined, samples: IncludedSample[], now: Date) {
  if (!sample || !samples.length) return false
  const components = source.performance_components
  const recomputed = Number((components.channel_relative_percentile * 0.5 + components.audience_view_percentile * 0.3 + components.recency_rate_percentile * 0.2).toFixed(2))
  const expectedComponents = {
    channel_relative_percentile: percentile(sample.channel_relative_ratio, samples.map((entry) => entry.channel_relative_ratio)),
    audience_view_percentile: percentile(sample.audience_view_ratio, samples.map((entry) => entry.audience_view_ratio)),
    recency_rate_percentile: percentile(sample.recency_adjusted_views_per_day, samples.map((entry) => entry.recency_adjusted_views_per_day)),
  }
  const expectedScore = Number((expectedComponents.channel_relative_percentile * 0.5 + expectedComponents.audience_view_percentile * 0.3 + expectedComponents.recency_rate_percentile * 0.2).toFixed(2))
  const observedAt = Date.parse(source.observed_at)
  const retrievedAt = Date.parse(source.retrieved_at)
  const descriptionRetrievedAt = Date.parse(source.description_retrieved_at)
  const age = now.getTime() - observedAt
  const description = source.description_text
  const descriptionHash = typeof description === 'string' ? `sha256:${createHash('sha256').update(description).digest('hex')}` : null
  const descriptionCharacters = typeof description === 'string' ? [...description].length : 0
  const descriptionParagraphs = typeof description === 'string' ? description.split(/\r?\n/).filter((line) => line.trim()).length : 0
  let url: URL
  try { url = new URL(source.url) } catch { return false }
  return source.qualified
    && url.protocol === 'https:'
    && (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com')
    && url.pathname === '/watch'
    && url.searchParams.get('v') === source.source_id
    && sample.video_id === source.source_id
    && sample.youtube_url === source.url
    && sample.title === source.title
    && sample.creator === source.creator
    && sample.published_at === source.published_at
    && sample.observed_at === source.observed_at
    && sample.duration_seconds >= 180
    && sample.outlier_qualified
    && sample.view_count === source.view_count_at_observation
    && sample.subscriber_count === source.subscriber_count_at_observation
    && sample.channel_baseline.sample_size === source.channel_baseline_sample_size
    && median(sample.channel_baseline.exact_view_counts) === source.channel_baseline_median_views
    && sample.channel_baseline.exact_view_counts.length === sample.channel_baseline.sample_size
    && Boolean(source.creator && source.title && source.topic_match && source.description_fingerprint?.startsWith('sha256:'))
    && source.description_capture === 'full_public_watch_metadata'
    && source.description_source_field === 'ytInitialPlayerResponse.videoDetails.shortDescription'
    && descriptionHash === source.description_fingerprint
    && descriptionCharacters === source.description_characters
    && descriptionParagraphs === source.description_paragraphs
    && source.description_characters >= 120
    && source.channel_baseline_sample_size >= 4
    && source.channel_baseline_median_views > 0
    && source.view_count_at_observation >= 0
    && Math.abs(sample.channel_relative_ratio - sample.view_count / source.channel_baseline_median_views) <= 0.0001
    && Math.abs(sample.audience_view_ratio - sample.view_count / sample.subscriber_count) <= 0.0001
    && Math.abs(sample.recency_adjusted_views_per_day - sample.view_count / Math.max(sample.age_days, 1)) <= 0.02
    // YouTube's public publishDate is day-precision; the captured age may use the full upload timestamp.
    && Math.abs(sample.age_days - Math.max(1, (observedAt - Date.parse(sample.published_at)) / 86_400_000)) <= 1
    && Object.entries(expectedComponents).every(([key, value]) => Math.abs(value - components[key as keyof typeof components]) <= 0.02)
    && Math.abs(expectedScore - recomputed) <= 0.02
    && Math.abs(expectedScore - sample.normalized_performance_score) <= 0.02
    && source.normalized_performance_score >= MIN_OUTLIER_SCORE
    && Math.abs(recomputed - source.normalized_performance_score) <= 0.02
    && Number.isFinite(observedAt)
    && Number.isFinite(retrievedAt)
    && age >= 0
    && age < MAX_FRESHNESS_DAYS * 86_400_000
    && retrievedAt >= observedAt
    && Number.isFinite(descriptionRetrievedAt)
    && descriptionRetrievedAt >= observedAt
    && descriptionRetrievedAt <= now.getTime()
}

export function assessApprovedYouTubeDescriptionCohort(
  cohort: Cohort,
  sourcePacket: typeof darkCastleCohort | typeof aiAuditCohort,
  now: Date,
  expectedSourcePacket: string,
) {
  const samples: IncludedSample[] = sourcePacket.included
  const samplesById = new Map(samples.map((sample) => [sample.video_id, sample]))
  const seen = new Set<string>()
  const eligible = cohort.sources.filter((source) => {
    if (seen.has(source.source_id)) return false
    seen.add(source.source_id)
    return qualifyingDescriptionSource(source, samplesById.get(source.source_id), samples, now)
  })
  const inventoryValid = new Set(cohort.sources.map((source) => source.source_id)).size === cohort.sources.length
    && new Set(cohort.sources.map((source) => source.url)).size === cohort.sources.length
    && cohort.sources.length === cohort.included_sample_size
    && cohort.sources.length === samples.length
    && cohort.source_packet === expectedSourcePacket
    && sourcePacket.status === 'approved'
    && sourcePacket.selection_gate.ready
    && samples.some((sample) => !seen.has(sample.video_id)) === false
  const observed = Date.parse(cohort.observed_at)
  const freshUntil = Date.parse(cohort.fresh_until)
  const ready = inventoryValid
    && cohort.cohort_id === sourcePacket.cohort_id
    && Number.isFinite(observed)
    && Number.isFinite(freshUntil)
    && observed === Date.parse(sourcePacket.observed_at)
    && freshUntil - observed <= MAX_FRESHNESS_DAYS * 86_400_000
    && now.getTime() < freshUntil
    && cohort.qualified_description_count === eligible.length
    && cohort.status === (eligible.length >= MIN_QUALIFIED_DESCRIPTIONS ? 'ready' : 'unscored')
    && eligible.length >= MIN_QUALIFIED_DESCRIPTIONS
  return { eligibleCount: eligible.length, inventoryValid, ready }
}

export function evaluateApprovedYouTubeCampaign(packet: Packet, cohort: Cohort, now = new Date()) {
  const blockers: string[] = []
  const selection = packet.campaign_identity === 'dark-castle-chess'
    ? darkCastleThumbnail.selection_decision
    : aiAuditThumbnail.selection_decision

  if (packet.version !== APPROVED_YOUTUBE_CAMPAIGN_PRODUCTION_VERSION) blockers.push('Unsupported production packet version.')
  if (packet.content_version !== selection.content_version || packet.selected_thumbnail_id !== selection.selected_candidate_id || packet.selection_receipt_id !== selection.receipt_id) blockers.push('Thumbnail selection is not bound to the exact approved content version and decision receipt.')
  if (packet.rejected_thumbnail_id === packet.selected_thumbnail_id || !selection.rejected_candidates.some((candidate) => candidate.candidate_id === packet.rejected_thumbnail_id)) blockers.push('Rejected Candidate B must remain ineligible.')
  if (packet.title.trim() === packet.thumbnail_teaser.trim()) blockers.push('Video title and thumbnail teaser must remain distinct.')
  if (packet.script_framework_version !== 'long-form-script-intelligence-v2' || packet.expected_duration_seconds < 480 || packet.expected_duration_seconds > 720 || packet.script_word_count < 1000) blockers.push('The narration does not meet the versioned long-form contract.')
  const retention = packet.retention_plan
  if (!retention.first_30_seconds || retention.open_loop_seconds[1] > 30 || retention.re_hook_seconds.length < 2 || retention.proof_placement_seconds.length < 3 || retention.pattern_interrupt_seconds.length < 4 || retention.payoff_seconds >= packet.expected_duration_seconds || retention.spoken_conclusion_seconds >= packet.expected_duration_seconds || retention.spoken_cta_seconds >= packet.expected_duration_seconds) blockers.push('The first 30 seconds, re-hooks, proof placement, payoff or spoken close are not mapped to the long-form framework.')
  if (packet.scenes.length < 8 || packet.scenes.some((scene, index) => scene.start_seconds !== index * 60 || scene.end_seconds !== (index + 1) * 60 || !scene.shot_framing || !scene.camera_angle || !scene.camera_movement || !scene.presenter_staging || !scene.pattern_interrupt || !scene.audio_cue || !scene.transition || scene.asset_timing.lead_in_seconds !== scene.start_seconds || scene.asset_timing.lead_out_seconds !== scene.end_seconds)) blockers.push('The timed cinematography or audio cue sheet is incomplete.')
  if (packet.scenes.some((scene, index) => index > 0 && scene.visual_asset === packet.scenes[index - 1].visual_asset)) blockers.push('Adjacent scenes repeat the same lead visual.')
  if (packet.scenes.some((scene) => INTERNAL_SPEECH.test(scene.narration) || /\([^)]*\)/.test(scene.narration))) blockers.push('Customer-facing narration contains internal production language or a parenthetical aside.')
  if (!/subscribe to AmaduTown/i.test(packet.scenes.at(-1)?.narration ?? '') || !packet.spoken_conclusion || !packet.spoken_cta) blockers.push('A spoken conclusion and channel CTA are required.')
  if (packet.scenes.some((scene) => !scene.proof_asset_id || !scene.proof_href || !scene.source_receipt_id || !scene.privacy_receipt_id || !scene.rights_receipt_id)) blockers.push('Every scene must bind first-party proof and privacy and rights receipts.')
  const lineageValid = packet.scenes.every((scene) => {
    if (packet.campaign_identity === 'dark-castle-chess') {
      const proof = darkCastleSource.evidence_assets.find((asset) => asset.asset_id === scene.proof_asset_id)
      return Boolean(proof && scene.proof_href === proof.reference && proof.source_receipt_ids.includes(scene.source_receipt_id) && scene.privacy_receipt_id === proof.privacy_receipt_id && scene.rights_receipt_id === proof.rights_receipt_id)
    }
    const proof = aiAuditThumbnail.product_proof
    return scene.proof_href === proof.public_path
      && proof.source_receipt_ids.includes(scene.source_receipt_id)
      && scene.privacy_receipt_id === proof.privacy_receipt_id
      && proof.rights_receipt_ids.includes(scene.rights_receipt_id)
  })
  if (!lineageValid) blockers.push('Scene proof lineage does not match the approved product evidence receipts.')
  if (packet.campaign_identity === 'dark-castle-chess' && packet.scenes.filter((scene) => scene.visual_role === 'first_party_product_capture' && scene.proof_href.includes('/welcome/media/')).length < 3) blockers.push('Dark Castle requires three real gameplay captures.')
  if (packet.campaign_identity === 'ai-audit-calculator' && !packet.scenes.some((scene) => scene.visual_role === 'first_party_product_capture' && scene.visual_asset === '/audit_calculator_img.png')) blockers.push('AI Audit requires the actual calculator screen.')
  if (Object.values(packet.external_gates).some(Boolean)) blockers.push('An excluded external action is enabled.')

  const sourcePacket = packet.campaign_identity === 'dark-castle-chess' ? darkCastleCohort : aiAuditCohort
  const assessment = assessApprovedYouTubeDescriptionCohort(cohort, sourcePacket, now, packet.campaign_identity === 'dark-castle-chess'
    ? 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/cohort.json'
    : 'artifacts/research/ai-audit-calculator-youtube-thumbnail-cohort-2026-10-18/cohort.json')
  if (!assessment.inventoryValid) blockers.push('Description source inventory is incomplete or duplicated.')
  const descriptionReady = cohort.campaign_identity === packet.campaign_identity
    && cohort.cohort_id === packet.description_cohort_id
    && assessment.ready
  if (!descriptionReady) blockers.push(`Description cohort Unscored: ${assessment.eligibleCount}/${MIN_QUALIFIED_DESCRIPTIONS} qualifying full descriptions at score ≥ ${MIN_OUTLIER_SCORE}, or evidence is stale.`)

  return {
    campaign_identity: packet.campaign_identity,
    status: blockers.length ? 'review_only_blocked' as const : 'ready_for_human_review' as const,
    description_status: descriptionReady ? 'ready' as const : 'unscored' as const,
    qualified_description_count: assessment.eligibleCount,
    required_description_count: MIN_QUALIFIED_DESCRIPTIONS,
    blockers,
  }
}

export function approvedYouTubeCampaignProductionReview(now = new Date()) {
  return {
    version: APPROVED_YOUTUBE_CAMPAIGN_PRODUCTION_VERSION,
    review_only: true as const,
    retrieved_at: descriptions.retrieved_at,
    description_formula: descriptions.formula,
    minimum_outlier_score: MIN_OUTLIER_SCORE,
    packets: production.packets.map((packet) => {
      const cohort = descriptions.campaigns.find((entry) => entry.campaign_identity === packet.campaign_identity)!
      return { ...packet, description_cohort: cohort, evaluation: evaluateApprovedYouTubeCampaign(packet, cohort, now) }
    }),
  }
}
