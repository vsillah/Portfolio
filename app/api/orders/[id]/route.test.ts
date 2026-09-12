import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
  isAuthError: (result: object) => 'error' in result,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(id: string, headers: Record<string, string> = { Authorization: 'Bearer owner-token' }) {
  return new NextRequest(`http://localhost/api/orders/${id}`, { headers })
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
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in API test') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' }, isAdmin: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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

  it.each([{}, { 'x-guest-email': '   ' }] as Record<string, string>[])('rejects missing credentials before reading order data: %j', async (headers) => {
    const response = await GET(request('42', headers), { params: { id: '42' } })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication or guest email required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not fall back to guest email when the bearer token is invalid', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    const req = request('42', { Authorization: 'Bearer invalid', 'x-guest-email': 'buyer@example.com' })
    const response = await GET(req, { params: { id: '42' } })
    expect(response.status).toBe(401)
    expect(mocks.verifyAuth).toHaveBeenCalledWith(req)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    { user_id: null, guest_email: 'someone-else@example.com' },
    { user_id: null, guest_email: null },
    { user_id: 'someone-else', guest_email: 'buyer@example.com' },
  ])('denies a guest without matching guest-order ownership: %j', async (ownership) => {
    mockOrderLookup({ data: { id: 42, ...ownership }, error: null })
    const response = await GET(request('42', { 'x-guest-email': 'buyer@example.com' }), { params: { id: '42' } })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })

  it.each(['pending', 'cancelled', 'refunded', 'completed'])('gates guest paid asset fields by order status: %s', async (status) => {
    const product = {
      id: 9, title: 'Guide', type: 'template',
      file_path: 'private/curriculum.pdf',
      asset_url: 'https://private.example/asset.zip',
      instructions_file_path: 'private/instructions.pdf',
    }
    mockOrderLookup({ data: {
      id: 42, user_id: null, guest_email: ' Buyer@Example.com ', status,
      order_items: [{ id: 1, products: { ...product } }],
    }, error: null })
    const response = await GET(request('42', { 'x-guest-email': 'BUYER@example.com' }), { params: { id: '42' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const { order } = await response.json()
    expect(order.order_items[0].products).toEqual(status === 'completed'
      ? product : { id: 9, title: 'Guide', type: 'template' })
    expect(mocks.verifyAuth).not.toHaveBeenCalled()
  })

  it('withholds paid asset fields from an authenticated owner before completion', async () => {
    mockOrderLookup({ data: { id: 42, user_id: 'user-1', status: 'pending',
      order_items: [{ products: { id: 9, file_path: 'private/file.pdf', asset_url: 'https://private.example', instructions_file_path: 'guide.pdf' } }],
    }, error: null })
    const response = await GET(request('42'), { params: { id: '42' } })
    expect(response.status).toBe(200)
    const { order } = await response.json()
    expect(order.order_items[0].products).toEqual({ id: 9 })
  })

  it.each(['42junk', '-1', '1.5'])('rejects malformed order id %s', async (id) => {
    const response = await GET(request(id), { params: { id } })
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
