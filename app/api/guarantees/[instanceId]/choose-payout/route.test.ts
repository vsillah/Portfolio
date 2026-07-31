import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  calculatePayoutAmount: vi.fn(),
  calculateRolloverCredit: vi.fn(),
  getResolvedStatus: vi.fn(),
  createStripeRefund: vi.fn(),
  findOrCreateStripeCustomer: vi.fn(),
  createStripeSubscription: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/guarantees', () => ({
  calculatePayoutAmount: mocks.calculatePayoutAmount,
  calculateRolloverCredit: mocks.calculateRolloverCredit,
  getResolvedStatus: mocks.getResolvedStatus,
}))

vi.mock('@/lib/stripe-subscriptions', () => ({
  createStripeRefund: mocks.createStripeRefund,
  findOrCreateStripeCustomer: mocks.findOrCreateStripeCustomer,
  createStripeSubscription: mocks.createStripeSubscription,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/guarantees/inst-1/choose-payout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function chain(result: Record<string, unknown>) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.insert = vi.fn(self)
  api.update = vi.fn(self)
  api.eq = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: Record<string, unknown>) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

function baseInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inst-1',
    status: 'conditions_met',
    client_email: 'client@example.com',
    client_name: 'Client',
    user_id: 'user-1',
    order_id: 'order-1',
    purchase_amount: 1000,
    guarantee_templates: {
      payout_amount_type: 'full',
      payout_amount_value: null,
      rollover_bonus_multiplier: 1.25,
      rollover_continuity_plan_id: null,
      rollover_upsell_service_ids: null,
    },
    ...overrides,
  }
}

describe('POST /api/guarantees/[instanceId]/choose-payout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.calculatePayoutAmount.mockReturnValue(1000)
    mocks.calculateRolloverCredit.mockReturnValue(1250)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects invalid payout types before loading the instance', async () => {
    const response = await POST(
      makeRequest({ payout_type: 'cash', client_email: 'client@example.com' }),
      { params: { instanceId: 'inst-1' } },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid payout_type. Must be one of: refund, credit, rollover_upsell, rollover_continuity',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a client email for ownership verification', async () => {
    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: '   ' }),
      { params: { instanceId: 'inst-1' } },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Client email is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the guarantee instance is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({ data: null, error: { message: 'missing' } })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'client@example.com' }),
      { params: { instanceId: 'missing' } },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Guarantee instance not found',
    })
  })

  it('rejects payout choice when the email does not match the guarantee owner', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({ data: baseInstance(), error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'intruder@example.com' }),
      { params: { instanceId: 'inst-1' } },
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('blocks payout choice unless status is conditions_met', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({ data: baseInstance({ status: 'active' }), error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ payout_type: 'credit', client_email: 'Client@Example.com' }),
      { params: { instanceId: 'inst-1' } },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Payout can only be chosen when status is conditions_met. Current: active',
    })
  })

  it('rejects refunds when the order has no Stripe payment intent', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({ data: baseInstance(), error: null })
      }
      if (table === 'orders') {
        return chain({ data: { stripe_payment_intent_id: null }, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'client@example.com' }),
      { params: { instanceId: 'inst-1' } },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No payment intent found for refund processing',
    })
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('issues a refund and marks the order refunded when Stripe succeeds', async () => {
    const guaranteeUpdates: Record<string, unknown>[] = []
    const orderUpdates: Record<string, unknown>[] = []
    mocks.createStripeRefund.mockResolvedValue({ id: 're_123' })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        const api = chain({ data: baseInstance(), error: null })
        api.update = vi.fn((payload: Record<string, unknown>) => {
          guaranteeUpdates.push(payload)
          return api
        })
        return api
      }
      if (table === 'orders') {
        const api = chain({
          data: { stripe_payment_intent_id: 'pi_123' },
          error: null,
        })
        api.update = vi.fn((payload: Record<string, unknown>) => {
          orderUpdates.push(payload)
          return api
        })
        return api
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'client@example.com' }),
      { params: { instanceId: 'inst-1' } },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      result: 'refund_issued',
      amount: 1000,
    })
    expect(mocks.createStripeRefund).toHaveBeenCalledWith('pi_123', 1000)
    expect(guaranteeUpdates[0]).toMatchObject({
      payout_type: 'refund',
      status: 'refund_issued',
      stripe_refund_id: 're_123',
    })
    expect(orderUpdates[0]).toEqual({ status: 'refunded' })
  })

  it('issues a one-time credit discount code for credit payouts', async () => {
    const guaranteeUpdates: Record<string, unknown>[] = []
    const discountInserts: Record<string, unknown>[] = []

    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        const api = chain({ data: baseInstance(), error: null })
        api.update = vi.fn((payload: Record<string, unknown>) => {
          guaranteeUpdates.push(payload)
          return api
        })
        return api
      }
      if (table === 'discount_codes') {
        const api = chain({ data: { id: 42 }, error: null })
        api.insert = vi.fn((payload: Record<string, unknown>) => {
          discountInserts.push(payload)
          return api
        })
        return api
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ payout_type: 'credit', client_email: 'client@example.com' }),
      { params: { instanceId: 'inst-abcd1234' } },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      result: 'credit_issued',
      discount_code: 'GUAR-INST-ABC',
      amount: 1000,
    })
    expect(discountInserts[0]).toMatchObject({
      code: 'GUAR-INST-ABC',
      discount_type: 'fixed',
      discount_value: 1000,
      max_uses: 1,
      is_active: true,
    })
    expect(guaranteeUpdates[0]).toMatchObject({
      payout_type: 'credit',
      status: 'credit_issued',
      discount_code_id: 42,
    })
  })

  it('rejects continuity rollover when the template has no continuity plan', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({ data: baseInstance(), error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        payout_type: 'rollover_continuity',
        client_email: 'client@example.com',
      }),
      { params: { instanceId: 'inst-1' } },
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No continuity plan configured for this guarantee template',
    })
    expect(mocks.findOrCreateStripeCustomer).not.toHaveBeenCalled()
  })
})
