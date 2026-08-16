import { beforeEach, describe, expect, it, vi } from 'vitest'

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

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/autoresearch-feedback', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/autoresearch-feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      title: 'Approval gates create trust',
      metadata: {
        autoresearch_feedback_handoffs: Array.from({ length: 10 }, (_, index) => ({
          id: `older-${index}`,
          feedback: `older ${index}`,
        })),
      },
    })
    mocks.updateAgentWorkItemMetadata.mockImplementation(async (input) => ({
      id: input.id,
      metadata: input.metadata,
    }))
  })

  it('records a governed AutoResearch feedback handoff without external side effects', async () => {
    const response = await POST(request({
      backlog_item_id: 'autoresearch-agentified-agt-x-01',
      backlog_item_title: 'What breaks first when AI gets faster?',
      feedback_target: 'both',
      feedback: 'Strengthen the CTA and carry the b-roll lesson into the next pass.',
      current_gate: 'final_submission',
      release_link_id: 'calendar-1',
      release_title: 'Tease: Approval gates',
      release_scheduled_for: '2026-06-24T14:00:00.000Z',
    }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      ok: true,
      feedback_handoff: {
        created_by: 'admin@example.com',
        source: 'content_intelligence_autoresearch_card',
        backlog_item_id: 'autoresearch-agentified-agt-x-01',
        backlog_item_title: 'What breaks first when AI gets faster?',
        feedback_target: 'both',
        feedback: 'Strengthen the CTA and carry the b-roll lesson into the next pass.',
        current_gate: 'final_submission',
        release_link_id: 'calendar-1',
        status: 'recorded',
        side_effects: {
          provider_generation: false,
          provider_call: false,
          upload: false,
          schedule: false,
          publish: false,
          external_post: false,
          production_mutation: false,
        },
      },
      side_effects: {
        provider_generation: false,
        provider_call: false,
        upload: false,
        schedule: false,
        publish: false,
        external_post: false,
        production_mutation: false,
      },
    })
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      note: 'Recorded AutoResearch feedback for What breaks first when AI gets faster?.',
    }))
    const metadata = mocks.updateAgentWorkItemMetadata.mock.calls[0][0].metadata
    expect(metadata.autoresearch_feedback_handoffs).toHaveLength(10)
    expect(metadata.autoresearch_feedback_handoffs[0].id).toBe('older-1')
    expect(metadata.autoresearch_feedback_latest).toMatchObject({
      backlog_item_id: 'autoresearch-agentified-agt-x-01',
      feedback_target: 'both',
    })
  })

  it('requires feedback, target, and backlog item id', async () => {
    expect((await POST(request({ feedback_target: 'both', backlog_item_id: 'item-1' }) as never, { params: { id: 'work-1' } })).status).toBe(400)
    expect((await POST(request({ feedback: 'Use this later.', backlog_item_id: 'item-1', feedback_target: 'later' }) as never, { params: { id: 'work-1' } })).status).toBe(400)
    expect((await POST(request({ feedback: 'Use this later.', feedback_target: 'both' }) as never, { params: { id: 'work-1' } })).status).toBe(400)
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })
})
