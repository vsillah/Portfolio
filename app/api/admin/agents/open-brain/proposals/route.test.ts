import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  createOpenBrainProposal: vi.fn(),
  validateMemoryProposal: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/open-brain', () => ({
  createOpenBrainProposal: mocks.createOpenBrainProposal,
  validateMemoryProposal: mocks.validateMemoryProposal,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/agents/open-brain/proposals', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/agents/open-brain/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.validateMemoryProposal.mockReturnValue([])
    mocks.createOpenBrainProposal.mockResolvedValue({
      id: 'proposal:1',
      status: 'pending',
      proposedMemory: { title: 'Memory' },
    })
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({}) as never)

    expect(response.status).toBe(401)
    expect(mocks.createOpenBrainProposal).not.toHaveBeenCalled()
  })

  it('rejects invalid proposals', async () => {
    mocks.validateMemoryProposal.mockReturnValue(['Body is required.'])

    const response = await POST(makeRequest({ title: 'Missing body' }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Body is required.' })
  })

  it('creates an approval-gated proposal with the admin user id', async () => {
    const response = await POST(makeRequest({
      kind: 'workflow',
      title: 'Memory',
      body: 'Body',
      privacyTier: 'internal_ops',
      reason: 'Needs review',
    }) as never)

    expect(response.status).toBe(201)
    expect(mocks.createOpenBrainProposal).toHaveBeenCalledWith(expect.objectContaining({
      createdBy: 'admin-user',
      title: 'Memory',
    }))
  })
})
