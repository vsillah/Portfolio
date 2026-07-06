import { describe, expect, it } from 'vitest'
import {
  buildLinkedInYoutubeReviewDrafts,
  defaultSocialChannelLanes,
  normalizeSocialChannelLanes,
  scoreCreatorAsset,
  socialTopicBacklogItemFromWorkItem,
} from './social-content-intelligence'
import type { AgentWorkItem } from './agent-work-items'

describe('social-content-intelligence', () => {
  it('scores creator assets deterministically with a small-creator outlier boost', () => {
    const score = scoreCreatorAsset({
      views: 120_000,
      likes: 8_000,
      comments: 900,
      shares: 400,
      follower_count: 20_000,
      published_at: '2026-06-20T12:00:00.000Z',
      retrieved_at: '2026-06-22T12:00:00.000Z',
      channel_relative_performance: 2.4,
      strategic_fit: 0.9,
    })

    expect(score).toEqual({
      outlier_score: 80,
      view_to_follower_ratio: 6,
      engagement_rate: 0.0775,
      comment_density: 0.0075,
      recency_score: 0.9333,
      channel_relative_performance: 2.4,
      small_creator_outlier_boost: 1,
      strategic_fit: 0.9,
    })
  })

  it('normalizes all channel lanes required for social production', () => {
    const lanes = normalizeSocialChannelLanes({
      linkedin: { status: 'selected', decision_note: 'Use as first channel.' },
    })

    expect(Object.keys(lanes)).toEqual(['linkedin', 'youtube_shorts', 'instagram_reels', 'tiktok', 'thumbnail'])
    expect(lanes.linkedin.status).toBe('selected')
    expect(lanes.youtube_shorts.status).toBe('not_started')
    expect(lanes.tiktok.required_inputs).toContain('audio rights')
    expect(lanes.thumbnail.required_inputs).toContain('2-3 variants')
  })

  it('maps central work items into the legacy Social Content topic shape', () => {
    const item = {
      id: 'work-social-1',
      title: 'Approval gates create trust',
      objective: 'Make the case for governed AI work.',
      status: 'proposed',
      priority: 'high',
      owner_agent_key: 'chief-of-staff',
      owner_runtime: 'codex',
      source_type: 'social_topic_trigger',
      source_id: 'approval-gates-create-trust',
      source_label: 'Shaka topic trigger',
      source_run_id: null,
      active_run_id: null,
      parent_work_item_id: null,
      branch_name: null,
      worktree_path: null,
      pr_number: null,
      pr_url: null,
      expected_files: [],
      touched_files: [],
      overlap_group: null,
      dependency_ids: [],
      blocker_summary: null,
      validation_summary: null,
      approval_id: null,
      metadata: {
        social_topic_trigger: true,
        channel_lanes: defaultSocialChannelLanes(),
        insight: {
          title: 'Approval gates create trust',
          triggering_event: 'A recent shipped feature made the approval path visible.',
          why_vambah_can_speak: 'Vambah built the system and reviewed the gates.',
          claim_boundaries: ['Do not imply every workflow is automated.'],
        },
      },
      idempotency_key: 'social-topic-trigger:approval-gates-create-trust',
      created_at: '2026-06-22T12:00:00.000Z',
      updated_at: '2026-06-22T12:00:00.000Z',
      completed_at: null,
    } satisfies AgentWorkItem

    const mapped = socialTopicBacklogItemFromWorkItem(item)

    expect(mapped.id).toBe('work-social-1')
    expect(mapped.agent_work_item_id).toBe('work-social-1')
    expect(mapped.title).toBe('Approval gates create trust')
    expect(mapped.claim_boundaries).toEqual(['Do not imply every workflow is automated.'])
  })

  it('builds channel review drafts from the same source while adapting fields by channel', () => {
    const drafts = buildLinkedInYoutubeReviewDrafts({
      generatedAt: '2026-06-24T15:00:00.000Z',
      insight: {
        title: 'Approval gates create trust',
        triggering_event: 'The Social Content review flow made the gate visible.',
        why_vambah_can_speak: 'Vambah built and reviewed the workflow.',
        evidence_summary: 'The work item links public research, channel drafts, and human decisions.',
        content_angle: 'AI should reduce burden when receipts and approval gates are visible.',
        suggested_hook: 'AI should reduce burden.',
        claim_boundaries: ['Do not claim external publishing is automated.'],
        approved_research_patterns: [
          {
            source_url: 'https://youtube.com/watch?v=abc',
            platform: 'youtube',
            creator_name: 'Useful outlier',
            pattern_status: 'usable_framework',
            pattern_packet: {
              hook_structure: 'Start with the missed approval gate.',
              promise_value: 'Show the operating layer behind the content.',
            },
          },
        ],
      },
    })

    expect(drafts.linkedin.shared_source).toEqual(drafts.youtube_shorts.shared_source)
    expect(drafts.linkedin.shared_source).toEqual({
      insight_title: 'Approval gates create trust',
      triggering_event: 'The Social Content review flow made the gate visible.',
      content_angle: 'AI should reduce burden when receipts and approval gates are visible.',
      evidence_summary: 'The work item links public research, channel drafts, and human decisions.',
    })
    expect(drafts.linkedin.fields).toMatchObject({
      post_text: expect.stringContaining('The Social Content review flow made the gate visible.'),
      cta: expect.stringContaining('Where have you seen AI'),
      visual_mode: 'carousel_or_framework_illustration_review',
    })
    expect(drafts.youtube_shorts.fields).toMatchObject({
      hook: 'AI should reduce burden.',
      first_30_seconds: expect.stringContaining('I noticed this through the social content review flow'),
      target_duration_seconds: 45,
      render_readiness: 'pending_human_approval',
    })
    expect(drafts.instagram_reels.fields).toMatchObject({
      hook: 'AI should reduce burden.',
      cover_text: expect.any(String),
      safe_area_notes: expect.arrayContaining([
        expect.stringContaining('9:16 vertical framing'),
      ]),
      export_readiness: 'pending_human_approval',
    })
    expect(drafts.tiktok.fields).toMatchObject({
      hook: 'AI should reduce burden.',
      cover_frame: expect.any(String),
      audio_rights: expect.stringContaining('platform-safe audio'),
      safe_area_notes: expect.arrayContaining([
        expect.stringContaining('TikTok controls'),
      ]),
      export_readiness: 'pending_human_approval',
    })
    expect(drafts.linkedin.fields).not.toHaveProperty('first_30_seconds')
    expect(drafts.youtube_shorts.fields).not.toHaveProperty('post_text')
    expect(drafts.linkedin.side_effects).toEqual({
      provider_generation: false,
      upload: false,
      publish: false,
      schedule: false,
      external_post: false,
    })
    expect(drafts.youtube_shorts.side_effects).toEqual(drafts.linkedin.side_effects)
    expect(drafts.instagram_reels.side_effects).toEqual(drafts.linkedin.side_effects)
    expect(drafts.tiktok.side_effects).toEqual(drafts.linkedin.side_effects)
  })
})
