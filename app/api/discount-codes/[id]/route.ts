import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const isUserAdmin = await isAdmin(user.id)
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

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

    const updateData: any = {}

    if (code !== undefined) updateData.code = code.toUpperCase()
    if (discount_type !== undefined) updateData.discount_type = discount_type
    if (discount_value !== undefined) updateData.discount_value = parseFloat(discount_value)
    if (applicable_product_ids !== undefined) {
      updateData.applicable_product_ids = applicable_product_ids && applicable_product_ids.length > 0
        ? applicable_product_ids
        : null
    }
    if (max_uses !== undefined) updateData.max_uses = max_uses ? parseInt(max_uses) : null
    if (valid_from !== undefined) updateData.valid_from = valid_from
    if (valid_until !== undefined) updateData.valid_until = valid_until || null
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabaseAdmin
      .from('discount_codes')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Discount code not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, code: data })
  } catch (error: any) {
    console.error('Error updating discount code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update discount code' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const isUserAdmin = await isAdmin(user.id)
    if (!isUserAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('discount_codes')
      .delete()
      .eq('id', params.id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Discount code not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting discount code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete discount code' },
      { status: 500 }
    )
  }
}
