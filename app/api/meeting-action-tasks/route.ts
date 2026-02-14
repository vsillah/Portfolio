import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { listTasks, updateTask, syncTasksToSlack } from '@/lib/meeting-action-tasks'
import type { TaskStatus } from '@/lib/meeting-action-tasks'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meeting-action-tasks
 *
 * List tasks. Query params:
 *   - meeting_record_id: filter by meeting
 *   - client_project_id: filter by project
 *   - status: filter by status (comma-separated for multiple)
 *
 * Auth: admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const meetingRecordId = searchParams.get('meeting_record_id') || undefined
    const clientProjectId = searchParams.get('client_project_id') || undefined
    const statusParam = searchParams.get('status') || undefined

    // Validate status values against allowed enum
    const VALID_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'complete', 'cancelled']
    let status: TaskStatus[] | undefined
    if (statusParam) {
      const parts = statusParam.split(',')
      const invalid = parts.filter(s => !VALID_STATUSES.includes(s as TaskStatus))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Invalid status value(s): ${invalid.join(', ')}. Allowed: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      status = parts as TaskStatus[]
    }

    const tasks = await listTasks({ meetingRecordId, clientProjectId, status })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('[Meeting action tasks GET] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/meeting-action-tasks
 *
 * Update one or more tasks. Body:
 * {
 *   updates: Array<{
 *     id: string
 *     status?: TaskStatus
 *     title?: string
 *     description?: string
 *     owner?: string
 *     due_date?: string
 *   }>
 *   sync_slack?: boolean  // default true
 * }
 *
 * Auth: admin only.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const { updates, sync_slack } = body as {
      updates: Array<{
        id: string
        status?: TaskStatus
        title?: string
        description?: string
        owner?: string
        due_date?: string
      }>
      sync_slack?: boolean
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array is required' },
        { status: 400 }
      )
    }

    const userId = !isAuthError(authResult) ? authResult.user.id : undefined
    const results = []

    for (const upd of updates) {
      const { id, ...fields } = upd
      if (!id) continue
      const updated = await updateTask(id, fields, userId)
      results.push(updated)
    }

    // Optionally sync status changes to Slack with enriched context
    if (sync_slack !== false && results.length > 0) {
      // Fetch meeting + project context for richer Slack messages
      const meetingRecordId = results[0].meeting_record_id
      let meetingType: string | null = null
      let projectName: string | null = null
      let clientName: string | null = null

      if (meetingRecordId) {
        const { data: meeting } = await supabaseAdmin
          .from('meeting_records')
          .select('meeting_type, client_project_id')
          .eq('id', meetingRecordId)
          .single()
        meetingType = meeting?.meeting_type ?? null

        if (meeting?.client_project_id) {
          const { data: project } = await supabaseAdmin
            .from('client_projects')
            .select('project_name, client_name')
            .eq('id', meeting.client_project_id)
            .single()
          projectName = project?.project_name ?? null
          clientName = project?.client_name ?? null
        }
      }

      await syncTasksToSlack({
        action: 'update_status',
        tasks: results.map(t => ({
          id: t.id,
          title: t.title,
          owner: t.owner,
          due_date: t.due_date,
          status: t.status,
          meeting_type: meetingType,
          project_name: projectName,
          client_name: clientName,
        })),
      })
    }

    return NextResponse.json({ success: true, updated: results })
  } catch (error) {
    console.error('[Meeting action tasks PATCH] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
