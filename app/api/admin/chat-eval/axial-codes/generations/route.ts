import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/chat-eval/axial-codes/generations
 * List all axial code generation batches
 */
export async function GET(request: NextRequest) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'pending', 'reviewed', 'completed'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabaseAdmin
      .from('axial_code_generations')
      .select(`
        *,
        axial_code_reviews(
          id,
          original_code,
          final_code,
          status,
          category_id
        )
      `, { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: generations, error, count } = await query

    if (error) {
      console.error('Error fetching generations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch generations' },
        { status: 500 }
      )
    }

    // Transform to include review stats
    const transformedGenerations = (generations || []).map((gen: any) => {
      const reviews = gen.axial_code_reviews || []
      const pendingCount = reviews.filter((r: any) => r.status === 'pending').length
      const approvedCount = reviews.filter((r: any) => r.status === 'approved' || r.status === 'modified').length
      const rejectedCount = reviews.filter((r: any) => r.status === 'rejected').length

      return {
        id: gen.id,
        source_session_count: gen.source_session_ids?.length || 0,
        source_open_code_count: gen.source_open_codes?.length || 0,
        axial_code_count: gen.generated_axial_codes?.length || 0,
        model_used: gen.model_used,
        status: gen.status,
        created_at: gen.created_at,
        review_stats: {
          total: reviews.length,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
      }
    })

    return NextResponse.json({
      generations: transformedGenerations,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Generations list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
