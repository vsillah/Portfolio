import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  from: vi.fn(),
  getSignedUrl: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/storage', () => ({
  getSignedUrl: mocks.getSignedUrl,
}))

import { GET } from './route'

function makeRequest({
  productId = '11',
  orderId,
  guestEmail,
}: {
  productId?: string
  orderId?: string
  guestEmail?: string
} = {}) {
  const url = new URL(`http://localhost/api/downloads/${productId}`)
  if (orderId) url.searchParams.set('orderId', orderId)
  const headers: Record<string, string> = {}
  if (guestEmail) headers['x-guest-email'] = guestEmail
  return new NextRequest(url, { headers })
}

function params(productId = '11') {
  return { params: { productId } }
}

type TableResult = { data: unknown; error: { message?: string } | null }

function mockTables(results: Record<string, TableResult>) {
  mocks.from.mockImplementation((table: string) => {
    const result = results[table]
    if (!result) throw new Error(`Unexpected table: ${table}`)
    const single = vi.fn().mockResolvedValue(result)
    const eq2 = vi.fn().mockReturnValue({ single })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2, single })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    const insert = vi.fn().mockResolvedValue({ error: null })
    return { select, insert }
  })
}

describe('GET /api/downloads/[productId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.getSignedUrl.mockResolvedValue('https://signed.example/file.pdf')
  })

  it('requires an orderId', async () => {
    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Order ID is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the order is missing', async () => {
    mockTables({
      orders: { data: null, error: { message: 'not found' } },
    })

    const response = await GET(makeRequest({ orderId: '99' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Order not found' })
  })

  it('forbids downloads until the order is completed', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'user-1', guest_email: null, status: 'pending' },
        error: null,
      },
    })

    const response = await GET(makeRequest({ orderId: '99' }), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Order is not completed' })
  })

  it('forbids an authenticated user from downloading another user\'s order', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'other-user', guest_email: null, status: 'completed' },
        error: null,
      },
    })

    const response = await GET(makeRequest({ orderId: '99' }), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('forbids a guest whose email does not match the order', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    mockTables({
      orders: {
        data: {
          id: 99,
          user_id: null,
          guest_email: 'buyer@example.com',
          status: 'completed',
        },
        error: null,
      },
    })

    const response = await GET(
      makeRequest({ orderId: '99', guestEmail: 'intruder@example.com' }),
      params(),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns a signed URL when the owner purchased the product', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'user-1', guest_email: null, status: 'completed' },
        error: null,
      },
      order_items: { data: { id: 'item-1' }, error: null },
      products: { data: { file_path: 'docs/guide.pdf', title: 'Guide.pdf' }, error: null },
      downloads: { data: null, error: null },
    })

    const response = await GET(makeRequest({ orderId: '99' }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://signed.example/file.pdf',
      fileName: 'Guide.pdf',
    })
    expect(mocks.getSignedUrl).toHaveBeenCalledWith('products', 'docs/guide.pdf', 3600)
  })
})
