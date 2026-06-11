import { AGENT_ORGANIZATION, AGENT_PODS, getAgentByKey, type AgentPodKey } from '@/lib/agent-organization'
import { supabaseAdmin } from '@/lib/supabase'

export const AGENT_ACTIVITY_RADAR_REFRESH_SECONDS = 15

export type AgentActivityState =
  | 'active'
  | 'idle'
  | 'queued'
  | 'waiting_for_approval'
  | 'blocked'
  | 'stale'
  | 'failed'

export type AgentActivitySteerAction = {
  kind: 'open_trace' | 'open_kanban' | 'open_approval' | 'ask_shaka' | 'engage_agent'
  label: string
  href?: string
  method?: 'POST'
  endpoint?: string
  payload?: Record<string, unknown>
}

export type AgentActivityRadarAgent = {
  key: string
  name: string
  pod_key: AgentPodKey
  pod_name: string
  runtime: string
  organization_status: string
  live_state: AgentActivityState
  idle_reason: string | null
  current_work_item: {
    id: string
    title: string
    status: string
    priority: string
    href: string
  } | null
  active_run: {
    id: string
    title: string
    status: string
    href: string
  } | null
  current_step: string | null
  latest_event: {
    event_type: string
    severity: string | null
    message: string | null
    occurred_at: string
    age_seconds: number
    href: string | null
  } | null
  linked_goal: {
    id: string
    title: string
    href: string
  } | null
  backlog_lane: {
    key: string
    label: string
    href: string
  } | null
  age_seconds: number | null
  trace_href: string | null
  steer_actions: AgentActivitySteerAction[]
}

export type AgentActivityRadarAttention = {
  id: string
  severity: 'info' | 'warning' | 'error'
  title: string
  detail: string
  agent_key: string | null
  agent_name: string
  state: AgentActivityState
  href: string
  age_seconds: number | null
}

export type AgentActivityRadarSnapshot = {
  generated_at: string
  refresh_interval_seconds: number
  summary: Record<AgentActivityState, number>
  agents: AgentActivityRadarAgent[]
  attention: AgentActivityRadarAttention[]
}

type JsonRecord = Record<string, unknown>

type AgentRunRow = {
  id: string
  agent_key: string | null
  runtime: string
  kind: string
  title: string
  status: string
  subject_type?: string | null
  subject_id?: string | null
  subject_label?: string | null
  current_step: string | null
  error_message: string | null
  started_at: string
  completed_at: string | null
  stale_after?: string | null
  metadata?: JsonRecord | null
}

type AgentEventRow = {
  id?: string | null
  run_id: string | null
  event_type: string
  severity: string | null
  message: string | null
  occurred_at: string
  metadata?: JsonRecord | null
}

type AgentWorkItemRow = {
  id: string
  title: string
  objective?: string | null
  status: string
  priority: string
  owner_agent_key: string | null
  owner_runtime?: string | null
  active_run_id: string | null
  blocker_summary: string | null
  validation_summary?: string | null
  approval_id: string | null
  source_type?: string | null
  source_id?: string | null
  source_label?: string | null
  metadata?: JsonRecord | null
  created_at: string
  updated_at: string
  completed_at?: string | null
}

type AgentHandoffRow = {
  id: string
  run_id: string | null
  work_item_id: string | null
  from_agent_key: string | null
  to_agent_key: string | null
  handoff_type: string | null
  summary: string | null
  status: string
  created_at: string
}

type AgentApprovalRow = {
  id: string
  run_id: string
  approval_type: string
  status: string
  requested_at: string
  requested_by_agent_key: string | null
  metadata?: JsonRecord | null
}

export type AgentActivityRadarBuildInput = {
  runs: AgentRunRow[]
  events: AgentEventRow[]
  workItems: AgentWorkItemRow[]
  handoffs?: AgentHandoffRow[]
  approvals: AgentApprovalRow[]
  now?: Date
}

const ACTIVE_WORK_ITEM_STATUSES = new Set([
  'proposed',
  'queued',
  'assigned',
  'in_progress',
  'blocked',
  'ready_for_review',
  'ready_for_merge',
])

const ACTIVE_RUN_STATUSES = new Set(['queued', 'running', 'waiting_for_approval'])
const ATTENTION_STATES = new Set<AgentActivityState>(['blocked', 'waiting_for_approval', 'stale', 'failed'])

function podName(key: AgentPodKey) {
  return AGENT_PODS.find((pod) => pod.key === key)?.name ?? key.replace(/_/g, ' ')
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function recordValue(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
}

function secondsSince(value: string | null | undefined, now: Date) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.round((now.getTime() - time) / 1000))
}

function fallbackAgentKeyForRun(run: AgentRunRow | undefined | null) {
  if (!run) return 'chief-of-staff'
  if (run.agent_key && getAgentByKey(run.agent_key)) return run.agent_key
  if (run.runtime === 'n8n') return 'automation-systems'
  if (run.kind?.includes('content')) return 'voice-content-architect'
  return 'chief-of-staff'
}

function workItemHref(item: AgentWorkItemRow) {
  return `/admin/agents/swarm-board?work_item=${encodeURIComponent(item.id)}`
}

function approvalHref(approval: AgentApprovalRow | null, item: AgentWorkItemRow | null) {
  const proposal = item?.id ?? stringValue(approval?.metadata?.work_item_id)
  return proposal
    ? `/admin/agents/coordination?proposal=${encodeURIComponent(proposal)}`
    : '/admin/agents/coordination'
}

function runHref(runId: string | null | undefined) {
  return runId ? `/admin/agents/runs/${runId}` : null
}

function laneForWorkItem(item: AgentWorkItemRow | null) {
  if (!item) return null
  const label = item.status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return {
    key: item.status,
    label,
    href: workItemHref(item),
  }
}

function goalForWorkItem(item: AgentWorkItemRow | null) {
  if (!item) return null
  const metadata = recordValue(item.metadata)
  const rawGoal = recordValue(metadata?.goal)
  const id =
    stringValue(metadata?.goal_id) ??
    stringValue(metadata?.agentic_goal_id) ??
    stringValue(rawGoal?.id) ??
    stringValue(metadata?.automation_goal_seed_id)
  const title =
    stringValue(metadata?.goal_title) ??
    stringValue(rawGoal?.title) ??
    stringValue(metadata?.automation_goal_title) ??
    stringValue(item.source_label)
  if (!id && !title) return null
  const goalId = id ?? item.id
  return {
    id: goalId,
    title: title ?? goalId,
    href: stringValue(metadata?.goal_session_href) ?? `/admin/agents/standup?goal=${encodeURIComponent(goalId)}`,
  }
}

function workItemRank(item: AgentWorkItemRow) {
  const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
  const statusRank: Record<string, number> = {
    blocked: 0,
    ready_for_merge: 1,
    ready_for_review: 2,
    in_progress: 3,
    assigned: 4,
    queued: 5,
    proposed: 6,
  }
  return (statusRank[item.status] ?? 9) * 10 + (priorityRank[item.priority] ?? 4)
}

function chooseCurrentWorkItem(items: AgentWorkItemRow[]) {
  return [...items]
    .filter((item) => ACTIVE_WORK_ITEM_STATUSES.has(item.status))
    .sort((a, b) => workItemRank(a) - workItemRank(b) || new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null
}

function chooseCurrentRun(runs: AgentRunRow[]) {
  return runs.find((run) => ACTIVE_RUN_STATUSES.has(run.status)) ?? runs[0] ?? null
}

function stateFor(input: {
  agentStatus: string
  run: AgentRunRow | null
  workItem: AgentWorkItemRow | null
  pendingApproval: AgentApprovalRow | null
}) {
  if (input.workItem?.status === 'blocked') return 'blocked' as const
  if (input.run?.status === 'waiting_for_approval' || input.pendingApproval) return 'waiting_for_approval' as const
  if (input.run?.status === 'failed') return 'failed' as const
  if (input.run?.status === 'stale') return 'stale' as const
  if (input.run?.status === 'running' || input.workItem?.status === 'in_progress' || input.workItem?.status === 'ready_for_review' || input.workItem?.status === 'ready_for_merge') {
    return 'active' as const
  }
  if (input.run?.status === 'queued' || ['proposed', 'queued', 'assigned'].includes(input.workItem?.status ?? '')) {
    return 'queued' as const
  }
  return 'idle' as const
}

function idleReasonFor(agentStatus: string, workItem: AgentWorkItemRow | null, run: AgentRunRow | null) {
  if (workItem || run) return null
  if (agentStatus === 'planned') return 'Planned agent; no active trace yet.'
  return 'No assigned active work.'
}

function buildSteerActions(input: {
  agentKey: string
  agentName: string
  state: AgentActivityState
  run: AgentRunRow | null
  workItem: AgentWorkItemRow | null
  approval: AgentApprovalRow | null
}) {
  const runUrl = runHref(input.run?.id ?? input.workItem?.active_run_id)
  const actions: AgentActivitySteerAction[] = []
  if (runUrl) actions.push({ kind: 'open_trace', label: 'Open trace', href: runUrl })
  if (input.workItem) actions.push({ kind: 'open_kanban', label: 'Open Kanban', href: workItemHref(input.workItem) })
  if (input.approval || input.state === 'waiting_for_approval') {
    actions.push({ kind: 'open_approval', label: 'Open approval', href: approvalHref(input.approval, input.workItem) })
  }
  const context = [
    `Review ${input.agentName}.`,
    `State: ${input.state}.`,
    input.workItem ? `Work item: ${input.workItem.title}.` : null,
    input.run ? `Run: ${input.run.title}.` : null,
    'Tell me whether this agent is on track, blocked, idle for a valid reason, or needs a handoff.',
  ].filter(Boolean).join(' ')
  actions.push({
    kind: 'ask_shaka',
    label: 'Ask Shaka',
    method: 'POST',
    endpoint: '/api/admin/agents/chief-of-staff/chat',
    payload: { message: context },
  })
  actions.push({
    kind: 'engage_agent',
    label: 'Queue engagement',
    method: 'POST',
    endpoint: '/api/admin/agents/engage',
    payload: {
      agent_key: input.agentKey,
      note: input.workItem
        ? `Activity Radar steering request for ${input.workItem.title}.`
        : `Activity Radar steering request for ${input.agentName}.`,
    },
  })
  return actions
}

function latestEventForAgent(input: {
  agentKey: string
  events: AgentEventRow[]
  runsById: Map<string, AgentRunRow>
  now: Date
}) {
  const event = input.events.find((candidate) => {
    const run = candidate.run_id ? input.runsById.get(candidate.run_id) : null
    return fallbackAgentKeyForRun(run) === input.agentKey
  })
  if (!event) return null
  return {
    event_type: event.event_type,
    severity: event.severity,
    message: event.message,
    occurred_at: event.occurred_at,
    age_seconds: secondsSince(event.occurred_at, input.now) ?? 0,
    href: runHref(event.run_id),
  }
}

function attentionSeverity(state: AgentActivityState): AgentActivityRadarAttention['severity'] {
  if (state === 'failed' || state === 'stale') return 'error'
  if (state === 'blocked' || state === 'waiting_for_approval') return 'warning'
  return 'info'
}

export function buildAgentActivityRadarSnapshotFromRows(input: AgentActivityRadarBuildInput): AgentActivityRadarSnapshot {
  const now = input.now ?? new Date()
  const runs = [...input.runs].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
  const events = [...input.events].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
  const workItems = [...input.workItems].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  const pendingApprovals = input.approvals.filter((approval) => approval.status === 'pending')
  const runsById = new Map(runs.map((run) => [run.id, run]))
  const approvalsByRun = new Map(pendingApprovals.map((approval) => [approval.run_id, approval]))

  const runsByAgent = new Map<string, AgentRunRow[]>()
  for (const run of runs) {
    const key = fallbackAgentKeyForRun(run)
    runsByAgent.set(key, [...(runsByAgent.get(key) ?? []), run])
  }

  const workItemsByAgent = new Map<string, AgentWorkItemRow[]>()
  for (const item of workItems) {
    if (!item.owner_agent_key) continue
    workItemsByAgent.set(item.owner_agent_key, [...(workItemsByAgent.get(item.owner_agent_key) ?? []), item])
  }

  const agents = AGENT_ORGANIZATION.map((agent): AgentActivityRadarAgent => {
    const agentRuns = runsByAgent.get(agent.key) ?? []
    const agentWorkItems = workItemsByAgent.get(agent.key) ?? []
    const currentWorkItem = chooseCurrentWorkItem(agentWorkItems)
    const currentRun = currentWorkItem?.active_run_id
      ? runsById.get(currentWorkItem.active_run_id) ?? chooseCurrentRun(agentRuns)
      : chooseCurrentRun(agentRuns)
    const pendingApproval = currentWorkItem?.approval_id
      ? pendingApprovals.find((approval) => approval.id === currentWorkItem.approval_id) ?? null
      : currentRun?.id
        ? approvalsByRun.get(currentRun.id) ?? null
        : null
    const liveState = stateFor({
      agentStatus: agent.status,
      run: currentRun,
      workItem: currentWorkItem,
      pendingApproval,
    })
    const latestEvent = latestEventForAgent({ agentKey: agent.key, events, runsById, now })
    const ageSource = latestEvent?.occurred_at ?? currentWorkItem?.updated_at ?? currentRun?.started_at ?? null
    const currentStep =
      (currentWorkItem?.status === 'blocked' ? currentWorkItem.blocker_summary : null) ??
      currentRun?.current_step ??
      currentRun?.error_message ??
      currentWorkItem?.blocker_summary ??
      currentWorkItem?.validation_summary ??
      currentWorkItem?.title ??
      null
    return {
      key: agent.key,
      name: agent.name,
      pod_key: agent.podKey,
      pod_name: podName(agent.podKey),
      runtime: agent.primaryRuntime,
      organization_status: agent.status,
      live_state: liveState,
      idle_reason: liveState === 'idle' ? idleReasonFor(agent.status, currentWorkItem, currentRun) : null,
      current_work_item: currentWorkItem ? {
        id: currentWorkItem.id,
        title: currentWorkItem.title,
        status: currentWorkItem.status,
        priority: currentWorkItem.priority,
        href: workItemHref(currentWorkItem),
      } : null,
      active_run: currentRun ? {
        id: currentRun.id,
        title: currentRun.title,
        status: currentRun.status,
        href: `/admin/agents/runs/${currentRun.id}`,
      } : null,
      current_step: currentStep,
      latest_event: latestEvent,
      linked_goal: goalForWorkItem(currentWorkItem),
      backlog_lane: laneForWorkItem(currentWorkItem),
      age_seconds: secondsSince(ageSource, now),
      trace_href: runHref(currentRun?.id ?? currentWorkItem?.active_run_id),
      steer_actions: buildSteerActions({
        agentKey: agent.key,
        agentName: agent.name,
        state: liveState,
        run: currentRun,
        workItem: currentWorkItem,
        approval: pendingApproval,
      }),
    }
  })

  const summary = agents.reduce((acc, agent) => {
    acc[agent.live_state] += 1
    return acc
  }, {
    active: 0,
    idle: 0,
    queued: 0,
    waiting_for_approval: 0,
    blocked: 0,
    stale: 0,
    failed: 0,
  } satisfies Record<AgentActivityState, number>)

  const attention: AgentActivityRadarAttention[] = agents
    .filter((agent) => ATTENTION_STATES.has(agent.live_state))
    .map((agent) => ({
      id: `${agent.key}:${agent.live_state}:${agent.current_work_item?.id ?? agent.active_run?.id ?? 'attention'}`,
      severity: attentionSeverity(agent.live_state),
      title: agent.current_work_item?.title ?? agent.active_run?.title ?? agent.name,
      detail: agent.current_step ?? agent.idle_reason ?? `${agent.name} needs review.`,
      agent_key: agent.key,
      agent_name: agent.name,
      state: agent.live_state,
      href: agent.current_work_item?.href ?? agent.active_run?.href ?? '/admin/agents/runs',
      age_seconds: agent.age_seconds,
    }))
    .sort((a, b) => {
      const severityRank = { error: 0, warning: 1, info: 2 }
      return severityRank[a.severity] - severityRank[b.severity] || (b.age_seconds ?? 0) - (a.age_seconds ?? 0)
    })
    .slice(0, 8)

  return {
    generated_at: now.toISOString(),
    refresh_interval_seconds: AGENT_ACTIVITY_RADAR_REFRESH_SECONDS,
    summary,
    agents,
    attention,
  }
}

export async function buildAgentActivityRadarSnapshot(): Promise<AgentActivityRadarSnapshot> {
  if (!supabaseAdmin) throw new Error('Database not available')
  const db = supabaseAdmin

  const [runsRes, eventsRes, workItemsRes, approvalsRes] = await Promise.all([
    db
      .from('agent_runs')
      .select('id, agent_key, runtime, kind, title, status, subject_type, subject_id, subject_label, current_step, error_message, started_at, completed_at, stale_after, metadata')
      .order('started_at', { ascending: false })
      .limit(200),
    db
      .from('agent_run_events')
      .select('id, run_id, event_type, severity, message, occurred_at, metadata')
      .order('occurred_at', { ascending: false })
      .limit(200),
    db
      .from('agent_work_items')
      .select('id, title, objective, status, priority, owner_agent_key, owner_runtime, active_run_id, blocker_summary, validation_summary, approval_id, source_type, source_id, source_label, metadata, created_at, updated_at, completed_at')
      .order('updated_at', { ascending: false })
      .limit(150),
    db
      .from('agent_approvals')
      .select('id, run_id, approval_type, status, requested_at, requested_by_agent_key, metadata')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(100),
  ])

  for (const result of [runsRes, eventsRes, workItemsRes, approvalsRes]) {
    if (result.error) throw new Error(result.error.message)
  }

  return buildAgentActivityRadarSnapshotFromRows({
    runs: (runsRes.data ?? []) as AgentRunRow[],
    events: (eventsRes.data ?? []) as AgentEventRow[],
    workItems: (workItemsRes.data ?? []) as AgentWorkItemRow[],
    approvals: (approvalsRes.data ?? []) as AgentApprovalRow[],
  })
}
