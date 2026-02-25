#!/usr/bin/env npx tsx
/**
 * Create a Stripe test Checkout Session for WF-001 testing.
 *
 * Use the returned URL to complete a test payment with any Stripe test card
 * (e.g. 4242 4242 4242 4242). The checkout.session.completed event will trigger
 * WF-001: Client Payment Intake in n8n.
 *
 * Usage:
 *   npx tsx scripts/create-stripe-test-checkout.ts
 *   # Optional: link to an existing proposal (WF-001 will find it)
 *   npx tsx scripts/create-stripe-test-checkout.ts --proposal-id <uuid>
 *   # Custom email/amount
 *   npx tsx scripts/create-stripe-test-checkout.ts --email test@example.com --amount 99
 *
 * Requires: STRIPE_SECRET_KEY in .env.local (use test key sk_test_... for testing)
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load env BEFORE importing lib/stripe (it reads STRIPE_SECRET_KEY at load time)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const STRIPE_TEST_CARDS = [
  { number: '4242 4242 4242 4242', result: 'Success', note: 'Most common for testing' },
  { number: '4000 0000 0000 0002', result: 'Declined', note: 'Generic decline' },
  { number: '4000 0000 0000 3220', result: '3D Secure', note: 'Requires authentication' },
  { number: '4000 0000 0000 9995', result: 'Insufficient funds', note: 'Decline scenario' },
]

async function main() {
  const args = process.argv.slice(2)
  let proposalId: string | null = null
  let email = 'test-stripe@example.com'
  let amount = 50

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--proposal-id' && args[i + 1]) {
      proposalId = args[++i]
    } else if (args[i] === '--email' && args[i + 1]) {
      email = args[++i]
    } else if (args[i] === '--amount' && args[i + 1]) {
      amount = parseFloat(args[++i]) || 50
    }
  }

  console.log('Creating Stripe test Checkout Session...')
  console.log(`Email: ${email} | Amount: $${amount}`)
  if (proposalId) console.log(`Proposal ID: ${proposalId}`)
  console.log('')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://amadutown.com'

  const { createCheckoutSession } = await import('../lib/stripe')
  const session = await createCheckoutSession({
    proposalId: proposalId || 'test-' + Date.now(),
    clientEmail: email,
    lineItems: [
      {
        name: 'Test Automation Project',
        description: 'WF-001 test payment - use any test card',
        amount,
      },
    ],
    successUrl: `${baseUrl}/admin/testing?payment=success`,
    cancelUrl: `${baseUrl}/admin/testing?payment=cancelled`,
  })

  if (!session || !session.url) {
    console.error('Failed to create checkout session. Is STRIPE_SECRET_KEY set in .env.local?')
    process.exit(1)
  }

  if (proposalId) {
    try {
      const { supabaseAdmin } = await import('../lib/supabase')
      const { error } = await supabaseAdmin
        .from('proposals')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', proposalId)
      if (error) {
        console.warn('Warning: Could not update proposal with session ID:', error.message)
      } else {
        console.log('Updated proposal with checkout session ID.')
      }
    } catch (e) {
      console.warn('Skipped proposal update (Supabase may not be configured):', (e as Error).message)
    }
  }

  console.log('')
  console.log('=== Checkout URL (paste into browser) ===')
  console.log('')
  console.log(session.url)
  console.log('')
  // Copy to clipboard on macOS
  if (process.platform === 'darwin' && process.stdout?.isTTY) {
    try {
      const { spawnSync } = await import('child_process')
      spawnSync('pbcopy', { input: session.url!, stdio: ['pipe', 'ignore', 'ignore'] })
      console.log('(URL copied to clipboard — paste into browser)')
      console.log('')
    } catch {
      // pbcopy not available
    }
  }
  console.log('=== Stripe Test Cards (use any future expiry, any CVC) ===')
  STRIPE_TEST_CARDS.forEach(({ number, result, note }) => {
    console.log(`  ${number}  → ${result}  (${note})`)
  })
  console.log('')
  console.log('Open the URL, complete payment with 4242 4242 4242 4242 to trigger WF-001.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
