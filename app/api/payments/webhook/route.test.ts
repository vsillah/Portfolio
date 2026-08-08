import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  from: vi.fn(),
  shouldSkipPrintfulSubmission: vi.fn(),
  notifyOrderConfirmation: vi.fn(),
  generateInvoicePDFBuffer: vi.fn(),
  recordCostEvent: vi.fn(),
  materializeCriteria: vi.fn(),
  calculateDeadline: vi.fn(),
  buildPrintfulSubmissionItems: vi.fn(),
  parsePrintfulPrice: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: mocks.constructEvent,
    },
    paymentIntents: {
      retrieve: vi.fn(),
    },
    charges: {
      retrieve: vi.fn(),
    },
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/printful', () => ({
  printful: {
    createOrder: vi.fn(),
  },
  parsePrintfulPrice: mocks.parsePrintfulPrice,
}))

vi.mock('@/lib/guarantees', () => ({}))

vi.mock('@/lib/campaigns', () => ({
  materializeCriteria: mocks.materializeCriteria,
  calculateDeadline: mocks.calculateDeadline,
}))

vi.mock('@/lib/cost-calculator', () => ({
  recordCostEvent: mocks.recordCostEvent,
}))

vi.mock('@/lib/notifications', () => ({
  notifyOrderConfirmation: mocks.notifyOrderConfirmation,
}))

vi.mock('@/lib/invoice-pdf', () => ({
  generateInvoicePDFBuffer: mocks.generateInvoicePDFBuffer,
}))

vi.mock('@/lib/printful-fulfillment', () => ({
  buildPrintfulSubmissionItems: mocks.buildPrintfulSubmissionItems,
  shouldSkipPrintfulSubmission: mocks.shouldSkipPrintfulSubmission,
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

function mockOrdersUpdate(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const update = vi.fn()
  const eq = vi.fn()
  const select = vi.fn()
  const single = vi.fn().mockResolvedValue(result)
  const eqSecond = vi.fn().mockResolvedValue({ error: null })

  update.mockImplementation(() => ({ eq }))
  // payment_intent.succeeded: update().eq().select().single()
  // payment_intent.payment_failed: update().eq().eq()
  eq.mockImplementation(() => ({
    select,
    eq: eqSecond,
  }))
  select.mockReturnValue({ single })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'orders') {
      return { update }
    }
    if (table === 'order_items') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { update, eq, eqSecond, select, single }
}

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.shouldSkipPrintfulSubmission.mockReturnValue(true)
    mocks.notifyOrderConfirmation.mockResolvedValue(undefined)
    mocks.generateInvoicePDFBuffer.mockResolvedValue(Buffer.from('pdf'))
    mocks.recordCostEvent.mockResolvedValue(undefined)
  })

  describe('signature guards', () => {
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

  describe('payment_intent.succeeded', () => {
    it('does not touch orders when metadata.orderId is missing', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_succeeded_no_order',
        type: 'payment_intent.succeeded',
        livemode: false,
        data: {
          object: {
            id: 'pi_1',
            metadata: {},
          },
        },
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ received: true })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('marks the matching order completed and skips Printful in non-production', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_succeeded',
        type: 'payment_intent.succeeded',
        livemode: false,
        data: {
          object: {
            id: 'pi_paid',
            metadata: { orderId: '42' },
          },
        },
      })

      const { update, eq } = mockOrdersUpdate({
        data: {
          id: 42,
          guest_email: '',
          guest_name: null,
          user_id: null,
          total_amount: 100,
          final_amount: 100,
          shipping_address: null,
          printful_order_id: null,
        },
        error: null,
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ received: true })
      expect(mocks.from).toHaveBeenCalledWith('orders')
      expect(update).toHaveBeenCalledWith({
        status: 'completed',
        stripe_payment_intent_id: 'pi_paid',
      })
      expect(eq).toHaveBeenCalledWith('id', 42)
      expect(mocks.shouldSkipPrintfulSubmission).toHaveBeenCalled()
      expect(mocks.notifyOrderConfirmation).not.toHaveBeenCalled()
    })
  })

  describe('payment_intent.payment_failed', () => {
    it('marks the matching order failed when orderId is present', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_failed',
        type: 'payment_intent.payment_failed',
        livemode: false,
        data: {
          object: {
            id: 'pi_failed',
            metadata: { orderId: '77' },
          },
        },
      })

      const { update, eq, eqSecond } = mockOrdersUpdate()

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ received: true })
      expect(update).toHaveBeenCalledWith({ status: 'failed' })
      expect(eq).toHaveBeenCalledWith('id', 77)
      expect(eqSecond).toHaveBeenCalledWith('stripe_payment_intent_id', 'pi_failed')
    })

    it('ignores failed payment intents without order metadata', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_failed_no_order',
        type: 'payment_intent.payment_failed',
        livemode: false,
        data: {
          object: {
            id: 'pi_failed_2',
            metadata: {},
          },
        },
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(mocks.from).not.toHaveBeenCalled()
    })
  })

  describe('checkout.session.completed installment path', () => {
    it('activates the installment plan and accepts a linked proposal', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_installment',
        type: 'checkout.session.completed',
        livemode: false,
        data: {
          object: {
            id: 'cs_1',
            mode: 'subscription',
            subscription: 'sub_123',
            payment_intent: 'pi_installment',
            metadata: {
              installment: 'true',
              installmentPlanId: 'plan-1',
              proposalId: 'proposal-1',
            },
          },
        },
      })

      const installmentUpdate = vi.fn()
      const proposalUpdate = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'installment_plans') {
          return {
            update: installmentUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'proposals') {
          return {
            update: proposalUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(installmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_subscription_id: 'sub_123',
          status: 'active',
        }),
      )
      expect(proposalUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'accepted',
          stripe_checkout_session_id: 'cs_1',
        }),
      )
    })
  })
})
