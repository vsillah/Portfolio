import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/chat-eval/diagnoses
 * List all error diagnoses with filters
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
    const status = searchParams.get('status')
    const error_type = searchParams.get('error_type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Use explicit FK names: error_diagnoses has FKs to both chat_sessions and chat_evaluations
    let query = supabaseAdmin
      .from('error_diagnoses')
      .select(`
        *,
        chat_sessions!error_diagnoses_session_id_fkey(
          session_id,
          visitor_name,
          visitor_email
        ),
        chat_evaluations!error_diagnoses_evaluation_id_fkey(
          id,
          notes,
          evaluation_categories(name, color)
        )
      `, { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }

    if (error_type) {
      query = query.eq('error_type', error_type)
    }

    query = query
      .order('diagnosed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: diagnoses, error, count } = await query

    if (error) {
      console.error('Error fetching diagnoses:', error)
      return NextResponse.json(
        { error: 'Failed to fetch diagnoses' },
        { status: 500 }
      )
    }

    // Transform diagnoses for response
    const transformedDiagnoses = (diagnoses || []).map((diag: any) => ({
      id: diag.id,
      session_id: diag.session_id,
      root_cause: diag.root_cause,
      error_type: diag.error_type,
      confidence_score: diag.confidence_score,
      status: diag.status,
      recommendations_count: Array.isArray(diag.recommendations) ? diag.recommendations.length : 0,
      diagnosed_at: diag.diagnosed_at,
      reviewed_at: diag.reviewed_at,
      applied_at: diag.applied_at,
      model_used: diag.model_used,
      session: diag.chat_sessions ? {
        session_id: diag.chat_sessions.session_id,
        visitor_name: diag.chat_sessions.visitor_name,
        visitor_email: diag.chat_sessions.visitor_email,
      } : null,
      evaluation: diag.chat_evaluations ? {
        id: diag.chat_evaluations.id,
        notes: diag.chat_evaluations.notes,
        category: diag.chat_evaluations.evaluation_categories ? {
          name: diag.chat_evaluations.evaluation_categories.name,
          color: diag.chat_evaluations.evaluation_categories.color,
        } : null,
      } : null,
    }))

    return NextResponse.json({
      diagnoses: transformedDiagnoses,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Diagnoses list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
