import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      cartItems,
      contactInfo,
      discountCode,
      subtotal,
      discountAmount,
      finalTotal,
      shippingAddress,
      shippingCost,
      tax,
    } = body

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }

    const user = await getCurrentUser()

    // Get discount code ID if provided
    let discountCodeId = null
    if (discountCode) {
      const { data: codeData } = await supabaseAdmin
        .from('discount_codes')
        .select('id')
        .eq('code', discountCode.toUpperCase())
        .single()

      if (codeData) {
        discountCodeId = codeData.id

        // Record discount code usage
        if (user) {
          await supabaseAdmin
            .from('user_discount_codes')
            .insert({
              user_id: user.id,
              discount_code_id: codeData.id,
            })
        }
      }
    }

    // Fetch products and variants to get prices
    const productIds = cartItems.map((item: { productId: number }) => item.productId)
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, price, is_print_on_demand')
      .in('id', productIds)

    if (productsError) throw productsError

    const productMap = new Map<number, { price: number | null; isPrintOnDemand: boolean }>(
      products.map((p: { id: number; price: number | null; is_print_on_demand: boolean }) => [
        p.id,
        { price: p.price, isPrintOnDemand: p.is_print_on_demand },
      ])
    )

    // Fetch variants for merchandise items
    const variantIds = cartItems
      .filter((item: any) => item.variantId)
      .map((item: any) => item.variantId)
    const variantMap = new Map<number, { price: number; printfulVariantId: string | null }>()

    if (variantIds.length > 0) {
      const { data: variants } = await supabaseAdmin
        .from('product_variants')
        .select('id, price, printful_variant_id')
        .in('id', variantIds)

      if (variants) {
        variants.forEach((v: any) => {
          variantMap.set(v.id, { price: v.price, printfulVariantId: v.printful_variant_id })
        })
      }
    }

    // Create order
    const orderData: any = {
      user_id: user?.id || null,
      guest_email: contactInfo?.email || null,
      guest_name: contactInfo?.name || null,
      total_amount: subtotal,
      discount_amount: discountAmount,
      final_amount: finalTotal,
      status: finalTotal > 0 ? 'pending' : 'completed',
      discount_code_id: discountCodeId,
    }

    // Add shipping info if provided (for merchandise)
    if (shippingAddress) {
      orderData.shipping_address = shippingAddress
      orderData.shipping_cost = shippingCost || 0
      orderData.tax = tax || 0
      orderData.fulfillment_status = 'pending'
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderData)
      .select()
      .single()

    if (orderError) throw orderError

    // Create order items
    const orderItems = cartItems.map((item: any) => {
      let price = 0
      let productVariantId = null
      let printfulVariantId = null

      if (item.variantId && variantMap.has(item.variantId)) {
        // Merchandise with variant
        const variant = variantMap.get(item.variantId)!
        price = variant.price
        productVariantId = item.variantId
        printfulVariantId = variant.printfulVariantId
      } else {
        // Regular product
        const product = productMap.get(item.productId)
        price = product?.price || 0
      }

      return {
        order_id: order.id,
        product_id: item.productId,
        product_variant_id: productVariantId,
        printful_variant_id: printfulVariantId,
        quantity: item.quantity,
        price_at_purchase: price,
      }
    })

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems)

    if (itemsError) throw itemsError

    return NextResponse.json({
      success: true,
      order,
    })
  } catch (error: any) {
    console.error('Error processing checkout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process checkout' },
      { status: 500 }
    )
  }
}
