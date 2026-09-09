import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyOrderCaller, canAccessOrder } from '@/lib/order-access'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await verifyOrderCaller(request)
    if ('error' in caller) {
      return NextResponse.json({ error: caller.error }, { status: caller.status })
    }
    const orderId = Number(params.id)
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (
            id,
            title,
            type,
            file_path,
            asset_url,
            instructions_file_path
          ),
          services (
            id,
            title
          )
        )
      `)
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Verify user has access
    if (!canAccessOrder(caller, order)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Pending, cancelled and refunded orders cannot reveal paid asset locations.
    if (order.status !== 'completed') {
      for (const item of order.order_items ?? []) {
        if (item.products) {
          delete item.products.file_path
          delete item.products.asset_url
          delete item.products.instructions_file_path
        }
      }
    }

    return NextResponse.json({ order }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: unknown) {
    console.error('Error fetching order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    )
  }
}
