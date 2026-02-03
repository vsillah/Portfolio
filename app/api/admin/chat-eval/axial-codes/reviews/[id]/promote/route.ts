import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/admin/chat-eval/axial-codes/reviews/[id]/promote
 * Promote an approved axial code to become an evaluation category
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const { color, sort_order } = body

    // Fetch the review
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('axial_code_reviews')
      .select('*')
      .eq('id', id)
      .single()

    if (reviewError) {
      if (reviewError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 })
      }
      console.error('Error fetching review:', reviewError)
      return NextResponse.json(
        { error: 'Failed to fetch review' },
        { status: 500 }
      )
    }

    // Verify review is approved or modified
    if (review.status !== 'approved' && review.status !== 'modified') {
      return NextResponse.json(
        { error: 'Only approved or modified reviews can be promoted to categories' },
        { status: 400 }
      )
    }

    // Check if already promoted
    if (review.category_id) {
      return NextResponse.json(
        { error: 'This axial code has already been promoted to a category' },
        { status: 400 }
      )
    }

    // Get the highest sort_order
    const { data: maxSort } = await supabaseAdmin
      .from('evaluation_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = sort_order ?? ((maxSort?.sort_order || 0) + 1)

    // Create the new category
    const categoryData = {
      name: review.final_code || review.original_code,
      description: review.final_description || review.original_description,
      color: color || '#6B7280', // Default gray if not specified
      sort_order: nextSortOrder,
      is_active: true,
      source: 'axial_code',
      axial_review_id: review.id,
    }

    const { data: category, error: categoryError } = await supabaseAdmin
      .from('evaluation_categories')
      .insert(categoryData)
      .select()
      .single()

    if (categoryError) {
      // Check for unique constraint violation (category name already exists)
      if (categoryError.code === '23505') {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 }
        )
      }
      console.error('Error creating category:', categoryError)
      return NextResponse.json(
        { error: 'Failed to create category' },
        { status: 500 }
      )
    }

    // Update the review with the new category_id
    const { error: updateError } = await supabaseAdmin
      .from('axial_code_reviews')
      .update({ category_id: category.id })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating review with category_id:', updateError)
      // Don't fail - category was created successfully
    }

    // Check if all approved reviews have been promoted
    const { data: siblings } = await supabaseAdmin
      .from('axial_code_reviews')
      .select('status, category_id')
      .eq('generation_id', review.generation_id)

    if (siblings) {
      const approvedReviews = siblings.filter((s: { status: string; category_id: string | null }) => s.status === 'approved' || s.status === 'modified')
      const allPromoted = approvedReviews.every((s: { status: string; category_id: string | null }) => s.category_id !== null)
      
      if (allPromoted && approvedReviews.length > 0) {
        // Update generation status to 'completed'
        await supabaseAdmin
          .from('axial_code_generations')
          .update({ status: 'completed' })
          .eq('id', review.generation_id)
      }
    }

    return NextResponse.json({
      category,
      message: 'Axial code successfully promoted to category',
    })
  } catch (error) {
    console.error('Promote error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
