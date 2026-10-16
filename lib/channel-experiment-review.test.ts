import { describe, expect, it } from 'vitest'
import {
  CHANNEL_EXPERIMENT_PACKET_IDS,
  CHANNEL_EXPERIMENT_REVIEWS,
  CHANNEL_EXPERIMENT_LINKEDIN_RECORD_IDS,
  CHANNEL_EXPERIMENT_SOCIAL_CONTENT_RECORD_IDS,
  CHANNEL_EXPERIMENT_SOCIAL_CONTENT_RECORDS,
  CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS,
  channelExperimentReviewForPacket,
  channelExperimentReviewForSocialContentId,
  channelExperimentSocialContentHref,
} from './channel-experiment-review'

describe('channel experiment review packets', () => {
  it('binds the approved three-packet scope to one shared evidence core and four channel-native variants each', () => {
    expect(Object.keys(CHANNEL_EXPERIMENT_REVIEWS).sort()).toEqual([...CHANNEL_EXPERIMENT_PACKET_IDS].sort())

    for (const packetId of CHANNEL_EXPERIMENT_PACKET_IDS) {
      const review = channelExperimentReviewForPacket(packetId)
      expect(review).not.toBeNull()
      expect(review?.linkedin).toHaveLength(2)
      expect(review?.youtube).toHaveLength(2)
      expect(new Set(review?.linkedin.map(variant => variant.hook))).toHaveProperty('size', 2)
      expect(new Set(review?.youtube.map(variant => variant.title))).toHaveProperty('size', 2)
      expect(review?.evidenceLinks.some(link => link.kind === 'research_packet' && link.href.includes(packetId))).toBe(true)
      expect(review?.evidenceLinks.some(link => link.kind === 'owned_proof')).toBe(true)
      expect(review?.approvedClaims.length).toBeGreaterThan(0)
      expect(review?.evidenceBoundary.length).toBeGreaterThan(0)
      expect(review?.uniqueVambahAngle.length).toBeGreaterThan(40)
      expect(review?.outlierBasis).toMatch(/cohort/i)
      expect(review?.originalityRisk).toMatch(/medium/i)
    }
  })

  it('keeps missing experiment evidence explicitly Unscored instead of converting it to zero', () => {
    for (const review of Object.values(CHANNEL_EXPERIMENT_REVIEWS)) {
      const unscored = review.scores.find(score => score.label === 'Variant performance')
      expect(unscored).toMatchObject({ value: null, input: 'No channel experiment has run yet' })
      expect(review.missingEvidence.some(item => /result|benchmark|cohort|receipt/i.test(item))).toBe(true)
      expect(review.formula).toMatch(/0\.50 x outlier/)
    }
  })

  it('does not expose packets outside the approved scope', () => {
    expect(channelExperimentReviewForPacket('packet-outside-approved-scope')).toBeNull()
  })

  it('binds the exact six authorized Social Content identities while specializing only the three YouTube records', () => {
    expect(CHANNEL_EXPERIMENT_SOCIAL_CONTENT_RECORD_IDS).toHaveLength(6)
    expect(CHANNEL_EXPERIMENT_LINKEDIN_RECORD_IDS).toHaveLength(3)
    expect(CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS).toHaveLength(3)
    expect(new Set(CHANNEL_EXPERIMENT_SOCIAL_CONTENT_RECORD_IDS).size).toBe(6)

    for (const record of CHANNEL_EXPERIMENT_SOCIAL_CONTENT_RECORDS) {
      if (record.channel === 'youtube') {
        expect(channelExperimentReviewForSocialContentId(record.id)?.variant.id).toBe(record.variantId)
        expect(channelExperimentSocialContentHref(record.variantId, 'test-commit')).toBe(
          `/admin/social-content/${record.id}?step=copy&qa_fixture=channel_experiment_social_detail_v1&rev=test-commit`,
        )
      } else {
        expect(channelExperimentReviewForSocialContentId(record.id)).toBeNull()
      }
    }
    expect(channelExperimentReviewForSocialContentId('licenses-yt-a')).toBeNull()
    expect(channelExperimentSocialContentHref('licenses-yt-b', 'test-commit')).toBeNull()
  })
})
