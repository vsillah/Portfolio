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
  return new Request('http://localhost/api/admin/agents/chief-of-staff/actions', {
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

const approvalProposal = {
  label: 'Approve outbound update',
  description: 'Create an approval checkpoint before sending a client update.',
  action: 'send_email',
  approvalType: 'send_email',
  requiresApproval: true,
  riskLevel: 'high',
}

describe('POST /api/admin/agents/chief-of-staff/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.startAgentRun.mockResolvedValue({ id: 'approval-run-1' })
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

  it('creates an approval checkpoint from a Chief of Staff proposal', async () => {
    const response = await POST(makeRequest({
      source_run_id: 'chief-run-1',
      proposal: approvalProposal,
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      run_id: 'approval-run-1',
      approval_id: 'approval-1',
      approval_type: 'send_email',
      approval_required: true,
    })
    expect(mocks.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({
      agentKey: 'chief-of-staff',
      runtime: 'manual',
      kind: 'chief_of_staff_action_approval',
      status: 'waiting_for_approval',
      triggeredByUserId: 'admin-user',
    }))
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      run_id: 'approval-run-1',
      approval_type: 'send_email',
      status: 'pending',
      requested_by_agent_key: 'chief-of-staff',
    }))
  })

  it('rejects non-gated proposals', async () => {
    const response = await POST(makeRequest({
      source_run_id: 'chief-run-1',
      proposal: {
        label: 'Read status',
        description: 'Review the current runs.',
        action: 'read_files',
        requiresApproval: false,
        riskLevel: 'low',
      },
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Proposal does not require an approval checkpoint' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })

  it('rejects invalid proposals', async () => {
    const response = await POST(makeRequest({
      source_run_id: 'chief-run-1',
      proposal: { label: 'Unknown', description: 'Bad action', action: 'dangerous_unknown' },
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Valid proposal is required' })
    expect(mocks.startAgentRun).not.toHaveBeenCalled()
  })
})
