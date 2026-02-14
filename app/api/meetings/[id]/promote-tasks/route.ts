import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { promoteActionItems, listTasks, syncTasksToSlack } from '@/lib/meeting-action-tasks'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/meetings/[id]/promote-tasks
 *
 * Promote action_items from a meeting_record into meeting_action_tasks rows.
 * Optionally syncs the new tasks to Slack via the task-sync n8n webhook.
 *
 * Auth: admin only.
 * Body (optional): { sync_slack?: boolean }
 */
export async function POST(
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

    const { id: meetingRecordId } = await params
    const body = await request.json().catch(() => ({}))
    const syncSlack = body.sync_slack !== false // default true

    // Promote action items → tasks
    const result = await promoteActionItems(meetingRecordId)

    // Optionally sync new tasks to Slack with enriched context
    let slackResult: { synced: boolean; message: string } | null = null
    if (syncSlack && result.created > 0) {
      const tasks = await listTasks({ meetingRecordId })

      // Fetch meeting + project context for richer Slack messages
      const { data: meeting } = await supabaseAdmin
        .from('meeting_records')
        .select('meeting_type, client_project_id')
        .eq('id', meetingRecordId)
        .single()

      let projectName: string | null = null
      let clientName: string | null = null
      if (meeting?.client_project_id) {
        const { data: project } = await supabaseAdmin
          .from('client_projects')
          .select('project_name, client_name')
          .eq('id', meeting.client_project_id)
          .single()
        projectName = project?.project_name ?? null
        clientName = project?.client_name ?? null
      }

      slackResult = await syncTasksToSlack({
        action: 'create',
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          owner: t.owner,
          due_date: t.due_date,
          status: t.status,
          meeting_type: meeting?.meeting_type ?? null,
          project_name: projectName,
          client_name: clientName,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      slack: slackResult,
    })
  } catch (error) {
    console.error('[Promote tasks] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
