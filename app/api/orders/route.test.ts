import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/orders', {
    headers: { authorization: 'Bearer user-token' },
  })
}

describe('GET /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' }, isAdmin: false })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before querying orders', async () => {
    mocks.verifyAuth.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns only the authenticated user orders newest first', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 2 }, { id: 1 }],
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      orders: [{ id: 2 }, { id: 1 }],
    })
    expect(mocks.from).toHaveBeenCalledWith('orders')
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('normalizes a null result set to an empty array', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ orders: [] })
  })
})
