import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  sweepStaleAgentRuns: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-stale-runs', () => ({
  sweepStaleAgentRuns: mocks.sweepStaleAgentRuns,
}))

import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/admin/agents/runs/stale-sweep', {
    method: 'POST',
    headers: { authorization: 'Bearer token' },
  })
}

describe('POST /api/admin/agents/runs/stale-sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.sweepStaleAgentRuns.mockResolvedValue({ checked: 3, marked: 1, runIds: ['run-1'] })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.sweepStaleAgentRuns).not.toHaveBeenCalled()
  })

  it('returns stale sweep results', async () => {
    const response = await POST(makeRequest() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      checked: 3,
      marked: 1,
      runIds: ['run-1'],
    })
  })
})
