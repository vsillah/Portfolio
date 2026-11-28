import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  listAvatars: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/heygen', () => ({
  listAvatars: mocks.listAvatars,
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/video-generation/avatars')
}

describe('GET /api/admin/video-generation/avatars', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before calling HeyGen', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.listAvatars).not.toHaveBeenCalled()
  })

  it('returns avatars from HeyGen', async () => {
    mocks.listAvatars.mockResolvedValue({
      avatars: [{ avatar_id: 'av-1', avatar_name: 'Ada' }],
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      avatars: [{ avatar_id: 'av-1', avatar_name: 'Ada' }],
    })
  })

  it('returns an empty list with the HeyGen error instead of 500', async () => {
    mocks.listAvatars.mockResolvedValue({ error: 'HeyGen unavailable' })

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      avatars: [],
      error: 'HeyGen unavailable',
    })
  })

  it('returns an empty list with the thrown message instead of 500', async () => {
    mocks.listAvatars.mockRejectedValue(new Error('network down'))

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      avatars: [],
      error: 'network down',
    })
  })
})
