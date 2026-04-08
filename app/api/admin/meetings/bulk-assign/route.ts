import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/meetings/bulk-assign
 *
 * Bulk-attribute meeting records to a lead or project.
 * Body: { meeting_ids: string[], contact_submission_id?: number | null, client_project_id?: string | null }
 * At least one of contact_submission_id or client_project_id should be provided.
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const meetingIds: string[] = body.meeting_ids
    const contactSubmissionId = body.contact_submission_id ?? null
    const clientProjectId = body.client_project_id ?? null

    if (!Array.isArray(meetingIds) || meetingIds.length === 0) {
      return NextResponse.json({ error: 'meeting_ids must be a non-empty array' }, { status: 400 })
    }
    if (meetingIds.length > 50) {
      return NextResponse.json({ error: 'Cannot assign more than 50 meetings at once' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (contactSubmissionId !== null) {
      updates.contact_submission_id = Number(contactSubmissionId)
      const { data: project } = await supabaseAdmin
        .from('client_projects')
        .select('id')
        .eq('contact_submission_id', Number(contactSubmissionId))
        .limit(1)
        .maybeSingle()
      if (project) {
        updates.client_project_id = project.id
      }
    }
    if (clientProjectId !== null) {
      updates.client_project_id = clientProjectId
      if (!contactSubmissionId) {
        const { data: project } = await supabaseAdmin
          .from('client_projects')
          .select('contact_submission_id')
          .eq('id', clientProjectId)
          .single()
        if (project?.contact_submission_id) {
          updates.contact_submission_id = project.contact_submission_id
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Provide contact_submission_id or client_project_id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('meeting_records')
      .update(updates)
      .in('id', meetingIds)

    if (error) {
      console.error('[bulk-assign] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to update meetings' }, { status: 500 })
    }

    return NextResponse.json({ success: true, updated: meetingIds.length })
  } catch (err) {
    console.error('[bulk-assign] Error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
