import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const STALE_THRESHOLD_MS = 15 * 60 * 1000

/**
 * GET /api/admin/value-evidence/workflow-status
 * Returns recent workflow runs with optional workflow_id filtering.
 * ?workflow_id=vep001  — only runs for this workflow
 * ?active=true         — only running rows (for polling)
 * ?limit=N             — max rows (default 10)
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflow_id')
    const activeOnly = searchParams.get('active') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50)

    let query = supabaseAdmin
      .from('value_evidence_workflow_runs')
      .select('id, workflow_id, triggered_at, completed_at, status, stages, items_inserted, error_message')
      .order('triggered_at', { ascending: false })
      .limit(limit)

    if (workflowId) {
      query = query.eq('workflow_id', workflowId)
    }
    if (activeOnly) {
      query = query.eq('status', 'running')
    }

    const { data: runs, error } = await query

    if (error) {
      console.error('Error fetching VEP workflow runs:', error)
      return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
    }

    const now = Date.now()
    const enriched = (runs || []).map((run: {
      id: string; workflow_id: string; triggered_at: string; completed_at: string | null;
      status: string; stages: Record<string, string> | null;
      items_inserted: number | null; error_message: string | null;
    }) => ({
      ...run,
      stale: run.status === 'running' &&
        (now - new Date(run.triggered_at).getTime()) > STALE_THRESHOLD_MS,
    }))

    return NextResponse.json({ runs: enriched })
  } catch (err) {
    console.error('Error in GET /api/admin/value-evidence/workflow-status:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/value-evidence/workflow-status
 * Cancel / mark a running workflow run as failed.
 * Body: { run_id: string, reason?: string }
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { run_id, reason } = body as { run_id?: string; reason?: string }

    if (!run_id) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
    }

    const { data: run } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .select('id, status')
      .eq('id', run_id)
      .single()

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    if (run.status !== 'running') {
      return NextResponse.json({ error: 'Run is not in running state' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('value_evidence_workflow_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: reason || 'Manually marked as failed (stale run)',
      })
      .eq('id', run_id)

    if (error) {
      console.error('Error marking VEP run as failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, run_id })
  } catch (err) {
    console.error('Error in PATCH /api/admin/value-evidence/workflow-status:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
