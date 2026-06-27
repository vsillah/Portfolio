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
    },
  },
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
      error: 'Link at least one approved research pattern before preparing LinkedIn and YouTube review drafts',
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('prepares LinkedIn and YouTube review drafts without external side effects', async () => {
    const response = await POST(request() as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(200)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      note: 'LinkedIn and YouTube Shorts review drafts prepared by admin@example.com.',
      metadata: expect.objectContaining({
        channel_review_workflow: expect.objectContaining({
          status: 'human_review_ready',
          prepared_channels: ['linkedin', 'youtube_shorts'],
          prepared_at: '2026-06-24T15:00:00.000Z',
        }),
        channel_lanes: expect.objectContaining({
          linkedin: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'linkedin',
              fields: expect.objectContaining({
                post_text: expect.stringContaining('The Social Content review flow made the gate visible.'),
                cta: expect.stringContaining('Where have you seen AI'),
              }),
            }),
          }),
          youtube_shorts: expect.objectContaining({
            status: 'in_review',
            review_requested_at: '2026-06-24T15:00:00.000Z',
            draft_packet: expect.objectContaining({
              channel: 'youtube_shorts',
              fields: expect.objectContaining({
                hook: 'AI should reduce burden.',
                first_30_seconds: expect.stringContaining('I noticed this through the social content review flow'),
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
  })
})
