import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  bulkLinkEvidence: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/value-evidence-linker', () => ({
  bulkLinkEvidence: mocks.bulkLinkEvidence,
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/value-evidence/calculations/recalculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/calculations/recalculate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.bulkLinkEvidence.mockResolvedValue({ linked: 3, updated: 1 })
  })

  it('rejects unauthenticated requests before recalculating', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ industry: 'healthcare' }))

    expect(response.status).toBe(401)
    expect(mocks.bulkLinkEvidence).not.toHaveBeenCalled()
  })

  it('forwards optional category and industry scope to bulkLinkEvidence', async () => {
    const response = await POST(
      request({ pain_point_category_id: 'pp-1', industry: 'healthcare' }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ linked: 3, updated: 1 })
    expect(mocks.bulkLinkEvidence).toHaveBeenCalledWith('pp-1', 'healthcare')
  })

  it('returns a generic 500 message when bulk linking throws', async () => {
    mocks.bulkLinkEvidence.mockRejectedValue(new Error('constraint boom'))

    const response = await POST(request({}))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Something went wrong. Please try again.',
    })
  })
})
