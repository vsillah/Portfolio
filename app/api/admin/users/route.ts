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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build the query for users
    let query = supabaseAdmin
      .from('user_profiles')
      .select('id, email, role, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply search filter if provided
    if (search) {
      query = query.ilike('email', `%${search}%`)
    }

    const { data: users, error: usersError, count } = await query

    if (usersError) throw usersError

    // Fetch order stats for each user
    const usersWithStats = await Promise.all(
      (users || []).map(async (user: { id: string; email: string; role: string; created_at: string; updated_at: string }) => {
        const { data: orderStats } = await supabaseAdmin
          .from('orders')
          .select('id, final_amount, status')
          .eq('user_id', user.id)
          .eq('status', 'completed')

        const orderCount = orderStats?.length || 0
        const totalSpent = orderStats?.reduce((sum: number, order: { final_amount: string }) => sum + (parseFloat(order.final_amount) || 0), 0) || 0

        return {
          ...user,
          order_count: orderCount,
          total_spent: totalSpent,
        }
      })
    )

    return NextResponse.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
