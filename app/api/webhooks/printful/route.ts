import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Printful Webhook Handler
 * Handles order status updates from Printful
 * POST /api/webhooks/printful
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('x-printful-signature')
    const webhookSecret = process.env.PRINTFUL_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      const body = await request.text()
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex')

      if (signature !== expectedSignature) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    }

    const event = await request.json()
    const { type, data } = event

    console.log('Printful webhook received:', type, data)

    // Handle different event types
    switch (type) {
      case 'package_shipped':
        await handlePackageShipped(data)
        break

      case 'package_returned':
        await handlePackageReturned(data)
        break

      case 'order_failed':
        await handleOrderFailed(data)
        break

      case 'order_put_hold':
        await handleOrderPutHold(data)
        break

      case 'order_remove_hold':
        await handleOrderRemoveHold(data)
        break

      default:
        console.log('Unhandled webhook type:', type)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error processing Printful webhook:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

/**
 * Handle package_shipped event
 */
async function handlePackageShipped(data: any) {
  const { order } = data

  if (!order || !order.external_id) {
    console.error('Invalid package_shipped event data')
    return
  }

  const orderId = parseInt(order.external_id)

  // Get tracking info from shipments
  const shipments = order.shipments || []
  const trackingNumber = shipments.length > 0 ? shipments[0].tracking_number : null
  const trackingUrl = shipments.length > 0 ? shipments[0].tracking_url : null

  // Update order status
  const updateData: any = {
    fulfillment_status: 'shipped',
  }

  if (trackingNumber) {
    updateData.tracking_number = trackingNumber
  }

  // Estimate delivery (typically 3-7 days after shipping)
  if (order.shipments && order.shipments.length > 0) {
    const shippedAt = order.shipments[0].shipped_at
    if (shippedAt) {
      const shipDate = new Date(shippedAt * 1000)
      const estimatedDelivery = new Date(shipDate)
      estimatedDelivery.setDate(estimatedDelivery.getDate() + 5) // Add 5 days
      updateData.estimated_delivery = estimatedDelivery.toISOString().split('T')[0]
    }
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update(updateData)
    .eq('id', orderId)

  if (error) {
    console.error('Error updating order with shipping info:', error)
  } else {
    // TODO: Send shipping notification email
    console.log(`Order ${orderId} marked as shipped with tracking: ${trackingNumber}`)
  }
}

/**
 * Handle package_returned event
 */
async function handlePackageReturned(data: any) {
  const { order } = data

  if (!order || !order.external_id) {
    console.error('Invalid package_returned event data')
    return
  }

  const orderId = parseInt(order.external_id)

  await supabaseAdmin
    .from('orders')
    .update({
      fulfillment_status: 'cancelled',
    })
    .eq('id', orderId)

  // TODO: Send return notification email
  console.log(`Order ${orderId} marked as returned`)
}

/**
 * Handle order_failed event
 */
async function handleOrderFailed(data: any) {
  const { order } = data

  if (!order || !order.external_id) {
    console.error('Invalid order_failed event data')
    return
  }

  const orderId = parseInt(order.external_id)

  await supabaseAdmin
    .from('orders')
    .update({
      fulfillment_status: 'cancelled',
      status: 'failed',
    })
    .eq('id', orderId)

  // TODO: Send failure notification email and process refund if needed
  console.log(`Order ${orderId} marked as failed`)
}

/**
 * Handle order_put_hold event
 */
async function handleOrderPutHold(data: any) {
  const { order } = data

  if (!order || !order.external_id) {
    console.error('Invalid order_put_hold event data')
    return
  }

  const orderId = parseInt(order.external_id)

  await supabaseAdmin
    .from('orders')
    .update({
      fulfillment_status: 'processing',
    })
    .eq('id', orderId)

  console.log(`Order ${orderId} put on hold`)
}

/**
 * Handle order_remove_hold event
 */
async function handleOrderRemoveHold(data: any) {
  const { order } = data

  if (!order || !order.external_id) {
    console.error('Invalid order_remove_hold event data')
    return
  }

  const orderId = parseInt(order.external_id)

  await supabaseAdmin
    .from('orders')
    .update({
      fulfillment_status: 'processing',
    })
    .eq('id', orderId)

  console.log(`Order ${orderId} hold removed`)
}
