import { describe, expect, it } from 'vitest'
import darkCastleSourcePacket from '@/artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/cohort.json'
import { approvedYouTubeCampaignProductionReview, assessApprovedYouTubeDescriptionCohort } from './approved-youtube-campaign-production'

const NOW = new Date('2026-10-20T18:00:00.000Z')
const SOURCE_PACKET_PATH = 'artifacts/research/dark-castle-chess-youtube-thumbnail-cohort-2026-10-18/cohort.json'

function currentCohort() {
  return structuredClone(approvedYouTubeCampaignProductionReview(NOW).packets[0].description_cohort)
}

function syntheticThreeOfEight() {
  const cohort = currentCohort()
  const sourcePacket = structuredClone(darkCastleSourcePacket)
  const channelRanks = [8, 5, 7, 6, 4, 3, 2, 1]
  const audienceRanks = [7, 5, 6, 8, 4, 3, 2, 1]
  const recencyRanks = [6, 5, 8, 7, 4, 3, 2, 1]
  for (const [index, sample] of sourcePacket.included.entries()) {
    const source = cohort.sources[index]
    const channel = channelRanks[index]
    const audience = audienceRanks[index]
    const recency = recencyRanks[index]
    const baseline = 8400 / channel
    sample.view_count = source.view_count_at_observation = 8400
    sample.subscriber_count = source.subscriber_count_at_observation = 8400 / audience
    sample.channel_baseline.sample_size = source.channel_baseline_sample_size = 4
    sample.channel_baseline.exact_view_counts = Array(4).fill(baseline)
    sample.channel_baseline.video_ids = ['baseline-a', 'baseline-b', 'baseline-c', 'baseline-d']
    sample.channel_baseline.median_view_count = source.channel_baseline_median_views = baseline
    sample.channel_relative_ratio = channel
    sample.audience_view_ratio = audience
    sample.recency_adjusted_views_per_day = recency
    sample.age_days = 8400 / recency
    sample.published_at = source.published_at = new Date(Date.parse(cohort.observed_at) - sample.age_days * 86_400_000).toISOString()
    const components = {
      channel_relative_percentile: (channel - 0.5) * 12.5,
      audience_view_percentile: (audience - 0.5) * 12.5,
      recency_rate_percentile: (recency - 0.5) * 12.5,
    }
    sample.performance_components = source.performance_components = components
    sample.normalized_performance_score = source.normalized_performance_score = Number((components.channel_relative_percentile * 0.5 + components.audience_view_percentile * 0.3 + components.recency_rate_percentile * 0.2).toFixed(2))
    sample.outlier_qualified = source.qualified = sample.normalized_performance_score >= 75 && Boolean(source.description_text)
    source.exclusion_reason = source.qualified ? null : source.description_text ? 'below_recorded_outlier_threshold' : 'full_description_unavailable'
  }
  cohort.qualified_description_count = 3
  cohort.status = 'ready'
  return { cohort, sourcePacket }
}

describe('approved YouTube description evidence', () => {
  it('preserves 1/3 per campaign from the attributable live recheck', () => {
    const review = approvedYouTubeCampaignProductionReview(NOW)
    expect(review.packets.map((packet) => packet.evaluation.qualified_description_count)).toEqual([1, 1])
    expect(review.packets.map((packet) => packet.evaluation.description_status)).toEqual(['unscored', 'unscored'])
  })

  it('rejects a duplicate video identity and URL', () => {
    const { cohort, sourcePacket } = syntheticThreeOfEight()
    cohort.sources[2].source_id = cohort.sources[0].source_id
    cohort.sources[2].url = cohort.sources[0].url
    const result = assessApprovedYouTubeDescriptionCohort(cohort, sourcePacket, NOW, SOURCE_PACKET_PATH)
    expect(result.inventoryValid).toBe(false)
    expect(result.ready).toBe(false)
  })

  it('rejects stale observations, unavailable descriptions, and below-threshold scores', () => {
    const cohort = currentCohort()
    const stale = assessApprovedYouTubeDescriptionCohort(cohort, darkCastleSourcePacket, new Date('2026-11-02T00:00:00.000Z'), SOURCE_PACKET_PATH)
    expect(stale.eligibleCount).toBe(0)
    expect(stale.ready).toBe(false)
    expect(cohort.sources.find((source) => source.source_id === 'Reza8udb47Y')).toMatchObject({ description_text: null, qualified: false, exclusion_reason: 'full_description_unavailable' })
    expect(cohort.sources.find((source) => source.source_id === '8xrELvz0dCI')).toMatchObject({ qualified: false, normalized_performance_score: 66.25, exclusion_reason: 'below_recorded_outlier_threshold' })
  })

  it('recomputes scores from the source cohort and the full description fingerprint', () => {
    const cohort = currentCohort()
    cohort.sources[0].performance_components.channel_relative_percentile = 100
    cohort.sources[0].normalized_performance_score = 91.88
    expect(assessApprovedYouTubeDescriptionCohort(cohort, darkCastleSourcePacket, NOW, SOURCE_PACKET_PATH).eligibleCount).toBe(0)
    const alteredDescription = currentCohort()
    alteredDescription.sources[0].description_text += ' altered'
    expect(assessApprovedYouTubeDescriptionCohort(alteredDescription, darkCastleSourcePacket, NOW, SOURCE_PACKET_PATH).eligibleCount).toBe(0)
  })

  it('opens the description gate at exactly three distinct complete sources and closes at two', () => {
    const { cohort, sourcePacket } = syntheticThreeOfEight()
    expect(assessApprovedYouTubeDescriptionCohort(cohort, sourcePacket, NOW, SOURCE_PACKET_PATH)).toMatchObject({ eligibleCount: 3, inventoryValid: true, ready: true })
    cohort.sources[2].description_text = null
    cohort.qualified_description_count = 2
    cohort.status = 'unscored'
    expect(assessApprovedYouTubeDescriptionCohort(cohort, sourcePacket, NOW, SOURCE_PACKET_PATH)).toMatchObject({ eligibleCount: 2, inventoryValid: true, ready: false })
  })
})
