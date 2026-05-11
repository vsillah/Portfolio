import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getAgentQualitySummary: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-evaluations', () => ({
  getAgentQualitySummary: mocks.getAgentQualitySummary,
}))

import { GET } from './route'

function request(url = 'http://localhost/api/admin/agents/evaluations') {
  return new Request(url, {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/evaluations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentQualitySummary.mockResolvedValue({
      window_hours: 24,
      generated_at: '2026-05-10T10:00:00.000Z',
      rubric_count: 1,
      evaluation_count: 1,
      average_score: 91,
      pass_rate: 1,
      by_agent: [],
      needs_coaching: [],
      rubric_trends: [],
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getAgentQualitySummary).not.toHaveBeenCalled()
  })

  it('returns an empty-safe quality summary', async () => {
    const response = await GET(request('http://localhost/api/admin/agents/evaluations?agent_key=chief-of-staff') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      rubric_count: 1,
      evaluation_count: 1,
      average_score: 91,
    })
    expect(mocks.getAgentQualitySummary).toHaveBeenCalledWith({
      agentKey: 'chief-of-staff',
      windowHours: 24,
    })
  })
})
