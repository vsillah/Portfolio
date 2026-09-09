import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  from: vi.fn(),
  getSignedUrl: vi.fn(),
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

vi.mock('@/lib/storage', () => ({
  getSignedUrl: mocks.getSignedUrl,
}))

import { GET } from './route'

function makeRequest({
  productId = '11',
  orderId,
  guestEmail,
  authenticated = true,
}: {
  productId?: string
  orderId?: string
  guestEmail?: string
  authenticated?: boolean
} = {}) {
  const url = new URL(`http://localhost/api/downloads/${productId}`)
  if (orderId) url.searchParams.set('orderId', orderId)
  const headers: Record<string, string> = authenticated ? { Authorization: 'Bearer owner-token' } : {}
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
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in API test') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' }, isAdmin: false })
    mocks.getSignedUrl.mockResolvedValue('https://signed.example/file.pdf')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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
      makeRequest({ orderId: '99', authenticated: false, guestEmail: 'intruder@example.com' }),
      params(),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it.each([undefined, '', '   '])('rejects a guest without a nonempty email: %j', async (guestEmail) => {
    const response = await GET(makeRequest({ orderId: '99', authenticated: false, guestEmail }), params())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication or guest email required' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it.each([
    { user_id: 'someone-else', guest_email: 'buyer@example.com' },
    { user_id: null, guest_email: null },
  ])('denies guest access to account orders or orders without email: %j', async (ownership) => {
    mockTables({ orders: { data: { id: 99, status: 'completed', ...ownership }, error: null } })
    const response = await GET(makeRequest({ orderId: '99', authenticated: false, guestEmail: 'buyer@example.com' }), params())
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from.mock.calls).toEqual([['orders']])
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects invalid bearer credentials even with a matching guest email', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    const req = makeRequest({ orderId: '99', guestEmail: 'buyer@example.com' })
    const response = await GET(req, params())
    expect(response.status).toBe(401)
    expect(mocks.verifyAuth).toHaveBeenCalledWith(req)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('returns a signed URL when a guest email matches the order', async () => {
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
      order_items: { data: { id: 'item-1' }, error: null },
      products: { data: { file_path: 'docs/guide.pdf', title: 'Guide.pdf' }, error: null },
    })

    const response = await GET(
      makeRequest({ orderId: '99', authenticated: false, guestEmail: ' BUYER@EXAMPLE.COM ' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      downloadUrl: 'https://signed.example/file.pdf',
      fileName: 'Guide.pdf',
    })
  })

  it('returns 404 when the product is not on the order', async () => {
    mockTables({
      orders: {
        data: { id: 99, user_id: 'user-1', guest_email: null, status: 'completed' },
        error: null,
      },
      order_items: { data: null, error: { message: 'not found' } },
    })

    const response = await GET(makeRequest({ orderId: '99' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Product not found in order' })
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
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

  it.each(['pending', 'cancelled', 'refunded'])('does not sign files for a matching guest on a %s order', async (status) => {
    mockTables({ orders: { data: { id: 99, user_id: null, guest_email: 'buyer@example.com', status }, error: null } })
    const response = await GET(makeRequest({ orderId: '99', authenticated: false, guestEmail: 'buyer@example.com' }), params())
    expect(response.status).toBe(403)
    expect(mocks.from.mock.calls).toEqual([['orders']])
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it.each([
    { orderId: '99junk', productId: '11' },
    { orderId: '99', productId: '11junk' },
    { orderId: '-1', productId: '11' },
  ])('rejects malformed identifiers before reading orders: %j', async ({ orderId, productId }) => {
    const response = await GET(makeRequest({ orderId, productId }), params(productId))
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.getSignedUrl).not.toHaveBeenCalled()
  })

  it('does not expose storage error details in the response', async () => {
    mockTables({
      orders: { data: { id: 99, user_id: 'user-1', status: 'completed' }, error: null },
      order_items: { data: { id: 'item-1' }, error: null },
      products: { data: { file_path: 'private/file.pdf' }, error: null },
    })
    mocks.getSignedUrl.mockRejectedValue(new Error('Storage failed for private/file.pdf'))
    const response = await GET(makeRequest({ orderId: '99' }), params())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to generate download' })
    expect(mocks.from).not.toHaveBeenCalledWith('downloads')
  })

})
