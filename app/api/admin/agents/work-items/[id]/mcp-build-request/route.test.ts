import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  requestAgentWorkItemMcpBuild: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  requestAgentWorkItemMcpBuild: mocks.requestAgentWorkItemMcpBuild,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/mcp-build-request', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/mcp-build-request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.requestAgentWorkItemMcpBuild.mockResolvedValue({ id: 'work-1', status: 'queued' })
  })

  it('records an MCP build request for a work item', async () => {
    const response = await POST(request({ request_summary: 'Use the handoff packet to create an inactive staging workflow.' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, work_item: { id: 'work-1' } })
    expect(mocks.requestAgentWorkItemMcpBuild).toHaveBeenCalledWith({
      id: 'work-1',
      requestSummary: 'Use the handoff packet to create an inactive staging workflow.',
      actorLabel: 'admin@example.com',
    })
  })

  it('requires a request summary', async () => {
    const response = await POST(request({ request_summary: '' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(400)
    expect(mocks.requestAgentWorkItemMcpBuild).not.toHaveBeenCalled()
  })
})
