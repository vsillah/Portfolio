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
  subscriptionsCancel: vi.fn(),
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
    subscriptions: {
      cancel: mocks.subscriptionsCancel,
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

describe('POST /api/payments/webhook continuity and proposal-paid paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.shouldSkipPrintfulSubmission.mockReturnValue(true)
    mocks.notifyOrderConfirmation.mockResolvedValue(undefined)
    mocks.generateInvoicePDFBuffer.mockResolvedValue(Buffer.from('pdf'))
    mocks.recordCostEvent.mockResolvedValue(undefined)
    mocks.calculateDeadline.mockReturnValue(new Date('2030-01-01T00:00:00.000Z'))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    )
  })

  describe('checkout.session.completed proposal-paid path', () => {
    it('creates a completed order, marks the proposal paid, and sends confirmation', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_proposal_paid',
        type: 'checkout.session.completed',
        livemode: false,
        data: {
          object: {
            id: 'cs_proposal',
            mode: 'payment',
            payment_intent: 'pi_proposal',
            metadata: {
              proposalId: 'proposal-1',
            },
          },
        },
      })

      const proposal = {
        id: 'proposal-1',
        client_email: 'buyer@example.com',
        client_name: 'Buyer',
        subtotal: 1000,
        discount_amount: 100,
        total_amount: 900,
        sales_session_id: 'session-1',
        bundle_id: null,
        line_items: [
          {
            content_type: 'service',
            content_id: 'svc-1',
            title: 'CI Workshop',
            price: 900,
            offer_role: 'core_offer',
          },
        ],
      }

      const orderInsert = vi.fn()
      const orderItemsInsert = vi.fn().mockResolvedValue({ error: null })
      const proposalUpdate = vi.fn()
      const salesUpdate = vi.fn()
      const guaranteeOrderItemsSelect = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: proposal, error: null }),
              }),
            }),
            update: proposalUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'orders') {
          return {
            insert: orderInsert.mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 501,
                    created_at: '2026-08-01T00:00:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'order_items') {
          return {
            insert: orderItemsInsert,
            select: guaranteeOrderItemsSelect.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        if (table === 'sales_sessions') {
          return {
            update: salesUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ received: true })
      expect(orderInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          guest_email: 'buyer@example.com',
          final_amount: 900,
          status: 'completed',
          proposal_id: 'proposal-1',
          stripe_payment_intent_id: 'pi_proposal',
        }),
      )
      expect(orderItemsInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          order_id: 501,
          item_type: 'service',
          item_name: 'CI Workshop',
          price: 900,
        }),
      ])
      expect(proposalUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paid',
          order_id: 501,
          stripe_payment_intent_id: 'pi_proposal',
        }),
      )
      expect(salesUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'converted',
          actual_revenue: 900,
        }),
      )
      expect(mocks.notifyOrderConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({
          clientEmail: 'buyer@example.com',
          orderId: 501,
          totalAmount: 900,
        }),
      )
      // No bundle_id → auto-enroll exits before campaign queries.
      expect(guaranteeOrderItemsSelect).toHaveBeenCalled()
    })

    it('acknowledges the webhook when the proposal row is missing', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_missing_proposal',
        type: 'checkout.session.completed',
        livemode: false,
        data: {
          object: {
            id: 'cs_missing',
            mode: 'payment',
            payment_intent: 'pi_missing',
            metadata: { proposalId: 'missing-proposal' },
          },
        },
      })

      mocks.from.mockImplementation((table: string) => {
        if (table === 'proposals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(mocks.notifyOrderConfirmation).not.toHaveBeenCalled()
    })
  })

  describe('invoice.paid', () => {
    it('increments continuity cycles and applies remaining credit', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_invoice_paid',
        type: 'invoice.paid',
        livemode: false,
        data: {
          object: {
            id: 'in_1',
            subscription: 'sub_continuity',
            amount_paid: 50000,
            period_start: 1719792000,
            period_end: 1722470400,
          },
        },
      })

      const continuityUpdate = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'installment_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
              }),
            }),
          }
        }
        if (table === 'client_subscriptions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'csub-1',
                    cycles_completed: 2,
                    credit_remaining: 750,
                    continuity_plan_id: 'plan-1',
                  },
                  error: null,
                }),
              }),
            }),
            update: continuityUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(continuityUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          cycles_completed: 3,
          credit_remaining: 250,
        }),
      )
    })

    it('records an installment payment and cancels Stripe when the plan completes', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_installment_final',
        type: 'invoice.paid',
        livemode: false,
        data: {
          object: {
            id: 'in_final',
            subscription: 'sub_installment',
            amount_paid: 25000,
          },
        },
      })

      const paymentInsert = vi.fn().mockResolvedValue({ error: null })
      const planUpdate = vi.fn()
      const orderUpdate = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'installment_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'inst-1',
                    installments_paid: 2,
                    num_installments: 3,
                    proposal_id: null,
                    order_id: 88,
                  },
                  error: null,
                }),
              }),
            }),
            update: planUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === 'installment_payments') {
          return { insert: paymentInsert }
        }
        if (table === 'orders') {
          return {
            update: orderUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      mocks.subscriptionsCancel.mockResolvedValue({ id: 'sub_installment', status: 'canceled' })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(paymentInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          installment_plan_id: 'inst-1',
          payment_number: 3,
          amount: 250,
          status: 'paid',
        }),
      )
      expect(planUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          installments_paid: 3,
          status: 'completed',
        }),
      )
      expect(mocks.subscriptionsCancel).toHaveBeenCalledWith('sub_installment')
      expect(orderUpdate).toHaveBeenCalledWith({ status: 'completed' })
    })
  })

  describe('invoice.payment_failed', () => {
    it('marks continuity subscriptions past_due', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_invoice_failed',
        type: 'invoice.payment_failed',
        livemode: false,
        data: {
          object: {
            id: 'in_fail',
            subscription: 'sub_fail',
            amount_due: 50000,
          },
        },
      })

      const continuityUpdate = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'installment_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
              }),
            }),
          }
        }
        if (table === 'client_subscriptions') {
          return {
            update: continuityUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(continuityUpdate).toHaveBeenCalledWith({ status: 'past_due' })
    })

    it('records a failed installment payment without touching continuity rows', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_installment_failed',
        type: 'invoice.payment_failed',
        livemode: false,
        data: {
          object: {
            id: 'in_inst_fail',
            subscription: 'sub_inst_fail',
            amount_due: 10000,
          },
        },
      })

      const paymentInsert = vi.fn().mockResolvedValue({ error: null })

      mocks.from.mockImplementation((table: string) => {
        if (table === 'installment_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'inst-fail', installments_paid: 1 },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'installment_payments') {
          return { insert: paymentInsert }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(paymentInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          installment_plan_id: 'inst-fail',
          payment_number: 2,
          amount: 100,
          status: 'failed',
        }),
      )
    })
  })

  describe('customer.subscription.*', () => {
    it('maps subscription.updated status and period bounds onto client_subscriptions', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_sub_updated',
        type: 'customer.subscription.updated',
        livemode: false,
        data: {
          object: {
            id: 'sub_updated',
            status: 'past_due',
            cancel_at_period_end: true,
            current_period_start: 1719792000,
            current_period_end: 1722470400,
          },
        },
      })

      const update = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'client_subscriptions') {
          return {
            update: update.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'past_due',
          cancel_at_period_end: true,
          current_period_start: new Date(1719792000 * 1000).toISOString(),
          current_period_end: new Date(1722470400 * 1000).toISOString(),
        }),
      )
    })

    it('cancels incomplete installment plans on subscription.deleted', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_sub_deleted_installment',
        type: 'customer.subscription.deleted',
        livemode: false,
        data: {
          object: {
            id: 'sub_deleted_inst',
            status: 'canceled',
            canceled_at: 1722470400,
          },
        },
      })

      const planUpdate = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'installment_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'inst-open', status: 'active' },
                  error: null,
                }),
              }),
            }),
            update: planUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(planUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'canceled' }),
      )
    })

    it('marks continuity subscriptions canceled on subscription.deleted', async () => {
      mocks.constructEvent.mockReturnValue({
        id: 'evt_sub_deleted_continuity',
        type: 'customer.subscription.deleted',
        livemode: false,
        data: {
          object: {
            id: 'sub_deleted_cont',
            status: 'canceled',
            canceled_at: 1722470400,
          },
        },
      })

      const continuityUpdate = vi.fn()

      mocks.from.mockImplementation((table: string) => {
        if (table === 'installment_plans') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
              }),
            }),
          }
        }
        if (table === 'client_subscriptions') {
          return {
            update: continuityUpdate.mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await POST(makeRequest('{"ok":true}'))

      expect(response.status).toBe(200)
      expect(continuityUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'canceled',
          canceled_at: new Date(1722470400 * 1000).toISOString(),
        }),
      )
    })
  })
})
