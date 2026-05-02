import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentEvent: mocks.recordAgentEvent,
}))

import { POST } from './route'

function makeRequest(body: unknown = {}) {
  return new Request('http://localhost/api/admin/agents/engage', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/engage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'engagement-run-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ agent_key: 'chief-of-staff' }) as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('queues a traceable engagement request', async () => {
    const response = await POST(makeRequest({
      agent_key: 'chief-of-staff',
      note: 'Review current blockers.',
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'engagement-run-1',
      agent_key: 'chief-of-staff',
      agent_name: 'Chief of Staff Agent',
      status: 'queued',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'chief-of-staff',
      runtime: 'manual',
      kind: 'agent_engagement_request',
      status: 'queued',
      triggeredByUserId: 'admin-user',
    }))
    expect(mocks.recordAgentEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'engagement-run-1',
      eventType: 'agent_engagement_requested',
    }))
  })

  it('rejects unknown agents', async () => {
    const response = await POST(makeRequest({ agent_key: 'unknown-agent' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unknown agent_key' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })
})
