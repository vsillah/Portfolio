import { describe, expect, it } from 'vitest'
import {
  SOCIAL_RESEARCH_ACTORS,
  apifyInputForResearchSource,
  buildLinkedInYoutubeReviewDrafts,
  defaultSocialChannelLanes,
  normalizeResearchActorKey,
  normalizeSocialChannelLanes,
  researchPacketDraftFromApifyItem,
  researchPacketDraftFromRecordedEvidence,
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

  it('selects research actors from source URLs and builds their required Apify inputs', () => {
    expect(normalizeResearchActorKey(null, 'https://youtube.com/watch?v=abc')).toBe('youtube_transcript')
    expect(normalizeResearchActorKey(null, 'https://instagram.com/reel/abc')).toBe('instagram_reel')
    expect(normalizeResearchActorKey(null, 'https://instagram.com/p/abc')).toBe('instagram_post')
    expect(normalizeResearchActorKey(null, 'https://tiktok.com/@creator/video/123')).toBe('tiktok_video')

    expect(apifyInputForResearchSource(
      { url: 'https://youtube.com/watch?v=abc' },
      SOCIAL_RESEARCH_ACTORS.youtube_transcript,
    )).toEqual({
      videoUrls: ['https://youtube.com/watch?v=abc'],
      urls: ['https://youtube.com/watch?v=abc'],
      url: 'https://youtube.com/watch?v=abc',
    })
    expect(apifyInputForResearchSource(
      { url: 'https://instagram.com/reel/abc' },
      SOCIAL_RESEARCH_ACTORS.instagram_reel,
    )).toEqual({
      resultsLimit: 10,
      directUrls: ['https://instagram.com/reel/abc'],
      startUrls: [{ url: 'https://instagram.com/reel/abc' }],
    })
  })

  it('normalizes alternate Apify result fields into a source-safe research packet', () => {
    const packet = researchPacketDraftFromApifyItem({
      source: {
        url: 'https://instagram.com/reel/fallback',
        actor_key: 'instagram_reel',
        label: 'Public reel',
      },
      config: SOCIAL_RESEARCH_ACTORS.instagram_reel,
      item: {
        videoUrl: 'https://instagram.com/reel/actual',
        title: 'A practical operating system for trustworthy AI',
        description: 'Visible approval gates reduce hidden operational risk.',
        transcript: 'Start with the operating risk. '.repeat(30),
        displayUrl: 'https://cdn.example.com/thumbnail.jpg',
        playCount: 4_500,
        likeCount: 230,
        commentCount: 31,
        shareCount: 9,
        followers: 900,
        timestamp: '2026-07-15T10:00:00.000Z',
        username: 'operator',
      },
      actorRun: {
        id: 'run-1',
        defaultDatasetId: 'dataset-1',
      },
      retrievedAt: '2026-07-16T10:00:00.000Z',
    })

    expect(packet).toMatchObject({
      source_url: 'https://instagram.com/reel/actual',
      platform: 'instagram_reels',
      creator_handle: 'operator',
      thumbnail_url: 'https://cdn.example.com/thumbnail.jpg',
      metrics: {
        views: 4_500,
        likes: 230,
        comments: 31,
        shares: 9,
        follower_count: 900,
        published_at: '2026-07-15T10:00:00.000Z',
        retrieved_at: '2026-07-16T10:00:00.000Z',
      },
      actor_metadata: {
        actor_id: 'apify/instagram-scraper',
        actor_key: 'instagram_reel',
        run_id: 'run-1',
        dataset_id: 'dataset-1',
        source_label: 'Public reel',
      },
      pattern_status: 'needs_brand_translation',
    })
    expect(packet.hook_transcript).toHaveLength(500)
    expect(packet.hook_transcript).toMatch(/\.\.\.$/)
    expect(packet.pattern_packet.source_use_boundary).toContain('Final content must be rewritten')
    expect(packet.privacy_notes).toContain('do not copy source script')
  })

  it('bounds manually recorded evidence and applies safe normalization defaults', () => {
    const packet = researchPacketDraftFromRecordedEvidence({
      evidence: {
        source_url: 'https://example.com/public-post',
        title: 'Useful public pattern',
        hook_transcript: 'A long public hook. '.repeat(40),
        metrics: {
          views: 80,
          retrieved_at: '2020-01-01T00:00:00.000Z',
        },
      },
      retrievedAt: '2026-07-16T10:00:00.000Z',
      actorLabel: 'Manual public review',
    })

    expect(packet.platform).toBe('other')
    expect(packet.pattern_status).toBe('needs_brand_translation')
    expect(packet.hook_transcript).toHaveLength(500)
    expect(packet.metrics).toEqual({
      views: 80,
      retrieved_at: '2026-07-16T10:00:00.000Z',
    })
    expect(packet.actor_metadata).toMatchObject({
      provider: 'free_recorded_evidence',
      retrieval_method: 'codex_browser',
      actor_label: 'Manual public review',
      cost_usd: 0,
    })
    expect(packet.pattern_packet.source_use_boundary).toContain('Reusable framework only')
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
    expect(drafts.linkedin.orchestration_evidence).toMatchObject({
      agents: expect.arrayContaining([
        expect.objectContaining({ name: 'Shaka' }),
        expect.objectContaining({ name: 'Askia' }),
        expect.objectContaining({ name: 'Amina' }),
      ]),
      channel_structure: expect.objectContaining({
        format: expect.stringContaining('Thought-leadership post'),
      }),
      voice_translation: expect.objectContaining({
        source: expect.stringContaining('Vambah personality corpus'),
        avoid: expect.arrayContaining(['Generic AI hype.']),
      }),
      visual_reinforcement: expect.objectContaining({
        recommended_assets: expect.arrayContaining(['Framework illustration', 'App screenshot carousel']),
      }),
    })
    expect(drafts.youtube_shorts.fields).toMatchObject({
      hook: 'AI should reduce burden.',
      first_30_seconds: expect.stringContaining('I noticed this through the social content review flow'),
      target_duration_seconds: 45,
      render_readiness: 'pending_human_approval',
    })
    expect(drafts.youtube_shorts.orchestration_evidence).toMatchObject({
      portfolio_surfaces: expect.arrayContaining([
        expect.objectContaining({ route: '/admin/content/video-generation' }),
      ]),
      visual_reinforcement: expect.objectContaining({
        recommended_assets: expect.arrayContaining(['Portfolio b-roll', 'Thumbnail direction']),
      }),
    })
    expect(drafts.instagram_reels.fields).toMatchObject({
      hook: 'AI should reduce burden.',
      cover_text: expect.any(String),
      safe_area_notes: expect.arrayContaining([
        expect.stringContaining('9:16 vertical framing'),
      ]),
      export_readiness: 'pending_human_approval',
    })
    expect(drafts.instagram_reels.orchestration_evidence?.visual_reinforcement.recommended_assets).toEqual(
      expect.arrayContaining(['Cover frame', 'Vertical proof b-roll']),
    )
    expect(drafts.tiktok.fields).toMatchObject({
      hook: 'AI should reduce burden.',
      cover_frame: expect.any(String),
      audio_rights: expect.stringContaining('platform-safe audio'),
      safe_area_notes: expect.arrayContaining([
        expect.stringContaining('TikTok controls'),
      ]),
      export_readiness: 'pending_human_approval',
    })
    expect(drafts.tiktok.orchestration_evidence?.channel_structure.structure).toEqual(
      expect.arrayContaining(['Use fast proof cuts from Portfolio surfaces.']),
    )
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
