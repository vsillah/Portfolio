import { printful } from '@/lib/printful'
import { supabaseAdmin } from '@/lib/supabase'
import type { CartItem } from '@/lib/cart'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AcceleratedCheckoutResult =
  | { ok: true; order: Record<string, unknown>; replay: boolean }
  | { ok: false; status: number; error: string }

export async function checkoutAcceleratedMemberCart(input: {
  userId: string
  cartItems: CartItem[]
  checkoutKey: unknown
  discountCode: unknown
  shippingAddress: unknown
}): Promise<AcceleratedCheckoutResult> {
  const { userId, cartItems } = input
  if (!uuid.test(String(input.checkoutKey ?? '')) || cartItems.length > 20 || !cartItems.some((item) => item.recommendationId)) {
    return { ok: false, status: 400, error: 'Reload this cart before checkout.' }
  }
  if (input.discountCode) {
    return { ok: false, status: 400, error: 'Remove the discount code before checking out a reviewed offer.' }
  }
  for (const item of cartItems) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 20 ||
      !['product', 'service'].includes(item.itemType) ||
      (item.itemType === 'product' && (!Number.isSafeInteger(item.productId) || Number(item.productId) <= 0)) ||
      (item.itemType === 'service' && !uuid.test(String(item.serviceId ?? ''))) ||
      (item.variantId != null && (!Number.isSafeInteger(item.variantId) || item.variantId <= 0)) ||
      (item.recommendationId && (!uuid.test(item.recommendationId) || !item.reviewedAt ||
        !Number.isFinite(Date.parse(item.reviewedAt)) || item.quantity !== 1))) {
      return { ok: false, status: 400, error: 'Cart contains an invalid item. Select the offer again.' }
    }
  }
  const merchandise = cartItems.filter((item) => item.itemType === 'product' && item.variantId != null)
  let address: { address1: string; city: string; state_code: string; zip: string; country_code: string; address2?: string; phone?: string } | null = null
  let shippingCost = 0
  if (merchandise.length) {
    if (!input.shippingAddress || typeof input.shippingAddress !== 'object' || Array.isArray(input.shippingAddress)) {
      return { ok: false, status: 400, error: 'Shipping address is required for merchandise.' }
    }
    const candidate = input.shippingAddress as Record<string, unknown>
    const keys = ['address1', 'city', 'state_code', 'zip', 'country_code'] as const
    if (keys.some((key) => typeof candidate[key] !== 'string' || !String(candidate[key]).trim())) {
      return { ok: false, status: 400, error: 'Complete the shipping address before checkout.' }
    }
    address = {
      address1: String(candidate.address1).trim(), city: String(candidate.city).trim(),
      state_code: String(candidate.state_code).trim(), zip: String(candidate.zip).trim(),
      country_code: String(candidate.country_code).trim(),
      address2: String(candidate.address2 ?? '').trim(), phone: String(candidate.phone ?? '').trim(),
    }
    const variantIds = merchandise.map((item) => item.variantId!)
    const { data: variants, error } = await supabaseAdmin.from('product_variants')
      .select('id,product_id,printful_variant_id,price,is_available').in('id', variantIds)
    if (error || !variants || variants.length !== new Set(variantIds).size) {
      return { ok: false, status: 409, error: 'A merchandise variant changed. Review your cart.' }
    }
    let merchandiseSubtotal = 0
    const shippingItems: { variant_id: number; quantity: number }[] = []
    for (const item of merchandise) {
      const variant = variants.find((row: { id: number; product_id: number; printful_variant_id: number; price: number; is_available: boolean }) => row.id === item.variantId)
      if (!variant || !variant.is_available || variant.product_id !== item.productId ||
        !Number.isFinite(Number(variant.price)) || !variant.printful_variant_id) {
        return { ok: false, status: 409, error: 'A merchandise variant changed. Review your cart.' }
      }
      merchandiseSubtotal += Number(variant.price) * item.quantity
      shippingItems.push({ variant_id: variant.printful_variant_id, quantity: item.quantity })
    }
    if (merchandiseSubtotal < 75) {
      shippingCost = 7.99
      try {
        const rates = await printful.calculateShipping(address, shippingItems)
        const rate = Number(rates?.[0]?.rate)
        if (Number.isFinite(rate) && rate >= 0) shippingCost = rate
      } catch {
        // Matches the existing checkout's flat-rate fallback.
      }
    }
  }
  const { data, error } = await supabaseAdmin.rpc('accelerated_checkout_member_cart', {
    p_user_id: userId,
    p_checkout_key: input.checkoutKey,
    p_items: cartItems,
    p_shipping_address: address,
    p_shipping_cost: shippingCost,
  })
  if (error) {
    const stale = error.code === 'P0001' || error.code === '23505' || error.code === '22023'
    return { ok: false, status: stale ? 409 : 503,
      error: stale ? error.message : 'Checkout is temporarily unavailable.' }
  }
  const receipt = data?.[0]
  if (!receipt || !Number.isSafeInteger(Number(receipt.order_id))) {
    return { ok: false, status: 503, error: 'Order receipt was not recorded.' }
  }
  const { data: order, error: orderError } = await supabaseAdmin.from('orders')
    .select('id,user_id,total_amount,final_amount,status,created_at,accelerated_recommendation_ids')
    .eq('id', receipt.order_id).eq('user_id', userId).single()
  if (orderError || !order) return { ok: false, status: 503, error: 'Order could not be loaded.' }
  return { ok: true, order, replay: Boolean(receipt.replay) }
}
