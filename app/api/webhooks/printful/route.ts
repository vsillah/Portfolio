import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Webhook URL must be registered with Printful via Webhook API (e.g. npm run printful:webhook or Admin → Printful webhook).

/** Printful package_shipped webhook payload (subset we use) */
type PrintfulWebhookPayload = {
  type: string
  data?: {
    shipment?: {
      tracking_number?: string | number
      tracking_url?: string
      carrier?: string
      ship_date?: string
    }
    order?: {
      id: number
      external_id?: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PrintfulWebhookPayload

    if (body?.type !== 'package_shipped' || !body?.data?.shipment || !body?.data?.order) {
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const printfulOrderId = body.data.order.id
    const shipment = body.data.shipment

    const trackingNumber =
      shipment.tracking_number != null && shipment.tracking_number !== ''
        ? String(shipment.tracking_number)
        : null
    const trackingUrl =
      shipment.tracking_url && String(shipment.tracking_url).trim()
        ? String(shipment.tracking_url).trim()
        : null

    const { data: order, error: findError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('printful_order_id', printfulOrderId)
      .single()

    if (findError || !order) {
      console.warn(`[Printful webhook] No order found for printful_order_id ${printfulOrderId}:`, findError?.message)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const update: Record<string, unknown> = {
      fulfillment_status: 'shipped',
    }
    if (trackingNumber) update.tracking_number = trackingNumber
    if (trackingUrl) update.tracking_url = trackingUrl
    if (shipment.ship_date) {
      const d = new Date(shipment.ship_date)
      if (!isNaN(d.getTime())) update.estimated_delivery = d.toISOString().slice(0, 10)
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(update)
      .eq('id', order.id)

    if (updateError) {
      console.error('[Printful webhook] Failed to update order:', updateError)
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      )
    }

    console.log(`[Printful webhook] Order ${order.id} marked shipped, tracking: ${trackingNumber || 'n/a'}`)
    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error('[Printful webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
