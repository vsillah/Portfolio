import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
    },
  },
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request(body: unknown, token?: string) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function signedIn() {
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  })
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires a signed-in user before creating an order', async () => {
    const missing = await POST(request({ cartItems: [{ itemType: 'product', productId: 1, quantity: 1 }] }))
    expect(missing.status).toBe(401)
    expect(await missing.json()).toMatchObject({
      error: expect.stringContaining('sign in'),
    })
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid session token', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'bad jwt' },
    })

    const response = await POST(request({ cartItems: [{ itemType: 'product', productId: 1, quantity: 1 }] }, 'bad-token'))

    expect(response.status).toBe(401)
    expect(mocks.getUser).toHaveBeenCalledWith('bad-token')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an empty cart after authentication', async () => {
    signedIn()

    const response = await POST(request({ cartItems: [] }, 'user-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Cart is empty' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a shipping address for merchandise variants', async () => {
    signedIn()

    const response = await POST(request({
      cartItems: [{
        itemType: 'product',
        productId: 1,
        variantId: 77,
        quantity: 1,
      }],
    }, 'user-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('Shipping address is required'),
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a pending order and line items for a priced digital product', async () => {
    signedIn()
    const orderInsert = vi.fn()
    const itemInsert = vi.fn().mockResolvedValue({ error: null })
    const productIn = vi.fn().mockResolvedValue({
      data: [{ id: 11, price: 40, is_print_on_demand: false }],
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn(() => ({ in: productIn })),
        }
      }
      if (table === 'orders') {
        return {
          insert: (payload: Record<string, unknown>) => {
            orderInsert(payload)
            return {
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: 501, ...payload },
                  error: null,
                }),
              }),
            }
          },
        }
      }
      if (table === 'order_items') {
        return { insert: itemInsert }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request({
      cartItems: [{ itemType: 'product', productId: 11, quantity: 2 }],
      subtotal: 80,
      discountAmount: 0,
      finalTotal: 80,
    }, 'user-token'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(orderInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      guest_email: null,
      total_amount: 80,
      final_amount: 80,
      status: 'pending',
    }))
    expect(itemInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        order_id: 501,
        product_id: 11,
        service_id: null,
        quantity: 2,
        price_at_purchase: 40,
      }),
    ])
    expect(productIn).toHaveBeenCalledWith('id', [11])
  })

  it('marks quote-based checkouts as quote_pending without charging a service price', async () => {
    signedIn()
    const orderInsert = vi.fn()
    const itemInsert = vi.fn().mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'services') {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'svc-1', price: 1200, is_quote_based: true }],
              error: null,
            }),
          })),
        }
      }
      if (table === 'orders') {
        return {
          insert: (payload: Record<string, unknown>) => {
            orderInsert(payload)
            return {
              select: () => ({
                single: () => Promise.resolve({
                  data: { id: 777, ...payload },
                  error: null,
                }),
              }),
            }
          },
        }
      }
      if (table === 'order_items') {
        return { insert: itemInsert }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request({
      cartItems: [{ itemType: 'service', serviceId: 'svc-1', quantity: 1 }],
      subtotal: 0,
      discountAmount: 0,
      finalTotal: 0,
      hasQuoteBasedItems: true,
    }, 'user-token'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.hasQuoteBasedItems).toBe(true)
    expect(orderInsert).toHaveBeenCalledWith(expect.objectContaining({
      status: 'quote_pending',
      user_id: 'user-1',
    }))
    expect(itemInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        order_id: 777,
        service_id: 'svc-1',
        product_id: null,
        price_at_purchase: 0,
      }),
    ])
  })
})
