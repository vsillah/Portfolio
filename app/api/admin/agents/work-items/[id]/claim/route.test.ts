import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  claimAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  claimAgentWorkItem: mocks.claimAgentWorkItem,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/claim', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/claim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.claimAgentWorkItem.mockResolvedValue({ id: 'work-1', owner_agent_key: 'ops-lead' })
  })

  it('rejects non-admin callers before claiming', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ owner_agent_key: 'ops-lead' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.claimAgentWorkItem).not.toHaveBeenCalled()
  })

  it('requires a trimmed owner_agent_key', async () => {
    const empty = await POST(request({}) as never, { params: { id: 'work-1' } })
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'owner_agent_key is required' })

    const blank = await POST(request({ owner_agent_key: '   ' }) as never, { params: { id: 'work-1' } })
    expect(blank.status).toBe(400)
    expect(mocks.claimAgentWorkItem).not.toHaveBeenCalled()
  })

  it('rejects an invalid owner_runtime before writing', async () => {
    const response = await POST(
      request({ owner_agent_key: 'ops-lead', owner_runtime: 'not-a-runtime' }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid owner_runtime' })
    expect(mocks.claimAgentWorkItem).not.toHaveBeenCalled()
  })

  it('claims the work item and defaults actor_label', async () => {
    const response = await POST(
      request({ owner_agent_key: '  ops-lead  ', owner_runtime: 'codex' }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      work_item: { id: 'work-1', owner_agent_key: 'ops-lead' },
    })
    expect(mocks.claimAgentWorkItem).toHaveBeenCalledWith({
      id: 'work-1',
      ownerAgentKey: 'ops-lead',
      ownerRuntime: 'codex',
      actorLabel: 'Admin user',
    })
  })

  it('maps a missing work item to 404', async () => {
    mocks.claimAgentWorkItem.mockRejectedValue(new Error('Agent work item not found'))

    const response = await POST(request({ owner_agent_key: 'ops-lead' }) as never, { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Agent work item not found' })
  })
})
