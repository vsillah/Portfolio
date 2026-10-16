import { describe, expect, it } from 'vitest'
import { CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS } from './channel-experiment-review'
import {
  channelExperimentSocialContentQaFixture,
  isChannelExperimentSocialContentId,
} from './social-channel-experiment-qa-fixture'

describe('channel experiment Social Content QA fixture', () => {
  it.each(CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS)('projects %s as a review-only YouTube record', (id) => {
    const item = channelExperimentSocialContentQaFixture(id)
    const packet = item.rag_context?.channel_experiment_review as Record<string, unknown>

    expect(item).toMatchObject({ id, platform: 'youtube', status: 'draft', target_platforms: ['youtube'] })
    expect(item.youtube_title).toBeTruthy()
    expect(item.youtube_description).toBeTruthy()
    expect(packet.opening_hook).toBeTruthy()
    expect(packet.outline).toHaveLength(4)
    expect(packet.thumbnail_brief).toBeTruthy()
    expect(packet.product_proof_requirements).toEqual(expect.arrayContaining([expect.any(String)]))
    expect(packet.evidence_lineage).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'research_packet' })]))
    expect(packet.scores).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Variant performance', value: null })]))
    expect(item.rag_context?.qa_fixture).toMatchObject({ read_only: true, kind: 'channel_experiment_social_detail_review' })
    expect(item.rag_context?.side_effects).toEqual(expect.objectContaining({
      production_write: false,
      provider_generation: false,
      rendering: false,
      upload: false,
      platform_draft: false,
      schedule: false,
      publish: false,
      external_send: false,
    }))
  })

  it('does not capture LinkedIn variants or unrelated Social Content rows', () => {
    expect(isChannelExperimentSocialContentId('licenses-li-a')).toBe(false)
    expect(isChannelExperimentSocialContentId('social-1')).toBe(false)
  })
})
