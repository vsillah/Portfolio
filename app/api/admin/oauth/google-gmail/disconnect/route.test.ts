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

function request() {
  return new NextRequest('http://localhost/api/admin/oauth/google-gmail/disconnect', {
    method: 'DELETE',
    headers: { authorization: 'Bearer token' },
  })
}

describe('DELETE /api/admin/oauth/google-gmail/disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires admin auth before deleting credentials', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes only the authenticated admin credentials row', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ delete: del })

    const response = await DELETE(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: 'Gmail connection removed.' })
    expect(mocks.from).toHaveBeenCalledWith('admin_gmail_user_credentials')
    expect(eq).toHaveBeenCalledWith('user_id', 'admin-user')
  })

  it('returns a generic 500 when the delete fails', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'fk violation' } })
    const del = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ delete: del })

    const response = await DELETE(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Something went wrong. Please try again.',
    })
  })
})
