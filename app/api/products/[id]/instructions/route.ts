import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products/[id]/instructions?orderId=...
 * Returns a signed download URL for the install instructions file (template products only).
 * Requires authentication and proof of purchase: orderId must be a completed order
 * that contains this product and belongs to the current user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Sign in to download install instructions' },
        { status: 401 }
      )
    }

    const { id: productId } = await params
    const { searchParams } = new URL(request.url)
    const orderIdParam = searchParams.get('orderId')
    if (!orderIdParam) {
      return NextResponse.json(
        { error: 'Order ID is required. Use the link from your purchase.' },
        { status: 400 }
      )
    }

    const orderId = parseInt(orderIdParam, 10)
    if (Number.isNaN(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      )
    }

    // Verify order exists, is completed, belongs to user, and contains this product
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, status')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }
    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }
    if (order.status !== 'completed') {
      return NextResponse.json(
        { error: 'Order must be completed to download instructions' },
        { status: 403 }
      )
    }

    const { data: orderItem, error: itemError } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)
      .eq('product_id', productId)
      .single()

    if (itemError || !orderItem) {
      return NextResponse.json(
        { error: 'Product not found in this order' },
        { status: 404 }
      )
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('id, type, instructions_file_path, title')
      .eq('id', productId)
      .single()

    if (error || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    if (product.type !== 'template') {
      return NextResponse.json(
        { error: 'Install instructions are only available for template products' },
        { status: 400 }
      )
    }

    if (!product.instructions_file_path) {
      return NextResponse.json(
        { error: 'No install instructions file has been set for this template' },
        { status: 404 }
      )
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('products')
      .createSignedUrl(product.instructions_file_path, 3600)
    if (signError || !signed?.signedUrl) {
      console.error('Instructions signed URL failed:', signError)
      return NextResponse.json(
        { error: 'Failed to generate download' },
        { status: 500 }
      )
    }
    const downloadUrl = signed.signedUrl

    const ext = product.instructions_file_path?.split('.').pop() || 'pdf'
    const safeTitle = product.title?.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '') || 'install-guide'
    return NextResponse.json({
      downloadUrl,
      fileName: `${safeTitle}-instructions.${ext}`,
    })
  } catch (error: unknown) {
    console.error('Error generating instructions download:', error)
    return NextResponse.json(
      { error: 'Failed to generate download' },
      { status: 500 }
    )
  }
}
