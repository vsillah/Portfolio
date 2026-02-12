// Stripe Subscription Helpers
// Wraps Stripe API calls for continuity/recurring billing

import Stripe from 'stripe';
import { stripe, formatAmountForStripe } from './stripe';
import { 
  BillingInterval, 
  toStripeInterval, 
  toStripeIntervalCount,
  type ContinuityPlan,
} from './continuity';

// ============================================================================
// Stripe Customer
// ============================================================================

/**
 * Find or create a Stripe Customer by email.
 */
export async function findOrCreateStripeCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer | null> {
  if (!stripe) return null;

  // Search for existing customer by email
  const existing = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: metadata || {},
  });

  return customer;
}

// ============================================================================
// Stripe Product / Price (sync from continuity_plans)
// ============================================================================

/**
 * Create or update a Stripe Product + Price for a continuity plan.
 * Returns the Stripe product ID and price ID.
 */
export async function syncContinuityPlanToStripe(
  plan: ContinuityPlan
): Promise<{ stripe_product_id: string; stripe_price_id: string } | null> {
  if (!stripe) return null;

  let productId = plan.stripe_product_id;

  // Create or update Stripe Product
  if (productId) {
    await stripe.products.update(productId, {
      name: plan.name,
      description: plan.description || undefined,
      active: plan.is_active,
    });
  } else {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description || undefined,
      metadata: {
        continuity_plan_id: plan.id,
      },
    });
    productId = product.id;
  }

  // Create a new Stripe Price (prices are immutable in Stripe)
  // If amount or interval changed, we need a new price
  const stripeInterval = toStripeInterval(plan.billing_interval);
  const stripeIntervalCount = toStripeIntervalCount(
    plan.billing_interval,
    plan.billing_interval_count
  );

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: formatAmountForStripe(plan.amount_per_interval, plan.currency),
    currency: plan.currency,
    recurring: {
      interval: stripeInterval,
      interval_count: stripeIntervalCount,
    },
    metadata: {
      continuity_plan_id: plan.id,
    },
  });

  // If there was an old price, archive it
  if (plan.stripe_price_id && plan.stripe_price_id !== price.id) {
    try {
      await stripe.prices.update(plan.stripe_price_id, { active: false });
    } catch {
      // Old price may already be inactive
    }
  }

  return {
    stripe_product_id: productId,
    stripe_price_id: price.id,
  };
}

// ============================================================================
// Stripe Subscription
// ============================================================================

export interface CreateSubscriptionOptions {
  stripeCustomerId: string;
  stripePriceId: string;
  trialDays?: number;
  creditAmount?: number;       // Guarantee rollover credit to apply as customer balance
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe Subscription.
 * If creditAmount is provided, it's applied as a negative customer balance
 * (Stripe auto-deducts from future invoices).
 */
export async function createStripeSubscription(
  options: CreateSubscriptionOptions
): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;

  // Apply credit as customer balance if provided
  if (options.creditAmount && options.creditAmount > 0) {
    await stripe.customers.createBalanceTransaction(options.stripeCustomerId, {
      amount: -formatAmountForStripe(options.creditAmount), // Negative = credit
      currency: 'usd',
      description: 'Guarantee rollover credit',
      metadata: options.metadata || {},
    });
  }

  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: options.stripeCustomerId,
    items: [{ price: options.stripePriceId }],
    metadata: options.metadata || {},
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
  };

  if (options.trialDays && options.trialDays > 0) {
    subscriptionParams.trial_period_days = options.trialDays;
  }

  const subscription = await stripe.subscriptions.create(subscriptionParams);
  return subscription;
}

/**
 * Cancel a Stripe Subscription.
 * By default cancels at end of current period.
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;

  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  }

  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Resume a subscription that was set to cancel at period end.
 */
export async function resumeStripeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;

  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Create a Stripe Refund.
 */
export async function createStripeRefund(
  paymentIntentId: string,
  amountInDollars?: number
): Promise<Stripe.Refund | null> {
  if (!stripe) return null;

  const refundParams: Stripe.RefundCreateParams = {
    payment_intent: paymentIntentId,
  };

  if (amountInDollars !== undefined) {
    refundParams.amount = formatAmountForStripe(amountInDollars);
  }

  return await stripe.refunds.create(refundParams);
}
