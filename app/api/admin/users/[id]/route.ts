import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { data: user, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email, role, created_at, updated_at')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      throw error
    }

    // Fetch order stats
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, final_amount, status, created_at')
      .eq('user_id', params.id)
      .order('created_at', { ascending: false })

    const completedOrders = orders?.filter((o: { status: string }) => o.status === 'completed') || []
    const orderCount = completedOrders.length
    const totalSpent = completedOrders.reduce((sum: number, order: { final_amount: string }) => sum + (parseFloat(order.final_amount) || 0), 0)

    return NextResponse.json({
      user: {
        ...user,
        order_count: orderCount,
        total_spent: totalSpent,
        orders: orders || [],
      },
    })
  } catch (error: any) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { user: adminUser } = authResult
    const body = await request.json()
    const { role } = body

    // Validate role
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role. Must be "user" or "admin"' },
          { status: 400 }
        )
      }

      // Prevent admin from removing their own admin role
      if (params.id === adminUser.id && role !== 'admin') {
        return NextResponse.json(
          { error: 'You cannot remove your own admin privileges' },
          { status: 400 }
        )
      }
    }

    const updateData: { role?: string } = {}
    if (role !== undefined) updateData.role = role

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, user: data })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}
