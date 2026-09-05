import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  from: vi.fn(),
  createPaymentIntent: vi.fn(),
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

vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: mocks.createPaymentIntent,
    },
  },
  formatAmountForStripe: (amount: number) => Math.round(amount * 100),
}))

import { POST } from './route'

function request(body: Record<string, unknown>, headers: Record<string, string> = { Authorization: 'Bearer owner-token' }) {
  return new NextRequest('http://localhost/api/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
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
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in API test') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' }, isAdmin: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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

  it.each([{}, { 'x-guest-email': '   ' }] as Record<string, string>[])('rejects a caller without credentials before any lookup or provider call: %j', async (headers) => {
    const response = await POST(request({ orderId: 12 }, headers))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication or guest email required' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled()
  })

  it.each([
    { user_id: 'someone-else', guest_email: 'buyer@example.com' },
    { user_id: null, guest_email: null },
    { user_id: null, guest_email: 'other@example.com' },
  ])('rejects a guest without guest-order ownership: %j', async (ownership) => {
    const update = vi.fn()
    mocks.from.mockReturnValue({ ...orderLookup({ id: 12, status: 'pending', final_amount: 150, ...ownership }), update })
    const response = await POST(request({ orderId: 12 }, { 'x-guest-email': 'buyer@example.com' }))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(update).not.toHaveBeenCalled()
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled()
  })

  it('rejects an invalid bearer token even with matching guest credentials', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    const req = request({ orderId: 12 }, { Authorization: 'Bearer invalid', 'x-guest-email': 'buyer@example.com' })
    const response = await POST(req)
    expect(response.status).toBe(401)
    expect(mocks.verifyAuth).toHaveBeenCalledWith(req)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled()
  })

  it.each(['owner', 'guest'])('creates an intent only after authorizing the %s', async (kind) => {
    mocks.createPaymentIntent.mockResolvedValue({ id: 'pi_authorized', client_secret: 'test_secret' })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    const lookup = orderLookup({
      id: 12, user_id: kind === 'owner' ? 'user-1' : null,
      status: 'pending', final_amount: 150, guest_email: kind === 'owner' ? null : 'buyer@example.com',
    })
    mocks.from.mockImplementation((table: string) => table === 'user_profiles'
      ? orderLookup({ email: 'owner@example.com' }) : { ...lookup, update })
    const req = kind === 'owner' ? request({ orderId: 12 })
      : request({ orderId: 12 }, { 'x-guest-email': ' BUYER@EXAMPLE.COM ' })
    const response = await POST(req)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({ clientSecret: 'test_secret', paymentIntentId: 'pi_authorized' }))
    expect(mocks.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
      amount: 15000, currency: 'usd', receipt_email: kind === 'owner' ? 'owner@example.com' : 'buyer@example.com',
      metadata: { orderId: '12', userId: kind === 'owner' ? 'user-1' : 'guest', guestEmail: kind === 'owner' ? '' : 'buyer@example.com' },
    }))
    expect(lookup.select).toHaveBeenCalledWith('id, user_id, guest_email, status, final_amount')
    expect(update).toHaveBeenCalledWith({ stripe_payment_intent_id: 'pi_authorized' })
    expect(updateEq).toHaveBeenCalledWith('id', 12)
    if (kind === 'owner') expect(mocks.verifyAuth).toHaveBeenCalledWith(req)
    else expect(mocks.verifyAuth).not.toHaveBeenCalled()
  })

  it.each(['12junk', -1, 1.5, '12'])('rejects invalid order id %j without querying or paying', async (orderId) => {
    const response = await POST(request({ orderId }))
    expect(response.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createPaymentIntent).not.toHaveBeenCalled()
  })
})
