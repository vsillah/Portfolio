import { describe, expect, it } from 'vitest'
import {
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

    expect(Object.keys(lanes)).toEqual(['linkedin', 'youtube_shorts', 'instagram_reels', 'thumbnail'])
    expect(lanes.linkedin.status).toBe('selected')
    expect(lanes.youtube_shorts.status).toBe('not_started')
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
})
