import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  markAgentWorkItemReadyForKanban: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  markAgentWorkItemReadyForKanban: mocks.markAgentWorkItemReadyForKanban,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/ready', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/ready', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.markAgentWorkItemReadyForKanban.mockResolvedValue({ id: 'work-1', status: 'queued' })
  })

  it('marks a work item ready for the Kanban inbox', async () => {
    const response = await POST(request({ definition_of_ready: '- Clear metric\n- Rollback path' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, work_item: { id: 'work-1' } })
    expect(mocks.markAgentWorkItemReadyForKanban).toHaveBeenCalledWith({
      id: 'work-1',
      definitionOfReady: '- Clear metric\n- Rollback path',
      actorLabel: 'admin@example.com',
    })
  })

  it('requires a definition of ready', async () => {
    const response = await POST(request({ definition_of_ready: '' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(400)
    expect(mocks.markAgentWorkItemReadyForKanban).not.toHaveBeenCalled()
  })
})
