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

import { DELETE } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/video-generation/broll-library/asset-1', {
    method: 'DELETE',
  })
}

describe('DELETE /api/admin/video-generation/broll-library/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before deleting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(makeRequest(), { params: { id: 'asset-1' } })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes by id and reports success even when no existence check runs', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn(() => ({ eq }))
    mocks.from.mockReturnValue({ delete: del })

    const response = await DELETE(makeRequest(), { params: { id: 'asset-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: true })
    expect(mocks.from).toHaveBeenCalledWith('broll_library')
    expect(del).toHaveBeenCalledWith()
    expect(eq).toHaveBeenCalledWith('id', 'asset-1')
  })

  it('returns a generic error when the delete fails', async () => {
    mocks.from.mockReturnValue({
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: { message: 'fk violation' } }),
      })),
    })

    const response = await DELETE(makeRequest(), { params: { id: 'asset-1' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to delete entry' })
  })

  it('returns a thrown Error message', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('delete exploded')
    })

    const response = await DELETE(makeRequest(), { params: { id: 'asset-1' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'delete exploded' })
  })
})
