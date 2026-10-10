import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getAgentWorkItem: vi.fn(),
  cancelAgentWorkItem: vi.fn(),
  completeAgentWorkItem: vi.fn(),
  updateAgentWorkItemStatus: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  AGENT_WORK_ITEM_STATUSES: [
    'proposed',
    'queued',
    'assigned',
    'in_progress',
    'blocked',
    'ready_for_review',
    'ready_for_merge',
    'merged',
    'deployed',
    'cancelled',
  ],
  getAgentWorkItem: mocks.getAgentWorkItem,
  cancelAgentWorkItem: mocks.cancelAgentWorkItem,
  completeAgentWorkItem: mocks.completeAgentWorkItem,
  updateAgentWorkItemStatus: mocks.updateAgentWorkItemStatus,
}))

import { GET, PATCH } from './route'

function request(method: 'GET' | 'PATCH', body?: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1', {
    method,
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/agents/work-items/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockResolvedValue({ id: 'work-1', status: 'queued' })
    mocks.cancelAgentWorkItem.mockResolvedValue({ id: 'work-1', status: 'cancelled' })
    mocks.completeAgentWorkItem.mockResolvedValue({ id: 'work-1', status: 'merged' })
    mocks.updateAgentWorkItemStatus.mockResolvedValue({ id: 'work-1', status: 'in_progress' })
  })

  it('requires admin auth for GET and PATCH', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getResponse = await GET(request('GET') as never, { params: { id: 'work-1' } })
    const patchResponse = await PATCH(request('PATCH', { status: 'in_progress' }) as never, { params: { id: 'work-1' } })

    expect(getResponse.status).toBe(401)
    expect(patchResponse.status).toBe(401)
    expect(mocks.getAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemStatus).not.toHaveBeenCalled()
  })

  it('returns 404 when the work item is missing', async () => {
    mocks.getAgentWorkItem.mockResolvedValue(null)

    const response = await GET(request('GET') as never, { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Work item not found' })
  })

  it('returns the work item', async () => {
    const response = await GET(request('GET') as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ work_item: { id: 'work-1', status: 'queued' } })
    expect(mocks.getAgentWorkItem).toHaveBeenCalledWith('work-1')
  })

  it('rejects an invalid status before writing', async () => {
    const response = await PATCH(request('PATCH', { status: 'later' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Valid status is required' })
    expect(mocks.cancelAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.completeAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemStatus).not.toHaveBeenCalled()
  })

  it('cancels via cancelAgentWorkItem', async () => {
    const response = await PATCH(
      request('PATCH', { status: 'cancelled', note: 'Duplicate of work-2' }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, work_item: { id: 'work-1', status: 'cancelled' } })
    expect(mocks.cancelAgentWorkItem).toHaveBeenCalledWith({ id: 'work-1', reason: 'Duplicate of work-2' })
    expect(mocks.completeAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemStatus).not.toHaveBeenCalled()
  })

  it('completes merged and deployed statuses', async () => {
    const merged = await PATCH(
      request('PATCH', { status: 'merged', note: 'QA passed' }) as never,
      { params: { id: 'work-1' } },
    )
    expect(merged.status).toBe(200)
    expect(mocks.completeAgentWorkItem).toHaveBeenCalledWith({
      id: 'work-1',
      status: 'merged',
      validationSummary: 'QA passed',
    })

    mocks.completeAgentWorkItem.mockClear()
    mocks.completeAgentWorkItem.mockResolvedValue({ id: 'work-1', status: 'deployed' })
    const deployed = await PATCH(request('PATCH', { status: 'deployed' }) as never, { params: { id: 'work-1' } })
    expect(deployed.status).toBe(200)
    expect(mocks.completeAgentWorkItem).toHaveBeenCalledWith({
      id: 'work-1',
      status: 'deployed',
      validationSummary: null,
    })
    expect(mocks.updateAgentWorkItemStatus).not.toHaveBeenCalled()
  })

  it('updates non-terminal statuses through updateAgentWorkItemStatus', async () => {
    const response = await PATCH(
      request('PATCH', { status: 'in_progress', note: 'Picked up' }) as never,
      { params: { id: 'work-1' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, work_item: { id: 'work-1', status: 'in_progress' } })
    expect(mocks.updateAgentWorkItemStatus).toHaveBeenCalledWith({
      id: 'work-1',
      status: 'in_progress',
      note: 'Picked up',
    })
    expect(mocks.cancelAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.completeAgentWorkItem).not.toHaveBeenCalled()
  })

  it('maps a missing work item on PATCH to 404', async () => {
    mocks.updateAgentWorkItemStatus.mockRejectedValue(new Error('Agent work item not found'))

    const response = await PATCH(request('PATCH', { status: 'queued' }) as never, { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Agent work item not found' })
  })
})
