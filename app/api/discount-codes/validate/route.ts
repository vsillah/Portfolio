import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, productIds } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Discount code is required' },
        { status: 400 }
      )
    }

    // Find discount code
    const { data: discountCode, error: codeError } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single()

    if (codeError || !discountCode) {
      return NextResponse.json(
        { error: 'Invalid or expired discount code' },
        { status: 404 }
      )
    }

    // Check if code is expired
    const now = new Date()
    if (discountCode.valid_until && new Date(discountCode.valid_until) < now) {
      return NextResponse.json(
        { error: 'Discount code has expired' },
        { status: 400 }
      )
    }

    if (discountCode.valid_from && new Date(discountCode.valid_from) > now) {
      return NextResponse.json(
        { error: 'Discount code is not yet valid' },
        { status: 400 }
      )
    }

    // Check usage limits
    if (discountCode.max_uses !== null && discountCode.used_count >= discountCode.max_uses) {
      return NextResponse.json(
        { error: 'Discount code has reached its usage limit' },
        { status: 400 }
      )
    }

    // Check if user has already used this code
    const user = await getCurrentUser()
    if (user) {
      const { data: userUsage } = await supabaseAdmin
        .from('user_discount_codes')
        .select('id')
        .eq('user_id', user.id)
        .eq('discount_code_id', discountCode.id)
        .single()

      if (userUsage) {
        return NextResponse.json(
          { error: 'You have already used this discount code' },
          { status: 400 }
        )
      }
    }

    // Check if code applies to the products in cart
    if (discountCode.applicable_product_ids && discountCode.applicable_product_ids.length > 0) {
      const applicable = productIds.some((id: number) =>
        discountCode.applicable_product_ids.includes(id)
      )
      if (!applicable) {
        return NextResponse.json(
          { error: 'Discount code does not apply to items in your cart' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      discountCode,
    })
  } catch (error: any) {
    console.error('Error validating discount code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to validate discount code' },
      { status: 500 }
    )
  }
}
