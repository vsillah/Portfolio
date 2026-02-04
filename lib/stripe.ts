// Stripe utilities
// Note: Install stripe package: npm install stripe @stripe/stripe-js

import Stripe from 'stripe'

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
