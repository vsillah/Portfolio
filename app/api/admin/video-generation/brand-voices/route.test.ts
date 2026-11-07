import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listBrandVoices: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/heygen', () => ({
  listBrandVoices: mocks.listBrandVoices,
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/video-generation/brand-voices')
}

describe('GET /api/admin/video-generation/brand-voices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before calling HeyGen', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.listBrandVoices).not.toHaveBeenCalled()
  })

  it('returns the brand voice catalog', async () => {
    mocks.listBrandVoices.mockResolvedValue({
      brandVoices: [{ id: 'voice-1', name: 'AmaduTown' }],
      error: null,
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      brandVoices: [{ id: 'voice-1', name: 'AmaduTown' }],
    })
  })

  it('returns an empty catalog with the provider error', async () => {
    mocks.listBrandVoices.mockResolvedValue({
      brandVoices: [{ id: 'ignored', name: 'Ignored' }],
      error: 'HEYGEN_API_KEY is not configured',
    })

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      brandVoices: [],
      error: 'HEYGEN_API_KEY is not configured',
    })
  })

  it('returns the thrown message when the catalog call rejects', async () => {
    mocks.listBrandVoices.mockRejectedValue(new Error('network down'))

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ brandVoices: [], error: 'network down' })
  })
})
