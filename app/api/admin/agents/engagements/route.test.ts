import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request() {
  return new Request('http://localhost/api/admin/agents/engagements', {
    headers: { authorization: 'Bearer token' },
  })
}

function engagementQuery(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  }
}

describe('GET /api/admin/agents/engagements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.from.mockReturnValue(engagementQuery([]))
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns latest traced engagement status for every mapped agent', async () => {
    mocks.from.mockReturnValue(engagementQuery([
      {
        id: 'new-run',
        agent_key: 'chief-of-staff',
        status: 'completed',
        current_step: 'Read-only dispatch ready',
        started_at: '2026-05-04T12:05:00.000Z',
        completed_at: '2026-05-04T12:06:00.000Z',
        metadata: { requested_agent: 'chief-of-staff', execution_mode: 'read_only' },
      },
      {
        id: 'old-run',
        agent_key: 'chief-of-staff',
        status: 'queued',
        current_step: 'Engagement request queued',
        started_at: '2026-05-04T12:00:00.000Z',
        completed_at: null,
        metadata: { requested_agent: 'chief-of-staff' },
      },
      {
        id: 'metadata-run',
        agent_key: 'manual',
        status: 'queued',
        current_step: 'Engagement request queued',
        started_at: '2026-05-04T11:00:00.000Z',
        completed_at: null,
        metadata: { requested_agent: 'strategic-narrative', executes_action: false },
      },
    ]))

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('agent_runs')
    expect(body.engagements.length).toBeGreaterThan(10)
    expect(body.engagements.find((item: { agent_key: string }) => item.agent_key === 'chief-of-staff')).toMatchObject({
      run_id: 'new-run',
      status: 'completed',
      execution_mode: 'read_only',
    })
    expect(body.engagements.find((item: { agent_key: string }) => item.agent_key === 'strategic-narrative')).toMatchObject({
      run_id: 'metadata-run',
      status: 'queued',
      execution_mode: 'read_only',
    })
  })

  it('returns a server error when engagement lookup fails', async () => {
    mocks.from.mockReturnValue(engagementQuery([], { message: 'database failed' }))

    const response = await GET(request() as never)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch agent engagements' })
  })
})
