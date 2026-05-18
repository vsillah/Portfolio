import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  requestAgentWorkItemN8nActivationReview: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  requestAgentWorkItemN8nActivationReview: mocks.requestAgentWorkItemN8nActivationReview,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/n8n-activation-review', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/n8n-activation-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.requestAgentWorkItemN8nActivationReview.mockResolvedValue({ id: 'work-1', status: 'ready_for_review' })
  })

  it('requests activation review without activating n8n', async () => {
    const response = await POST(request({
      review_summary: 'Review inactive workflow evidence before any activation decision.',
    }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, work_item: { id: 'work-1' } })
    expect(mocks.requestAgentWorkItemN8nActivationReview).toHaveBeenCalledWith({
      id: 'work-1',
      reviewSummary: 'Review inactive workflow evidence before any activation decision.',
      actorLabel: 'admin@example.com',
    })
  })

  it('requires a review summary', async () => {
    const response = await POST(request({ review_summary: '' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(400)
    expect(mocks.requestAgentWorkItemN8nActivationReview).not.toHaveBeenCalled()
  })

  it('rejects non-admin callers before requesting activation review', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({
      review_summary: 'Review inactive workflow evidence before any activation decision.',
    }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.requestAgentWorkItemN8nActivationReview).not.toHaveBeenCalled()
  })
})
