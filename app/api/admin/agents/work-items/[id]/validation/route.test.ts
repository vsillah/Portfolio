import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  recordAgentWorkItemValidation: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  recordAgentWorkItemValidation: mocks.recordAgentWorkItemValidation,
}))

import { POST } from './route'

function request(body: unknown) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/validation', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/work-items/[id]/validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.recordAgentWorkItemValidation.mockResolvedValue({ id: 'work-1', status: 'ready_for_merge' })
  })

  it('rejects non-admin callers before recording validation', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ validation_summary: 'Looks good' }) as never, { params: { id: 'work-1' } })

    expect(response.status).toBe(401)
    expect(mocks.recordAgentWorkItemValidation).not.toHaveBeenCalled()
  })

  it('requires a trimmed validation_summary', async () => {
    const empty = await POST(request({}) as never, { params: { id: 'work-1' } })
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'validation_summary is required' })

    const blank = await POST(request({ validation_summary: '   ' }) as never, { params: { id: 'work-1' } })
    expect(blank.status).toBe(400)
    expect(mocks.recordAgentWorkItemValidation).not.toHaveBeenCalled()
  })

  it('treats ready_for_merge as true only for a boolean true', async () => {
    const truthyString = await POST(
      request({ validation_summary: 'Looks good', ready_for_merge: 'true' }) as never,
      { params: { id: 'work-1' } },
    )
    expect(truthyString.status).toBe(200)
    expect(mocks.recordAgentWorkItemValidation).toHaveBeenCalledWith({
      id: 'work-1',
      validationSummary: 'Looks good',
      readyForMerge: false,
    })

    mocks.recordAgentWorkItemValidation.mockClear()
    const ready = await POST(
      request({ validation_summary: '  Merge after QA  ', ready_for_merge: true }) as never,
      { params: { id: 'work-1' } },
    )
    expect(ready.status).toBe(200)
    expect(await ready.json()).toEqual({
      ok: true,
      work_item: { id: 'work-1', status: 'ready_for_merge' },
    })
    expect(mocks.recordAgentWorkItemValidation).toHaveBeenCalledWith({
      id: 'work-1',
      validationSummary: 'Merge after QA',
      readyForMerge: true,
    })
  })

  it('maps a missing work item to 404', async () => {
    mocks.recordAgentWorkItemValidation.mockRejectedValue(new Error('Agent work item not found'))

    const response = await POST(request({ validation_summary: 'Looks good' }) as never, { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Agent work item not found' })
  })
})
