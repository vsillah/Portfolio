import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  from: vi.fn(),
}))

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

vi.mock('@/lib/guarantees', () => ({}))
vi.mock('@/lib/campaigns', () => ({
  materializeCriteria: vi.fn(),
  calculateDeadline: vi.fn(),
}))
vi.mock('@/lib/cost-calculator', () => ({
  recordCostEvent: vi.fn(),
}))
vi.mock('@/lib/notifications', () => ({
  notifyOrderConfirmation: vi.fn(),
}))
vi.mock('@/lib/invoice-pdf', () => ({
  generateInvoicePDFBuffer: vi.fn(),
}))
vi.mock('@/lib/printful-fulfillment', () => ({
  buildPrintfulSubmissionItems: vi.fn(),
  shouldSkipPrintfulSubmission: vi.fn(),
}))

import { POST } from './route'

function makeRequest(body = '{}', signature: string | null = 'sig_test') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (signature) headers['stripe-signature'] = signature
  return new NextRequest('http://localhost/api/payments/webhook', {
    method: 'POST',
    headers,
    body,
  })
}

describe('POST /api/payments/webhook signature guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects requests missing the Stripe signature header', async () => {
    const response = await POST(makeRequest('{}', null))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No signature' })
    expect(mocks.constructEvent).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects requests with an invalid Stripe signature', async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error('bad signature')
    })

    const response = await POST(makeRequest('{"id":"evt_1"}', 'bad_sig'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Webhook Error: bad signature',
    })
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      '{"id":"evt_1"}',
      'bad_sig',
      process.env.STRIPE_WEBHOOK_SECRET || '',
    )
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
