import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/meetings/[id]/assign-lead
 *
 * Sets contact_submission_id on a meeting_record, linking it to a lead.
 * Also cascades client_project_id if the lead already has a project.
 *
 * Body: { contact_submission_id: number | null }
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
    const { contact_submission_id } = body as { contact_submission_id: number | null }

    if (contact_submission_id !== null && typeof contact_submission_id !== 'number') {
      return NextResponse.json(
        { error: 'contact_submission_id must be a number or null' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = { contact_submission_id }

    // If linking to a lead, check if that lead already has a client_project
    if (contact_submission_id !== null) {
      const { data: project } = await supabaseAdmin
        .from('client_projects')
        .select('id')
        .eq('contact_submission_id', contact_submission_id)
        .limit(1)
        .maybeSingle()

      if (project) {
        updates.client_project_id = project.id
      }
    }

    const { data: meeting, error } = await supabaseAdmin
      .from('meeting_records')
      .update(updates)
      .eq('id', id)
      .select('id, contact_submission_id, client_project_id')
      .single()

    if (error) {
      console.error('[assign-lead] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to update meeting record' },
        { status: 500 }
      )
    }

    // Cascade client_project_id to tasks if we set one
    if (updates.client_project_id) {
      await supabaseAdmin
        .from('meeting_action_tasks')
        .update({ client_project_id: updates.client_project_id as string })
        .eq('meeting_record_id', id)
        .is('client_project_id', null)
    }

    return NextResponse.json({ success: true, meeting })
  } catch (error) {
    console.error('[assign-lead] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
