import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  collectLiveSocialTopicCoverage: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/social-topic-source-coverage', () => ({
  collectLiveSocialTopicCoverage: mocks.collectLiveSocialTopicCoverage,
}))

import { GET } from './route'

const coverage = {
  status: 'ready',
  generated_at: '2026-10-11T10:00:00.000Z',
  receipts: [],
  products: [],
}

function request() {
  return new NextRequest('http://localhost/api/admin/social-content/source-coverage', {
    headers: { authorization: 'Bearer admin-token' },
  })
}

describe('GET /api/admin/social-content/source-coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.collectLiveSocialTopicCoverage.mockResolvedValue(coverage)
  })

  it('requires an admin session before reading live coverage', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.collectLiveSocialTopicCoverage).not.toHaveBeenCalled()
  })

  it('reads coverage without persisting a new scan', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(mocks.collectLiveSocialTopicCoverage).toHaveBeenCalledWith({ persist: false })
    expect(await response.json()).toEqual({ coverage })
  })

  it('returns a closed message when the read fails without an Error', async () => {
    mocks.collectLiveSocialTopicCoverage.mockRejectedValue('database unavailable')

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to read source coverage' })
  })
})
