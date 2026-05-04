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
  outcome: Record<string, unknown> | null
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

export type AgentInboxItem = {
  id: string
  priority: 'high' | 'medium' | 'low'
  agent_key: string
  agent_name: string
  pod: string
  title: string
  reason: string
  action_label: string
  href: string
  source_run_id: string | null
}

export type DailyOperatingBrief = {
  headline: string
  synthesis: string
  generated_from: 'standup' | 'current_state'
  run_id: string | null
  updated_at: string
  signals: string[]
  next_actions: string[]
}

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

function findAgent(agentKey: string | null | undefined) {
  return AGENT_ORGANIZATION.find((agent) => agent.key === agentKey) ?? AGENT_ORGANIZATION.find((agent) => agent.key === 'chief-of-staff')
}

function inboxItemForRun(run: AgentRunRow, costByRun: Map<string, number>): AgentInboxItem {
  const agent = findAgent(run.agent_key ?? (typeof run.metadata?.requested_agent === 'string' ? run.metadata.requested_agent : null))
  const cost = costByRun.get(run.id) ?? 0
  const priority: AgentInboxItem['priority'] =
    run.status === 'failed' || run.status === 'waiting_for_approval'
      ? 'high'
      : run.status === 'stale' || cost >= 0.25
        ? 'medium'
        : 'low'

  const title =
    run.status === 'waiting_for_approval'
      ? `Approval needed: ${run.title}`
      : run.status === 'failed'
        ? `Failure needs triage: ${run.title}`
        : run.status === 'stale'
          ? `Stale run needs owner: ${run.title}`
          : cost >= 0.25
            ? `Cost review: ${run.title}`
            : run.title

  return {
    id: `${run.id}:${run.status}`,
    priority,
    agent_key: agent?.key ?? 'chief-of-staff',
    agent_name: agent?.name ?? 'Chief of Staff Agent',
    pod: agent ? agentPodName(agent.podKey) : 'Chief of Staff',
    title,
    reason: run.error_message ?? run.current_step ?? `${run.runtime} run is ${run.status.replace(/_/g, ' ')}.`,
    action_label: run.status === 'waiting_for_approval'
      ? 'Review approval'
      : run.status === 'failed' || run.status === 'stale'
        ? 'Open trace'
        : 'Review signal',
    href: `/admin/agents/runs/${run.id}`,
    source_run_id: run.id,
  }
}

function inboxItemForApproval(approval: ApprovalRow, runsById: Map<string, AgentRunRow>): AgentInboxItem {
  const run = runsById.get(approval.run_id)
  const agent = findAgent(run?.agent_key)
  return {
    id: `${approval.id}:approval`,
    priority: 'high',
    agent_key: agent?.key ?? 'chief-of-staff',
    agent_name: agent?.name ?? 'Chief of Staff Agent',
    pod: agent ? agentPodName(agent.podKey) : 'Chief of Staff',
    title: `Approval checkpoint: ${run?.title ?? approval.approval_type}`,
    reason: `${approval.approval_type.replace(/_/g, ' ')} is pending.`,
    action_label: 'Review approval',
    href: `/admin/agents/runs/${approval.run_id}`,
    source_run_id: approval.run_id,
  }
}

export function buildAgentInbox(input: {
  runs: AgentRunRow[]
  approvals: ApprovalRow[]
  costByRun: Map<string, number>
  latestStandup: AgentRunRow | undefined
}): AgentInboxItem[] {
  const runsById = new Map(input.runs.map((run) => [run.id, run]))
  const pendingApprovalRunIds = new Set(input.approvals.map((approval) => approval.run_id))
  const failedRuns = input.runs.filter((run) => run.status === 'failed' || run.status === 'stale')
  const approvalItems = input.approvals.map((approval) => inboxItemForApproval(approval, runsById))
  const runItems = input.runs
    .filter((run) =>
      (run.status === 'waiting_for_approval' && !pendingApprovalRunIds.has(run.id)) ||
      run.status === 'failed' ||
      run.status === 'stale' ||
      (input.costByRun.get(run.id) ?? 0) >= 0.25,
    )
    .map((run) => inboxItemForRun(run, input.costByRun))

  const staleStandup =
    !input.latestStandup ||
    Date.now() - new Date(input.latestStandup.started_at).getTime() > 20 * 60 * 60 * 1000

  const standupItem: AgentInboxItem | null = staleStandup
    ? {
        id: 'chief-of-staff:standup',
        priority: failedRuns.length || input.approvals.length ? 'medium' : 'low',
        agent_key: 'chief-of-staff',
        agent_name: 'Chief of Staff Agent',
        pod: 'Chief of Staff',
        title: input.latestStandup ? 'Standup is stale' : 'No War Room standup yet',
        reason: 'Run a standup to turn current signals into an operating brief.',
        action_label: 'Run standup',
        href: '/admin/agents',
        source_run_id: input.latestStandup?.id ?? null,
      }
    : null

  const priorityRank = { high: 0, medium: 1, low: 2 }
  return [...approvalItems, ...runItems, ...(standupItem ? [standupItem] : [])]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index)
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 8)
}

export function buildDailyOperatingBrief(input: {
  approvals: ApprovalRow[]
  costToday: number
  latestStandup: AgentRunRow | undefined
  inbox: AgentInboxItem[]
  activeRunsCount: number
  failedRunsCount: number
}): DailyOperatingBrief {
  const standupSynthesis =
    typeof input.latestStandup?.outcome?.synthesis === 'string'
      ? input.latestStandup.outcome.synthesis
      : null
  const highPriorityCount = input.inbox.filter((item) => item.priority === 'high').length
  const signals = [
    `${input.activeRunsCount} active run(s)`,
    `${input.failedRunsCount} failed or stale run(s)`,
    `${input.approvals.length} pending approval(s)`,
    `$${input.costToday.toFixed(4)} cost today`,
  ]

  if (standupSynthesis && input.latestStandup) {
    return {
      headline: highPriorityCount ? `${highPriorityCount} high-priority item(s) need attention` : 'Agent system is in reviewable shape',
      synthesis: standupSynthesis,
      generated_from: 'standup',
      run_id: input.latestStandup.id,
      updated_at: input.latestStandup.completed_at ?? input.latestStandup.started_at,
      signals,
      next_actions: input.inbox.length
        ? input.inbox.slice(0, 3).map((item) => `${item.agent_name}: ${item.title}`)
        : ['Use Chief of Staff Command for the next assignment.'],
    }
  }

  return {
    headline: highPriorityCount ? `${highPriorityCount} high-priority item(s) need attention` : 'Run a standup to create today’s operating brief',
    synthesis: input.inbox.length
      ? 'Mission Control has enough trace data to identify the next queue. Run a standup when you want a synthesized daily operating brief.'
      : 'No urgent agent signals are visible. Run a standup to establish the next operating brief.',
    generated_from: 'current_state',
    run_id: null,
    updated_at: new Date().toISOString(),
    signals,
    next_actions: input.inbox.length
      ? input.inbox.slice(0, 3).map((item) => `${item.agent_name}: ${item.title}`)
      : ['Run War Room standup.', 'Use Chief of Staff Command for the next assignment.'],
  }
}

export async function buildAgentMissionControlSnapshot() {
  const db = assertDatabase()
  const since = sinceHours(24)

  const [runsRes, costsRes, approvalsRes, eventsRes] = await Promise.all([
    db
      .from('agent_runs')
      .select('id, agent_key, runtime, kind, title, status, subject_label, current_step, error_message, started_at, completed_at, outcome, metadata')
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
  const latestStandupBrief = runs.find(
    (run) => run.kind === 'agent_war_room_standup' && typeof run.outcome?.synthesis === 'string',
  )
  const agentInbox = buildAgentInbox({ runs, approvals, costByRun, latestStandup })
  const costToday = Number(costs.reduce((sum, row) => sum + Number(row.amount ?? 0), 0).toFixed(4))
  const dailyBrief = buildDailyOperatingBrief({
    approvals,
    costToday,
    latestStandup: latestStandupBrief,
    inbox: agentInbox,
    activeRunsCount: activeRuns.length,
    failedRunsCount: failedRuns.length,
  })

  return {
    generated_at: new Date().toISOString(),
    status_strip: {
      active: activeRuns.length,
      queued: countByStatus(runs, 'queued'),
      running: countByStatus(runs, 'running'),
      waiting_for_approval: countByStatus(runs, 'waiting_for_approval'),
      failed: countByStatus(runs, 'failed'),
      stale: countByStatus(runs, 'stale'),
      cost_today: costToday,
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
    daily_brief: dailyBrief,
    agent_inbox: agentInbox,
    approvals: approvals.slice(0, 8),
  }
}
