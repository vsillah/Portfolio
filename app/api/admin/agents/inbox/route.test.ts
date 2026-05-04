import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  routeAgentInboxItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-inbox-routing', () => ({
  routeAgentInboxItem: mocks.routeAgentInboxItem,
}))

import { POST } from './route'

function request(body: unknown = {}) {
  return new Request('http://localhost/api/admin/agents/inbox', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.routeAgentInboxItem.mockResolvedValue({
      item: {
        id: 'failed-run:failed',
        title: 'Failure needs triage',
      },
      runId: 'route-run',
      routeAction: 'agent_engagement',
      status: 'completed',
      executionMode: 'read_only',
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ item_id: '1' }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.routeAgentInboxItem).not.toHaveBeenCalled()
  })

  it('routes an inbox item through the shared router', async () => {
    const response = await POST(request({ item_id: 'failed-run:failed' }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      run_id: 'route-run',
      route_action: 'agent_engagement',
      status: 'completed',
      execution_mode: 'read_only',
    })
    expect(mocks.routeAgentInboxItem).toHaveBeenCalledWith(expect.objectContaining({
      itemRef: 'failed-run:failed',
      triggerSource: 'admin_agent_inbox_route',
      actor: expect.objectContaining({
        id: 'admin-user',
        userId: 'admin-user',
        type: 'admin_user',
      }),
    }))
  })

  it('rejects missing item ids', async () => {
    const response = await POST(request({}) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'item_id is required' })
  })

  it('returns not found for stale inbox references', async () => {
    mocks.routeAgentInboxItem.mockRejectedValue(new Error('Agent Inbox item not found'))

    const response = await POST(request({ item_id: 'missing' }) as never)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Agent Inbox item not found' })
  })
})
