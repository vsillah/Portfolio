import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  supabaseAdmin: { from: vi.fn() } as { from: ReturnType<typeof vi.fn> } | null,
  seedAgentifiedXApprovedDrafts: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdmin
  },
}))

vi.mock('@/lib/agentified-x-approved-drafts', () => ({
  seedAgentifiedXApprovedDrafts: mocks.seedAgentifiedXApprovedDrafts,
}))

import { POST } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/social-content/agentified-x/approved-drafts', {
    method: 'POST',
    headers: { authorization: 'Bearer admin-token' },
  })
}

describe('POST /api/admin/social-content/agentified-x/approved-drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.supabaseAdmin = { from: vi.fn() }
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.seedAgentifiedXApprovedDrafts.mockResolvedValue({ seeded: 4 })
  })

  it('rejects unauthenticated seeds', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    expect(mocks.seedAgentifiedXApprovedDrafts).not.toHaveBeenCalled()
  })

  it('fails closed when supabaseAdmin is unavailable', async () => {
    mocks.supabaseAdmin = null

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Server configuration error' })
    expect(mocks.seedAgentifiedXApprovedDrafts).not.toHaveBeenCalled()
  })

  it('seeds drafts as the authenticated admin', async () => {
    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ seeded: 4 })
    expect(mocks.seedAgentifiedXApprovedDrafts).toHaveBeenCalledWith({
      admin: mocks.supabaseAdmin,
      reviewedByUserId: 'admin-1',
    })
  })
})
