import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyOrderCaller, canAccessOrder } from '@/lib/order-access'
import { getSignedUrl } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const productId = Number(params.productId)
    const parsedOrderId = Number(orderId)
    if (!Number.isSafeInteger(productId) || productId <= 0 ||
        !Number.isSafeInteger(parsedOrderId) || parsedOrderId <= 0) {
      return NextResponse.json({ error: 'Invalid order or product ID' }, { status: 400 })
    }

    const caller = await verifyOrderCaller(request)
    if ('error' in caller) {
      return NextResponse.json({ error: caller.error }, { status: caller.status })
    }
    const { user } = caller

    // Verify user has access to this order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, guest_email, status')
      .eq('id', parsedOrderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (!canAccessOrder(caller, order)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check order status after ownership to avoid exposing another buyer's state.
    if (order.status !== 'completed') {
      return NextResponse.json(
        { error: 'Order is not completed' },
        { status: 403 }
      )
    }

    // Verify product is in order
    const { data: orderItem, error: itemError } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('order_id', parsedOrderId)
      .eq('product_id', productId)
      .single()

    if (itemError || !orderItem) {
      return NextResponse.json(
        { error: 'Product not found in order' },
        { status: 404 }
      )
    }

    // Get product file path
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('file_path, title')
      .eq('id', productId)
      .single()

    if (productError || !product || !product.file_path) {
      return NextResponse.json(
        { error: 'Product file not found' },
        { status: 404 }
      )
    }

    // Get signed URL for download
    const downloadUrl = await getSignedUrl('products', product.file_path, 3600)

    // Track download
    if (user) {
      await supabaseAdmin
        .from('downloads')
        .insert({
          user_id: user.id,
          order_id: parsedOrderId,
          product_id: productId,
        })
    }

    return NextResponse.json({
      downloadUrl,
      fileName: product.title,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: unknown) {
    console.error('Error generating download:', error)
    return NextResponse.json(
      { error: 'Failed to generate download' },
      { status: 500 }
    )
  }
}
