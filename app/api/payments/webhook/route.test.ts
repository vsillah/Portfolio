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

  it('does not repeat fulfillment or notification after the order has left a payable state', async () => {
    mocks.constructEvent.mockReturnValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123', metadata: { orderId: '91' } } },
    })
    const statusFilter = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: null, error: null }) }) })
    const eq = vi.fn().mockReturnValue({ in: statusFilter })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', stripe_payment_intent_id: 'pi_123' }))
    expect(statusFilter).toHaveBeenCalledWith('status', ['pending', 'failed'])
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.notifyOrderConfirmation).not.toHaveBeenCalled()
  })
})
