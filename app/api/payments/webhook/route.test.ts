import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  from: vi.fn(),
  notifyOrderConfirmation: vi.fn(),
}))

vi.mock('@/lib/proposal-milestones', () => ({ handleMilestoneEvent: vi.fn().mockResolvedValue(false) }))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: mocks.constructEvent,
    },
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/printful', () => ({
  printful: {},
  parsePrintfulPrice: vi.fn(),
}))

vi.mock('@/lib/cost-calculator', () => ({
  recordCostEvent: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  notifyOrderConfirmation: mocks.notifyOrderConfirmation,
}))

vi.mock('@/lib/invoice-pdf', () => ({
  generateInvoicePDFBuffer: vi.fn(),
}))

vi.mock('@/lib/printful-fulfillment', () => ({
  buildPrintfulSubmissionItems: vi.fn(),
  shouldSkipPrintfulSubmission: vi.fn(),
}))

import { POST } from './route'

function request({
  body = '{}',
  signature = 't=1,v1=abc',
}: {
  body?: string
  signature?: string | null
} = {}) {
  return new NextRequest('http://localhost/api/payments/webhook', {
    method: 'POST',
    headers: signature ? { 'stripe-signature': signature } : {},
    body,
  })
}

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects requests with no Stripe signature', async () => {
    const response = await POST(request({ signature: null }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No signature' })
    expect(mocks.constructEvent).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects payloads that fail signature verification', async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error('invalid signature')
    })

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Webhook Error: invalid signature' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    ['a mismatched PaymentIntent', 'pi_other', 'pending'],
    ['an exact replay after completion', 'pi_123', 'completed'],
  ])('does not complete or fulfill for %s', async (_case, recordedIntent, status) => {
    mocks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123', metadata: { orderId: '91' } } },
    })
    const filters: Record<string, unknown> = {}
    const chain = {
      eq: vi.fn((column: string, value: unknown) => { filters[column] = value; return chain }),
      in: vi.fn((column: string, values: unknown) => { filters[column] = values; return chain }),
      select: vi.fn(() => chain),
      single: vi.fn(async () => ({
        data: filters.stripe_payment_intent_id === recordedIntent &&
          (filters.status as string[] | undefined)?.includes(status)
          ? { id: 91, status, stripe_payment_intent_id: recordedIntent } : null,
        error: null,
      })),
    }
    const update = vi.fn().mockReturnValue(chain)
    mocks.from.mockReturnValue({ update })

    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({ status: 'completed' })
    expect(chain.eq).toHaveBeenCalledWith('stripe_payment_intent_id', 'pi_123')
    expect(chain.in).toHaveBeenCalledWith('status', ['pending', 'failed'])
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.notifyOrderConfirmation).not.toHaveBeenCalled()
  })
})
