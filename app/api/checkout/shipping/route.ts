import { NextRequest, NextResponse } from 'next/server'
import { printful } from '@/lib/printful'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const FREE_SHIPPING_THRESHOLD = 75
const FLAT_SHIPPING_RATE = 7.99

/**
 * Calculate shipping costs for merchandise items
 * POST /api/checkout/shipping
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, recipient } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      )
    }

    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient address is required' },
        { status: 400 }
      )
    }

    // Calculate subtotal
    let subtotal = 0
    const printfulItems: Array<{ variant_id: number; quantity: number }> = []

    for (const item of items) {
      if (item.printfulVariantId) {
        // Fetch variant to get price
        const { data: variant } = await supabaseAdmin
          .from('product_variants')
          .select('price')
          .eq('id', item.variantId)
          .single()

        if (variant) {
          subtotal += variant.price * item.quantity
          printfulItems.push({
            variant_id: item.printfulVariantId,
            quantity: item.quantity,
          })
        }
      } else {
        // Regular product (digital)
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('price')
          .eq('id', item.productId)
          .single()

        if (product && product.price) {
          subtotal += product.price * item.quantity
        }
      }
    }

    // Check if free shipping applies
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      return NextResponse.json({
        shipping_cost: 0,
        subtotal,
        total: subtotal,
        free_shipping: true,
        free_shipping_threshold: FREE_SHIPPING_THRESHOLD,
      })
    }

    // Calculate shipping via Printful if we have merchandise items
    let shippingCost = FLAT_SHIPPING_RATE

    if (printfulItems.length > 0) {
      try {
        const shippingRates = await printful.calculateShipping(
          {
            address1: recipient.address1 || '',
            city: recipient.city || '',
            state_code: recipient.state_code || '',
            country_code: recipient.country_code || 'US',
            zip: recipient.zip || '',
          },
          printfulItems
        )

        if (shippingRates && shippingRates.length > 0) {
          // Use the first (cheapest) shipping rate
          shippingCost = parseFloat(shippingRates[0].rate) || FLAT_SHIPPING_RATE
        }
      } catch (error) {
        console.error('Error calculating Printful shipping:', error)
        // Fall back to flat rate
      }
    }

    const total = subtotal + shippingCost

    return NextResponse.json({
      shipping_cost: shippingCost,
      subtotal,
      total,
      free_shipping: false,
      free_shipping_threshold: FREE_SHIPPING_THRESHOLD,
    })
  } catch (error: any) {
    console.error('Error calculating shipping:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to calculate shipping' },
      { status: 500 }
    )
  }
}
