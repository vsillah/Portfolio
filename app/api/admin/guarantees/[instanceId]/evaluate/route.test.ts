import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  calculatePayoutAmount: vi.fn(),
  calculateRolloverCredit: vi.fn(),
  getResolvedStatus: vi.fn(),
  isGuaranteeExpired: vi.fn(),
  createStripeRefund: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
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
  isGuaranteeExpired: mocks.isGuaranteeExpired,
}))

vi.mock('@/lib/stripe-subscriptions', () => ({
  createStripeRefund: mocks.createStripeRefund,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(
    'http://localhost/api/admin/guarantees/inst-1/evaluate',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
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
    status: 'active',
    payout_type: 'refund',
    purchase_amount: 1000,
    order_id: 'order-1',
    guarantee_templates: {
      guarantee_type: 'conditional',
      payout_amount_type: 'full',
      payout_amount_value: null,
      rollover_bonus_multiplier: 1,
    },
    guarantee_milestones: [
      { condition_id: 'c1', condition_label: 'Milestone 1', status: 'met' },
    ],
    ...overrides,
  }
}

describe('POST /api/admin/guarantees/[instanceId]/evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.calculatePayoutAmount.mockReturnValue(1000)
    mocks.calculateRolloverCredit.mockReturnValue(1250)
    mocks.isGuaranteeExpired.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before loading the instance', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), { params: { instanceId: 'inst-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the guarantee instance is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({ data: null, error: { message: 'missing' } })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), { params: { instanceId: 'missing' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Guarantee instance not found',
    })
  })

  it('blocks evaluation for non-active statuses', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({ data: baseInstance({ status: 'refund_issued' }), error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), { params: { instanceId: 'inst-1' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Cannot evaluate guarantee with status: refund_issued',
    })
  })

  it('marks expired guarantees and returns expired without issuing payout', async () => {
    mocks.isGuaranteeExpired.mockReturnValue(true)
    let calls = 0
    let capturedUpdate: Record<string, unknown> | null = null
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'guarantee_instances') throw new Error(`Unexpected table: ${table}`)
      calls += 1
      if (calls === 1) return chain({ data: baseInstance(), error: null })
      const api = chain({ data: null, error: null })
      api.update = vi.fn((payload: Record<string, unknown>) => {
        capturedUpdate = payload
        return api
      })
      return api
    })

    const response = await POST(makeRequest(), { params: { instanceId: 'inst-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: 'expired',
      message: 'Guarantee has expired. Window closed.',
    })
    expect(capturedUpdate).toEqual(
      expect.objectContaining({
        status: 'expired',
        resolution_notes: 'Guarantee window expired with unmet conditions.',
      }),
    )
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('returns outstanding conditions for conditional guarantees', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({
          data: baseInstance({
            guarantee_milestones: [
              { condition_id: 'c1', condition_label: 'Milestone 1', status: 'pending' },
              { condition_id: 'c2', condition_label: 'Milestone 2', status: 'met' },
            ],
          }),
          error: null,
        })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), { params: { instanceId: 'inst-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: 'conditions_not_met',
      message: '1 condition(s) still outstanding.',
      pending_conditions: [
        { condition_id: 'c1', label: 'Milestone 1', status: 'pending' },
      ],
    })
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('issues a Stripe refund when conditions are met and payment intent exists', async () => {
    let guaranteeCalls = 0
    let orderCalls = 0
    mocks.createStripeRefund.mockResolvedValue({ id: 're_123' })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        guaranteeCalls += 1
        if (guaranteeCalls === 1) {
          return chain({ data: baseInstance({ payout_type: 'refund' }), error: null })
        }
        return chain({ data: null, error: null })
      }
      if (table === 'orders') {
        orderCalls += 1
        if (orderCalls === 1) {
          return chain({
            data: { stripe_payment_intent_id: 'pi_123' },
            error: null,
          })
        }
        const api = chain({ data: null, error: null })
        api.update = vi.fn((payload: Record<string, unknown>) => {
          expect(payload).toEqual({ status: 'refunded' })
          return api
        })
        return api
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), { params: { instanceId: 'inst-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: 'refund_issued',
      refund_id: 're_123',
      amount: 1000,
    })
    expect(mocks.createStripeRefund).toHaveBeenCalledWith('pi_123', 1000)
  })

  it('refuses refund when the order has no payment intent', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        return chain({ data: baseInstance({ payout_type: 'refund' }), error: null })
      }
      if (table === 'orders') {
        return chain({ data: { stripe_payment_intent_id: null }, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), { params: { instanceId: 'inst-1' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'No payment intent found for this order. Cannot process refund.',
    })
    expect(mocks.createStripeRefund).not.toHaveBeenCalled()
  })

  it('marks rollover payouts as conditions_met with rollover credit', async () => {
    let guaranteeCalls = 0
    let capturedUpdate: Record<string, unknown> | null = null
    mocks.from.mockImplementation((table: string) => {
      if (table === 'guarantee_instances') {
        guaranteeCalls += 1
        if (guaranteeCalls === 1) {
          return chain({
            data: baseInstance({ payout_type: 'rollover_continuity' }),
            error: null,
          })
        }
        const api = chain({ data: null, error: null })
        api.update = vi.fn((payload: Record<string, unknown>) => {
          capturedUpdate = payload
          return api
        })
        return api
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest(), { params: { instanceId: 'inst-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      result: 'conditions_met',
      message: 'Conditions met. Client should choose their payout preference.',
      payout_type: 'rollover_continuity',
      refund_amount: 1000,
      rollover_credit_amount: 1250,
      bonus_multiplier: 1,
    })
    expect(capturedUpdate).toEqual({
      status: 'conditions_met',
      rollover_credit_amount: 1250,
    })
  })
})
