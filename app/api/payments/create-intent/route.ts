import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyOrderCaller, canAccessOrder } from '@/lib/order-access'
import { formatAmountForStripe } from '@/lib/stripe'

if (!stripe) {
  console.warn('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.')
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let orderId: number | undefined
  try {
    const body = await request.json()
    orderId = body?.orderId

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const caller = await verifyOrderCaller(request)
    if ('error' in caller) {
      return NextResponse.json({ error: caller.error }, { status: caller.status })
    }
    const { user } = caller

    // Fetch order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, guest_email, status, final_amount')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify order belongs to user
    if (!canAccessOrder(caller, order)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'Order is not pending payment' },
        { status: 400 }
      )
    }

    if (order.final_amount <= 0) {
      return NextResponse.json(
        { error: 'Order total must be greater than zero' },
        { status: 400 }
      )
    }

    if (!stripe) {
      return NextResponse.json(
        { error: 'Payment processing not available' },
        { status: 503 }
      )
    }

    // Get customer email for receipt
    let receiptEmail = order.guest_email
    if (!receiptEmail && user) {
      // Fetch email from user profile
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .eq('id', user.id)
        .single()
      receiptEmail = profile?.email
    }

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(order.final_amount),
      currency: 'usd',
      receipt_email: receiptEmail || undefined,
      metadata: {
        orderId: order.id.toString(),
        userId: user?.id || 'guest',
        guestEmail: order.guest_email || '',
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // Update order with payment intent ID
    await supabaseAdmin
      .from('orders')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', orderId)

    const secretKeyPrefix = process.env.STRIPE_SECRET_KEY?.slice(0, 7) || ''
    const keyMode = secretKeyPrefix === 'sk_live' ? 'live' : secretKeyPrefix === 'sk_test' ? 'test' : 'unknown'
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      keyMode,
    })
  } catch (error: unknown) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    )
  }
}
