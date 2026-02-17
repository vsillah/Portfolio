import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/n8n/milestone-notify
 *
 * Called by n8n to check for and report milestone achievements.
 * Can be triggered after a score recalculation or on a schedule.
 * Authenticated via N8N_INGEST_SECRET bearer token.
 *
 * Body: { client_project_id: string }
 *
 * Returns milestone achievement details so n8n can send notifications.
 */
export async function POST(request: NextRequest) {
  // Auth: bearer token
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET
  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { client_project_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.client_project_id) {
    return NextResponse.json(
      { error: 'client_project_id is required' },
      { status: 400 }
    )
  }

  // Fetch project + client info
  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select('id, client_name, client_email, client_company, onboarding_plan_id')
    .eq('id', body.client_project_id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Fetch latest score snapshot
  const { data: latestSnapshot } = await supabaseAdmin
    .from('score_snapshots')
    .select('overall_score, category_scores, snapshot_date')
    .eq('client_project_id', body.client_project_id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  // Fetch task completion stats
  const { data: tasks } = await supabaseAdmin
    .from('dashboard_tasks')
    .select('status')
    .eq('client_project_id', body.client_project_id)

  const totalTasks = tasks?.length || 0
  const completedTasks = tasks?.filter((t: { status: string }) => t.status === 'complete').length || 0
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Define score milestones
  const milestoneThresholds = [25, 50, 75, 90]
  const currentScore = latestSnapshot?.overall_score || 0

  // Check which milestones are newly achieved
  const { data: previousSnapshots } = await supabaseAdmin
    .from('score_snapshots')
    .select('overall_score')
    .eq('client_project_id', body.client_project_id)
    .order('snapshot_date', { ascending: false })
    .limit(2) // Current + previous

  const previousScore = previousSnapshots && previousSnapshots.length >= 2
    ? previousSnapshots[1].overall_score
    : 0

  const newMilestones = milestoneThresholds.filter(
    (threshold) => currentScore >= threshold && previousScore < threshold
  )

  // Fetch dashboard access token for the link
  const { data: access } = await supabaseAdmin
    .from('client_dashboard_access')
    .select('access_token')
    .eq('client_project_id', body.client_project_id)
    .eq('is_active', true)
    .limit(1)
    .single()

  return NextResponse.json({
    client_name: project.client_name,
    client_email: project.client_email,
    client_company: project.client_company,
    current_score: currentScore,
    previous_score: previousScore,
    score_change: currentScore - previousScore,
    completion_rate: completionRate,
    tasks_completed: completedTasks,
    tasks_total: totalTasks,
    new_milestones: newMilestones,
    has_new_milestones: newMilestones.length > 0,
    dashboard_url: access?.access_token
      ? `/client/dashboard/${access.access_token}`
      : null,
  })
}
