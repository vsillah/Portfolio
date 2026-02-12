import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAuth, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface CartItemInput {
  productId?: number
  serviceId?: string
  quantity: number
  itemType: 'product' | 'service'
  variantId?: number
  printfulVariantId?: number
}

// Get user's cart from database (for authenticated users)
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { user } = authResult

    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .select('id, product_id, service_id, quantity, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform to CartItem format expected by frontend
    const cartItems = (data || []).map((row: { product_id: number | null; service_id: string | null; quantity: number }) => {
      if (row.service_id) {
        return {
          serviceId: row.service_id,
          quantity: row.quantity,
          itemType: 'service' as const,
        }
      }
      return {
        productId: row.product_id,
        quantity: row.quantity,
        itemType: 'product' as const,
      }
    })

    return NextResponse.json({ cartItems })
  } catch (error: any) {
    console.error('Error fetching cart:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cart' },
      { status: 500 }
    )
  }
}

// Sync cart from localStorage to database (for authenticated users)
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { user } = authResult

    const body = await request.json()
    const { cartItems } = body

    if (!Array.isArray(cartItems)) {
      return NextResponse.json(
        { error: 'Invalid cart items' },
        { status: 400 }
      )
    }

    // Delete existing cart items
    await supabaseAdmin
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)

    // Insert new cart items (products and services)
    if (cartItems.length > 0) {
      const itemsToInsert = cartItems.map((item: CartItemInput) => {
        const isService = item.itemType === 'service' && item.serviceId
        return {
          user_id: user.id,
          product_id: isService ? null : (item.productId ?? null),
          service_id: isService ? item.serviceId : null,
          quantity: item.quantity ?? 1,
        }
      }).filter(
        (item: { product_id: number | null; service_id: string | null | undefined }) =>
          item.product_id !== null || (item.service_id !== null && item.service_id !== undefined)
      )

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('cart_items')
          .insert(itemsToInsert)

        if (insertError) throw insertError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error syncing cart:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync cart' },
      { status: 500 }
    )
  }
}
