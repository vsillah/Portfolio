import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  startAgentRun: vi.fn(),
  recordAgentEvent: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-run', () => ({
  startAgentRun: mocks.startAgentRun,
  recordAgentEvent: mocks.recordAgentEvent,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function makeRequest(body: unknown = {}) {
  return new Request('http://localhost/api/admin/agents/approval-drill', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function approvalInsertChain() {
  const single = vi.fn().mockResolvedValue({ data: { id: 'approval-1' }, error: null })
  const select = vi.fn(() => ({ single }))
  mocks.insert.mockImplementation(() => ({ select }))
  mocks.from.mockReturnValue({ insert: mocks.insert })
}

describe('POST /api/admin/agents/approval-drill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'run-1' })
    mocks.recordAgentEvent.mockResolvedValue({ id: 'event-1' })
    approvalInsertChain()
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('creates a waiting_for_approval drill run and pending approval', async () => {
    const response = await POST(makeRequest({ approval_type: 'send_email' }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'run-1',
      approval_id: 'approval-1',
      approval_type: 'send_email',
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      runtime: 'manual',
      kind: 'approval_gate_drill',
      status: 'waiting_for_approval',
      triggeredByUserId: 'admin-user',
    }))
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      run_id: 'run-1',
      approval_type: 'send_email',
      status: 'pending',
    }))
  })

  it('rejects unknown approval types', async () => {
    const response = await POST(makeRequest({ approval_type: 'dangerous_unknown' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid approval_type' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })
})
