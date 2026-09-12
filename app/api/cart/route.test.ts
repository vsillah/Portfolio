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

import { GET, POST } from './route'

function makeGetRequest() {
  return new NextRequest('http://localhost/api/cart')
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated reads before querying cart_items', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps product and service rows into the client cart shape', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { product_id: 7, service_id: null, quantity: 2 },
        { product_id: null, service_id: 'svc-1', quantity: 1 },
      ],
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      cartItems: [
        { productId: 7, quantity: 2, itemType: 'product' },
        { serviceId: 'svc-1', quantity: 1, itemType: 'service' },
      ],
    })
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})

describe('POST /api/cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated syncs before mutating cart_items', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makePostRequest({ cartItems: [] }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a non-array cartItems payload', async () => {
    const response = await POST(makePostRequest({ cartItems: { productId: 1 } }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid cart items' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('replaces the user cart and drops rows with neither product nor service', async () => {
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn().mockReturnValue({ eq: deleteEq })
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ delete: del, insert })

    const response = await POST(
      makePostRequest({
        cartItems: [
          { itemType: 'product', productId: 9, quantity: 3 },
          { itemType: 'service', serviceId: 'svc-2', quantity: 1 },
          { itemType: 'product', quantity: 4 },
        ],
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(deleteEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(insert).toHaveBeenCalledWith([
      { user_id: 'user-1', product_id: 9, service_id: null, quantity: 3 },
      { user_id: 'user-1', product_id: null, service_id: 'svc-2', quantity: 1 },
    ])
  })
})
