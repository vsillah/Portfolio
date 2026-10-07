import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SOCIAL_CONTENT_INTELLIGENCE_CHANNELS } from '@/lib/social-content-intelligence'

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

function request() {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/social-channels/approve-all', {
    method: 'PATCH',
    headers: { authorization: 'Bearer token' },
  })
}

function readyWorkItem() {
  return {
    id: 'work-1',
    metadata: {
      channel_lanes: Object.fromEntries(SOCIAL_CONTENT_INTELLIGENCE_CHANNELS.map((channel) => [channel, {
        status: 'in_review',
        label: channel,
        draft_packet: {
          channel,
          approval_status: 'in_review',
          enrichment_receipt: { status: 'passed' },
          fields: { copy: `${channel} review copy` },
        },
      }])),
    },
  }
}

describe('/api/admin/agents/work-items/[id]/social-channels/approve-all', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const workItem = readyWorkItem()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockResolvedValue(workItem)
    mocks.updateAgentWorkItemMetadata.mockImplementation(async ({ metadata }) => ({ ...workItem, metadata }))
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(request() as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(401)
    expect(mocks.getAgentWorkItem).not.toHaveBeenCalled()
  })

  it('approves every receipt-backed lane in one metadata update with no side effects', async () => {
    const response = await PATCH(request() as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledTimes(1)
    const update = mocks.updateAgentWorkItemMetadata.mock.calls[0][0]
    expect(update.note).toBe('All social channel lanes approved by admin@example.com.')
    for (const channel of SOCIAL_CONTENT_INTELLIGENCE_CHANNELS) {
      expect(update.metadata.channel_lanes[channel]).toMatchObject({
        status: 'approved',
        draft_packet: {
          approval_status: 'approved',
          decided_at: expect.any(String),
        },
      })
    }
    expect(await response.json()).toMatchObject({
      success: true,
      approved_channels: SOCIAL_CONTENT_INTELLIGENCE_CHANNELS,
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  })

  it('fails closed when any lane lacks a passing enrichment receipt', async () => {
    const workItem = readyWorkItem()
    workItem.metadata.channel_lanes.linkedin.draft_packet.enrichment_receipt = { status: 'blocked' }
    mocks.getAgentWorkItem.mockResolvedValue(workItem)

    const response = await PATCH(request() as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      blockers: ['linkedin: passing enrichment receipt is missing'],
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })
})
