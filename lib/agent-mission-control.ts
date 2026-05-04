import { AGENT_ORGANIZATION, AGENT_PODS } from '@/lib/agent-organization'
import { supabaseAdmin } from '@/lib/supabase'

type AgentRunRow = {
  id: string
  agent_key: string | null
  runtime: string
  kind: string
  title: string
  status: string
  subject_label: string | null
  current_step: string | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  metadata: Record<string, unknown> | null
}

type CostEventRow = {
  agent_run_id: string | null
  amount: number | string | null
  occurred_at: string
}

type ApprovalRow = {
  id: string
  run_id: string
  approval_type: string
  status: string
  requested_at: string
}

type EventRow = {
  run_id: string
  event_type: string
  severity: string
  message: string | null
  occurred_at: string
}

export type AgentMissionControlSnapshot = Awaited<ReturnType<typeof buildAgentMissionControlSnapshot>>

function sinceHours(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function assertDatabase() {
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }
  return supabaseAdmin
}

function countByStatus(runs: AgentRunRow[], status: string) {
  return runs.filter((run) => run.status === status).length
}

function agentPodName(podKey: string) {
  return AGENT_PODS.find((pod) => pod.key === podKey)?.name ?? podKey
}

function summarizeRun(run: AgentRunRow, costByRun: Map<string, number>) {
  return {
    id: run.id,
    agent_key: run.agent_key,
    runtime: run.runtime,
    kind: run.kind,
    title: run.title,
    status: run.status,
    subject_label: run.subject_label,
    current_step: run.current_step,
    error_message: run.error_message,
    started_at: run.started_at,
    completed_at: run.completed_at,
    cost_total: Number((costByRun.get(run.id) ?? 0).toFixed(4)),
  }
}

export async function buildAgentMissionControlSnapshot() {
  const db = assertDatabase()
  const since = sinceHours(24)

  const [runsRes, costsRes, approvalsRes, eventsRes] = await Promise.all([
    db
      .from('agent_runs')
      .select('id, agent_key, runtime, kind, title, status, subject_label, current_step, error_message, started_at, completed_at, metadata')
      .order('started_at', { ascending: false })
      .limit(50),
    db
      .from('cost_events')
      .select('agent_run_id, amount, occurred_at')
      .gte('occurred_at', since)
      .limit(500),
    db
      .from('agent_approvals')
      .select('id, run_id, approval_type, status, requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(20),
    db
      .from('agent_run_events')
      .select('run_id, event_type, severity, message, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(12),
  ])

  for (const result of [runsRes, costsRes, approvalsRes, eventsRes]) {
    if (result.error) {
      throw new Error(result.error.message)
    }
  }

  const runs = (runsRes.data ?? []) as AgentRunRow[]
  const costs = (costsRes.data ?? []) as CostEventRow[]
  const approvals = (approvalsRes.data ?? []) as ApprovalRow[]
  const events = (eventsRes.data ?? []) as EventRow[]
  const costByRun = new Map<string, number>()

  for (const row of costs) {
    if (!row.agent_run_id) continue
    costByRun.set(row.agent_run_id, (costByRun.get(row.agent_run_id) ?? 0) + Number(row.amount ?? 0))
  }

  const activeStatuses = new Set(['queued', 'running', 'waiting_for_approval'])
  const activeRuns = runs.filter((run) => activeStatuses.has(run.status))
  const failedRuns = runs.filter((run) => run.status === 'failed' || run.status === 'stale')
  const expensiveRuns = runs
    .filter((run) => (costByRun.get(run.id) ?? 0) >= 0.25)
    .slice(0, 5)

  const attentionQueue = [
    ...activeRuns.filter((run) => run.status === 'waiting_for_approval'),
    ...failedRuns,
    ...expensiveRuns,
  ]
    .filter((run, index, list) => list.findIndex((item) => item.id === run.id) === index)
    .slice(0, 10)
    .map((run) => summarizeRun(run, costByRun))

  const latestStandup = runs.find((run) => run.kind === 'agent_war_room_standup')

  return {
    generated_at: new Date().toISOString(),
    status_strip: {
      active: activeRuns.length,
      queued: countByStatus(runs, 'queued'),
      running: countByStatus(runs, 'running'),
      waiting_for_approval: countByStatus(runs, 'waiting_for_approval'),
      failed: countByStatus(runs, 'failed'),
      stale: countByStatus(runs, 'stale'),
      cost_today: Number(costs.reduce((sum, row) => sum + Number(row.amount ?? 0), 0).toFixed(4)),
      pending_approvals: approvals.length,
    },
    roster: AGENT_PODS.map((pod) => {
      const agents = AGENT_ORGANIZATION.filter((agent) => agent.podKey === pod.key)
      return {
        key: pod.key,
        name: pod.name,
        purpose: pod.purpose,
        agents: agents.map((agent) => {
          const latestRun = runs.find(
            (run) =>
              run.agent_key === agent.key ||
              run.metadata?.requested_agent === agent.key,
          )
          return {
            key: agent.key,
            name: agent.name,
            pod: agentPodName(agent.podKey),
            status: agent.status,
            runtime: agent.primaryRuntime,
            responsibility: agent.responsibility,
            active_workflow_count: agent.n8nWorkflows.filter((workflow) => workflow.active).length,
            latest_run: latestRun ? summarizeRun(latestRun, costByRun) : null,
          }
        }),
      }
    }),
    attention_queue: attentionQueue,
    active_runs: activeRuns.slice(0, 8).map((run) => summarizeRun(run, costByRun)),
    latest_events: events,
    latest_standup: latestStandup ? summarizeRun(latestStandup, costByRun) : null,
    approvals: approvals.slice(0, 8),
  }
}
