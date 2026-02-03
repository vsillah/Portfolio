import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/chat-eval/axial-codes/reviews/[id]
 * Get a specific review
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

    const { data: review, error } = await supabaseAdmin
      .from('axial_code_reviews')
      .select(`
        *,
        evaluation_categories(id, name, color, description),
        axial_code_generations(
          id,
          source_session_ids,
          source_open_codes,
          model_used
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 })
      }
      console.error('Error fetching review:', error)
      return NextResponse.json(
        { error: 'Failed to fetch review' },
        { status: 500 }
      )
    }

    return NextResponse.json({ review })
  } catch (error) {
    console.error('Review fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/chat-eval/axial-codes/reviews/[id]
 * Update a review (approve/reject/modify)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { status, final_code, final_description } = body

    // Validate status
    if (!status || !['pending', 'approved', 'rejected', 'modified'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status is required (pending, approved, rejected, modified)' },
        { status: 400 }
      )
    }

    // If approving or modifying, final_code is required
    if ((status === 'approved' || status === 'modified') && !final_code) {
      return NextResponse.json(
        { error: 'final_code is required when approving or modifying' },
        { status: 400 }
      )
    }

    // Build update object
    const updates: Record<string, any> = {
      status,
      reviewed_by: authResult.user.id,
      reviewed_at: new Date().toISOString(),
    }

    if (final_code) {
      updates.final_code = final_code
    }

    if (final_description !== undefined) {
      updates.final_description = final_description
    }

    const { data: review, error } = await supabaseAdmin
      .from('axial_code_reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 })
      }
      console.error('Error updating review:', error)
      return NextResponse.json(
        { error: 'Failed to update review' },
        { status: 500 }
      )
    }

    // Check if all reviews for this generation are complete
    const { data: siblings } = await supabaseAdmin
      .from('axial_code_reviews')
      .select('status')
      .eq('generation_id', review.generation_id)

    if (siblings) {
      const allReviewed = siblings.every((s: { status: string }) => s.status !== 'pending')
      if (allReviewed) {
        // Update generation status to 'reviewed'
        await supabaseAdmin
          .from('axial_code_generations')
          .update({ status: 'reviewed' })
          .eq('id', review.generation_id)
      }
    }

    return NextResponse.json({ review })
  } catch (error) {
    console.error('Review update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
