import { AGENT_ORGANIZATION, AGENT_PODS } from '@/lib/agent-organization'
import { KNOWLEDGE_GOVERNANCE_STATUS } from '@/lib/knowledge-source-manifest'
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
  source: string | null
  reference_type: string | null
  amount: number | string | null
  occurred_at: string
  metadata: Record<string, unknown> | null
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

export type AgentEngagementQueueItem = {
  run_id: string
  agent_key: string
  agent_name: string
  owner_label: string
  pod: string
  runtime: string
  status: string
  current_step: string | null
  execution_mode: string
  requested_from: string | null
  source_label: string
  source_inbox_item_id: string | null
  source_run_id: string | null
  note: string | null
  next_action: string | null
  started_at: string
  completed_at: string | null
}

export type AgentDeadLetterItem = {
  run_id: string
  agent_key: string
  agent_name: string
  pod: string
  runtime: string
  status: string
  title: string
  reason: string
  age_hours: number
  source_label: string
  routed: boolean
  routed_run_id: string | null
  routed_kind: string | null
  routed_status: string | null
  recovery_retry_attempt: number | null
  recovery_earliest_retry_at: string | null
  recovery_backoff_active: boolean
  next_action: string
  href: string
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

export type AgentCostGroup = {
  key: string
  label: string
  amount: number
  event_count: number
  run_count: number
}

export type AgentCostSummary = {
  window_hours: number
  total: number
  event_count: number
  linked_event_count: number
  unlinked_event_count: number
  by_runtime: AgentCostGroup[]
  by_agent: AgentCostGroup[]
  by_workflow: AgentCostGroup[]
  by_client_project: AgentCostGroup[]
  by_artifact_type: AgentCostGroup[]
}

export type AgentOperatingSignal = {
  run_id: string
  kind: 'morning_review' | 'deployment_watch'
  title: string
  status: string
  signal: string
  summary: string
  updated_at: string
  href: string
  details: string[]
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

function requestedAgentKey(run: AgentRunRow) {
  const requested = run.metadata?.requested_agent
  return typeof requested === 'string' && requested.trim() ? requested.trim() : run.agent_key
}

function stringMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function executionModeForRun(run: AgentRunRow) {
  const explicitMode = stringMetadataValue(run.metadata, 'execution_mode')
  if (explicitMode) return explicitMode

  const executesAction = run.metadata?.executes_action ?? run.outcome?.executes_action
  if (typeof executesAction === 'boolean') return executesAction ? 'action' : 'read_only'

  return 'read_only'
}

function readableLabel(value: string | null | undefined) {
  if (!value) return null
  return value
    .replace(/^agent_/, 'agent ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stableMetadataValue(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function labelFromKey(value: string | null | undefined, fallback: string) {
  return readableLabel(value) ?? fallback
}

function costAmount(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount : 0
}

function summarizeCostGroups(groups: Map<string, AgentCostGroup & { runIds: Set<string> }>) {
  return Array.from(groups.values())
    .map(({ runIds, ...group }) => ({
      ...group,
      amount: Number(group.amount.toFixed(4)),
      run_count: runIds.size,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
    .slice(0, 5)
}

function addCostGroup(
  groups: Map<string, AgentCostGroup & { runIds: Set<string> }>,
  key: string,
  label: string,
  amount: number,
  runId: string | null,
) {
  const existing = groups.get(key) ?? {
    key,
    label,
    amount: 0,
    event_count: 0,
    run_count: 0,
    runIds: new Set<string>(),
  }

  existing.amount += amount
  existing.event_count += 1
  if (runId) existing.runIds.add(runId)
  groups.set(key, existing)
}

function workflowKeyForCost(run: AgentRunRow | undefined, cost: CostEventRow) {
  const workflow =
    stableMetadataValue(run?.metadata, ['workflow_id', 'workflow', 'n8n_workflow_id', 'source_workflow']) ??
    stableMetadataValue(cost.metadata, ['workflow_id', 'workflow', 'n8n_workflow_id', 'source_workflow']) ??
    run?.kind ??
    cost.reference_type ??
    cost.source

  return {
    key: workflow ?? 'unspecified_workflow',
    label: labelFromKey(workflow, 'Unspecified workflow'),
  }
}

function clientProjectKeyForCost(run: AgentRunRow | undefined, cost: CostEventRow) {
  const clientProject =
    stableMetadataValue(run?.metadata, [
      'client_project_name',
      'project_name',
      'client_name',
      'client_project_id',
      'project_id',
      'client_id',
    ]) ??
    stableMetadataValue(cost.metadata, [
      'client_project_name',
      'project_name',
      'client_name',
      'client_project_id',
      'project_id',
      'client_id',
    ]) ??
    run?.subject_label

  return {
    key: clientProject ?? 'unassigned_client_project',
    label: labelFromKey(clientProject, 'Unassigned client/project'),
  }
}

function artifactTypeKeyForCost(run: AgentRunRow | undefined, cost: CostEventRow) {
  const artifactType =
    stableMetadataValue(cost.metadata, ['artifact_type', 'artifactType', 'output_type', 'content_type']) ??
    stableMetadataValue(run?.metadata, ['artifact_type', 'artifactType', 'output_type', 'content_type']) ??
    cost.reference_type ??
    run?.kind ??
    cost.source

  return {
    key: artifactType ?? 'unspecified_artifact',
    label: labelFromKey(artifactType, 'Unspecified artifact'),
  }
}

export function buildAgentCostSummary(input: {
  costs: CostEventRow[]
  runsById: Map<string, AgentRunRow>
  windowHours?: number
}): AgentCostSummary {
  const runtimeGroups = new Map<string, AgentCostGroup & { runIds: Set<string> }>()
  const agentGroups = new Map<string, AgentCostGroup & { runIds: Set<string> }>()
  const workflowGroups = new Map<string, AgentCostGroup & { runIds: Set<string> }>()
  const clientProjectGroups = new Map<string, AgentCostGroup & { runIds: Set<string> }>()
  const artifactTypeGroups = new Map<string, AgentCostGroup & { runIds: Set<string> }>()

  let total = 0
  let linkedEventCount = 0

  for (const cost of input.costs) {
    const amount = costAmount(cost.amount)
    total += amount

    const run = cost.agent_run_id ? input.runsById.get(cost.agent_run_id) : undefined
    if (cost.agent_run_id) linkedEventCount += 1

    const agentKey = run ? requestedAgentKey(run) : null
    const agent = agentKey ? findAgent(agentKey) : null
    const workflow = workflowKeyForCost(run, cost)
    const clientProject = clientProjectKeyForCost(run, cost)
    const artifactType = artifactTypeKeyForCost(run, cost)
    const runId = cost.agent_run_id ?? null

    addCostGroup(runtimeGroups, run?.runtime ?? 'unlinked', labelFromKey(run?.runtime, 'Unlinked'), amount, runId)
    addCostGroup(agentGroups, agent?.key ?? 'unassigned_agent', agent?.name ?? 'Unassigned agent', amount, runId)
    addCostGroup(workflowGroups, workflow.key, workflow.label, amount, runId)
    addCostGroup(clientProjectGroups, clientProject.key, clientProject.label, amount, runId)
    addCostGroup(artifactTypeGroups, artifactType.key, artifactType.label, amount, runId)
  }

  return {
    window_hours: input.windowHours ?? 24,
    total: Number(total.toFixed(4)),
    event_count: input.costs.length,
    linked_event_count: linkedEventCount,
    unlinked_event_count: input.costs.length - linkedEventCount,
    by_runtime: summarizeCostGroups(runtimeGroups),
    by_agent: summarizeCostGroups(agentGroups),
    by_workflow: summarizeCostGroups(workflowGroups),
    by_client_project: summarizeCostGroups(clientProjectGroups),
    by_artifact_type: summarizeCostGroups(artifactTypeGroups),
  }
}

export function buildAgentOperatingSignals(runs: AgentRunRow[]): AgentOperatingSignal[] {
  const latestMorningReview = runs.find((run) => run.kind === 'agent_ops_morning_review')
  const latestDeploymentWatch = runs.find((run) => run.kind === 'agent_ops_deployment_watch')
  const signals: AgentOperatingSignal[] = []

  if (latestMorningReview) {
    const overall =
      typeof latestMorningReview.outcome?.overall === 'string'
        ? latestMorningReview.outcome.overall
        : latestMorningReview.status
    const warningCount =
      typeof latestMorningReview.outcome?.warning_count === 'number'
        ? latestMorningReview.outcome.warning_count
        : null
    const staleMarked =
      typeof latestMorningReview.outcome?.stale_marked === 'number'
        ? latestMorningReview.outcome.stale_marked
        : null
    const slackNotified =
      typeof latestMorningReview.outcome?.slack_notified === 'boolean'
        ? latestMorningReview.outcome.slack_notified
        : null

    signals.push({
      run_id: latestMorningReview.id,
      kind: 'morning_review',
      title: 'Morning Review',
      status: latestMorningReview.status,
      signal: `Overall: ${overall}`,
      summary: latestMorningReview.error_message ?? latestMorningReview.current_step ?? latestMorningReview.title,
      updated_at: latestMorningReview.completed_at ?? latestMorningReview.started_at,
      href: `/admin/agents/runs/${latestMorningReview.id}`,
      details: [
        warningCount === null ? null : `${warningCount} warning(s)`,
        staleMarked === null ? null : `${staleMarked} stale run(s) marked`,
        slackNotified === null ? null : slackNotified ? 'Slack notified' : 'Slack skipped',
      ].filter((detail): detail is string => Boolean(detail)),
    })
  }

  if (latestDeploymentWatch) {
    const deploymentState =
      typeof latestDeploymentWatch.outcome?.deployment_state === 'string'
        ? latestDeploymentWatch.outcome.deployment_state
        : latestDeploymentWatch.status
    const ref =
      typeof latestDeploymentWatch.outcome?.ref === 'string'
        ? latestDeploymentWatch.outcome.ref
        : stringMetadataValue(latestDeploymentWatch.metadata, 'ref')
    const guidance = Array.isArray(latestDeploymentWatch.outcome?.guidance)
      ? latestDeploymentWatch.outcome.guidance.filter((item): item is string => typeof item === 'string')
      : []
    const contexts = Array.isArray(latestDeploymentWatch.outcome?.contexts)
      ? latestDeploymentWatch.outcome.contexts
          .map((item) => {
            if (!item || typeof item !== 'object') return null
            const context = 'context' in item && typeof item.context === 'string' ? item.context : null
            const state = 'state' in item && typeof item.state === 'string' ? item.state : null
            return context && state ? `${context}: ${state}` : null
          })
          .filter((detail): detail is string => Boolean(detail))
      : []

    signals.push({
      run_id: latestDeploymentWatch.id,
      kind: 'deployment_watch',
      title: 'Deployment Watcher',
      status: latestDeploymentWatch.status,
      signal: `Deployments: ${deploymentState}`,
      summary: ref ? `Latest watcher snapshot for ${ref}.` : latestDeploymentWatch.current_step ?? latestDeploymentWatch.title,
      updated_at: latestDeploymentWatch.completed_at ?? latestDeploymentWatch.started_at,
      href: `/admin/agents/runs/${latestDeploymentWatch.id}`,
      details: [...contexts.slice(0, 2), ...guidance.slice(0, 1)],
    })
  }

  return signals
}

function sourceLabelForRun(run: AgentRunRow) {
  const requestedFrom = stringMetadataValue(run.metadata, 'route_action') ?? run.subject_label
  if (stringMetadataValue(run.metadata, 'agent_inbox_item_id')) return 'Agent Inbox'
  if (requestedFrom?.toLowerCase().includes('slack')) return 'Slack'
  if (requestedFrom?.toLowerCase().includes('chief')) return 'Chief of Staff'
  if (requestedFrom?.toLowerCase().includes('admin')) return 'Admin'
  return readableLabel(requestedFrom) ?? 'Manual'
}

function inboxItemForRun(run: AgentRunRow, costByRun: Map<string, number>): AgentInboxItem {
  const agent = findAgent(requestedAgentKey(run))
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
    agent_name: agent?.name ?? 'Shaka (Zulu) - Chief of Staff',
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
    agent_name: agent?.name ?? 'Shaka (Zulu) - Chief of Staff',
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
        agent_name: 'Shaka (Zulu) - Chief of Staff',
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

export function buildAgentEngagementQueue(runs: AgentRunRow[]): AgentEngagementQueueItem[] {
  return runs
    .filter((run) => run.kind === 'agent_engagement_request' || run.kind === 'agent_recovery_request')
    .map((run) => {
      const agent = findAgent(requestedAgentKey(run))
      const agentName = agent?.name ?? 'Shaka (Zulu) - Chief of Staff'
      return {
        run_id: run.id,
        agent_key: agent?.key ?? 'chief-of-staff',
        agent_name: agentName,
        owner_label: agentName,
        pod: agent ? agentPodName(agent.podKey) : 'Chief of Staff',
        runtime: run.runtime,
        status: run.status,
        current_step: run.current_step,
        execution_mode: executionModeForRun(run),
        requested_from: stringMetadataValue(run.metadata, 'route_action') ?? run.subject_label,
        source_label: sourceLabelForRun(run),
        source_inbox_item_id: stringMetadataValue(run.metadata, 'agent_inbox_item_id'),
        source_run_id: stringMetadataValue(run.metadata, 'source_run_id'),
        note: stringMetadataValue(run.metadata, 'note'),
        next_action: stringMetadataValue(run.metadata, 'suggested_next_action'),
        started_at: run.started_at,
        completed_at: run.completed_at,
      }
    })
    .slice(0, 8)
}

export function buildAgentDeadLetterQueue(
  runs: AgentRunRow[],
): AgentDeadLetterItem[] {
  const routedBySourceRun = new Map<string, AgentRunRow>()
  for (const run of runs) {
    if (run.kind !== 'agent_engagement_request' && run.kind !== 'agent_recovery_request') continue
    const sourceRunId = stringMetadataValue(run.metadata, 'source_run_id')
    if (!sourceRunId || routedBySourceRun.has(sourceRunId)) continue
    routedBySourceRun.set(sourceRunId, run)
  }

  return runs
    .filter((run) => run.status === 'failed' || run.status === 'stale')
    .map((run) => {
      const agent = findAgent(requestedAgentKey(run))
      const routedRun = routedBySourceRun.get(run.id)
      const agentName = agent?.name ?? 'Shaka (Zulu) - Chief of Staff'
      const reason = run.error_message ?? run.current_step ?? `${run.runtime} run is ${run.status.replace(/_/g, ' ')}.`
      const recoveryRetryAttempt =
        routedRun?.kind === 'agent_recovery_request'
          ? numberMetadataValue(routedRun.metadata, 'retry_attempt')
          : null
      const recoveryEarliestRetryAt =
        routedRun?.kind === 'agent_recovery_request'
          ? stringMetadataValue(routedRun.metadata, 'earliest_retry_at')
          : null
      const recoveryBackoffActive =
        Boolean(recoveryEarliestRetryAt) &&
        Number.isFinite(new Date(recoveryEarliestRetryAt ?? '').getTime()) &&
        new Date(recoveryEarliestRetryAt ?? '').getTime() > Date.now()

      return {
        run_id: run.id,
        agent_key: agent?.key ?? 'chief-of-staff',
        agent_name: agentName,
        pod: agent ? agentPodName(agent.podKey) : 'Chief of Staff',
        runtime: run.runtime,
        status: run.status,
        title: run.title,
        reason,
        age_hours: Number(Math.max(0, (Date.now() - new Date(run.started_at).getTime()) / 36e5).toFixed(1)),
        source_label: sourceLabelForRun(run),
        routed: Boolean(routedRun),
        routed_run_id: routedRun?.id ?? null,
        routed_kind: routedRun?.kind ?? null,
        routed_status: routedRun?.status ?? null,
        recovery_retry_attempt: recoveryRetryAttempt,
        recovery_earliest_retry_at: recoveryEarliestRetryAt,
        recovery_backoff_active: recoveryBackoffActive,
        next_action: routedRun
          ? routedRun.kind === 'agent_recovery_request'
            ? recoveryBackoffActive
              ? 'Recovery is waiting for its backoff window.'
              : 'Review retry request.'
            : 'Review routed engagement request.'
          : run.status === 'stale'
            ? 'Route stale run owner from Agent Inbox.'
            : 'Route failure triage from Agent Inbox.',
        href: `/admin/agents/runs/${run.id}`,
      }
    })
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
      .select('agent_run_id, source, reference_type, amount, occurred_at, metadata')
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
  const runsById = new Map(runs.map((run) => [run.id, run]))

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
  const engagementQueue = buildAgentEngagementQueue(runs)
  const deadLetterQueue = buildAgentDeadLetterQueue(runs)
  const operatingSignals = buildAgentOperatingSignals(runs)
  const costToday = Number(costs.reduce((sum, row) => sum + Number(row.amount ?? 0), 0).toFixed(4))
  const costSummary = buildAgentCostSummary({ costs, runsById, windowHours: 24 })
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
    cost_summary: costSummary,
    operating_signals: operatingSignals,
    knowledge_governance: KNOWLEDGE_GOVERNANCE_STATUS,
    agent_inbox: agentInbox,
    engagement_queue: engagementQueue,
    dead_letter_queue: deadLetterQueue,
    approvals: approvals.slice(0, 8),
  }
}
