import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { printful } from '@/lib/printful'

export const dynamic = 'force-dynamic'

// Type definition for order item
type OrderItemRow = {
  id: number
  order_id: number
  product_id: number
  product_variant_id: number | null
  printful_variant_id: string | null
  quantity: number
  price_at_purchase: number
}

/**
 * Submit order to Printful for fulfillment
 * POST /api/orders/fulfill
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check if already fulfilled
    if (order.printful_order_id) {
      return NextResponse.json(
        { error: 'Order already submitted to Printful' },
        { status: 400 }
      )
    }

    // Fetch order items
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    if (itemsError || !orderItems || orderItems.length === 0) {
      return NextResponse.json(
        { error: 'Order items not found' },
        { status: 404 }
      )
    }

    // Separate merchandise and digital items
    const merchandiseItems = orderItems.filter((item: OrderItemRow) => item.product_variant_id)
    const digitalItems = orderItems.filter((item: OrderItemRow) => !item.product_variant_id)

    if (merchandiseItems.length === 0) {
      return NextResponse.json(
        { error: 'No merchandise items to fulfill' },
        { status: 400 }
      )
    }

    // Get shipping address
    if (!order.shipping_address) {
      return NextResponse.json(
        { error: 'Shipping address is required' },
        { status: 400 }
      )
    }

    const shippingAddress = order.shipping_address as any

    // Fetch sync_variant_ids from product_variants (includes print files)
    const pvIds = merchandiseItems.map((i: OrderItemRow) => i.product_variant_id).filter(Boolean)
    const { data: pvRows } = pvIds.length > 0
      ? await supabaseAdmin
          .from('product_variants')
          .select('id, printful_variant_id, printful_sync_variant_id')
          .in('id', pvIds)
      : { data: [] }
    type PVRow = { id: number; printful_variant_id: number; printful_sync_variant_id: number | null }
    const pvMap = new Map<number, PVRow>()
    for (const r of (pvRows || []) as PVRow[]) {
      pvMap.set(r.id, r)
    }

    const printfulItems: Array<{ sync_variant_id?: number; variant_id?: number; quantity: number }> = []
    for (const item of merchandiseItems) {
      const pv = pvMap.get(item.product_variant_id)
      if (pv?.printful_sync_variant_id) {
        printfulItems.push({ sync_variant_id: pv.printful_sync_variant_id, quantity: item.quantity })
      } else if (item.printful_variant_id || pv?.printful_variant_id) {
        printfulItems.push({ variant_id: item.printful_variant_id || pv?.printful_variant_id, quantity: item.quantity })
      }
    }

    if (printfulItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid Printful items found' },
        { status: 400 }
      )
    }

    // Get customer info
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
      order.id.toString(), // External ID
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
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        printful_order_id: printfulOrder.id,
        fulfillment_status: 'processing',
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Error updating order with Printful ID:', updateError)
      // Don't fail - order was submitted to Printful
    }

    // Update order items with Printful variant IDs if missing
    for (const item of merchandiseItems) {
      if (!item.printful_variant_id) {
        const printfulItem = printfulOrder.items.find(
          (pi) => pi.external_id === item.id.toString()
        )
        if (printfulItem) {
          await supabaseAdmin
            .from('order_items')
            .update({ printful_variant_id: printfulItem.variant_id })
            .eq('id', item.id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      printful_order_id: printfulOrder.id,
      order: printfulOrder,
    })
  } catch (error: any) {
    console.error('Error fulfilling order:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fulfill order' },
      { status: 500 }
    )
  }
}
