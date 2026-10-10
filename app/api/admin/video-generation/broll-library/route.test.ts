import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/video-generation/broll-library')
}

describe('GET /api/admin/video-generation/broll-library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before reading the library', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns assets ordered by route and coerces a null list to an empty array', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn(() => ({ order }))
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ assets: [] })
    expect(mocks.from).toHaveBeenCalledWith('broll_library')
    expect(select).toHaveBeenCalledWith('*')
    expect(order).toHaveBeenCalledWith('route', { ascending: true })
  })

  it('returns a generic error when the library query fails', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'relation missing' } }),
      })),
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch B-roll library' })
  })

  it('returns a thrown string as the error body', async () => {
    mocks.from.mockImplementation(() => {
      throw 'library down'
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'library down' })
  })
})
