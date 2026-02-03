import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/admin/chat-eval/diagnoses/[id]/approve
 * Approve recommendations (marks as ready to apply)
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
    const { recommendation_ids } = body // Optional: approve specific recommendations

    // Fetch current diagnosis
    const { data: diagnosis, error: fetchError } = await supabaseAdmin
      .from('error_diagnoses')
      .select('recommendations, status')
      .eq('id', id)
      .single()

    if (fetchError || !diagnosis) {
      return NextResponse.json(
        { error: 'Diagnosis not found' },
        { status: 404 }
      )
    }

    // Update recommendations if specific ones are approved
    let updatedRecommendations = diagnosis.recommendations
    if (recommendation_ids && Array.isArray(recommendation_ids)) {
      updatedRecommendations = (diagnosis.recommendations || []).map((rec: any) => {
        if (recommendation_ids.includes(rec.id)) {
          return { ...rec, approved: true }
        }
        return rec
      })
    } else {
      // Approve all recommendations
      updatedRecommendations = (diagnosis.recommendations || []).map((rec: any) => ({
        ...rec,
        approved: true,
      }))
    }

    // Update diagnosis status
    const { data, error } = await supabaseAdmin
      .from('error_diagnoses')
      .update({
        status: 'approved',
        recommendations: updatedRecommendations,
        reviewed_by: authResult.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error approving diagnosis:', error)
      return NextResponse.json(
        { error: 'Failed to approve diagnosis' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      diagnosis: data,
      message: 'Diagnosis approved successfully',
    })
  } catch (error) {
    console.error('Approve diagnosis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
