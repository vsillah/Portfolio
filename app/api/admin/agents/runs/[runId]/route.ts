import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { AGENT_RUN_STATUSES, type AgentRunStatus } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

type CostRow = { amount: number | string | null }

function isStatus(value: string): value is AgentRunStatus {
  return AGENT_RUN_STATUSES.includes(value as AgentRunStatus)
}

async function authorizeAdminOrN8n(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.N8N_INGEST_SECRET && token === process.env.N8N_INGEST_SECRET) {
    return null
  }

  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  return null
}

/**
 * GET /api/admin/agents/runs/:runId
 * Returns one run with timeline detail, artifacts, approvals, handoffs, and costs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { data: run, error } = await supabaseAdmin
    .from('agent_runs')
    .select('*')
    .eq('id', params.runId)
    .single()

  if (error || !run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  const [steps, events, artifacts, handoffs, approvals, costs] = await Promise.all([
    supabaseAdmin
      .from('agent_run_steps')
      .select('*')
      .eq('run_id', params.runId)
      .order('started_at', { ascending: true }),
    supabaseAdmin
      .from('agent_run_events')
      .select('*')
      .eq('run_id', params.runId)
      .order('occurred_at', { ascending: true }),
    supabaseAdmin
      .from('agent_run_artifacts')
      .select('*')
      .eq('run_id', params.runId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('agent_handoffs')
      .select('*')
      .eq('run_id', params.runId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('agent_approvals')
      .select('*')
      .eq('run_id', params.runId)
      .order('requested_at', { ascending: true }),
    supabaseAdmin
      .from('cost_events')
      .select('*')
      .eq('agent_run_id', params.runId)
      .order('occurred_at', { ascending: false }),
  ])

  const costTotal = ((costs.data || []) as CostRow[]).reduce(
    (sum: number, row: CostRow) => sum + Number(row.amount ?? 0),
    0,
  )

  return NextResponse.json({
    run,
    steps: steps.data || [],
    events: events.data || [],
    artifacts: artifacts.data || [],
    handoffs: handoffs.data || [],
    approvals: approvals.data || [],
    costs: costs.data || [],
    cost_total: Number(costTotal.toFixed(4)),
  })
}

/**
 * PATCH /api/admin/agents/runs/:runId
 * Updates run state for admin controls like cancel, stale, or mark failed.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const authError = await authorizeAdminOrN8n(request)
  if (authError) return authError
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: string
    error_message?: string | null
    current_step?: string | null
    outcome?: Record<string, unknown>
  }

  if (!body.status || !isStatus(body.status)) {
    return NextResponse.json({ error: 'Valid status is required' }, { status: 400 })
  }

  const terminal = ['completed', 'failed', 'cancelled', 'stale'].includes(body.status)
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .update({
      status: body.status,
      error_message: body.error_message ?? null,
      current_step: body.current_step ?? body.status,
      outcome: body.outcome ?? {},
      completed_at: terminal ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.runId)
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update run' }, { status: 500 })
  }

  await supabaseAdmin.from('agent_run_events').insert({
    run_id: params.runId,
    event_type: 'run_status_updated',
    severity: body.status === 'failed' ? 'error' : 'info',
    message: body.error_message ?? body.status,
    metadata: { status: body.status },
  })

  return NextResponse.json({ ok: true, run_id: params.runId })
}
