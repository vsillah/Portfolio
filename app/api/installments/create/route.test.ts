import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createInstallmentCheckoutSession: vi.fn(),
  findOrCreateStripeCustomer: vi.fn(),
  getInstallmentFeePercent: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/stripe', () => ({
  createInstallmentCheckoutSession: mocks.createInstallmentCheckoutSession,
}))

vi.mock('@/lib/stripe-subscriptions', () => ({
  findOrCreateStripeCustomer: mocks.findOrCreateStripeCustomer,
}))

vi.mock('@/lib/installments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/installments')>('@/lib/installments')
  return {
    ...actual,
    getInstallmentFeePercent: mocks.getInstallmentFeePercent,
  }
})

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/installments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    clientEmail: 'client@example.com',
    clientName: 'Client',
    baseAmount: 1000,
    numInstallments: 4,
    productName: 'Strategy Sprint',
    successUrl: 'https://amadutown.com/success',
    cancelUrl: 'https://amadutown.com/cancel',
    proposalId: 'prop-1',
    ...overrides,
  }
}

describe('POST /api/installments/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getInstallmentFeePercent.mockResolvedValue(10)
    mocks.findOrCreateStripeCustomer.mockResolvedValue({ id: 'cus_1' })
    mocks.createInstallmentCheckoutSession.mockResolvedValue({
      id: 'cs_1',
      url: 'https://checkout.stripe.com/cs_1',
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires the checkout identity and amount fields', async () => {
    const response = await POST(makeRequest({ clientEmail: 'client@example.com' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required fields: clientEmail, baseAmount, numInstallments, successUrl, cancelUrl',
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.findOrCreateStripeCustomer).not.toHaveBeenCalled()
  })

  it('rejects installment counts outside 2-60', async () => {
    const tooFew = await POST(makeRequest(validBody({ numInstallments: 1 })))
    expect(tooFew.status).toBe(400)
    await expect(tooFew.json()).resolves.toEqual({
      error: 'Number of installments must be between 2 and 60',
    })

    const tooMany = await POST(makeRequest(validBody({ numInstallments: 61 })))
    expect(tooMany.status).toBe(400)
    expect(mocks.findOrCreateStripeCustomer).not.toHaveBeenCalled()
  })

  it('rejects non-positive base amounts', async () => {
    const response = await POST(makeRequest(validBody({ baseAmount: -25 })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Base amount must be positive' })
    expect(mocks.findOrCreateStripeCustomer).not.toHaveBeenCalled()
  })

  it('fails closed when Stripe customer creation returns null', async () => {
    mocks.findOrCreateStripeCustomer.mockResolvedValue(null)

    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to create Stripe customer' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('persists the plan and returns the checkout session url', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'plan-1' },
          error: null,
        }),
      }),
    })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(makeRequest(validBody()))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      checkoutUrl: 'https://checkout.stripe.com/cs_1',
      checkoutSessionId: 'cs_1',
      installmentPlan: {
        id: 'plan-1',
        numInstallments: 4,
        feePercent: 10,
        baseAmount: 1000,
      },
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: 'cus_1',
        proposal_id: 'prop-1',
        status: 'pending',
        num_installments: 4,
        fee_percent: 10,
      }),
    )
    expect(mocks.createInstallmentCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_1',
        numInstallments: 4,
        productName: 'Strategy Sprint',
        metadata: expect.objectContaining({
          installmentPlanId: 'plan-1',
          proposalId: 'prop-1',
        }),
      }),
    )
  })
})
