import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getOpenBrainSnapshot: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/open-brain', () => ({
  getOpenBrainSnapshot: mocks.getOpenBrainSnapshot,
}))

import { GET } from './route'

function makeRequest() {
  return new Request('http://localhost/api/admin/agents/open-brain', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/agents/open-brain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getOpenBrainSnapshot.mockResolvedValue({
      generatedAt: '2026-05-10T12:00:00.000Z',
      service: { available: true, storage: 'local_jsonl' },
      overview: { sources: 3, memories: 1, pendingProposals: 2 },
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getOpenBrainSnapshot).not.toHaveBeenCalled()
  })

  it('returns the sanitized Open Brain snapshot', async () => {
    const response = await GET(makeRequest() as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      generatedAt: '2026-05-10T12:00:00.000Z',
      overview: expect.objectContaining({ sources: 3 }),
    }))
  })
})
