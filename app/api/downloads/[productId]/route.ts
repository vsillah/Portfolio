import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { getSignedUrl } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const productId = parseInt(params.productId)

    // Verify user has access to this order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, guest_email, status')
      .eq('id', parseInt(orderId))
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check order status
    if (order.status !== 'completed') {
      return NextResponse.json(
        { error: 'Order is not completed' },
        { status: 403 }
      )
    }

    // Verify user has access
    if (user) {
      if (order.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }
    } else {
      // For guest users, we'd need to verify email somehow
      // For now, we'll allow if order exists (in production, add email verification)
      const guestEmail = request.headers.get('x-guest-email')
      if (guestEmail && order.guest_email !== guestEmail) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }
    }

    // Verify product is in order
    const { data: orderItem, error: itemError } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('order_id', parseInt(orderId))
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
          order_id: parseInt(orderId),
          product_id: productId,
        })
    }

    return NextResponse.json({
      downloadUrl,
      fileName: product.title,
    })
  } catch (error: any) {
    console.error('Error generating download:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate download' },
      { status: 500 }
    )
  }
}
