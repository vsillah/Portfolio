import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildAgentActivityRadarSnapshot: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-activity-radar', () => ({
  buildAgentActivityRadarSnapshot: mocks.buildAgentActivityRadarSnapshot,
}))

import { GET } from './route'

function request() {
  return new Request('http://localhost/api/admin/agents/activity-radar', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/activity-radar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.buildAgentActivityRadarSnapshot.mockResolvedValue({
      generated_at: '2026-06-11T14:00:00.000Z',
      refresh_interval_seconds: 15,
      summary: {
        active: 1,
        idle: 2,
        queued: 0,
        waiting_for_approval: 1,
        blocked: 0,
        stale: 0,
        failed: 0,
      },
      agents: [{
        key: 'chief-of-staff',
        name: 'Shaka (Zulu) - Chief of Staff',
        pod_key: 'chief_of_staff',
        pod_name: 'Chief of Staff',
        runtime: 'mixed',
        organization_status: 'partial',
        live_state: 'active',
        idle_reason: null,
        current_work_item: null,
        active_run: {
          id: 'run-1',
          title: 'Morning review',
          status: 'running',
          href: '/admin/agents/runs/run-1',
        },
        current_step: 'Reviewing active work',
        latest_event: null,
        linked_goal: null,
        backlog_lane: null,
        age_seconds: 60,
        trace_href: '/admin/agents/runs/run-1',
        steer_actions: [],
      }],
      attention: [],
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildAgentActivityRadarSnapshot).not.toHaveBeenCalled()
  })

  it('returns the radar snapshot', async () => {
    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.refresh_interval_seconds).toBe(15)
    expect(body.summary).toMatchObject({ active: 1, waiting_for_approval: 1 })
    expect(body.agents[0]).toMatchObject({
      key: 'chief-of-staff',
      live_state: 'active',
      trace_href: '/admin/agents/runs/run-1',
    })
    expect(mocks.buildAgentActivityRadarSnapshot).toHaveBeenCalledOnce()
  })

  it('returns a server error when snapshot generation fails', async () => {
    mocks.buildAgentActivityRadarSnapshot.mockRejectedValue(new Error('Database not available'))

    const response = await GET(request() as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Database not available' })
  })
})
