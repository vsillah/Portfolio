import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/time-entries?project_id=...&target_type=...&target_id=...
 * List time entries for a project, optionally filtered by target.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const targetType = searchParams.get('target_type')
  const targetId = searchParams.get('target_id')

  if (!projectId) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('time_entries')
    .select('*')
    .eq('client_project_id', projectId)
    .order('created_at', { ascending: false })

  if (targetType) query = query.eq('target_type', targetType)
  if (targetId) query = query.eq('target_id', targetId)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching time entries:', error)
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
  }

  return NextResponse.json({ entries: data || [] })
}

/**
 * POST /api/admin/time-entries
 * Start a timer or create a manual entry.
 * Body: { client_project_id, target_type, target_id, description?, duration_seconds? }
 * If duration_seconds is provided, creates a completed manual entry.
 * Otherwise, starts a running timer.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { client_project_id, target_type, target_id, description, duration_seconds } = body

  if (!client_project_id || !target_type || !target_id) {
    return NextResponse.json(
      { error: 'client_project_id, target_type, and target_id are required' },
      { status: 400 }
    )
  }

  if (!['milestone', 'task'].includes(target_type)) {
    return NextResponse.json({ error: 'target_type must be milestone or task' }, { status: 400 })
  }

  const isManual = typeof duration_seconds === 'number'

  if (!isManual) {
    // Stop any currently running timer for this user on this project first
    const { data: running } = await supabaseAdmin
      .from('time_entries')
      .select('id, started_at')
      .eq('client_project_id', client_project_id)
      .eq('created_by', auth.user.id)
      .eq('is_running', true)

    if (running && running.length > 0) {
      const now = new Date()
      for (const entry of running) {
        const elapsed = Math.round((now.getTime() - new Date(entry.started_at).getTime()) / 1000)
        await supabaseAdmin
          .from('time_entries')
          .update({
            is_running: false,
            stopped_at: now.toISOString(),
            duration_seconds: elapsed,
            updated_at: now.toISOString(),
          })
          .eq('id', entry.id)
      }
    }
  }

  const now = new Date().toISOString()
  const insertData: Record<string, unknown> = {
    client_project_id,
    target_type,
    target_id,
    description: description || null,
    created_by: auth.user.id,
  }

  if (isManual) {
    insertData.duration_seconds = duration_seconds
    insertData.is_running = false
    insertData.started_at = now
    insertData.stopped_at = now
  } else {
    insertData.is_running = true
    insertData.started_at = now
  }

  const { data, error } = await supabaseAdmin
    .from('time_entries')
    .insert(insertData)
    .select('*')
    .single()

  if (error) {
    console.error('Error creating time entry:', error)
    return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 })
  }

  return NextResponse.json({ entry: data }, { status: 201 })
}
