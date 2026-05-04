import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildAgentMissionControlSnapshot: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-mission-control', () => ({
  buildAgentMissionControlSnapshot: mocks.buildAgentMissionControlSnapshot,
}))

import { GET } from './route'

function request() {
  return new Request('http://localhost/api/admin/agents/mission-control', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/mission-control', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.buildAgentMissionControlSnapshot.mockResolvedValue({
      generated_at: '2026-05-04T12:00:00.000Z',
      status_strip: {
        active: 1,
        queued: 0,
        running: 1,
        waiting_for_approval: 0,
        failed: 0,
        stale: 0,
        cost_today: 0.25,
        pending_approvals: 0,
      },
      roster: [],
      attention_queue: [],
      active_runs: [],
      latest_events: [],
      latest_standup: null,
      approvals: [],
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildAgentMissionControlSnapshot).not.toHaveBeenCalled()
  })

  it('returns the compact mission control snapshot', async () => {
    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.status_strip).toMatchObject({
      active: 1,
      running: 1,
      cost_today: 0.25,
    })
    expect(mocks.buildAgentMissionControlSnapshot).toHaveBeenCalledOnce()
  })

  it('returns a server error when snapshot generation fails', async () => {
    mocks.buildAgentMissionControlSnapshot.mockRejectedValue(new Error('Database not available'))

    const response = await GET(request() as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Database not available' })
  })
})
