// Stripe utilities
// Note: Install stripe package: npm install stripe @stripe/stripe-js

import Stripe from 'stripe'

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
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
