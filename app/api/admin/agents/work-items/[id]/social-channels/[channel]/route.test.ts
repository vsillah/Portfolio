import { describe, expect, it, beforeEach, vi } from 'vitest'

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

import { PATCH } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/social-channels/linkedin', {
    method: 'PATCH',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseWorkItem = {
  id: 'work-1',
  metadata: {
    channel_lanes: {
      linkedin: {
        status: 'selected',
        label: 'LinkedIn',
        required_inputs: ['post text', 'CTA'],
        draft_packet: {
          channel: 'linkedin',
          fields: {
            post_text: 'LinkedIn draft',
          },
        },
      },
    },
  },
}

describe('/api/admin/agents/work-items/[id]/social-channels/[channel]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockResolvedValue(baseWorkItem)
    mocks.updateAgentWorkItemMetadata.mockResolvedValue({
      ...baseWorkItem,
      metadata: {
        ...baseWorkItem.metadata,
        channel_lanes: {
          ...baseWorkItem.metadata.channel_lanes,
          linkedin: {
            ...baseWorkItem.metadata.channel_lanes.linkedin,
            status: 'approved',
            decision_note: 'Approved for planning.',
            updated_at: '2026-06-23T10:00:00.000Z',
          },
        },
      },
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(request({ status: 'approved' }) as never, {
      params: { id: 'work-1', channel: 'linkedin' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getAgentWorkItem).not.toHaveBeenCalled()
  })

  it('validates channel and status', async () => {
    const badChannel = await PATCH(request({ status: 'approved' }) as never, {
      params: { id: 'work-1', channel: 'threads' },
    })
    expect(badChannel.status).toBe(400)

    const badStatus = await PATCH(request({ status: 'published' }) as never, {
      params: { id: 'work-1', channel: 'linkedin' },
    })
    expect(badStatus.status).toBe(400)
  })

  it('updates only the selected social channel lane and reports no side effects', async () => {
    const response = await PATCH(request({
      status: 'approved',
      decision_note: 'Approved for planning.',
    }) as never, {
      params: { id: 'work-1', channel: 'linkedin' },
    })

    expect(response.status).toBe(200)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      note: 'LinkedIn lane updated by admin@example.com.',
      metadata: expect.objectContaining({
        channel_lanes: expect.objectContaining({
          linkedin: expect.objectContaining({
            status: 'approved',
            decision_note: 'Approved for planning.',
            required_inputs: ['post text', 'CTA'],
            draft_packet: expect.objectContaining({
              approval_status: 'approved',
              decision_note: 'Approved for planning.',
              decided_at: expect.any(String),
            }),
          }),
          youtube_shorts: expect.objectContaining({
            status: 'not_started',
            label: 'YouTube Shorts',
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
      lane: expect.objectContaining({
        draft_packet: expect.objectContaining({
          approval_status: 'approved',
          decision_note: 'Approved for planning.',
        }),
      }),
    })
  })

  it('requires a prepared review draft before approving a production channel lane', async () => {
    mocks.getAgentWorkItem.mockResolvedValue({
      ...baseWorkItem,
      metadata: {
        channel_lanes: {
          linkedin: {
            status: 'selected',
            label: 'LinkedIn',
            required_inputs: ['post text', 'CTA'],
          },
        },
      },
    })

    const response = await PATCH(request({
      status: 'approved',
      decision_note: 'Approved for planning.',
    }) as never, {
      params: { id: 'work-1', channel: 'linkedin' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Prepare the channel review draft before approving this lane',
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })
})
