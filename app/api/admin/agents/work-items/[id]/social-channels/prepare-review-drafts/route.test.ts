import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getAgentWorkItem: vi.fn(),
  updateAgentWorkItemMetadata: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  getAgentWorkItem: mocks.getAgentWorkItem,
  updateAgentWorkItemMetadata: mocks.updateAgentWorkItemMetadata,
}))

import { POST } from './route'

function request() {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/social-channels/prepare-review-drafts', {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
  })
}

const baseWorkItem = {
  id: 'work-1',
  title: 'Approval gates create trust',
  metadata: {
    insight: {
      title: 'Approval gates create trust',
      triggering_event: 'The Social Content review flow made the gate visible.',
      why_vambah_can_speak: 'Vambah is building and reviewing the system directly.',
      evidence_summary: 'Review path and visual gate work shipped locally.',
      content_angle: 'AI should reduce burden, but only when authority and evidence are separated.',
      suggested_hook: 'AI should reduce burden.',
      claim_boundaries: ['Do not imply publishing is automated.'],
      approved_research_patterns: [
        {
          source_url: 'https://youtube.com/watch?v=abc',
          platform: 'youtube',
          creator_name: 'Creator',
          pattern_status: 'usable_framework',
          pattern_packet: {
            hook_structure: 'Start with the missed approval gate.',
            promise_value: 'Show how review gates build trust.',
            thumbnail_pattern: 'Translate the layout into AmaduTown style.',
          },
        },
      ],
    },
    channel_lanes: {
      linkedin: { status: 'selected', label: 'LinkedIn', required_inputs: ['post text', 'CTA'] },
      youtube_shorts: { status: 'not_started', label: 'YouTube Shorts', required_inputs: ['hook', 'script'] },
      instagram_reels: { status: 'not_started', label: 'Instagram Reels', required_inputs: ['hook', 'caption'] },
      tiktok: { status: 'not_started', label: 'TikTok', required_inputs: ['hook', 'caption', 'audio rights'] },
      x: { status: 'not_started', label: 'X', required_inputs: ['post text', 'thread option', 'CTA'] },
      thumbnail: { status: 'not_started', label: 'Thumbnail', required_inputs: ['promise', '2-3 variants'] },
    },
    autoresearch_feedback_latest: {
      feedback_target: 'both',
      feedback: 'Make the next operator action explicit and route commentary into this item and the next AutoResearch pass.',
      backlog_item_id: 'autoresearch-agentified-agt-x-01',
      status: 'recorded',
    },
  },
}

function cloneBaseWorkItem() {
  return structuredClone(baseWorkItem)
}

function preparedLanes() {
  return mocks.updateAgentWorkItemMetadata.mock.calls[0][0].metadata.channel_lanes
}

function nonXPublicDraftText(lanes: Record<string, { draft_packet: { fields: Record<string, unknown> } }>) {
  return JSON.stringify({
    youtube: {
      title_variants: lanes.youtube.draft_packet.fields.title_variants,
      description: lanes.youtube.draft_packet.fields.description,
      opening_hook: lanes.youtube.draft_packet.fields.opening_hook,
      first_30_seconds: lanes.youtube.draft_packet.fields.first_30_seconds,
      full_video_script: lanes.youtube.draft_packet.fields.full_video_script,
    },
    youtube_shorts: {
      hook: lanes.youtube_shorts.draft_packet.fields.hook,
      first_30_seconds: lanes.youtube_shorts.draft_packet.fields.first_30_seconds,
      script: lanes.youtube_shorts.draft_packet.fields.script,
      caption: lanes.youtube_shorts.draft_packet.fields.caption,
      on_screen_text: lanes.youtube_shorts.draft_packet.fields.on_screen_text,
    },
    instagram_reels: {
      hook: lanes.instagram_reels.draft_packet.fields.hook,
      script: lanes.instagram_reels.draft_packet.fields.script,
      cover_text: lanes.instagram_reels.draft_packet.fields.cover_text,
      caption: lanes.instagram_reels.draft_packet.fields.caption,
    },
    tiktok: {
      hook: lanes.tiktok.draft_packet.fields.hook,
      script: lanes.tiktok.draft_packet.fields.script,
      cover_frame: lanes.tiktok.draft_packet.fields.cover_frame,
      caption: lanes.tiktok.draft_packet.fields.caption,
    },
    thumbnail: {
      primary_text: lanes.thumbnail.draft_packet.fields.primary_text,
      alternate_text_options: lanes.thumbnail.draft_packet.fields.alternate_text_options,
      visual_direction: lanes.thumbnail.draft_packet.fields.visual_direction,
    },
  })
}

describe('/api/admin/agents/work-items/[id]/social-channels/prepare-review-drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T15:00:00.000Z'))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockResolvedValue(baseWorkItem)
    mocks.updateAgentWorkItemMetadata.mockImplementation(async (input) => ({
      ...baseWorkItem,
      metadata: input.metadata,
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getAgentWorkItem).not.toHaveBeenCalled()
  })

  it('requires social insight metadata', async () => {
    mocks.getAgentWorkItem.mockResolvedValue({ ...baseWorkItem, metadata: {} })

    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Social insight metadata is required' })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('requires approved research patterns before preparing channel drafts', async () => {
    mocks.getAgentWorkItem.mockResolvedValue({
      ...baseWorkItem,
      metadata: {
        ...baseWorkItem.metadata,
        insight: {
          ...baseWorkItem.metadata.insight,
          approved_research_patterns: [],
        },
      },
    })

    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Link at least one approved research pattern before preparing channel review drafts',
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('prepares channel review drafts without external side effects', async () => {
    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(200)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      note: 'Social channel review drafts prepared by admin@example.com.',
      metadata: expect.objectContaining({
        channel_review_workflow: expect.objectContaining({
          status: 'human_review_ready',
          prepared_channels: ['linkedin', 'youtube', 'youtube_shorts', 'instagram_reels', 'tiktok', 'x', 'thumbnail'],
          prepared_at: '2026-06-24T15:00:00.000Z',
        }),
        channel_lanes: expect.objectContaining({
          linkedin: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'linkedin',
              orchestration_evidence: expect.objectContaining({
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
                }),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['Framework illustration', 'App screenshot carousel']),
                }),
              }),
              fields: expect.objectContaining({
                post_text: expect.stringContaining('The Social Content review flow made the gate visible.'),
                cta: expect.stringContaining('Where have you seen AI'),
              }),
            }),
          }),
          youtube: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'youtube',
              orchestration_evidence: expect.objectContaining({
                channel_structure: expect.objectContaining({
                  format: expect.stringContaining('Long-form YouTube video packet'),
                }),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['Full-video script', 'Thumbnail/title variants']),
                }),
              }),
              fields: expect.objectContaining({
                full_video_script: expect.arrayContaining([
                  expect.stringContaining('Core argument: AI should reduce burden'),
                ]),
                upload_readiness: 'pending_final_human_submission_gate',
                visibility_default: 'private',
              }),
            }),
          }),
          youtube_shorts: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'youtube_shorts',
              orchestration_evidence: expect.objectContaining({
                portfolio_surfaces: expect.arrayContaining([
                  expect.objectContaining({ route: '/admin/content/video-generation' }),
                ]),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['Portfolio b-roll', 'Thumbnail direction']),
                }),
              }),
              fields: expect.objectContaining({
                hook: 'AI should reduce burden.',
                first_30_seconds: expect.stringContaining('The mistake is thinking the demo is the finish line'),
              }),
            }),
          }),
          instagram_reels: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'instagram_reels',
              orchestration_evidence: expect.objectContaining({
                portfolio_surfaces: expect.arrayContaining([
                  expect.objectContaining({ route: '/admin/content/visual-assets' }),
                ]),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['Cover frame', 'Vertical proof b-roll']),
                }),
              }),
              fields: expect.objectContaining({
                cover_text: expect.any(String),
                export_readiness: 'pending_human_approval',
              }),
            }),
          }),
          tiktok: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'tiktok',
              orchestration_evidence: expect.objectContaining({
                channel_structure: expect.objectContaining({
                  success_criteria: expect.arrayContaining([
                    expect.stringContaining('Audio rights'),
                  ]),
                }),
                voice_translation: expect.objectContaining({
                  avoid: expect.arrayContaining(['Generic AI hype.']),
                }),
              }),
              fields: expect.objectContaining({
                audio_rights: expect.stringContaining('platform-safe audio'),
                export_readiness: 'pending_human_approval',
              }),
            }),
          }),
          x: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'x',
              orchestration_evidence: expect.objectContaining({
                channel_structure: expect.objectContaining({
                  format: expect.stringContaining('X post'),
                  success_criteria: expect.arrayContaining([
                    expect.stringContaining('X length constraints'),
                  ]),
                }),
                portfolio_surfaces: expect.arrayContaining([
                  expect.objectContaining({ route: '/admin/social-content' }),
                ]),
              }),
              fields: expect.objectContaining({
                post_text: expect.stringContaining('The Social Content review flow made the gate visible.'),
                thread_option: expect.arrayContaining([
                  expect.stringContaining('The Social Content review flow made the gate visible.'),
                ]),
                manual_handoff_gate: 'pending_human_approval_and_connected_x_provider',
              }),
            }),
          }),
          thumbnail: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'thumbnail',
              orchestration_evidence: expect.objectContaining({
                channel_structure: expect.objectContaining({
                  format: expect.stringContaining('thumbnail review packet'),
                }),
                visual_reinforcement: expect.objectContaining({
                  recommended_assets: expect.arrayContaining(['AmaduTown shield', 'Portfolio proof screenshot']),
                }),
              }),
              fields: expect.objectContaining({
                primary_text: expect.any(String),
                review_readiness: 'pending_visual_privacy_qa',
              }),
            }),
          }),
        }),
      }),
    }))

    expect(await response.json()).toMatchObject({
      success: true,
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })

    const lanes = preparedLanes()
    expect(lanes.linkedin.draft_packet.reviewer_action_guidance).toMatchObject({
      feedback_target: 'both',
      feedback: 'Make the next operator action explicit and route commentary into this item and the next AutoResearch pass.',
      current_item_action: expect.stringContaining('current channel drafts'),
      next_autoresearch_pass_action: expect.stringContaining('next AutoResearch loop'),
      next_operator_action: expect.stringContaining('current draft packet'),
    })
    expect(lanes.linkedin.draft_packet.reviewer_action_guidance.next_operator_action).toContain('next AutoResearch pass')
    expect(lanes.youtube.draft_packet.fields.reviewer_trace).toMatchObject({
      evidence_summary: 'Review path and visual gate work shipped locally.',
      source_urls: ['https://youtube.com/watch?v=abc'],
      approved_pattern_count: 1,
      transformation_boundary: expect.stringContaining('Do not paste source summaries'),
    })
    expect(lanes.linkedin.draft_packet.fields.post_text).not.toContain('Review path and visual gate work shipped locally.')
    expect(lanes.youtube.draft_packet.fields.description).not.toContain('Source basis:')
    expect(lanes.thumbnail.draft_packet.fields.primary_text).not.toContain('Open the X thread')
  })

  it('keeps source summaries and X-specific instructions out of non-X public copy', async () => {
    const workItem = cloneBaseWorkItem()
    workItem.metadata.insight = {
      ...workItem.metadata.insight,
      title: 'Agentified book and workbook rollout campaign',
      triggering_event: 'Agentified book and workbook rollout campaign',
      evidence_summary: 'Prepared from the Agentified campaign packet and internal source basis.',
      content_angle: 'Prepared from the Agentified campaign packet for the next operator.',
      suggested_hook: 'Open the X thread with the Agentified book and workbook rollout campaign.',
      approved_research_patterns: [
        {
          source_url: 'https://example.com/public-pattern',
          platform: 'x',
          creator_name: 'Creator',
          pattern_status: 'usable_framework',
          pattern_packet: {
            hook_structure: 'Open the X thread with the planning phrase.',
            promise_value: 'Open the X thread for the Agentified book and workbook rollout campaign.',
            thumbnail_pattern: 'Do not copy this packet title.',
          },
        },
      ],
    }
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(200)
    const lanes = preparedLanes()
    const publicText = nonXPublicDraftText(lanes)
    expect(publicText).not.toContain('Open the X thread')
    expect(publicText).not.toContain('Agentified book and workbook rollout campaign')
    expect(publicText).not.toContain('Prepared from the Agentified campaign packet')
    expect(publicText).not.toContain('internal source basis')
    expect(lanes.youtube.draft_packet.fields.reviewer_trace).toMatchObject({
      evidence_summary: 'Prepared from the Agentified campaign packet and internal source basis.',
      source_urls: ['https://example.com/public-pattern'],
    })
    expect(lanes.thumbnail.draft_packet.fields.primary_text).toBe('Receipts Before Reach')
    expect(lanes.thumbnail.draft_packet.fields.primary_text).not.toContain('Agentified')
  })
})
