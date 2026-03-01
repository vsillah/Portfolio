import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user }, error: authError } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null }, error: null }

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Please sign in to complete your purchase. We use your account to deliver your order and to follow up with you.' },
        { status: 401 }
      )
    }

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
      hasQuoteBasedItems,
    } = body

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }

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

    // Separate product and service items
    const productItems = cartItems.filter((item: any) => item.itemType === 'product')
    const serviceItems = cartItems.filter((item: any) => item.itemType === 'service')

    // Merchandise (physical products) require a shipping address
    const hasMerchandise = productItems.some((item: any) => item.variantId != null)
    if (hasMerchandise && !shippingAddress) {
      return NextResponse.json(
        { error: 'Shipping address is required for physical products. Please enter your delivery address.' },
        { status: 400 }
      )
    }

    // Fetch products and variants to get prices
    const productIds = productItems.map((item: any) => item.productId)
    const productMap = new Map<number, { price: number | null; isPrintOnDemand: boolean }>()
    
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabaseAdmin
        .from('products')
        .select('id, price, is_print_on_demand')
        .in('id', productIds)

      if (productsError) throw productsError

      products.forEach((p: { id: number; price: number | null; is_print_on_demand: boolean }) => {
        productMap.set(p.id, { price: p.price, isPrintOnDemand: p.is_print_on_demand })
      })
    }

    // Fetch services to get prices
    const serviceIds = serviceItems.map((item: any) => item.serviceId)
    const serviceMap = new Map<string, { price: number | null; isQuoteBased: boolean }>()

    if (serviceIds.length > 0) {
      const { data: services, error: servicesError } = await supabaseAdmin
        .from('services')
        .select('id, price, is_quote_based')
        .in('id', serviceIds)

      if (servicesError) throw servicesError

      services.forEach((s: { id: string; price: number | null; is_quote_based: boolean }) => {
        serviceMap.set(s.id, { price: s.price, isQuoteBased: s.is_quote_based })
      })
    }

    // Fetch variants for merchandise items
    const variantIds = productItems
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

    // Create order (user is required above)
    const orderData: any = {
      user_id: user.id,
      guest_email: null,
      guest_name: null,
      total_amount: subtotal,
      discount_amount: discountAmount,
      final_amount: finalTotal,
      status: hasQuoteBasedItems ? 'quote_pending' : (finalTotal > 0 ? 'pending' : 'completed'),
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

    // Create order items for products
    const productOrderItems = productItems.map((item: any) => {
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
        service_id: null,
        product_variant_id: productVariantId,
        printful_variant_id: printfulVariantId,
        quantity: item.quantity,
        price_at_purchase: price,
      }
    })

    // Create order items for services
    const serviceOrderItems = serviceItems.map((item: any) => {
      const service = serviceMap.get(item.serviceId)
      const price = service?.isQuoteBased ? 0 : (service?.price || 0)

      return {
        order_id: order.id,
        product_id: null,
        service_id: item.serviceId,
        product_variant_id: null,
        printful_variant_id: null,
        quantity: item.quantity,
        price_at_purchase: price,
      }
    })

    // Insert all order items
    const allOrderItems = [...productOrderItems, ...serviceOrderItems]
    
    if (allOrderItems.length > 0) {
      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(allOrderItems)

      if (itemsError) throw itemsError
    }

    // Save shipping address to user profile for future orders (prefill at checkout)
    if (shippingAddress && user?.id) {
      await supabaseAdmin
        .from('user_profiles')
        .update({
          shipping_address: shippingAddress,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }

    return NextResponse.json({
      success: true,
      order,
      hasQuoteBasedItems,
    })
  } catch (error: any) {
    console.error('Error processing checkout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process checkout' },
      { status: 500 }
    )
  }
}
