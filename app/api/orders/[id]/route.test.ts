import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(id: string) {
  return new NextRequest(`http://localhost/api/orders/${id}`)
}

function mockOrderLookup(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockReturnValue({ select })
  return { select, eq }
}

describe('GET /api/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
  })

  it('returns 404 when the order does not exist', async () => {
    mockOrderLookup({ data: null, error: { message: 'No rows' } })

    const response = await GET(request('42'), { params: { id: '42' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Order not found' })
    expect(mocks.from).toHaveBeenCalledWith('orders')
  })

  it('returns 403 when an authenticated user does not own the order', async () => {
    mockOrderLookup({
      data: {
        id: 42,
        user_id: 'someone-else',
        order_items: [],
      },
      error: null,
    })

    const response = await GET(request('42'), { params: { id: '42' } })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns the order payload when the authenticated user owns it', async () => {
    const order = {
      id: 42,
      user_id: 'user-1',
      status: 'pending',
      order_items: [{ id: 1, product_id: 9 }],
    }
    const lookup = mockOrderLookup({ data: order, error: null })

    const response = await GET(request('42'), { params: { id: '42' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ order })
    expect(lookup.eq).toHaveBeenCalledWith('id', 42)
  })
})
