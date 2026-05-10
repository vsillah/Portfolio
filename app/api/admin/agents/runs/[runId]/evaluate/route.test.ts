import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  evaluateAgentRun: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-evaluations', () => ({
  evaluateAgentRun: mocks.evaluateAgentRun,
}))

import { POST } from './route'

function request(body: unknown = {}) {
  return new Request('http://localhost/api/admin/agents/runs/run-1/evaluate', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/runs/:runId/evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.evaluateAgentRun.mockResolvedValue({
      id: 'eval-1',
      run_id: 'run-1',
      rubric_key: 'chief-of-staff-synthesis-quality',
      score: 91,
      passed: true,
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ rubric_key: 'chief-of-staff-synthesis-quality' }) as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.evaluateAgentRun).not.toHaveBeenCalled()
  })

  it('rejects malformed evaluation requests', async () => {
    const response = await POST(request({}) as never, { params: { runId: 'run-1' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'rubric_key is required' })
    expect(mocks.evaluateAgentRun).not.toHaveBeenCalled()
  })

  it('creates a trace-linked evaluation', async () => {
    const response = await POST(request({ rubric_key: 'chief-of-staff-synthesis-quality' }) as never, { params: { runId: 'run-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      evaluation: {
        id: 'eval-1',
        run_id: 'run-1',
        rubric_key: 'chief-of-staff-synthesis-quality',
      },
    })
    expect(mocks.evaluateAgentRun).toHaveBeenCalledWith('run-1', 'chief-of-staff-synthesis-quality')
  })

  it('returns 404 when the run or rubric is missing', async () => {
    mocks.evaluateAgentRun.mockRejectedValue(new Error('Agent run not found'))

    const response = await POST(request({ rubric_key: 'chief-of-staff-synthesis-quality' }) as never, { params: { runId: 'missing-run' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Agent run not found' })
  })
})
