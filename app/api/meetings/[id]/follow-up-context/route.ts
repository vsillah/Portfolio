import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meetings/[id]/follow-up-context
 *
 * Returns meeting + project context needed to schedule a follow-up meeting.
 * Used by n8n WF-FUP (Calendly scheduling) or by the admin UI.
 *
 * Returns:
 *   - meeting: type, date, attendees, next_meeting_type, next_meeting_agenda
 *   - project: name, client_name, client_email, slack_channel
 *   - action_items_summary: count of pending/complete tasks
 *
 * Auth: admin (Bearer session token) OR n8n (Bearer N8N_INGEST_SECRET).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: admin session OR ingest secret
    const authorized = await authorizeRequest(request)
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: meetingRecordId } = await params

    // 1. Fetch meeting record
    const { data: meeting, error: meetingErr } = await supabaseAdmin
      .from('meeting_records')
      .select(
        'id, meeting_type, meeting_date, duration_minutes, attendees, next_meeting_type, next_meeting_agenda, client_project_id, calendly_event_uri'
      )
      .eq('id', meetingRecordId)
      .single()

    if (meetingErr || !meeting) {
      return NextResponse.json({ error: 'Meeting record not found' }, { status: 404 })
    }

    // 2. Fetch project context (if linked)
    let project: {
      id: string
      client_name: string
      client_email: string
      client_company: string | null
      project_name: string | null
      slack_channel: string | null
      project_status: string | null
    } | null = null

    if (meeting.client_project_id) {
      const { data } = await supabaseAdmin
        .from('client_projects')
        .select('id, client_name, client_email, client_company, project_name, slack_channel, project_status')
        .eq('id', meeting.client_project_id)
        .single()
      project = data
    }

    // 3. Action items summary for this meeting
    let taskSummary: { pending: number; in_progress: number; complete: number; total: number } | null = null
    const { data: tasks } = await supabaseAdmin
      .from('meeting_action_tasks')
      .select('status')
      .eq('meeting_record_id', meetingRecordId)

    type StatusRow = { status: string }
    const typedTasks = (tasks || []) as StatusRow[]

    if (typedTasks.length > 0) {
      taskSummary = {
        pending: typedTasks.filter((t: StatusRow) => t.status === 'pending').length,
        in_progress: typedTasks.filter((t: StatusRow) => t.status === 'in_progress').length,
        complete: typedTasks.filter((t: StatusRow) => t.status === 'complete').length,
        total: typedTasks.length,
      }
    }

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        meeting_type: meeting.meeting_type,
        meeting_date: meeting.meeting_date,
        duration_minutes: meeting.duration_minutes,
        attendees: meeting.attendees,
        next_meeting_type: meeting.next_meeting_type,
        next_meeting_agenda: meeting.next_meeting_agenda,
        calendly_event_uri: meeting.calendly_event_uri,
      },
      project,
      task_summary: taskSummary,
    })
  } catch (error) {
    console.error('[Follow-up context] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Authorize via admin session OR N8N_INGEST_SECRET.
 */
async function authorizeRequest(request: NextRequest): Promise<boolean> {
  // Try admin session first
  const authResult = await verifyAdmin(request)
  if (!isAuthError(authResult)) {
    return true
  }

  // Fall back to ingest secret
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (expectedSecret && token === expectedSecret) {
    return true
  }

  return false
}
