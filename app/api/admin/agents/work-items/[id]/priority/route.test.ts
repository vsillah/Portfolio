import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  prioritizeAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  AGENT_WORK_ITEM_PRIORITIES: ['low', 'medium', 'high', 'urgent'],
  prioritizeAgentWorkItem: mocks.prioritizeAgentWorkItem,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/priority', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/priority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.prioritizeAgentWorkItem.mockResolvedValue({ id: 'work-1', priority: 'urgent' })
  })

  it('updates work item priority', async () => {
    const response = await POST(request({ priority: 'urgent', note: 'Move to top' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, work_item: { id: 'work-1' } })
    expect(mocks.prioritizeAgentWorkItem).toHaveBeenCalledWith({
      id: 'work-1',
      priority: 'urgent',
      note: 'Move to top',
    })
  })

  it('rejects invalid priority', async () => {
    const response = await POST(request({ priority: 'later' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(400)
    expect(mocks.prioritizeAgentWorkItem).not.toHaveBeenCalled()
  })
})
