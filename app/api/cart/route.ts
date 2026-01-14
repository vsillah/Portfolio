import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Get user's cart from database (for authenticated users)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('cart_items')
      .select('*, products(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ cartItems: data || [] })
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
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

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

    // Insert new cart items
    if (cartItems.length > 0) {
      const itemsToInsert = cartItems.map((item: { productId: number; quantity: number }) => ({
        user_id: user.id,
        product_id: item.productId,
        quantity: item.quantity,
      }))

      const { error: insertError } = await supabaseAdmin
        .from('cart_items')
        .insert(itemsToInsert)

      if (insertError) throw insertError
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
