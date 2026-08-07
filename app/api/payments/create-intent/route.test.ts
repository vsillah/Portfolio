import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  from: vi.fn(),
  paymentIntentsCreate: vi.fn(),
  stripe: {
    paymentIntents: {
      create: vi.fn(),
    },
  } as { paymentIntents: { create: ReturnType<typeof vi.fn> } } | null,
  formatAmountForStripe: vi.fn((amount: number) => Math.round(amount * 100)),
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
  get stripe() {
    return mocks.stripe
  },
  formatAmountForStripe: mocks.formatAmountForStripe,
}))

import { POST } from './route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockOrderLookup(order: Record<string, unknown> | null, error: { message: string } | null = null) {
  const single = vi.fn().mockResolvedValue({
    data: order,
    error: order ? null : (error || { message: 'not found' }),
  })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, single }
}

function mockOrderUpdate() {
  const eq = vi.fn().mockResolvedValue({ data: null, error: null })
  const update = vi.fn().mockReturnValue({ eq })
  return { update, eq }
}

describe('POST /api/payments/create-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    mocks.stripe = {
      paymentIntents: {
        create: mocks.paymentIntentsCreate,
      },
    }
    mocks.paymentIntentsCreate.mockResolvedValue({
      id: 'pi_123',
      client_secret: 'pi_123_secret',
    })
    mocks.formatAmountForStripe.mockImplementation((amount: number) => Math.round(amount * 100))
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('rejects requests without an orderId', async () => {
    const response = await POST(makeRequest({}))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Order ID is required')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the order does not exist', async () => {
    mocks.from.mockReturnValueOnce(mockOrderLookup(null))

    const response = await POST(makeRequest({ orderId: 42 }))
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.error).toBe('Order not found')
    expect(mocks.paymentIntentsCreate).not.toHaveBeenCalled()
  })

  it('rejects when a signed-in user does not own the order', async () => {
    mocks.from.mockReturnValueOnce(mockOrderLookup({
      id: 42,
      user_id: 'other-user',
      status: 'pending',
      final_amount: 50,
      guest_email: null,
    }))

    const response = await POST(makeRequest({ orderId: 42 }))
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('Unauthorized')
    expect(mocks.paymentIntentsCreate).not.toHaveBeenCalled()
  })

  it('rejects orders that are not pending payment', async () => {
    mocks.from.mockReturnValueOnce(mockOrderLookup({
      id: 42,
      user_id: 'user-1',
      status: 'paid',
      final_amount: 50,
      guest_email: null,
    }))

    const response = await POST(makeRequest({ orderId: 42 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Order is not pending payment')
    expect(mocks.paymentIntentsCreate).not.toHaveBeenCalled()
  })

  it('rejects zero or negative order totals', async () => {
    mocks.from.mockReturnValueOnce(mockOrderLookup({
      id: 42,
      user_id: 'user-1',
      status: 'pending',
      final_amount: 0,
      guest_email: null,
    }))

    const response = await POST(makeRequest({ orderId: 42 }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('Order total must be greater than zero')
    expect(mocks.paymentIntentsCreate).not.toHaveBeenCalled()
  })

  it('returns 503 when Stripe is not configured', async () => {
    mocks.stripe = null
    mocks.from.mockReturnValueOnce(mockOrderLookup({
      id: 42,
      user_id: 'user-1',
      status: 'pending',
      final_amount: 25,
      guest_email: 'guest@example.com',
    }))

    const response = await POST(makeRequest({ orderId: 42 }))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toBe('Payment processing not available')
  })

  it('creates a payment intent and persists the intent id on the order', async () => {
    const orderLookup = mockOrderLookup({
      id: 42,
      user_id: 'user-1',
      status: 'pending',
      final_amount: 49.5,
      guest_email: 'buyer@example.com',
    })
    const orderUpdate = mockOrderUpdate()
    mocks.from
      .mockReturnValueOnce(orderLookup)
      .mockReturnValueOnce(orderUpdate)

    const response = await POST(makeRequest({ orderId: 42 }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      clientSecret: 'pi_123_secret',
      paymentIntentId: 'pi_123',
      keyMode: 'test',
    })
    expect(mocks.formatAmountForStripe).toHaveBeenCalledWith(49.5)
    expect(mocks.paymentIntentsCreate).toHaveBeenCalledWith({
      amount: 4950,
      currency: 'usd',
      receipt_email: 'buyer@example.com',
      metadata: {
        orderId: '42',
        userId: 'user-1',
        guestEmail: 'buyer@example.com',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })
    expect(orderUpdate.update).toHaveBeenCalledWith({ stripe_payment_intent_id: 'pi_123' })
    expect(orderUpdate.eq).toHaveBeenCalledWith('id', 42)
  })
})
