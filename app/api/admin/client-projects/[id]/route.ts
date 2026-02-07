import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/client-projects/[id]
 * Full project detail including onboarding plan with milestones,
 * communication plan, warranty, artifacts, and progress update history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params

    // Fetch client project with related data
    const { data: project, error: projectError } = await supabaseAdmin
      .from('client_projects')
      .select('*')
      .eq('id', id)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Client project not found' },
        { status: 404 }
      )
    }

    // Fetch onboarding plan (table may not exist yet -- ignore errors gracefully)
    let onboardingPlan = null
    const { data: planData, error: planError } = await supabaseAdmin
      .from('onboarding_plans')
      .select('*')
      .eq('client_project_id', id)
      .maybeSingle()

    if (!planError && planData) {
      onboardingPlan = planData
    }

    // Fetch progress update history (table may not exist yet)
    const { data: progressUpdates } = await supabaseAdmin
      .from('progress_update_log')
      .select('*')
      .eq('client_project_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    // Fetch project blockers (table may not exist yet)
    const { data: blockers } = await supabaseAdmin
      .from('project_blockers')
      .select('*')
      .eq('client_project_id', id)
      .order('detected_at', { ascending: false })

    return NextResponse.json({
      project,
      onboarding_plan: onboardingPlan,
      progress_updates: progressUpdates || [],
      blockers: blockers || [],
    })
  } catch (error) {
    console.error('Error in GET /api/admin/client-projects/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/client-projects/[id]
 * Update project fields (status, phase, slack_channel, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id } = await params
    const body = await request.json()

    // Allowed fields for update
    const allowedFields = [
      'project_status',
      'current_phase',
      'slack_channel',
      'project_start_date',
      'estimated_end_date',
      'project_folder_url',
      'sop_document_url',
      'video_url',
    ]

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('client_projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating client project:', error)
      return NextResponse.json(
        { error: 'Failed to update client project' },
        { status: 500 }
      )
    }

    return NextResponse.json({ project: data })
  } catch (error) {
    console.error('Error in PATCH /api/admin/client-projects/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
