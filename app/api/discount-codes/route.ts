import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data: codes, error } = await supabaseAdmin
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ codes: codes || [] })
  } catch (error: any) {
    console.error('Error fetching discount codes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch discount codes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { user } = authResult

    const body = await request.json()
    const {
      code,
      discount_type,
      discount_value,
      applicable_product_ids,
      max_uses,
      valid_from,
      valid_until,
      is_active,
    } = body

    if (!code || !discount_type || discount_value === undefined) {
      return NextResponse.json(
        { error: 'Code, discount type, and discount value are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('discount_codes')
      .insert([{
        code: code.toUpperCase(),
        discount_type,
        discount_value: parseFloat(discount_value),
        applicable_product_ids: applicable_product_ids && applicable_product_ids.length > 0
          ? applicable_product_ids
          : null,
        max_uses: max_uses ? parseInt(max_uses) : null,
        valid_from: valid_from || new Date().toISOString(),
        valid_until: valid_until || null,
        is_active: is_active !== undefined ? is_active : true,
        created_by: user.id,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, code: data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating discount code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create discount code' },
      { status: 500 }
    )
  }
}
