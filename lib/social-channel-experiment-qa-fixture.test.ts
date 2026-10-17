import { describe, expect, it } from 'vitest'
import {
  CHANNEL_EXPERIMENT_LINKEDIN_RECORD_IDS,
  CHANNEL_EXPERIMENT_YOUTUBE_RECORD_IDS,
} from './channel-experiment-review'
import {
  YOUTUBE_DESCRIPTION_COMPLETION_QA_ID,
  channelExperimentSocialContentQaFixture,
  isChannelExperimentSocialContentId,
  youtubeDescriptionCompletionQaFixture,
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

  it.each(CHANNEL_EXPERIMENT_LINKEDIN_RECORD_IDS)('projects %s through the ordinary read-only LinkedIn control path', (id) => {
    const item = channelExperimentSocialContentQaFixture(id)
    expect(item).toMatchObject({ id, platform: 'linkedin', status: 'draft', target_platforms: ['linkedin'] })
    expect(item.youtube_title).toBeNull()
    expect(item.youtube_description).toBeNull()
    expect(item.rag_context?.qa_fixture).toMatchObject({ read_only: true, kind: 'channel_experiment_linkedin_control' })
    expect(item.rag_context?.channel_experiment_review).toBeUndefined()
    expect(item.rag_context?.side_effects).toEqual(expect.objectContaining({
      production_read: false,
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

  it('does not capture variant slugs or unrelated Social Content rows', () => {
    expect(isChannelExperimentSocialContentId('licenses-li-b')).toBe(false)
    expect(isChannelExperimentSocialContentId('licenses-yt-a')).toBe(false)
    expect(isChannelExperimentSocialContentId('social-1')).toBe(false)
  })

  it('projects the repaired Jev description and evidence as a read-only QA record', () => {
    const item = youtubeDescriptionCompletionQaFixture(YOUTUBE_DESCRIPTION_COMPLETION_QA_ID)
    const evidence = item.rag_context?.description_outlier_evidence as Record<string, unknown>

    expect(item).toMatchObject({ platform: 'youtube', status: 'draft', target_platforms: ['youtube'] })
    expect(item.youtube_description).toContain('The model kept choosing.')
    expect(evidence).toMatchObject({ status: 'ready', release_readiness: 'ready', minimum_source_count: 3, minimum_outlier_score: 65 })
    expect(evidence.sources).toHaveLength(3)
    expect(item.rag_context?.qa_fixture).toMatchObject({ read_only: true, kind: 'youtube_description_completion_review' })
    expect(item.rag_context?.side_effects).toEqual(expect.objectContaining({
      provider_call: false,
      render: false,
      upload: false,
      platform_draft: false,
      schedule: false,
      publish: false,
      external_send: false,
    }))
  })
})
