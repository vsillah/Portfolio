import production from '@/artifacts/review/approved-youtube-campaign-production-2026-10-19/receipt.json'
import descriptions from '@/artifacts/research/approved-youtube-campaign-descriptions-2026-10-19/receipt.json'
import darkCastleThumbnail from '@/artifacts/research/dark-castle-hero-thumbnail-candidates-2026-10-19/receipt.json'
import aiAuditThumbnail from '@/artifacts/research/ai-audit-hero-thumbnail-candidates-2026-10-19/receipt.json'

export const APPROVED_YOUTUBE_CAMPAIGN_PRODUCTION_VERSION = 'approved-youtube-campaign-production/v1' as const

type Packet = (typeof production.packets)[number]
type Cohort = (typeof descriptions.campaigns)[number]
type Source = Cohort['sources'][number]

const INTERNAL_SPEECH = /\b(?:fixture|sample data|synthetic|prompt instruction|source receipt|input version|review.only|qa note|provider gate|outlier score|thumbnail candidate|script intelligence)\b/i

function qualifyingDescriptionSource(source: Source, now: Date) {
  const components = source.performance_components
  const recomputed = Number((components.channel_relative_percentile * 0.5 + components.audience_view_percentile * 0.3 + components.recency_rate_percentile * 0.2).toFixed(2))
  const observedAt = Date.parse(source.observed_at)
  const retrievedAt = Date.parse(source.retrieved_at)
  const age = now.getTime() - observedAt
  let url: URL
  try { url = new URL(source.url) } catch { return false }
  return source.qualified
    && url.protocol === 'https:'
    && (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com')
    && Boolean(source.creator && source.title && source.topic_match && source.description_fingerprint?.startsWith('sha256:'))
    && source.description_capture === 'full_public_watch_metadata'
    && source.description_characters >= 120
    && source.channel_baseline_sample_size >= 4
    && source.channel_baseline_median_views > 0
    && source.view_count_at_observation >= 0
    && source.normalized_performance_score >= descriptions.minimum_outlier_score
    && Math.abs(recomputed - source.normalized_performance_score) <= 0.02
    && Number.isFinite(observedAt)
    && Number.isFinite(retrievedAt)
    && age >= 0
    && age <= descriptions.freshness_days * 86_400_000
    && retrievedAt >= observedAt
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
  if (packet.campaign_identity === 'dark-castle-chess' && packet.scenes.filter((scene) => scene.visual_role === 'first_party_product_capture' && scene.proof_href.includes('/welcome/media/')).length < 3) blockers.push('Dark Castle requires three real gameplay captures.')
  if (packet.campaign_identity === 'ai-audit-calculator' && !packet.scenes.some((scene) => scene.visual_role === 'first_party_product_capture' && scene.visual_asset === '/audit_calculator_img.png')) blockers.push('AI Audit requires the actual calculator screen.')
  if (Object.values(packet.external_gates).some(Boolean)) blockers.push('An excluded external action is enabled.')

  const eligible = cohort.sources.filter((source) => qualifyingDescriptionSource(source, now))
  if (new Set(cohort.sources.map((source) => source.source_id)).size !== cohort.sources.length || cohort.sources.length !== cohort.included_sample_size) blockers.push('Description source inventory is incomplete or duplicated.')
  const observed = Date.parse(cohort.observed_at)
  const freshUntil = Date.parse(cohort.fresh_until)
  const descriptionReady = cohort.campaign_identity === packet.campaign_identity
    && cohort.cohort_id === packet.description_cohort_id
    && Number.isFinite(observed)
    && Number.isFinite(freshUntil)
    && now.getTime() <= freshUntil
    && eligible.length >= descriptions.minimum_qualified_sources
  if (!descriptionReady) blockers.push(`Description cohort Unscored: ${eligible.length}/${descriptions.minimum_qualified_sources} qualifying full descriptions at score ≥ ${descriptions.minimum_outlier_score}, or evidence is stale.`)

  return {
    campaign_identity: packet.campaign_identity,
    status: blockers.length ? 'review_only_blocked' as const : 'ready_for_human_review' as const,
    description_status: descriptionReady ? 'ready' as const : 'unscored' as const,
    qualified_description_count: eligible.length,
    required_description_count: descriptions.minimum_qualified_sources,
    blockers,
  }
}

export function approvedYouTubeCampaignProductionReview(now = new Date()) {
  return {
    version: APPROVED_YOUTUBE_CAMPAIGN_PRODUCTION_VERSION,
    review_only: true as const,
    retrieved_at: descriptions.retrieved_at,
    description_formula: descriptions.formula,
    minimum_outlier_score: descriptions.minimum_outlier_score,
    packets: production.packets.map((packet) => {
      const cohort = descriptions.campaigns.find((entry) => entry.campaign_identity === packet.campaign_identity)!
      return { ...packet, description_cohort: cohort, evaluation: evaluateApprovedYouTubeCampaign(packet, cohort, now) }
    }),
  }
}
