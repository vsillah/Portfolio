import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

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

function request(id = '42') {
  return new NextRequest(`http://localhost/api/orders/${id}`)
}

function mockOrderLookup(order: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({
    data: order,
    error: order ? null : { message: 'not found' },
  })
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
    mockOrderLookup(null)

    const response = await GET(request('999'), { params: { id: '999' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Order not found' })
  })

  it('forbids access when the authenticated user does not own the order', async () => {
    mockOrderLookup({ id: 42, user_id: 'other-user' })

    const response = await GET(request('42'), { params: { id: '42' } })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns the order for the owning authenticated user', async () => {
    const order = {
      id: 42,
      user_id: 'user-1',
      order_items: [{ id: 1, product_id: 11 }],
    }
    mockOrderLookup(order)

    const response = await GET(request('42'), { params: { id: '42' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ order })
  })
})
