import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { listTasks, updateTask, syncTasksToSlack, TASK_CATEGORIES } from '@/lib/meeting-action-tasks'
import type { TaskStatus, TaskCategory } from '@/lib/meeting-action-tasks'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/meeting-action-tasks
 *
 * List tasks. Query params:
 *   - meeting_record_id: filter by meeting
 *   - client_project_id: filter by project
 *   - contact_submission_id: filter by contact. Accepts a number or the literal
 *     string "all" (or omit the param) meaning no restriction on contact.
 *     Per `filter-all-option.mdc`, we never substitute a subset for "all".
 *   - task_category: filter by category (comma-separated allowed). "all" or
 *     omit for no restriction.
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
    const contactSubmissionIdParam = searchParams.get('contact_submission_id')
    const taskCategoryParam = searchParams.get('task_category')
    const statusParam = searchParams.get('status') || undefined

    let contactSubmissionId: number | undefined
    if (contactSubmissionIdParam && contactSubmissionIdParam !== 'all') {
      const parsed = Number(contactSubmissionIdParam)
      if (!Number.isInteger(parsed)) {
        return NextResponse.json(
          { error: 'contact_submission_id must be an integer or "all"' },
          { status: 400 }
        )
      }
      contactSubmissionId = parsed
    }

    let taskCategory: TaskCategory[] | undefined
    if (taskCategoryParam && taskCategoryParam !== 'all') {
      const parts = taskCategoryParam.split(',').map(s => s.trim()).filter(Boolean)
      const invalid = parts.filter(p => !TASK_CATEGORIES.includes(p as TaskCategory))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Invalid task_category value(s): ${invalid.join(', ')}. Allowed: ${TASK_CATEGORIES.join(', ')}` },
          { status: 400 }
        )
      }
      taskCategory = parts as TaskCategory[]
    }

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

    const tasks = await listTasks({
      meetingRecordId,
      clientProjectId,
      contactSubmissionId,
      taskCategory,
      status,
    })

    // Enrich with project + meeting context for display and filtering
    const projectIds = [...new Set((tasks || []).map(t => t.client_project_id).filter(Boolean))] as string[]
    let projectMap: Record<string, { project_name: string | null; client_name: string | null }> = {}
    if (projectIds.length > 0) {
      const { data: projects } = await supabaseAdmin
        .from('client_projects')
        .select('id, project_name, client_name')
        .in('id', projectIds)
      for (const p of projects || []) {
        projectMap[p.id] = { project_name: p.project_name ?? null, client_name: p.client_name ?? null }
      }
    }

    const meetingIds = [...new Set((tasks || []).map(t => t.meeting_record_id).filter(Boolean))] as string[]
    let meetingMap: Record<string, { meeting_type: string | null; meeting_date: string | null; contact_submission_id: number | null }> = {}
    if (meetingIds.length > 0) {
      const { data: meetings } = await supabaseAdmin
        .from('meeting_records')
        .select('id, meeting_type, meeting_date, contact_submission_id')
        .in('id', meetingIds)
      for (const m of meetings || []) {
        meetingMap[m.id] = {
          meeting_type: m.meeting_type ?? null,
          meeting_date: m.meeting_date ?? null,
          contact_submission_id: m.contact_submission_id ?? null,
        }
      }
    }

    // Batch-fetch lead details. Prefer the task's OWN contact_submission_id (durable
    // attribution, see 2026_04_17 migration) and fall back to the meeting's value
    // for tasks that haven't been backfilled yet.
    const leadIds = [...new Set(
      (tasks || [])
        .map(t => {
          const direct = t.contact_submission_id
          if (typeof direct === 'number') return direct
          const meetingCs = t.meeting_record_id ? meetingMap[t.meeting_record_id]?.contact_submission_id : null
          return meetingCs ?? null
        })
        .filter((v): v is number => typeof v === 'number')
    )]
    let leadMap: Record<number, { name: string | null; email: string | null }> = {}
    if (leadIds.length > 0) {
      const { data: leads } = await supabaseAdmin
        .from('contact_submissions')
        .select('id, name, email')
        .in('id', leadIds)
      for (const l of leads || []) {
        leadMap[l.id] = { name: l.name ?? null, email: l.email ?? null }
      }
    }

    const enrichedTasks = tasks.map(t => {
      const meeting = t.meeting_record_id ? meetingMap[t.meeting_record_id] : null
      const csId = typeof t.contact_submission_id === 'number'
        ? t.contact_submission_id
        : meeting?.contact_submission_id ?? null
      const lead = csId ? leadMap[csId] : null
      return {
        ...t,
        project_name: t.client_project_id ? projectMap[t.client_project_id]?.project_name ?? null : null,
        client_name: t.client_project_id ? projectMap[t.client_project_id]?.client_name ?? null : null,
        meeting_type: meeting?.meeting_type ?? null,
        meeting_date: meeting?.meeting_date ?? null,
        contact_submission_id: csId,
        lead_name: lead?.name ?? null,
        lead_email: lead?.email ?? null,
      }
    })

    return NextResponse.json({ tasks: enrichedTasks })
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
        contact_submission_id?: number | null
        task_category?: TaskCategory
      }>
      sync_slack?: boolean
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array is required' },
        { status: 400 }
      )
    }

    // Validate task_category against allowed enum (keeps DB layer, API layer,
    // and UI layer in sync per enum-sync-checklist.mdc).
    for (const upd of updates) {
      if (
        upd.task_category !== undefined &&
        !TASK_CATEGORIES.includes(upd.task_category as TaskCategory)
      ) {
        return NextResponse.json(
          {
            error: `Invalid task_category: ${upd.task_category}. Allowed: ${TASK_CATEGORIES.join(', ')}`,
          },
          { status: 400 }
        )
      }
      if (
        upd.contact_submission_id !== undefined &&
        upd.contact_submission_id !== null &&
        !Number.isInteger(upd.contact_submission_id)
      ) {
        return NextResponse.json(
          { error: 'contact_submission_id must be an integer or null' },
          { status: 400 }
        )
      }
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
