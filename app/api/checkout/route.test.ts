import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

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

function makeRequest(body: unknown, token = 'user-token') {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'buyer@example.com' } },
      error: null,
    })
  })

  it('requires a signed-in user before creating an order', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid' },
    })

    const response = await POST(makeRequest({ cartItems: [{ itemType: 'product', productId: 1, quantity: 1 }] }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Please sign in to complete your purchase. We use your account to deliver your order and to follow up with you.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an empty cart before touching the database', async () => {
    const response = await POST(makeRequest({ cartItems: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Cart is empty' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires shipping address for merchandise variants', async () => {
    const response = await POST(makeRequest({
      cartItems: [{
        itemType: 'product',
        productId: 11,
        variantId: 99,
        quantity: 1,
      }],
      subtotal: 40,
      discountAmount: 0,
      finalTotal: 40,
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Shipping address is required for physical products. Please enter your delivery address.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a digital product order without requiring shipping', async () => {
    const orderInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 501, user_id: 'user-1', status: 'pending' },
          error: null,
        }),
      }),
    })
    const itemsInsert = vi.fn().mockResolvedValue({ error: null })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 11, price: 25, is_print_on_demand: false }],
              error: null,
            }),
          }),
        }
      }
      if (table === 'orders') {
        return { insert: orderInsert }
      }
      if (table === 'order_items') {
        return { insert: itemsInsert }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest({
      cartItems: [{
        itemType: 'product',
        productId: 11,
        quantity: 1,
      }],
      subtotal: 25,
      discountAmount: 0,
      finalTotal: 25,
      hasQuoteBasedItems: false,
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      order: { id: 501 },
      hasQuoteBasedItems: false,
    })
    expect(orderInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      total_amount: 25,
      final_amount: 25,
      status: 'pending',
    }))
    expect(itemsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        order_id: 501,
        product_id: 11,
        quantity: 1,
        price_at_purchase: 25,
      }),
    ])
  })
})
