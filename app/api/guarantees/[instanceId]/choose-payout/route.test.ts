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
  return new NextRequest(
    'http://localhost/api/guarantees/inst-1/choose-payout',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

function params(instanceId = 'inst-1') {
  return { params: { instanceId } }
}

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.insert = vi.fn(self)
  api.update = vi.fn(self)
  api.eq = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: { data?: unknown; error?: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

function baseInstance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inst-1',
    status: 'conditions_met',
    client_email: 'client@example.com',
    client_name: 'Client Name',
    user_id: 'user-1',
    purchase_amount: 1000,
    order_id: 'order-1',
    guarantee_templates: {
      payout_amount_type: 'full',
      payout_amount_value: null,
      rollover_bonus_multiplier: 1.25,
      rollover_continuity_plan_id: 'plan-1',
    },
    ...overrides,
  }
}

describe('POST /api/guarantees/[instanceId]/choose-payout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.calculatePayoutAmount.mockReturnValue(1000)
    mocks.calculateRolloverCredit.mockReturnValue(1250)
  })

  it('rejects an invalid payout_type before loading the instance', async () => {
    const response = await POST(
      makeRequest({ payout_type: 'cash', client_email: 'client@example.com' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid payout_type. Must be one of: refund, credit, rollover_upsell, rollover_continuity',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing or whitespace-only client email', async () => {
    const missing = await POST(makeRequest({ payout_type: 'refund' }), params())
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'Client email is required' })

    const whitespace = await POST(
      makeRequest({ payout_type: 'refund', client_email: '   ' }),
      params(),
    )
    expect(whitespace.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the guarantee instance is missing', async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { message: 'missing' } }))

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'client@example.com' }),
      params(),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Guarantee instance not found' })
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('returns 403 when the email does not own the instance', async () => {
    mocks.from.mockReturnValue(chain({ data: baseInstance(), error: null }))

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'other@example.com' }),
      params(),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('compares ownership case-insensitively', async () => {
    const instanceLookup = chain({ data: baseInstance(), error: null })
    const orderLookup = chain({
      data: { stripe_payment_intent_id: null },
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') return instanceLookup
      if (table === 'orders') return orderLookup
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'CLIENT@example.com' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No payment intent found for refund processing',
    })
  })

  it('rejects payouts when the instance is not conditions_met', async () => {
    mocks.from.mockReturnValue(
      chain({ data: baseInstance({ status: 'active' }), error: null }),
    )

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'client@example.com' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Payout can only be chosen when status is conditions_met. Current: active',
    })
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('issues a Stripe refund and marks the order refunded', async () => {
    const instanceLookup = chain({ data: baseInstance(), error: null })
    const instanceUpdate = chain({ data: null, error: null })
    const orderLookup = chain({
      data: { stripe_payment_intent_id: 'pi_123' },
      error: null,
    })
    const orderUpdate = chain({ data: null, error: null })
    let instanceCalls = 0
    let orderCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        instanceCalls += 1
        return instanceCalls === 1 ? instanceLookup : instanceUpdate
      }
      if (table === 'orders') {
        orderCalls += 1
        return orderCalls === 1 ? orderLookup : orderUpdate
      }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.createStripeRefund.mockResolvedValue({ id: 're_123' })

    const response = await POST(
      makeRequest({ payout_type: 'refund', client_email: 'client@example.com' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: 'refund_issued',
      amount: 1000,
      message: 'Your refund of $1000.00 has been processed.',
    })
    expect(mocks.createStripeRefund).toHaveBeenCalledWith('pi_123', 1000)
    expect(instanceUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payout_type: 'refund',
        status: 'refund_issued',
        stripe_refund_id: 're_123',
      }),
    )
    expect(orderUpdate.update).toHaveBeenCalledWith({ status: 'refunded' })
  })

  it('issues a one-use discount code for credit payouts', async () => {
    const instanceLookup = chain({ data: baseInstance(), error: null })
    const instanceUpdate = chain({ data: null, error: null })
    const discountInsert = chain({ data: { id: 'disc-1' }, error: null })
    let instanceCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        instanceCalls += 1
        return instanceCalls === 1 ? instanceLookup : instanceUpdate
      }
      if (table === 'discount_codes') return discountInsert
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({ payout_type: 'credit', client_email: 'client@example.com' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: 'credit_issued',
      discount_code: 'GUAR-INST-1',
      amount: 1000,
      message: 'Your credit of $1000.00 has been issued. Use code GUAR-INST-1 on your next purchase.',
    })
    expect(discountInsert.insert).toHaveBeenCalledWith({
      code: 'GUAR-INST-1',
      discount_type: 'fixed',
      discount_value: 1000,
      max_uses: 1,
      is_active: true,
    })
    expect(instanceUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payout_type: 'credit',
        status: 'credit_issued',
        discount_code_id: 'disc-1',
      }),
    )
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('blocks continuity rollover when the template has no plan', async () => {
    mocks.from.mockReturnValue(
      chain({
        data: baseInstance({
          guarantee_templates: {
            payout_amount_type: 'full',
            payout_amount_value: null,
            rollover_bonus_multiplier: 1.25,
            rollover_continuity_plan_id: null,
          },
        }),
        error: null,
      }),
    )

    const response = await POST(
      makeRequest({
        payout_type: 'rollover_continuity',
        client_email: 'client@example.com',
      }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No continuity plan configured for this guarantee template',
    })
    expect(mocks.createStripeSubscription).not.toHaveBeenCalled()
  })

  it('blocks continuity rollover when the plan is not synced to Stripe', async () => {
    const instanceLookup = chain({ data: baseInstance(), error: null })
    const planLookup = chain({
      data: { id: 'plan-1', stripe_price_id: null },
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') return instanceLookup
      if (table === 'continuity_plans') return planLookup
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makeRequest({
        payout_type: 'rollover_continuity',
        client_email: 'client@example.com',
      }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Continuity plan not found or not synced to Stripe',
    })
    expect(mocks.findOrCreateStripeCustomer).not.toHaveBeenCalled()
  })
})
