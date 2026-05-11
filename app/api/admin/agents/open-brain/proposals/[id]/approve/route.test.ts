import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  reviewOpenBrainProposal: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/open-brain', () => ({
  reviewOpenBrainProposal: mocks.reviewOpenBrainProposal,
}))

import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/admin/agents/open-brain/proposals/proposal%3A1/approve', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'Looks correct' }),
  })
}

describe('POST /api/admin/agents/open-brain/proposals/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.reviewOpenBrainProposal.mockResolvedValue({ id: 'proposal:1', status: 'approved' })
  })

  it('approves a proposal through the local Open Brain store', async () => {
    const response = await POST(makeRequest() as never, { params: { id: 'proposal%3A1' } })

    expect(response.status).toBe(200)
    expect(mocks.reviewOpenBrainProposal).toHaveBeenCalledWith('proposal:1', 'approved', 'Looks correct', 'admin-user')
    expect(await response.json()).toEqual({ proposal: { id: 'proposal:1', status: 'approved' } })
  })
})
