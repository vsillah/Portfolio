// Stripe utilities
// Note: Install stripe package: npm install stripe @stripe/stripe-js

import Stripe from 'stripe'

const stripeKeyPrefix = process.env.STRIPE_SECRET_KEY?.slice(0, 7) || ''
export const stripeMode: 'live' | 'test' | 'none' =
  stripeKeyPrefix === 'sk_live' ? 'live' : stripeKeyPrefix === 'sk_test' ? 'test' : 'none'

if (process.env.STRIPE_SECRET_KEY) {
  console.log(`[Stripe] Initialized in ${stripeMode.toUpperCase()} mode`)
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    })
  : null

export function formatAmountForStripe(amount: number, currency: string = 'usd'): number {
  // Convert dollars to cents
  return Math.round(amount * 100)
}

export function formatAmountFromStripe(amount: number): number {
  // Convert cents to dollars
  return amount / 100
}

// Create a Stripe Checkout Session for proposals
export interface CheckoutSessionParams {
  proposalId: string;
  clientEmail: string;
  lineItems: {
    name: string;
    description?: string;
    amount: number; // in dollars
    quantity?: number;
  }[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

// Create a Stripe Checkout Session for installment payments (subscription mode)
export interface InstallmentCheckoutParams {
  customerId: string;
  installmentAmount: number; // per-installment amount in dollars
  numInstallments: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export async function createInstallmentCheckoutSession(
  params: InstallmentCheckoutParams
): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) {
    console.error('Stripe is not configured');
    return null;
  }

  const price = await stripe.prices.create({
    currency: 'usd',
    unit_amount: formatAmountForStripe(params.installmentAmount),
    recurring: { interval: 'month', interval_count: 1 },
    product_data: {
      name: `${params.productName} - Installment Payment`,
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId,
    payment_method_collection: 'always',
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: {
      metadata: {
        ...params.metadata,
        installment: 'true',
        num_installments: String(params.numInstallments),
      },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      ...params.metadata,
      installment: 'true',
    },
  });

  return session;
}

export async function createCheckoutSession(params: CheckoutSessionParams): Promise<Stripe.Checkout.Session | null> {
  if (!stripe) {
    console.error('Stripe is not configured');
    return null;
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.lineItems.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.name,
        description: item.description,
      },
      unit_amount: formatAmountForStripe(item.amount),
    },
    quantity: item.quantity || 1,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: params.clientEmail,
    line_items: lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      proposalId: params.proposalId,
      ...params.metadata,
    },
    payment_intent_data: {
      receipt_email: params.clientEmail,
      metadata: {
        proposalId: params.proposalId,
        ...params.metadata,
      },
    },
  });

  return session;
}
