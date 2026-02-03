import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/chat-eval/axial-codes/generations/[id]
 * Get a specific generation with all its reviews
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await params

    // Fetch the generation
    const { data: generation, error: genError } = await supabaseAdmin
      .from('axial_code_generations')
      .select('*')
      .eq('id', id)
      .single()

    if (genError) {
      if (genError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
      }
      console.error('Error fetching generation:', genError)
      return NextResponse.json(
        { error: 'Failed to fetch generation' },
        { status: 500 }
      )
    }

    // Fetch all reviews for this generation
    const { data: reviews, error: reviewError } = await supabaseAdmin
      .from('axial_code_reviews')
      .select(`
        *,
        evaluation_categories(id, name, color)
      `)
      .eq('generation_id', id)
      .order('created_at', { ascending: true })

    if (reviewError) {
      console.error('Error fetching reviews:', reviewError)
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      )
    }

    // Calculate review stats
    const pendingCount = reviews?.filter((r: { status: string }) => r.status === 'pending').length || 0
    const approvedCount = reviews?.filter((r: { status: string }) => r.status === 'approved' || r.status === 'modified').length || 0
    const rejectedCount = reviews?.filter((r: { status: string }) => r.status === 'rejected').length || 0

    return NextResponse.json({
      generation: {
        id: generation.id,
        generated_axial_codes: generation.generated_axial_codes,
        source_session_ids: generation.source_session_ids,
        source_open_codes: generation.source_open_codes,
        model_used: generation.model_used,
        prompt_version: generation.prompt_version,
        status: generation.status,
        created_at: generation.created_at,
      },
      reviews: reviews?.map((r: { 
        id: string; 
        original_code: string; 
        original_description: string; 
        final_code: string | null; 
        final_description: string | null; 
        status: string; 
        mapped_open_codes: string[]; 
        mapped_session_ids: string[]; 
        category_id: string | null; 
        evaluation_categories: { id: string; name: string; color: string } | null; 
        reviewed_at: string | null 
      }) => ({
        id: r.id,
        original_code: r.original_code,
        original_description: r.original_description,
        final_code: r.final_code,
        final_description: r.final_description,
        status: r.status,
        mapped_open_codes: r.mapped_open_codes,
        mapped_session_ids: r.mapped_session_ids,
        category_id: r.category_id,
        category: r.evaluation_categories ? {
          id: r.evaluation_categories.id,
          name: r.evaluation_categories.name,
          color: r.evaluation_categories.color,
        } : null,
        reviewed_at: r.reviewed_at,
      })) || [],
      review_stats: {
        total: reviews?.length || 0,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    })
  } catch (error) {
    console.error('Generation detail error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/chat-eval/axial-codes/generations/[id]
 * Update generation status
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Verify admin access
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !['pending', 'reviewed', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required (pending, reviewed, completed)' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('axial_code_generations')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Generation not found' }, { status: 404 })
      }
      console.error('Error updating generation:', error)
      return NextResponse.json(
        { error: 'Failed to update generation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ generation: data })
  } catch (error) {
    console.error('Generation update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
