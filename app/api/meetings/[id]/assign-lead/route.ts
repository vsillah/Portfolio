import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/meetings/[id]/assign-lead
 *
 * Sets contact_submission_id on a meeting_record, linking it to a lead.
 * Cascades client_project_id if the lead already has a project.
 * Also cascades contact_submission_id to child meeting_action_tasks using a
 * three-branch algorithm that preserves manually-retargeted tasks.
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

    // Snapshot the previous contact BEFORE updating so task cascade can branch correctly.
    const { data: previousMeeting, error: previousError } = await supabaseAdmin
      .from('meeting_records')
      .select('id, contact_submission_id')
      .eq('id', id)
      .maybeSingle()

    if (previousError) {
      console.error('[assign-lead] Failed to fetch previous meeting:', previousError)
      return NextResponse.json(
        { error: 'Failed to update meeting record' },
        { status: 500 }
      )
    }

    if (!previousMeeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const previousContactId = (previousMeeting.contact_submission_id as number | null) ?? null

    const updates: Record<string, unknown> = { contact_submission_id }

    // Full clear: project-only rows have client_project_id set but no lead — nulling only
    // contact_submission_id would leave the project link. Clear both for "unlink meeting".
    if (contact_submission_id === null) {
      updates.client_project_id = null
    }

    // If linking to a lead, check if that lead already has a client_project.
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

    // Cascade client_project_id to tasks if we set one (unchanged behavior).
    if (updates.client_project_id) {
      await supabaseAdmin
        .from('meeting_action_tasks')
        .update({ client_project_id: updates.client_project_id as string })
        .eq('meeting_record_id', id)
        .is('client_project_id', null)
    }

    // Cascade contact_submission_id to meeting_action_tasks using a three-branch
    // algorithm. Only touch tasks that still match the previous attribution so we
    // never overwrite a task that was manually retargeted to a different contact.
    if (previousContactId === null && contact_submission_id !== null) {
      // Case A: brand-new attribution — backfill only tasks that are still null.
      const { error: cascadeError } = await supabaseAdmin
        .from('meeting_action_tasks')
        .update({ contact_submission_id })
        .eq('meeting_record_id', id)
        .is('contact_submission_id', null)
      if (cascadeError) {
        console.error('[assign-lead] Task cascade (A: backfill) failed:', cascadeError)
      }
    } else if (
      previousContactId !== null &&
      contact_submission_id !== null &&
      previousContactId !== contact_submission_id
    ) {
      // Case B: reassignment — move only tasks that still match the previous contact.
      const { error: cascadeError } = await supabaseAdmin
        .from('meeting_action_tasks')
        .update({ contact_submission_id })
        .eq('meeting_record_id', id)
        .eq('contact_submission_id', previousContactId)
      if (cascadeError) {
        console.error('[assign-lead] Task cascade (B: reassign) failed:', cascadeError)
      }
    } else if (contact_submission_id === null && previousContactId !== null) {
      // Case C: unlinking — only clear tasks that still match the previous contact.
      // Manually-retargeted tasks are preserved.
      const { error: cascadeError } = await supabaseAdmin
        .from('meeting_action_tasks')
        .update({ contact_submission_id: null })
        .eq('meeting_record_id', id)
        .eq('contact_submission_id', previousContactId)
      if (cascadeError) {
        console.error('[assign-lead] Task cascade (C: unlink) failed:', cascadeError)
      }
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
