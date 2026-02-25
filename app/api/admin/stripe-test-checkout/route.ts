// API Route: Create Stripe test Checkout Session (admin-only)
// Used by Admin → Testing to generate a test payment URL for WF-001

import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutSession } from '@/lib/stripe'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const { proposalId, email = 'test-stripe@example.com', amount = 50 } = body as {
      proposalId?: string
      email?: string
      amount?: number
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    const session = await createCheckoutSession({
      proposalId: proposalId || `test-${Date.now()}`,
      clientEmail: String(email),
      lineItems: [
        {
          name: 'Test Automation Project',
          description: 'WF-001 test payment - use any Stripe test card',
          amount: typeof amount === 'number' ? amount : 50,
        },
      ],
      successUrl: `${baseUrl}/admin/testing?payment=success`,
      cancelUrl: `${baseUrl}/admin/testing?payment=cancelled`,
    })

    if (!session || !session.url) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local.' },
        { status: 500 }
      )
    }

    if (proposalId && UUID_REGEX.test(proposalId)) {
      const { error } = await supabaseAdmin
        .from('proposals')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', proposalId)
      if (error) {
        console.warn('Could not update proposal with session ID:', error.message)
      }
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
    })
  } catch (err) {
    console.error('Stripe test checkout error:', err)
    return NextResponse.json(
      { error: 'Something went wrong creating the checkout session.' },
      { status: 500 }
    )
  }
}
