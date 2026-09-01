import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  from: vi.fn(),
  createPaymentIntent: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: mocks.createPaymentIntent,
    },
  },
  formatAmountForStripe: (amount: number) => Math.round(amount * 100),
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function orderLookup(order: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: order,
          error: order ? null : { message: 'not found' },
        }),
      }),
    }),
  }
}

describe('POST /api/payments/create-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
  })

  it('requires an order id', async () => {
    const response = await POST(request({}))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Order ID is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not exist', async () => {
    mocks.from.mockReturnValue(orderLookup(null))

    const response = await POST(request({ orderId: 99 }))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Order not found' })
  })

  it('forbids a signed-in user from paying someone else\'s order', async () => {
    mocks.from.mockReturnValue(orderLookup({
      id: 12,
      user_id: 'other-user',
      status: 'pending',
      final_amount: 150,
    }))

    const response = await POST(request({ orderId: 12 }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled()
  })

  it('rejects orders that are not pending or have a zero total', async () => {
    mocks.from.mockReturnValue(orderLookup({
      id: 12,
      user_id: 'user-1',
      status: 'completed',
      final_amount: 150,
    }))
    const completed = await POST(request({ orderId: 12 }))
    expect(completed.status).toBe(400)
    expect(await completed.json()).toEqual({ error: 'Order is not pending payment' })

    mocks.from.mockReturnValue(orderLookup({
      id: 13,
      user_id: 'user-1',
      status: 'pending',
      final_amount: 0,
    }))
    const zero = await POST(request({ orderId: 13 }))
    expect(zero.status).toBe(400)
    expect(await zero.json()).toEqual({ error: 'Order total must be greater than zero' })
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled()
  })
})
