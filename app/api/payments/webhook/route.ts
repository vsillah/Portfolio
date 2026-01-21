import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { printful } from '@/lib/printful'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// Type for order item from query
type OrderItemRow = {
  product_variant_id: number | null
  printful_variant_id: string | null
  quantity: number
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    )
  }

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          // Update order status to completed
          const { data: order } = await supabaseAdmin
            .from('orders')
            .update({
              status: 'completed',
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', parseInt(orderId))
            .select()
            .single()

          // If order has merchandise items, submit to Printful
          if (order && order.shipping_address && !order.printful_order_id) {
            try {
              // Check if order has merchandise items
              const { data: orderItems } = await supabaseAdmin
                .from('order_items')
                .select('product_variant_id, printful_variant_id, quantity')
                .eq('order_id', order.id)
                .not('product_variant_id', 'is', null)

              if (orderItems && orderItems.length > 0) {
                // Build Printful items
                const printfulItems = orderItems
                  .filter((item: OrderItemRow) => item.printful_variant_id)
                  .map((item: OrderItemRow) => ({
                    variant_id: item.printful_variant_id,
                    quantity: item.quantity,
                  }))

                if (printfulItems.length > 0) {
                  const shippingAddress = order.shipping_address as any
                  let customerEmail = order.guest_email
                  let customerName = order.guest_name

                  if (order.user_id) {
                    const { data: userProfile } = await supabaseAdmin
                      .from('user_profiles')
                      .select('email, full_name')
                      .eq('id', order.user_id)
                      .single()

                    if (userProfile) {
                      customerEmail = userProfile.email
                      customerName = userProfile.full_name || customerName
                    }
                  }

                  // Submit to Printful
                  const printfulOrder = await printful.createOrder(
                    order.id.toString(),
                    {
                      name: customerName || 'Customer',
                      email: customerEmail || '',
                      phone: shippingAddress.phone || '',
                      address1: shippingAddress.address1 || '',
                      address2: shippingAddress.address2 || '',
                      city: shippingAddress.city || '',
                      state_code: shippingAddress.state_code || '',
                      country_code: shippingAddress.country_code || 'US',
                      zip: shippingAddress.zip || '',
                    },
                    printfulItems,
                    {
                      subtotal: order.total_amount?.toString() || '0',
                      shipping: order.shipping_cost?.toString() || '0',
                      tax: order.tax?.toString() || '0',
                    }
                  )

                  // Update order with Printful order ID
                  await supabaseAdmin
                    .from('orders')
                    .update({
                      printful_order_id: printfulOrder.id,
                      fulfillment_status: 'processing',
                    })
                    .eq('id', order.id)

                  console.log(`Order ${order.id} automatically submitted to Printful: ${printfulOrder.id}`)
                }
              }
            } catch (fulfillError: any) {
              console.error('Error auto-fulfilling order:', fulfillError)
              // Don't fail the webhook - order is still marked as paid
              // Admin can manually fulfill later
            }
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          // Update order status to failed
          await supabaseAdmin
            .from('orders')
            .update({ status: 'failed' })
            .eq('id', parseInt(orderId))
            .eq('stripe_payment_intent_id', paymentIntent.id)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
