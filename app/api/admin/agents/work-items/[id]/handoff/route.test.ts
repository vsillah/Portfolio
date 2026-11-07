import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  handoffAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  handoffAgentWorkItem: mocks.handoffAgentWorkItem,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/handoff', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.handoffAgentWorkItem.mockResolvedValue({
      workItem: { id: 'work-1', owner_agent_key: 'reviewer' },
      handoffId: 'handoff-9',
    })
  })

  it('rejects non-admin callers before handing off', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      request({ to_agent_key: 'reviewer', summary: 'Needs review' }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(401)
    expect(mocks.handoffAgentWorkItem).not.toHaveBeenCalled()
  })

  it('requires to_agent_key and summary', async () => {
    const missingSummary = await POST(request({ to_agent_key: 'reviewer' }) as never, { params: { id: 'work-1' } })
    expect(missingSummary.status).toBe(400)
    expect(await missingSummary.json()).toEqual({ error: 'to_agent_key and summary are required' })

    const blankKey = await POST(request({ to_agent_key: '  ', summary: 'Needs review' }) as never, {
      params: { id: 'work-1' },
    })
    expect(blankKey.status).toBe(400)
    expect(mocks.handoffAgentWorkItem).not.toHaveBeenCalled()
  })

  it('rejects an invalid to_runtime before writing', async () => {
    const response = await POST(
      request({ to_agent_key: 'reviewer', summary: 'Needs review', to_runtime: 'galaxy' }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid to_runtime' })
    expect(mocks.handoffAgentWorkItem).not.toHaveBeenCalled()
  })

  it('hands off the work item and returns the handoff id', async () => {
    const response = await POST(
      request({
        to_agent_key: '  reviewer  ',
        to_runtime: 'n8n',
        summary: '  Needs review  ',
        from_agent_key: 'ops-lead',
        handoff_type: 'review',
        acceptance_criteria: 'Ship only after QA',
        idempotency_key: 'handoff-once',
      }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      work_item: { id: 'work-1', owner_agent_key: 'reviewer' },
      handoff_id: 'handoff-9',
    })
    expect(mocks.handoffAgentWorkItem).toHaveBeenCalledWith({
      id: 'work-1',
      toAgentKey: 'reviewer',
      toRuntime: 'n8n',
      fromAgentKey: 'ops-lead',
      handoffType: 'review',
      summary: 'Needs review',
      acceptanceCriteria: 'Ship only after QA',
      idempotencyKey: 'handoff-once',
    })
  })

  it('maps a missing work item to 404', async () => {
    mocks.handoffAgentWorkItem.mockRejectedValue(new Error('Agent work item not found'))

    const response = await POST(
      request({ to_agent_key: 'reviewer', summary: 'Needs review' }) as never,
      { params: { id: 'missing' } },
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Agent work item not found' })
  })
})
