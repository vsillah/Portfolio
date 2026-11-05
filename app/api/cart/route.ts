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
  recommendationId?: string
  reviewedAt?: string
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

    let { data, error } = await supabaseAdmin
      .from('cart_items')
      .select('id, product_id, service_id, quantity, created_at, accelerated_recommendation_id, accelerated_reviewed_at, accelerated_variant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error?.code === '42703') {
      const legacy = await supabaseAdmin.from('cart_items')
        .select('id, product_id, service_id, quantity, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false })
      data = legacy.data
      error = legacy.error
    }

    if (error) throw error

    // Transform to CartItem format expected by frontend
    const cartItems = (data || []).map((row: { product_id: number | null; service_id: string | null; quantity: number; accelerated_recommendation_id?: string | null; accelerated_reviewed_at?: string | null; accelerated_variant_id?: number | null }) => {
      const binding = row.accelerated_recommendation_id ? {
        recommendationId: row.accelerated_recommendation_id,
        reviewedAt: row.accelerated_reviewed_at,
        ...(row.accelerated_variant_id ? { variantId: row.accelerated_variant_id } : {}),
      } : {}
      if (row.service_id) {
        return {
          serviceId: row.service_id,
          quantity: row.quantity,
          itemType: 'service' as const,
          ...binding,
        }
      }
      return {
        productId: row.product_id,
        quantity: row.quantity,
        itemType: 'product' as const,
        ...binding,
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

    const recommended = cartItems.filter((item: CartItemInput) => item.recommendationId)
    for (const item of recommended) {
      if (!item.reviewedAt || item.quantity !== 1) {
        return NextResponse.json({ error: 'Select the reviewed offer again.' }, { status: 409 })
      }
      const { data: selected, error: selectError } = await supabaseAdmin.rpc('accelerated_select_member_recommendation', {
        p_user_id: user.id,
        p_recommendation_id: item.recommendationId,
        p_reviewed_at: item.reviewedAt,
        p_variant_id: item.variantId ?? null,
      })
      if (selectError || selected?.[0]?.quote_based) {
        return NextResponse.json({ error: 'A reviewed offer changed. Select it again.' }, { status: 409 })
      }
    }

    // A local removal also removes the server selection. Keep only the reviewed
    // bindings that survived this sync; ordinary items are handled below.
    if (recommended.length) {
      const { data: stored, error: storedError } = await supabaseAdmin.from('cart_items')
        .select('id,accelerated_recommendation_id').eq('user_id', user.id)
        .not('accelerated_recommendation_id', 'is', null)
      if (storedError) throw storedError
      const kept = new Set(recommended.map((item: CartItemInput) => item.recommendationId))
      for (const row of stored ?? []) {
        if (!kept.has(row.accelerated_recommendation_id)) {
          const { error: removeError } = await supabaseAdmin.from('cart_items').delete()
            .eq('user_id', user.id).eq('id', row.id)
          if (removeError) throw removeError
        }
      }
    }

    // Reviewed selections were validated by the service-role-only function above.
    // Sync ordinary store items separately so their IDs cannot overwrite lineage.
    const deletion = supabaseAdmin.from('cart_items').delete().eq('user_id', user.id)
    const { error: deleteError } = recommended.length
      ? await deletion.is('accelerated_recommendation_id', null)
      : await deletion
    if (deleteError) throw deleteError

    // Insert new cart items (products and services)
    if (cartItems.length > 0) {
      const itemsToInsert = cartItems.filter((item: CartItemInput) => !item.recommendationId).map((item: CartItemInput) => {
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
