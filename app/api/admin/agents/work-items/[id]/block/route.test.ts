import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  recordAgentWorkItemBlocker: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  recordAgentWorkItemBlocker: mocks.recordAgentWorkItemBlocker,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/block', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/block', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.recordAgentWorkItemBlocker.mockResolvedValue({ id: 'work-1', status: 'blocked' })
  })

  it('rejects non-admin callers before recording a blocker', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ blocker_summary: 'Waiting on credentials' }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(401)
    expect(mocks.recordAgentWorkItemBlocker).not.toHaveBeenCalled()
  })

  it('requires a trimmed blocker_summary', async () => {
    const empty = await POST(request({}) as never, { params: { id: 'work-1' } })
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'blocker_summary is required' })

    const blank = await POST(request({ blocker_summary: '  ' }) as never, { params: { id: 'work-1' } })
    expect(blank.status).toBe(400)
    expect(mocks.recordAgentWorkItemBlocker).not.toHaveBeenCalled()
  })

  it('records the blocker and returns the work item', async () => {
    const response = await POST(request({ blocker_summary: '  Waiting on credentials  ' }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      work_item: { id: 'work-1', status: 'blocked' },
    })
    expect(mocks.recordAgentWorkItemBlocker).toHaveBeenCalledWith({
      id: 'work-1',
      blockerSummary: 'Waiting on credentials',
    })
  })

  it('maps a missing work item to 404', async () => {
    mocks.recordAgentWorkItemBlocker.mockRejectedValue(new Error('Agent work item not found'))

    const response = await POST(request({ blocker_summary: 'Waiting' }) as never, { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Agent work item not found' })
  })
})
