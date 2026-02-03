import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/chat-eval/diagnoses/[id]
 * Get detailed diagnosis with recommendations
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

    // Fetch diagnosis with related data
    const { data: diagnosis, error: diagError } = await supabaseAdmin
      .from('error_diagnoses')
      .select(`
        *,
        chat_sessions(
          session_id,
          visitor_name,
          visitor_email,
          channel
        ),
        chat_evaluations(
          id,
          rating,
          notes,
          tags,
          open_code,
          evaluation_categories(id, name, description, color)
        ),
        fix_applications(
          id,
          change_type,
          target_identifier,
          application_method,
          verification_status,
          applied_at
        )
      `)
      .eq('id', id)
      .single()

    if (diagError) {
      if (diagError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Diagnosis not found' }, { status: 404 })
      }
      console.error('Error fetching diagnosis:', diagError)
      return NextResponse.json(
        { error: 'Failed to fetch diagnosis' },
        { status: 500 }
      )
    }

    return NextResponse.json({ diagnosis })
  } catch (error) {
    console.error('Diagnosis detail error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/chat-eval/diagnoses/[id]
 * Update diagnosis (e.g., change status, add notes)
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
    const { status, recommendations, application_instructions } = body

    const updates: Record<string, any> = {}

    if (status) {
      if (!['pending', 'reviewed', 'approved', 'applied', 'rejected'].includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        )
      }
      updates.status = status
      
      if (status === 'reviewed' || status === 'approved') {
        updates.reviewed_by = authResult.user.id
        updates.reviewed_at = new Date().toISOString()
      }
    }

    if (recommendations !== undefined) {
      updates.recommendations = recommendations
    }

    if (application_instructions !== undefined) {
      updates.application_instructions = application_instructions
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('error_diagnoses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Diagnosis not found' }, { status: 404 })
      }
      console.error('Error updating diagnosis:', error)
      return NextResponse.json(
        { error: 'Failed to update diagnosis' },
        { status: 500 }
      )
    }

    return NextResponse.json({ diagnosis: data })
  } catch (error) {
    console.error('Diagnosis update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
