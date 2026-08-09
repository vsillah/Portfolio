import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContinuityPlan } from './continuity'

const stripeState = vi.hoisted(() => ({
  client: null as null | {
    customers: {
      list: ReturnType<typeof vi.fn>
      create: ReturnType<typeof vi.fn>
      createBalanceTransaction: ReturnType<typeof vi.fn>
    }
    products: {
      create: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
    }
    prices: {
      create: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
    }
    subscriptions: {
      create: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      cancel: ReturnType<typeof vi.fn>
    }
    refunds: {
      create: ReturnType<typeof vi.fn>
    }
  },
}))

vi.mock('@/lib/stripe', () => ({
  get stripe() {
    return stripeState.client
  },
  formatAmountForStripe: (amount: number) => Math.round(amount * 100),
}))

import {
  cancelStripeSubscription,
  createStripeRefund,
  createStripeSubscription,
  findOrCreateStripeCustomer,
  resumeStripeSubscription,
  syncContinuityPlanToStripe,
} from './stripe-subscriptions'

function makeStripeClient() {
  return {
    customers: {
      list: vi.fn(),
      create: vi.fn(),
      createBalanceTransaction: vi.fn(),
    },
    products: {
      create: vi.fn(),
      update: vi.fn(),
    },
    prices: {
      create: vi.fn(),
      update: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    refunds: {
      create: vi.fn(),
    },
  }
}

function samplePlan(overrides: Partial<ContinuityPlan> = {}): ContinuityPlan {
  return {
    id: 'plan-1',
    name: 'Growth Partner',
    description: 'Monthly continuity',
    billing_interval: 'month',
    billing_interval_count: 1,
    amount_per_interval: 1500,
    currency: 'usd',
    is_active: true,
    stripe_product_id: null,
    stripe_price_id: null,
    ...overrides,
  } as ContinuityPlan
}

describe('stripe-subscriptions helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stripeState.client = makeStripeClient()
  })

  describe('when Stripe is not configured', () => {
    beforeEach(() => {
      stripeState.client = null
    })

    it('returns null from all public helpers', async () => {
      await expect(findOrCreateStripeCustomer('a@example.com')).resolves.toBeNull()
      await expect(syncContinuityPlanToStripe(samplePlan())).resolves.toBeNull()
      await expect(
        createStripeSubscription({
          stripeCustomerId: 'cus_1',
          stripePriceId: 'price_1',
        }),
      ).resolves.toBeNull()
      await expect(cancelStripeSubscription('sub_1')).resolves.toBeNull()
      await expect(resumeStripeSubscription('sub_1')).resolves.toBeNull()
      await expect(createStripeRefund('pi_1')).resolves.toBeNull()
    })
  })

  describe('findOrCreateStripeCustomer', () => {
    it('returns an existing customer when Stripe finds one by email', async () => {
      const existing = { id: 'cus_existing', email: 'client@example.com' }
      stripeState.client!.customers.list.mockResolvedValue({ data: [existing] })

      const result = await findOrCreateStripeCustomer('client@example.com', 'Client')

      expect(result).toEqual(existing)
      expect(stripeState.client!.customers.create).not.toHaveBeenCalled()
    })

    it('creates a customer when none exist', async () => {
      const created = { id: 'cus_new', email: 'new@example.com' }
      stripeState.client!.customers.list.mockResolvedValue({ data: [] })
      stripeState.client!.customers.create.mockResolvedValue(created)

      const result = await findOrCreateStripeCustomer('new@example.com', 'New', {
        source: 'guarantee_rollover',
      })

      expect(result).toEqual(created)
      expect(stripeState.client!.customers.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        name: 'New',
        metadata: { source: 'guarantee_rollover' },
      })
    })
  })

  describe('syncContinuityPlanToStripe', () => {
    it('creates product + price when the plan has no Stripe ids', async () => {
      stripeState.client!.products.create.mockResolvedValue({ id: 'prod_new' })
      stripeState.client!.prices.create.mockResolvedValue({ id: 'price_new' })

      const result = await syncContinuityPlanToStripe(samplePlan())

      expect(stripeState.client!.products.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Growth Partner',
          metadata: { continuity_plan_id: 'plan-1' },
        }),
      )
      expect(stripeState.client!.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product: 'prod_new',
          unit_amount: 150000,
          currency: 'usd',
          recurring: { interval: 'month', interval_count: 1 },
        }),
      )
      expect(result).toEqual({
        stripe_product_id: 'prod_new',
        stripe_price_id: 'price_new',
      })
    })

    it('updates an existing product, creates a new price, and archives the old price', async () => {
      stripeState.client!.products.update.mockResolvedValue({ id: 'prod_old' })
      stripeState.client!.prices.create.mockResolvedValue({ id: 'price_new' })
      stripeState.client!.prices.update.mockResolvedValue({ id: 'price_old', active: false })

      const result = await syncContinuityPlanToStripe(
        samplePlan({
          stripe_product_id: 'prod_old',
          stripe_price_id: 'price_old',
          billing_interval: 'quarter',
          billing_interval_count: 1,
        }),
      )

      expect(stripeState.client!.products.update).toHaveBeenCalledWith(
        'prod_old',
        expect.objectContaining({ name: 'Growth Partner', active: true }),
      )
      expect(stripeState.client!.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          product: 'prod_old',
          recurring: { interval: 'month', interval_count: 3 },
        }),
      )
      expect(stripeState.client!.prices.update).toHaveBeenCalledWith('price_old', {
        active: false,
      })
      expect(result).toEqual({
        stripe_product_id: 'prod_old',
        stripe_price_id: 'price_new',
      })
    })
  })

  describe('createStripeSubscription', () => {
    it('applies guarantee credit as a negative balance before creating the subscription', async () => {
      const subscription = { id: 'sub_1' }
      stripeState.client!.customers.createBalanceTransaction.mockResolvedValue({ id: 'txn_1' })
      stripeState.client!.subscriptions.create.mockResolvedValue(subscription)

      const result = await createStripeSubscription({
        stripeCustomerId: 'cus_1',
        stripePriceId: 'price_1',
        creditAmount: 500,
        trialDays: 14,
        metadata: { guarantee_instance_id: 'gi_1' },
      })

      expect(stripeState.client!.customers.createBalanceTransaction).toHaveBeenCalledWith(
        'cus_1',
        expect.objectContaining({
          amount: -50000,
          currency: 'usd',
          description: 'Guarantee rollover credit',
        }),
      )
      expect(stripeState.client!.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_1',
          items: [{ price: 'price_1' }],
          trial_period_days: 14,
          payment_behavior: 'default_incomplete',
        }),
      )
      expect(result).toEqual(subscription)
    })

    it('skips balance transactions when creditAmount is zero', async () => {
      stripeState.client!.subscriptions.create.mockResolvedValue({ id: 'sub_2' })

      await createStripeSubscription({
        stripeCustomerId: 'cus_1',
        stripePriceId: 'price_1',
        creditAmount: 0,
      })

      expect(stripeState.client!.customers.createBalanceTransaction).not.toHaveBeenCalled()
    })
  })

  describe('cancel/resume/refund', () => {
    it('cancels immediately or at period end based on the flag', async () => {
      stripeState.client!.subscriptions.cancel.mockResolvedValue({ id: 'sub_1', status: 'canceled' })
      stripeState.client!.subscriptions.update.mockResolvedValue({
        id: 'sub_1',
        cancel_at_period_end: true,
      })

      await cancelStripeSubscription('sub_1', true)
      await cancelStripeSubscription('sub_1', false)

      expect(stripeState.client!.subscriptions.cancel).toHaveBeenCalledWith('sub_1')
      expect(stripeState.client!.subscriptions.update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: true,
      })
    })

    it('resumes a subscription by clearing cancel_at_period_end', async () => {
      stripeState.client!.subscriptions.update.mockResolvedValue({
        id: 'sub_1',
        cancel_at_period_end: false,
      })

      await resumeStripeSubscription('sub_1')

      expect(stripeState.client!.subscriptions.update).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: false,
      })
    })

    it('creates full and partial refunds', async () => {
      stripeState.client!.refunds.create.mockResolvedValueOnce({ id: 're_full' })
      stripeState.client!.refunds.create.mockResolvedValueOnce({ id: 're_partial' })

      await createStripeRefund('pi_1')
      await createStripeRefund('pi_1', 25.5)

      expect(stripeState.client!.refunds.create).toHaveBeenNthCalledWith(1, {
        payment_intent: 'pi_1',
      })
      expect(stripeState.client!.refunds.create).toHaveBeenNthCalledWith(2, {
        payment_intent: 'pi_1',
        amount: 2550,
      })
    })
  })
})
