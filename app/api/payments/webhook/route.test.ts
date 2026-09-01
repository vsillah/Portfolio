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
})
