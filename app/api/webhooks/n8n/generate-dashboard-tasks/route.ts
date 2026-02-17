import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/n8n/generate-dashboard-tasks
 *
 * Called by n8n to auto-generate dashboard tasks from a client's assessment data.
 * Authenticated via N8N_INGEST_SECRET bearer token.
 *
 * Body: { client_project_id: string, tasks: Array<{ category, title, description, priority, impact_score, diy_resources?, accelerated_bundle_id?, accelerated_headline?, accelerated_savings? }> }
 */
export async function POST(request: NextRequest) {
  // Auth: bearer token
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  const expectedSecret = process.env.N8N_INGEST_SECRET
  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    client_project_id: string
    tasks: Array<{
      category: string
      title: string
      description?: string
      priority?: 'high' | 'medium' | 'low'
      impact_score?: number
      due_date?: string
      diy_resources?: unknown[]
      accelerated_bundle_id?: string
      accelerated_service_id?: number
      accelerated_headline?: string
      accelerated_savings?: string
    }>
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.client_project_id || !body.tasks || !Array.isArray(body.tasks)) {
    return NextResponse.json(
      { error: 'client_project_id and tasks array are required' },
      { status: 400 }
    )
  }

  // Validate project exists
  const { data: project } = await supabaseAdmin
    .from('client_projects')
    .select('id')
    .eq('id', body.client_project_id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Insert tasks with sequential display_order
  const { data: maxRow } = await supabaseAdmin
    .from('dashboard_tasks')
    .select('display_order')
    .eq('client_project_id', body.client_project_id)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  let nextOrder = (maxRow?.display_order ?? -1) + 1

  const rows = body.tasks.map((task) => ({
    client_project_id: body.client_project_id,
    category: task.category,
    title: task.title,
    description: task.description || null,
    priority: task.priority || 'medium',
    impact_score: task.impact_score || 0,
    due_date: task.due_date || null,
    display_order: nextOrder++,
    diy_resources: task.diy_resources || [],
    accelerated_bundle_id: task.accelerated_bundle_id || null,
    accelerated_service_id: task.accelerated_service_id || null,
    accelerated_headline: task.accelerated_headline || null,
    accelerated_savings: task.accelerated_savings || null,
  }))

  const { data: inserted, error } = await supabaseAdmin
    .from('dashboard_tasks')
    .insert(rows)
    .select('id')

  if (error) {
    console.error('Error inserting dashboard tasks:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    tasks_created: inserted?.length || 0,
  })
}
