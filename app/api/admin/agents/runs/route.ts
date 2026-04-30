import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { AGENT_RUNTIMES, AGENT_RUN_STATUSES, type AgentRuntime, type AgentRunStatus } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

const STALE_THRESHOLD_MS = 30 * 60 * 1000

type AgentRunListRow = {
  id: string
  agent_key: string | null
  runtime: string
  kind: string
  title: string
  status: string
  subject_type: string | null
  subject_id: string | null
  subject_label: string | null
  current_step: string | null
  trigger_source: string | null
  started_at: string
  completed_at: string | null
  stale_after: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
}

function isRuntime(value: string): value is AgentRuntime {
  return AGENT_RUNTIMES.includes(value as AgentRuntime)
}

function isStatus(value: string): value is AgentRunStatus {
  return AGENT_RUN_STATUSES.includes(value as AgentRunStatus)
}

/**
 * GET /api/admin/agents/runs
 * Lists recent agent runs with cost and approval summaries.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const runtime = searchParams.get('runtime')
  const status = searchParams.get('status')
  const activeOnly = searchParams.get('active') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  if (runtime && runtime !== 'all' && !isRuntime(runtime)) {
    return NextResponse.json({ error: 'Invalid runtime filter' }, { status: 400 })
  }
  if (status && status !== 'all' && !isStatus(status)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('agent_runs')
    .select(
      'id, agent_key, runtime, kind, title, status, subject_type, subject_id, subject_label, current_step, trigger_source, started_at, completed_at, stale_after, error_message, metadata',
    )
    .order('started_at', { ascending: false })
    .limit(limit)

  if (runtime && runtime !== 'all') query = query.eq('runtime', runtime)
  if (status && status !== 'all') query = query.eq('status', status)
  if (activeOnly) query = query.in('status', ['queued', 'running', 'waiting_for_approval'])

  const { data: runs, error } = await query
  if (error) {
    console.error('[agent-runs] list failed:', error)
    return NextResponse.json({ error: 'Failed to fetch agent runs' }, { status: 500 })
  }

  const typedRuns = (runs || []) as AgentRunListRow[]
  const runIds = typedRuns.map((run) => run.id)
  const [costsRes, approvalsRes] = runIds.length
    ? await Promise.all([
        supabaseAdmin
          .from('cost_events')
          .select('agent_run_id, amount')
          .in('agent_run_id', runIds),
        supabaseAdmin
          .from('agent_approvals')
          .select('run_id, status')
          .in('run_id', runIds),
      ])
    : [{ data: [] }, { data: [] }]

  const costByRun = new Map<string, number>()
  for (const row of costsRes.data || []) {
    const runId = row.agent_run_id as string | null
    if (!runId) continue
    costByRun.set(runId, (costByRun.get(runId) ?? 0) + Number(row.amount ?? 0))
  }

  const approvalsByRun = new Map<string, { pending: number; approved: number; rejected: number }>()
  for (const row of approvalsRes.data || []) {
    const runId = row.run_id as string
    const summary = approvalsByRun.get(runId) ?? { pending: 0, approved: 0, rejected: 0 }
    if (row.status === 'pending') summary.pending += 1
    if (row.status === 'approved') summary.approved += 1
    if (row.status === 'rejected') summary.rejected += 1
    approvalsByRun.set(runId, summary)
  }

  const now = Date.now()
  const enriched = typedRuns.map((run) => {
    const staleAfter = run.stale_after ? new Date(run.stale_after as string).getTime() : null
    const stale =
      run.status === 'running' &&
      ((staleAfter != null && now > staleAfter) ||
        now - new Date(run.started_at as string).getTime() > STALE_THRESHOLD_MS)

    return {
      ...run,
      stale,
      cost_total: Number((costByRun.get(run.id) ?? 0).toFixed(4)),
      approvals: approvalsByRun.get(run.id) ?? { pending: 0, approved: 0, rejected: 0 },
    }
  })

  return NextResponse.json({ runs: enriched })
}
