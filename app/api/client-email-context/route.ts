import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-email-context?email=...
 *
 * Returns project context for drafting a reply to a client email.
 * Used by n8n Gmail draft workflow to build LLM context.
 *
 * Returns:
 *   - project: name, status, phase, product, client info
 *   - milestones: summary (total, completed, next milestone)
 *   - last_meeting: type, date, summary, key decisions
 *   - action_items: pending and recently completed tasks
 *
 * Auth: admin (Bearer session token) OR n8n (Bearer N8N_INGEST_SECRET).
 */
export async function GET(request: NextRequest) {
  try {
    // Auth: admin session OR ingest secret
    const authorized = await authorizeRequest(request)
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'email query parameter is required' }, { status: 400 })
    }

    // 1. Find client project by email
    const { data: project, error: projErr } = await supabaseAdmin
      .from('client_projects')
      .select('id, client_name, client_email, client_company, project_name, project_status, current_phase, product_purchased, slack_channel, project_start_date, estimated_end_date')
      .eq('client_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (projErr || !project) {
      return NextResponse.json({
        found: false,
        message: `No client project found for email: ${email}`,
      }, { status: 404 })
    }

    // 2. Milestones summary (from onboarding_plans)
    let milestones: {
      total: number
      completed: number
      in_progress: number
      next_milestone: string | null
      schedule_status: string | null
    } | null = null

    const { data: plan } = await supabaseAdmin
      .from('onboarding_plans')
      .select('milestones, status')
      .eq('client_project_id', project.id)
      .limit(1)
      .single()

    if (plan?.milestones && Array.isArray(plan.milestones)) {
      const ms = plan.milestones as Array<{ title?: string; status?: string; target_date?: string }>
      const completed = ms.filter(m => m.status === 'complete').length
      const inProgress = ms.filter(m => m.status === 'in_progress').length
      const nextMs = ms.find(m => m.status !== 'complete')

      milestones = {
        total: ms.length,
        completed,
        in_progress: inProgress,
        next_milestone: nextMs?.title ?? null,
        schedule_status: completed === ms.length ? 'complete' : inProgress > 0 ? 'in progress' : 'not started',
      }
    }

    // 3. Last meeting record
    let lastMeeting: {
      meeting_type: string
      meeting_date: string
      summary: string | null
      key_decisions: unknown[] | null
    } | null = null

    const { data: meeting } = await supabaseAdmin
      .from('meeting_records')
      .select('meeting_type, meeting_date, structured_notes, key_decisions')
      .eq('client_project_id', project.id)
      .order('meeting_date', { ascending: false })
      .limit(1)
      .single()

    if (meeting) {
      // Extract a short summary from structured_notes if available
      const notes = meeting.structured_notes as Record<string, unknown> | null
      const summary = notes?.summary as string | null
        ?? notes?.highlights as string | null
        ?? null

      lastMeeting = {
        meeting_type: meeting.meeting_type,
        meeting_date: meeting.meeting_date,
        summary,
        key_decisions: meeting.key_decisions as unknown[] | null,
      }
    }

    // 4. Action items (pending + recently completed)
    let actionItems: {
      pending: Array<{ title: string; owner: string | null; due_date: string | null }>
      recently_completed: Array<{ title: string; completed_at: string | null }>
    } | null = null

    const { data: tasks } = await supabaseAdmin
      .from('meeting_action_tasks')
      .select('title, owner, due_date, status, completed_at')
      .eq('client_project_id', project.id)
      .in('status', ['pending', 'in_progress', 'complete'])
      .order('display_order', { ascending: true })
      .limit(20)

    type TaskRow = { title: string; owner: string | null; due_date: string | null; status: string; completed_at: string | null }
    const typedTasks = (tasks || []) as TaskRow[]

    if (typedTasks.length > 0) {
      actionItems = {
        pending: typedTasks
          .filter((t: TaskRow) => t.status === 'pending' || t.status === 'in_progress')
          .map((t: TaskRow) => ({ title: t.title, owner: t.owner, due_date: t.due_date })),
        recently_completed: typedTasks
          .filter((t: TaskRow) => t.status === 'complete')
          .slice(0, 5)
          .map((t: TaskRow) => ({ title: t.title, completed_at: t.completed_at })),
      }
    }

    return NextResponse.json({
      found: true,
      project: {
        id: project.id,
        client_name: project.client_name,
        client_email: project.client_email,
        client_company: project.client_company,
        project_name: project.project_name,
        project_status: project.project_status,
        current_phase: project.current_phase,
        product_purchased: project.product_purchased,
        slack_channel: project.slack_channel,
        project_start_date: project.project_start_date,
        estimated_end_date: project.estimated_end_date,
      },
      milestones,
      last_meeting: lastMeeting,
      action_items: actionItems,
    })
  } catch (error) {
    console.error('[Client email context] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Authorize via admin session OR N8N_INGEST_SECRET.
 */
async function authorizeRequest(request: NextRequest): Promise<boolean> {
  const authResult = await verifyAdmin(request)
  if (!isAuthError(authResult)) {
    return true
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET

  if (expectedSecret && token === expectedSecret) {
    return true
  }

  return false
}
