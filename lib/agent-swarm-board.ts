import { actionRequiresApproval, type AgentAction } from '@/lib/agent-policy'
import { AGENT_ORGANIZATION, AGENT_PODS, getAgentByKey, type AgentPodKey } from '@/lib/agent-organization'
import {
  buildClientConnectorReadiness,
  type ClientConnectorAuditSignal,
  type ClientConnectorReadiness,
} from '@/lib/client-connector-readiness'
import { supabaseAdmin } from '@/lib/supabase'

type JsonRecord = Record<string, unknown>

export type SwarmBoardColumnKey =
  | 'intake'
  | 'discovery'
  | 'decision_packet'
  | 'provisioning_plan'
  | 'build_configure'
  | 'qa_isolation'
  | 'waiting_approval'
  | 'active_monitoring'
  | 'blocked_escalated'
  | 'done_archived'

export type SwarmBoardPriority = 'high' | 'medium' | 'low'

export type SwarmHandoffStage =
  | 'discovery'
  | 'technology_decision'
  | 'provisioning_plan'
  | 'build_configure'
  | 'qa_isolation'
  | 'reporting'

export type SwarmHandoffPolicyDecision = {
  autonomousAllowed: boolean
  requiresApproval: boolean
  approvalActions: AgentAction[]
  reason: string
  nextColumn: SwarmBoardColumnKey
}

export type SwarmBoardCard = {
  id: string
  clientProjectId: string
  clientName: string
  projectName: string
  column: SwarmBoardColumnKey
  priority: SwarmBoardPriority
  currentAgentKey: string
  currentAgentLabel: string
  nextAction: string
  statusLabel: string
  riskLabel: string
  approvalState: 'none' | 'pending' | 'required'
  isolationStatus: 'not_started' | 'pending' | 'passed' | 'failed'
  moduleHealth: 'green' | 'yellow' | 'red'
  latestRunId: string | null
  latestRunStatus: string | null
  failedOrStaleRuns: number
  pendingApprovals: number
  activeRuns: number
  roadmapStatus: string | null
  dueDate: string | null
  connectorReadiness: ClientConnectorReadiness
  connectorSummary: string
  requiredConnectorCount: number
  readyConnectorCount: number
  approvalBlockedConnectorCount: number
  missingCriticalConnectorCount: number
  connectorNextAction: string
  href: string
}

export type SwarmBoardColumn = {
  key: SwarmBoardColumnKey
  label: string
  description: string
  cards: SwarmBoardCard[]
}

export type AgentSwarmBoardSnapshot = {
  generated_at: string
  summary: {
    clients: number
    active: number
    failed_or_stale: number
    pending_approvals: number
    isolation_failures: number
    autonomous_ready: number
  }
  columns: SwarmBoardColumn[]
}

export type AgentOrgBoardTaskStatus =
  | 'proposed'
  | 'queued'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'ready_for_review'
  | 'ready_for_merge'
  | 'merged'
  | 'deployed'
  | 'cancelled'

export type AgentOrgBoardTask = {
  id: string
  title: string
  objective: string | null
  status: AgentOrgBoardTaskStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  ownerAgentKey: string | null
  ownerAgentName: string
  ownerRuntime: string | null
  branchName: string | null
  worktreePath: string | null
  prNumber: number | null
  prUrl: string | null
  activeRunId: string | null
  blockerSummary: string | null
  validationSummary: string | null
  overlapGroup: string | null
  parentWorkItemId: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  goal: {
    id: string
    title: string
    sequence: number | null
    status: string | null
    progressWeight: number
    sessionHref: string
    draftRunId: string | null
    approvalRunId: string | null
    latestRunId: string | null
    parentWorkItemId: string | null
    draftTraceHref: string | null
    approvalTraceHref: string | null
    latestTraceHref: string | null
    automationGoalSeedId: string | null
    workflowFamily: string | null
    automationLevel: string | null
    requiresNewWorkflow: boolean
    n8nWorkflows: string[]
    approvalGate: string | null
    nextAction: string | null
  } | null
}

export type AgentOrgBoardGoalMetric = {
  id: string
  title: string
  total: number
  completed: number
  progress: number
  blocked: number
  open: number
  burndown: Array<{ label: string; remaining: number }>
  sessionHref: string
  draftRunId: string | null
  approvalRunId: string | null
  latestRunId: string | null
  draftTraceHref: string | null
  approvalTraceHref: string | null
  latestTraceHref: string | null
  automationGoalSeedId: string | null
  workflowFamily: string | null
  automationLevel: string | null
  requiresNewWorkflow: boolean
  n8nWorkflows: string[]
  approvalGate: string | null
  nextAction: string | null
}

export type AgentOrgBoardWipMetric = {
  laneKey: string
  label: string
  count: number
  limit: number
  overLimit: boolean
}

export type AgentOrgBoardLane = {
  key: string
  label: string
  agentKey: string | null
  agentName: string
  status: 'live' | 'idle' | 'planned'
  tasks: AgentOrgBoardTask[]
}

export type AgentOrgBoardAgent = {
  key: string
  name: string
  podKey: AgentPodKey
  podName: string
  status: 'active' | 'partial' | 'planned'
  runtime: string
  live: boolean
  todayTurns: number
  latestAction: string
  latestRunId: string | null
}

export type AgentOrgBoardActivity = {
  id: string
  occurredAt: string
  agentKey: string
  agentName: string
  podKey: AgentPodKey | 'main'
  action: string
  summary: string
  runId: string | null
  severity: string | null
}

export type AgentOrgBoardWarRoomAgent = {
  key: string
  name: string
  podName: string
  status: 'live' | 'idle' | 'planned'
  latestAction: string
}

export type AgentOrgBoardWarRoomRun = {
  id: string
  title: string
  command: string
  status: string
  startedAt: string
  summary: string
  goalId: string | null
}

export type AgentOrgBoardSnapshot = {
  generated_at: string
  summary: {
    agents: number
    live_agents: number
    active_work_items: number
    unassigned_work_items: number
    blocked_work_items: number
    ready_for_merge: number
    pending_approvals: number
    activity_entries: number
    active_goals: number
    average_cycle_hours: number | null
    oldest_in_flight_hours: number | null
    wip: AgentOrgBoardWipMetric[]
    goals: AgentOrgBoardGoalMetric[]
  }
  agents: AgentOrgBoardAgent[]
  lanes: AgentOrgBoardLane[]
  activity: AgentOrgBoardActivity[]
  warRoom: {
    roster: AgentOrgBoardWarRoomAgent[]
    recentRuns: AgentOrgBoardWarRoomRun[]
    commands: string[]
    suggestedPrompt: string
  }
}

type ClientProjectRow = {
  id: string
  project_name: string
  client_name: string
  project_status: string
  client_email?: string | null
  contact_submission_id?: number | string | null
  estimated_end_date: string | null
  created_at: string | null
}

type RoadmapRow = {
  id: string
  client_project_id: string
  title: string
  status: string
  snapshot: JsonRecord | null
  updated_at: string | null
}

type RoadmapTaskRow = {
  id: string
  roadmap_id: string
  task_key: string
  title: string
  status: string
  priority: SwarmBoardPriority | string
  owner_type: string
  due_date: string | null
  metadata: JsonRecord | null
}

type RoadmapTaskOrgBoardMetadata = {
  column?: SwarmBoardColumnKey
  owner_agent_key?: string
  owner_agent_label?: string
  approval_posture?: 'none' | 'required' | 'pending'
  isolation_required?: boolean
  internal_handoff_label?: string
  client_visible_label?: string
}

type RoadmapReportRow = {
  roadmap_id: string
  report_type: string
  status: string
  generated_at: string | null
  monitoring_summary: JsonRecord | null
}

type AgentRunRow = {
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
  error_message: string | null
  started_at: string
  completed_at: string | null
  metadata: JsonRecord | null
}

type ApprovalRow = {
  id: string
  run_id: string
  approval_type: string
  status: string
  requested_at: string
}

type AgentRunEventRow = {
  id?: string
  run_id: string | null
  event_type: string
  severity?: string | null
  message?: string | null
  occurred_at: string
  metadata?: JsonRecord | null
}

type AgentWorkItemRow = {
  id: string
  title: string
  objective: string | null
  status: string
  priority: string
  owner_agent_key: string | null
  owner_runtime: string | null
  active_run_id: string | null
  branch_name: string | null
  worktree_path: string | null
  pr_number: number | null
  pr_url: string | null
  overlap_group: string | null
  blocker_summary: string | null
  validation_summary: string | null
  approval_id: string | null
  parent_work_item_id?: string | null
  metadata?: JsonRecord | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

type ContactSubmissionRow = {
  id: number
  email: string | null
  website_tech_stack: JsonRecord | null
  client_verified_tech_stack: JsonRecord | null
}

type DiagnosticAuditRow = ClientConnectorAuditSignal & {
  id: string | number
  contact_submission_id: number | null
  contact_email: string | null
  completed_at?: string | null
  updated_at?: string | null
  created_at?: string | null
}

type SwarmBoardBuildInput = {
  projects: ClientProjectRow[]
  roadmaps: RoadmapRow[]
  tasks: RoadmapTaskRow[]
  reports: RoadmapReportRow[]
  runs: AgentRunRow[]
  approvals: ApprovalRow[]
  contacts?: ContactSubmissionRow[]
  audits?: DiagnosticAuditRow[]
}

type AgentOrgBoardBuildInput = {
  runs: AgentRunRow[]
  events: AgentRunEventRow[]
  workItems: AgentWorkItemRow[]
  approvals: ApprovalRow[]
  now?: Date
}

const COLUMN_DEFINITIONS: Omit<SwarmBoardColumn, 'cards'>[] = [
  { key: 'intake', label: 'Intake', description: 'New client setup requests and unstarted swarm work.' },
  { key: 'discovery', label: 'Discovery', description: 'Stack, goals, data, and risk profile collection.' },
  { key: 'decision_packet', label: 'Decision Packet', description: 'LLM, RAG, auth, automation, and cost decisions.' },
  { key: 'provisioning_plan', label: 'Provisioning Plan', description: 'Repo, provider, credential, and workflow setup packet.' },
  { key: 'build_configure', label: 'Build/Configure', description: 'Generated shell, modules, workflow imports, and configs.' },
  { key: 'qa_isolation', label: 'QA/Isolation', description: 'Build checks, synthetic tests, and isolation scans.' },
  { key: 'waiting_approval', label: 'Waiting Approval', description: 'Provider writes, credentials, sends, publishing, and deployment gates.' },
  { key: 'active_monitoring', label: 'Active/Monitoring', description: 'Launched swarms with health checks and reports.' },
  { key: 'blocked_escalated', label: 'Blocked/Escalated', description: 'Failures, stale handoffs, and human/client decisions.' },
  { key: 'done_archived', label: 'Done/Archived', description: 'Completed or cancelled client swarm setup.' },
]

const AUTONOMOUS_STAGE_TO_COLUMN: Record<SwarmHandoffStage, SwarmBoardColumnKey> = {
  discovery: 'discovery',
  technology_decision: 'decision_packet',
  provisioning_plan: 'provisioning_plan',
  build_configure: 'build_configure',
  qa_isolation: 'qa_isolation',
  reporting: 'active_monitoring',
}

const APPROVAL_ACTIONS = new Set<AgentAction>([
  'unknown_db_write',
  'production_config_change',
  'publish_public_content',
  'send_email',
  'public_content_from_private_material',
  'client_data_access',
  'known_workflow_db_write',
])

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function projectIdFromRun(run: AgentRunRow): string | null {
  if (run.subject_type === 'client_project' && run.subject_id) return run.subject_id
  return (
    stringValue(run.metadata?.client_project_id) ??
    stringValue(run.metadata?.clientProjectId) ??
    stringValue(run.metadata?.project_id) ??
    null
  )
}

function isolationStatusFromRoadmap(roadmap: RoadmapRow | null, tasks: RoadmapTaskRow[]) {
  const snapshotStatus = stringValue(roadmap?.snapshot?.isolation_status)
  if (snapshotStatus === 'passed' || snapshotStatus === 'failed' || snapshotStatus === 'pending') return snapshotStatus

  if (tasks.some((task) => orgBoardProjection(task)?.isolation_required)) return 'pending'

  const isolationTasks = tasks.filter((task) => {
    const key = task.task_key.toLowerCase()
    const title = task.title.toLowerCase()
    return key.includes('isolation') || title.includes('isolation')
  })
  if (isolationTasks.some((task) => task.status === 'blocked' || task.status === 'cancelled')) return 'failed'
  if (isolationTasks.some((task) => task.status === 'complete')) return 'passed'
  if (isolationTasks.length > 0) return 'pending'
  return 'not_started'
}

function orgBoardProjection(task: RoadmapTaskRow): RoadmapTaskOrgBoardMetadata | null {
  const value = task.metadata?.org_board
  if (!value || typeof value !== 'object') return null
  const projection = value as RoadmapTaskOrgBoardMetadata
  if (!projection.column) return null
  return projection
}

function orgBoardColumn(task: RoadmapTaskRow): SwarmBoardColumnKey | null {
  const column = orgBoardProjection(task)?.column
  const allowed = new Set<SwarmBoardColumnKey>(COLUMN_DEFINITIONS.map((item) => item.key))
  return column && allowed.has(column) ? column : null
}

function orgBoardApprovalPosture(tasks: RoadmapTaskRow[]): 'none' | 'required' | 'pending' {
  const postures = tasks.map((task) => orgBoardProjection(task)?.approval_posture)
  if (postures.includes('pending')) return 'pending'
  if (postures.includes('required')) return 'required'
  return 'none'
}

function columnFromTaskStatus(input: {
  roadmap: RoadmapRow | null
  openTasks: RoadmapTaskRow[]
  failedOrStaleRuns: number
  pendingApprovals: number
  isolationStatus: SwarmBoardCard['isolationStatus']
  projectStatus: string
}): SwarmBoardColumnKey {
  if (input.pendingApprovals > 0) return 'waiting_approval'
  if (input.failedOrStaleRuns > 0 || input.isolationStatus === 'failed') return 'blocked_escalated'
  if (input.projectStatus === 'completed' || input.roadmap?.status === 'completed') return 'done_archived'
  if (input.projectStatus === 'cancelled' || input.roadmap?.status === 'cancelled') return 'done_archived'
  if (input.roadmap?.status === 'active' && input.openTasks.length === 0) return 'active_monitoring'

  const metadataColumn = input.openTasks.map(orgBoardColumn).find((column): column is SwarmBoardColumnKey => Boolean(column))
  if (metadataColumn) return metadataColumn

  const titles = input.openTasks.map((task) => `${task.task_key} ${task.title}`.toLowerCase()).join(' ')
  if (!input.roadmap) return 'intake'
  if (titles.includes('isolation') || titles.includes('validation') || titles.includes('qa')) return 'qa_isolation'
  if (titles.includes('build') || titles.includes('configure') || titles.includes('workflow') || titles.includes('module')) return 'build_configure'
  if (titles.includes('credential') || titles.includes('repo') || titles.includes('provider') || titles.includes('provision')) return 'provisioning_plan'
  if (titles.includes('llm') || titles.includes('rag') || titles.includes('auth') || titles.includes('decision') || titles.includes('technology')) return 'decision_packet'
  if (titles.includes('discovery') || titles.includes('ownership') || titles.includes('data source')) return 'discovery'
  return 'intake'
}

function priorityFromSignals(input: {
  pendingApprovals: number
  failedOrStaleRuns: number
  isolationStatus: SwarmBoardCard['isolationStatus']
  openTasks: RoadmapTaskRow[]
}): SwarmBoardPriority {
  if (input.pendingApprovals > 0 || input.failedOrStaleRuns > 0 || input.isolationStatus === 'failed') return 'high'
  if (input.openTasks.some((task) => task.priority === 'high' || task.status === 'blocked')) return 'medium'
  return 'low'
}

function moduleHealth(input: {
  pendingApprovals: number
  failedOrStaleRuns: number
  isolationStatus: SwarmBoardCard['isolationStatus']
  reports: RoadmapReportRow[]
}): SwarmBoardCard['moduleHealth'] {
  if (input.failedOrStaleRuns > 0 || input.isolationStatus === 'failed') return 'red'
  if (input.pendingApprovals > 0 || input.isolationStatus === 'pending') return 'yellow'
  if (input.reports.some((report) => {
    const summary = report.monitoring_summary ?? {}
    return Number(summary.overdue_tasks ?? 0) > 0 || Boolean(summary.report_missing)
  })) return 'yellow'
  return 'green'
}

function currentAgentForColumn(column: SwarmBoardColumnKey) {
  switch (column) {
    case 'discovery':
      return { key: 'research-source-register', label: 'Askia Muhammad (Songhai) - Research Source Register' }
    case 'decision_packet':
      return { key: 'technology-evaluator', label: 'Imhotep (Kemet) - Technology Evaluator' }
    case 'provisioning_plan':
      return { key: 'automation-systems', label: 'Yaa Asantewaa (Ashanti) - Automation Systems' }
    case 'build_configure':
      return { key: 'engineering-copilot', label: 'Piye (Kush) - Engineering Copilot' }
    case 'qa_isolation':
      return { key: 'engineering-copilot', label: 'Amanitore (Kush) - QA & Isolation' }
    case 'waiting_approval':
      return { key: 'approval-steward', label: 'Tenkamenin (Ghana) - Approval Steward' }
    case 'blocked_escalated':
      return { key: 'chief-of-staff', label: 'Shaka (Zulu) - Chief of Staff' }
    case 'active_monitoring':
      return { key: 'chief-of-staff', label: 'Shaka (Zulu) - Client Swarm Monitor' }
    default:
      return { key: 'chief-of-staff', label: 'Shaka (Zulu) - Chief of Staff' }
  }
}

function currentAgentForTasks(column: SwarmBoardColumnKey, openTasks: RoadmapTaskRow[]) {
  const projection = openTasks.map(orgBoardProjection).find((item) => item?.owner_agent_key)
  if (projection?.owner_agent_key) {
    return {
      key: projection.owner_agent_key,
      label: projection.owner_agent_label ?? projection.owner_agent_key,
    }
  }
  return currentAgentForColumn(column)
}

function nextActionForCard(input: {
  column: SwarmBoardColumnKey
  pendingApprovals: number
  failedOrStaleRuns: number
  openTasks: RoadmapTaskRow[]
}) {
  if (input.pendingApprovals > 0) return 'Review the approval checkpoint before any side effect runs.'
  if (input.failedOrStaleRuns > 0) return 'Open the latest failed or stale trace and route triage.'
  const nextTask = input.openTasks[0]
  const orgBoardLabel = nextTask ? stringValue(orgBoardProjection(nextTask)?.internal_handoff_label) : null
  if (orgBoardLabel) return orgBoardLabel
  if (nextTask) return nextTask.title

  switch (input.column) {
    case 'active_monitoring':
      return 'Continue scheduled health monitoring and monthly reporting.'
    case 'done_archived':
      return 'Archive the completed swarm package and preserve handoff artifacts.'
    default:
      return 'Create the next read-only work packet.'
  }
}

export function evaluateSwarmHandoffPolicy(input: {
  stage: SwarmHandoffStage
  runtime?: 'codex' | 'n8n' | 'hermes' | 'opencode' | 'manual'
  requestedActions?: AgentAction[]
  riskLevel?: 'low' | 'medium' | 'high'
}): SwarmHandoffPolicyDecision {
  const runtime = input.runtime ?? 'codex'
  const requestedActions = input.requestedActions ?? ['read_files']
  const approvalActions = requestedActions.filter((action) => APPROVAL_ACTIONS.has(action) || actionRequiresApproval(runtime, action))
  const requiresApproval = approvalActions.length > 0 || input.riskLevel === 'high'

  if (requiresApproval) {
    return {
      autonomousAllowed: false,
      requiresApproval: true,
      approvalActions,
      reason: input.riskLevel === 'high'
        ? 'High-risk handoffs must wait for an approval checkpoint.'
        : 'Requested actions cross an approval boundary.',
      nextColumn: 'waiting_approval',
    }
  }

  return {
    autonomousAllowed: true,
    requiresApproval: false,
    approvalActions: [],
    reason: 'Read-only, planning, QA, or reporting handoff may proceed autonomously.',
    nextColumn: AUTONOMOUS_STAGE_TO_COLUMN[input.stage],
  }
}

export function buildAgentSwarmBoardSnapshotFromRows(input: SwarmBoardBuildInput): AgentSwarmBoardSnapshot {
  const roadmapsByProject = new Map<string, RoadmapRow>()
  for (const roadmap of input.roadmaps) {
    if (!roadmapsByProject.has(roadmap.client_project_id)) {
      roadmapsByProject.set(roadmap.client_project_id, roadmap)
    }
  }

  const tasksByRoadmap = new Map<string, RoadmapTaskRow[]>()
  for (const task of input.tasks) {
    tasksByRoadmap.set(task.roadmap_id, [...(tasksByRoadmap.get(task.roadmap_id) ?? []), task])
  }

  const reportsByRoadmap = new Map<string, RoadmapReportRow[]>()
  for (const report of input.reports) {
    reportsByRoadmap.set(report.roadmap_id, [...(reportsByRoadmap.get(report.roadmap_id) ?? []), report])
  }

  const runsByProject = new Map<string, AgentRunRow[]>()
  for (const run of input.runs) {
    const projectId = projectIdFromRun(run)
    if (!projectId) continue
    runsByProject.set(projectId, [...(runsByProject.get(projectId) ?? []), run])
  }

  const approvalsByRun = new Map<string, ApprovalRow[]>()
  for (const approval of input.approvals.filter((item) => item.status === 'pending')) {
    approvalsByRun.set(approval.run_id, [...(approvalsByRun.get(approval.run_id) ?? []), approval])
  }

  const contactsById = new Map<number, ContactSubmissionRow>()
  const contactsByEmail = new Map<string, ContactSubmissionRow>()
  for (const contact of input.contacts ?? []) {
    contactsById.set(contact.id, contact)
    if (contact.email) contactsByEmail.set(contact.email.toLowerCase(), contact)
  }

  const auditsByContactId = new Map<number, DiagnosticAuditRow[]>()
  const auditsByEmail = new Map<string, DiagnosticAuditRow[]>()
  for (const audit of input.audits ?? []) {
    if (audit.contact_submission_id) {
      auditsByContactId.set(audit.contact_submission_id, [...(auditsByContactId.get(audit.contact_submission_id) ?? []), audit])
    }
    if (audit.contact_email) {
      const email = audit.contact_email.toLowerCase()
      auditsByEmail.set(email, [...(auditsByEmail.get(email) ?? []), audit])
    }
  }

  const cards = input.projects.map((project): SwarmBoardCard => {
    const projectContactId = project.contact_submission_id !== null && project.contact_submission_id !== undefined
      ? Number(project.contact_submission_id)
      : null
    const projectEmail = project.client_email?.toLowerCase() ?? null
    const contact = projectContactId && Number.isFinite(projectContactId)
      ? contactsById.get(projectContactId)
      : projectEmail
        ? contactsByEmail.get(projectEmail)
        : undefined
    const roadmap = roadmapsByProject.get(project.id) ?? null
    const tasks = roadmap ? tasksByRoadmap.get(roadmap.id) ?? [] : []
    const reports = roadmap ? reportsByRoadmap.get(roadmap.id) ?? [] : []
    const audits = [
      ...(projectContactId && Number.isFinite(projectContactId) ? auditsByContactId.get(projectContactId) ?? [] : []),
      ...(projectEmail ? auditsByEmail.get(projectEmail) ?? [] : []),
    ].filter((audit, index, rows) => rows.findIndex((item) => String(item.id) === String(audit.id)) === index)
    const connectorReadiness = buildClientConnectorReadiness({
      verifiedStack: contact?.client_verified_tech_stack ?? null,
      auditSignals: audits,
      builtWithStack: contact?.website_tech_stack ?? null,
      roadmapSnapshot: roadmap?.snapshot ?? null,
      roadmapTasks: tasks,
      projectMetadata: {
        project_name: project.project_name,
        client_name: project.client_name,
        project_status: project.project_status,
      },
    })
    const openTasks = tasks
      .filter((task) => !['complete', 'completed', 'cancelled'].includes(task.status))
      .sort((a, b) => {
        const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
        return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1)
      })
    const runs = runsByProject.get(project.id) ?? []
    const activeRuns = runs.filter((run) => ['queued', 'running', 'waiting_for_approval'].includes(run.status))
    const failedOrStaleRuns = runs.filter((run) => run.status === 'failed' || run.status === 'stale').length
    const pendingApprovals = runs.reduce((count, run) => count + (approvalsByRun.get(run.id)?.length ?? 0), 0)
    const isolationStatus = isolationStatusFromRoadmap(roadmap, tasks)
    const column = columnFromTaskStatus({
      roadmap,
      openTasks,
      failedOrStaleRuns,
      pendingApprovals,
      isolationStatus,
      projectStatus: project.project_status,
    })
    const agent = currentAgentForTasks(column, openTasks)
    const latestRun = runs[0] ?? null
    const health = moduleHealth({ pendingApprovals, failedOrStaleRuns, isolationStatus, reports })
    const approvalPosture = orgBoardApprovalPosture(openTasks)
    const approvalState = pendingApprovals > 0 ? 'pending' : approvalPosture === 'required' || column === 'waiting_approval' ? 'required' : 'none'

    return {
      id: `client-swarm:${project.id}`,
      clientProjectId: project.id,
      clientName: project.client_name,
      projectName: project.project_name,
      column,
      priority: priorityFromSignals({ pendingApprovals, failedOrStaleRuns, isolationStatus, openTasks }),
      currentAgentKey: agent.key,
      currentAgentLabel: agent.label,
      nextAction: nextActionForCard({ column, pendingApprovals, failedOrStaleRuns, openTasks }),
      statusLabel: roadmap?.status ?? project.project_status,
      riskLabel: pendingApprovals > 0 ? 'approval gated' : failedOrStaleRuns > 0 ? 'triage required' : approvalState === 'required' ? 'approval required before side effects' : 'read-only handoff safe',
      approvalState,
      isolationStatus,
      moduleHealth: health,
      latestRunId: latestRun?.id ?? null,
      latestRunStatus: latestRun?.status ?? null,
      failedOrStaleRuns,
      pendingApprovals,
      activeRuns: activeRuns.length,
      roadmapStatus: roadmap?.status ?? null,
      dueDate: openTasks.find((task) => task.due_date)?.due_date ?? project.estimated_end_date,
      connectorReadiness,
      connectorSummary: connectorReadiness.summary,
      requiredConnectorCount: connectorReadiness.requiredConnectorCount,
      readyConnectorCount: connectorReadiness.readyConnectorCount,
      approvalBlockedConnectorCount: connectorReadiness.approvalBlockedConnectorCount,
      missingCriticalConnectorCount: connectorReadiness.missingCriticalConnectorCount,
      connectorNextAction: connectorReadiness.connectorNextAction,
      href: `/admin/client-projects/${project.id}`,
    }
  })

  const columns = COLUMN_DEFINITIONS.map((column) => ({
    ...column,
    cards: cards.filter((card) => card.column === column.key),
  }))
  const active = cards.filter((card) => !['done_archived'].includes(card.column)).length

  return {
    generated_at: new Date().toISOString(),
    summary: {
      clients: cards.length,
      active,
      failed_or_stale: cards.reduce((sum, card) => sum + card.failedOrStaleRuns, 0),
      pending_approvals: cards.reduce((sum, card) => sum + card.pendingApprovals, 0),
      isolation_failures: cards.filter((card) => card.isolationStatus === 'failed').length,
      autonomous_ready: cards.filter((card) => card.approvalState === 'none' && card.moduleHealth !== 'red').length,
    },
    columns,
  }
}

function podName(podKey: AgentPodKey) {
  return AGENT_PODS.find((pod) => pod.key === podKey)?.name ?? podKey
}

function agentName(agentKey: string | null) {
  if (!agentKey) return 'Unassigned'
  return getAgentByKey(agentKey)?.name ?? agentKey
}

function normalizeTaskStatus(status: string): AgentOrgBoardTaskStatus {
  const allowed = new Set<AgentOrgBoardTaskStatus>([
    'proposed',
    'queued',
    'assigned',
    'in_progress',
    'blocked',
    'ready_for_review',
    'ready_for_merge',
    'merged',
    'deployed',
    'cancelled',
  ])
  return allowed.has(status as AgentOrgBoardTaskStatus) ? status as AgentOrgBoardTaskStatus : 'queued'
}

function normalizeTaskPriority(priority: string): AgentOrgBoardTask['priority'] {
  if (priority === 'urgent' || priority === 'high' || priority === 'medium' || priority === 'low') return priority
  return 'medium'
}

function isActiveRun(status: string) {
  return status === 'queued' || status === 'running' || status === 'waiting_for_approval'
}

function isActiveWorkStatus(status: AgentOrgBoardTaskStatus) {
  return !['merged', 'deployed', 'cancelled'].includes(status)
}

function laneKeyForTask(task: AgentWorkItemRow) {
  if (!task.owner_agent_key || task.status === 'proposed' || task.status === 'queued') return 'inbox'
  if (task.owner_agent_key === 'integration-captain' || task.status === 'ready_for_merge' || task.status === 'ready_for_review') return 'integration-captain'
  return task.owner_agent_key
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function goalForTask(item: AgentWorkItemRow): AgentOrgBoardTask['goal'] {
  const metadata = item.metadata ?? {}
  const goalId = stringValue(metadata.goal_id)
  const goalTitle = stringValue(metadata.goal_title)
  if (!goalId || !goalTitle) return null
  const draftRunId = stringValue(metadata.goal_draft_run_id) ?? stringValue(metadata.draft_run_id)
  const approvalRunId = stringValue(metadata.goal_approved_by_run_id) ?? stringValue(metadata.approved_by_run_id) ?? stringValue(metadata.goal_created_by_run_id)
  const latestRunId = item.active_run_id ?? approvalRunId ?? draftRunId
  const sessionHref = stringValue(metadata.goal_session_href) ?? `/admin/agents/standup?goal=${encodeURIComponent(goalId)}`
  return {
    id: goalId,
    title: goalTitle,
    sequence: typeof metadata.goal_sequence === 'number' ? metadata.goal_sequence : null,
    status: stringValue(metadata.goal_status),
    progressWeight: numberValue(metadata.goal_progress_weight, 1),
    sessionHref,
    draftRunId,
    approvalRunId,
    latestRunId,
    parentWorkItemId: stringValue(metadata.goal_parent_work_item_id) ?? item.parent_work_item_id ?? null,
    draftTraceHref: draftRunId ? `/admin/agents/runs/${draftRunId}` : null,
    approvalTraceHref: approvalRunId ? `/admin/agents/runs/${approvalRunId}` : null,
    latestTraceHref: latestRunId ? `/admin/agents/runs/${latestRunId}` : null,
    automationGoalSeedId: stringValue(metadata.automation_goal_seed_id),
    workflowFamily: stringValue(metadata.workflow_family),
    automationLevel: stringValue(metadata.automation_level),
    requiresNewWorkflow: metadata.requires_new_workflow === true,
    n8nWorkflows: stringArrayValue(metadata.n8n_workflows),
    approvalGate: stringValue(metadata.approval_gate),
    nextAction: stringValue(metadata.next_action),
  }
}

function hoursBetween(start: string | null | undefined, end: Date | string | null | undefined) {
  if (!start) return null
  const startMs = new Date(start).getTime()
  const endMs = end ? new Date(end).getTime() : Date.now()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return null
  return Math.round(((endMs - startMs) / 3_600_000) * 10) / 10
}

function isCompletedWorkStatus(status: AgentOrgBoardTaskStatus) {
  return status === 'merged' || status === 'deployed'
}

function buildGoalMetrics(tasks: AgentOrgBoardTask[]): AgentOrgBoardGoalMetric[] {
  const grouped = new Map<string, AgentOrgBoardTask[]>()
  for (const task of tasks) {
    if (!task.goal) continue
    grouped.set(task.goal.id, [...(grouped.get(task.goal.id) ?? []), task])
  }

  return [...grouped.entries()].map(([id, goalTasks]) => {
    const title = goalTasks[0]?.goal?.title ?? id
    const firstGoal = goalTasks.find((task) => task.goal)?.goal ?? null
    const draftRunId = goalTasks.find((task) => task.goal?.draftRunId)?.goal?.draftRunId ?? null
    const approvalRunId = goalTasks.find((task) => task.goal?.approvalRunId)?.goal?.approvalRunId ?? null
    const latestRunId = goalTasks.find((task) => task.goal?.latestRunId)?.goal?.latestRunId ?? approvalRunId ?? draftRunId
    const totalWeight = goalTasks.reduce((sum, task) => sum + (task.goal?.progressWeight ?? 1), 0) || goalTasks.length || 1
    const completedWeight = goalTasks
      .filter((task) => isCompletedWorkStatus(task.status))
      .reduce((sum, task) => sum + (task.goal?.progressWeight ?? 1), 0)
    const sorted = [...goalTasks].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const burndown = sorted.slice(0, 6).map((task, index) => ({
      label: task.completedAt ? new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `T${index + 1}`,
      remaining: sorted.filter((candidate) => !isCompletedWorkStatus(candidate.status) || new Date(candidate.updatedAt).getTime() > new Date(task.updatedAt).getTime()).length,
    }))
    return {
      id,
      title,
      total: goalTasks.length,
      completed: goalTasks.filter((task) => isCompletedWorkStatus(task.status)).length,
      progress: Math.round((completedWeight / totalWeight) * 100),
      blocked: goalTasks.filter((task) => task.status === 'blocked').length,
      open: goalTasks.filter((task) => isActiveWorkStatus(task.status)).length,
      burndown,
      sessionHref: firstGoal?.sessionHref ?? `/admin/agents/standup?goal=${encodeURIComponent(id)}`,
      draftRunId,
      approvalRunId,
      latestRunId,
      draftTraceHref: draftRunId ? `/admin/agents/runs/${draftRunId}` : null,
      approvalTraceHref: approvalRunId ? `/admin/agents/runs/${approvalRunId}` : null,
      latestTraceHref: latestRunId ? `/admin/agents/runs/${latestRunId}` : null,
      automationGoalSeedId: firstGoal?.automationGoalSeedId ?? null,
      workflowFamily: firstGoal?.workflowFamily ?? null,
      automationLevel: firstGoal?.automationLevel ?? null,
      requiresNewWorkflow: firstGoal?.requiresNewWorkflow ?? false,
      n8nWorkflows: firstGoal?.n8nWorkflows ?? [],
      approvalGate: firstGoal?.approvalGate ?? null,
      nextAction: firstGoal?.nextAction ?? null,
    }
  })
}

function fallbackAgentForRun(run: AgentRunRow | undefined) {
  if (!run) return AGENT_ORGANIZATION[0]
  if (run.agent_key) return getAgentByKey(run.agent_key) ?? AGENT_ORGANIZATION[0]
  if (run.runtime === 'n8n') return getAgentByKey('automation-systems') ?? AGENT_ORGANIZATION[0]
  if (run.kind?.includes('content')) return getAgentByKey('voice-content-architect') ?? AGENT_ORGANIZATION[0]
  return AGENT_ORGANIZATION[0]
}

export function buildAgentOrgBoardSnapshotFromRows(input: AgentOrgBoardBuildInput): AgentOrgBoardSnapshot {
  const now = input.now ?? new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const runsById = new Map(input.runs.map((run) => [run.id, run]))
  const runsByAgent = new Map<string, AgentRunRow[]>()
  for (const run of input.runs) {
    const agent = fallbackAgentForRun(run)
    runsByAgent.set(agent.key, [...(runsByAgent.get(agent.key) ?? []), run])
  }

  const pendingApprovals = input.approvals.filter((approval) => approval.status === 'pending')
  const agents: AgentOrgBoardAgent[] = AGENT_ORGANIZATION.map((agent) => {
    const runs = runsByAgent.get(agent.key) ?? []
    const latestRun = runs[0] ?? null
    const live = agent.status !== 'planned' && runs.some((run) => isActiveRun(run.status))
    const todayTurns = runs.filter((run) => new Date(run.started_at).getTime() >= startOfDay.getTime()).length
    return {
      key: agent.key,
      name: agent.name,
      podKey: agent.podKey,
      podName: podName(agent.podKey),
      status: agent.status,
      runtime: agent.primaryRuntime,
      live,
      todayTurns,
      latestAction: latestRun?.current_step ?? latestRun?.title ?? 'No recent traced activity',
      latestRunId: latestRun?.id ?? null,
    }
  })

  const tasks: AgentOrgBoardTask[] = input.workItems.map((item) => ({
    id: item.id,
    title: item.title,
    objective: item.objective,
    status: normalizeTaskStatus(item.status),
    priority: normalizeTaskPriority(item.priority),
    ownerAgentKey: item.owner_agent_key,
    ownerAgentName: agentName(item.owner_agent_key),
    ownerRuntime: item.owner_runtime,
    branchName: item.branch_name,
    worktreePath: item.worktree_path,
    prNumber: item.pr_number,
    prUrl: item.pr_url,
    activeRunId: item.active_run_id,
    blockerSummary: item.blocker_summary,
    validationSummary: item.validation_summary,
    overlapGroup: item.overlap_group,
    parentWorkItemId: item.parent_work_item_id ?? null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    completedAt: item.completed_at ?? null,
    goal: goalForTask(item),
  }))

  const laneSeeds: AgentOrgBoardLane[] = [
    {
      key: 'inbox',
      label: 'Inbox',
      agentKey: null,
      agentName: 'Unassigned',
      status: 'idle',
      tasks: [],
    },
    {
      key: 'integration-captain',
      label: 'Integration Captain',
      agentKey: 'integration-captain',
      agentName: 'Integration Captain',
      status: 'live',
      tasks: [],
    },
    ...AGENT_ORGANIZATION
      .filter((agent) => ['chief-of-staff', 'engineering-copilot', 'automation-systems', 'research-source-register', 'voice-content-architect', 'inbox-follow-up'].includes(agent.key))
      .map((agent): AgentOrgBoardLane => ({
        key: agent.key,
        label: agent.name.replace(/ Agent$/, ''),
        agentKey: agent.key,
        agentName: agent.name,
        status: agent.status === 'planned' ? 'planned' : runsByAgent.get(agent.key)?.some((run) => isActiveRun(run.status)) ? 'live' : 'idle',
        tasks: [],
      })),
  ]

  const lanesByKey = new Map(laneSeeds.map((lane) => [lane.key, { ...lane, tasks: [] as AgentOrgBoardTask[] }]))
  for (const item of input.workItems) {
    const task = tasks.find((candidate) => candidate.id === item.id)
    if (!task || !isActiveWorkStatus(task.status)) continue
    const key = laneKeyForTask(item)
    const lane = lanesByKey.get(key) ?? lanesByKey.get('inbox')
    lane?.tasks.push(task)
  }

  const lanes = [...lanesByKey.values()].map((lane) => ({
    ...lane,
    tasks: lane.tasks.sort((a, b) => {
      const rank: Record<AgentOrgBoardTask['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 }
      return rank[a.priority] - rank[b.priority] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }),
  }))

  const activity: AgentOrgBoardActivity[] = input.events.slice(0, 100).map((event) => {
    const run = event.run_id ? runsById.get(event.run_id) : undefined
    const agent = fallbackAgentForRun(run)
    return {
      id: event.id ?? `${event.run_id ?? 'event'}:${event.event_type}:${event.occurred_at}`,
      occurredAt: event.occurred_at,
      agentKey: agent.key,
      agentName: agent.name,
      podKey: agent.podKey,
      action: event.event_type,
      summary: stringValue(event.message) ?? run?.current_step ?? run?.title ?? 'Agent Ops event recorded',
      runId: event.run_id,
      severity: event.severity ?? null,
    }
  })

  const roster = agents
    .filter((agent) => ['chief-of-staff', 'engineering-copilot', 'automation-systems', 'research-source-register', 'voice-content-architect', 'inbox-follow-up'].includes(agent.key))
    .map((agent): AgentOrgBoardWarRoomAgent => ({
      key: agent.key,
      name: agent.name.replace(/ Agent$/, ''),
      podName: agent.podName,
      status: agent.status === 'planned' ? 'planned' : agent.live ? 'live' : 'idle',
      latestAction: agent.latestAction,
    }))
  const recentWarRoomRuns: AgentOrgBoardWarRoomRun[] = input.runs
    .filter((run) => run.kind?.startsWith('agent_war_room_'))
    .slice(0, 5)
    .map((run) => ({
      id: run.id,
      title: run.title,
      command: String(run.metadata?.command ?? run.kind?.replace(/^agent_war_room_/, '') ?? 'war_room'),
      status: run.status,
      startedAt: run.started_at,
      summary: run.current_step ?? run.title,
      goalId: stringValue(run.metadata?.goal_id) ?? stringValue(run.metadata?.goal_preview),
    }))

  const activeTasks = tasks.filter((task) => isActiveWorkStatus(task.status))
  const completedCycleHours = tasks
    .filter((task) => isCompletedWorkStatus(task.status))
    .map((task) => hoursBetween(task.createdAt, task.completedAt ?? task.updatedAt))
    .filter((value): value is number => value != null)
  const activeAges = activeTasks
    .map((task) => hoursBetween(task.createdAt, now))
    .filter((value): value is number => value != null)
  const wip = lanes.map((lane) => {
    const limit = lane.key === 'integration-captain' ? 3 : lane.key === 'inbox' ? 6 : 4
    return {
      laneKey: lane.key,
      label: lane.label,
      count: lane.tasks.length,
      limit,
      overLimit: lane.tasks.length > limit,
    }
  })
  const goals = buildGoalMetrics(tasks)

  return {
    generated_at: now.toISOString(),
    summary: {
      agents: agents.length,
      live_agents: agents.filter((agent) => agent.live).length,
      active_work_items: activeTasks.length,
      unassigned_work_items: activeTasks.filter((task) => !task.ownerAgentKey).length,
      blocked_work_items: activeTasks.filter((task) => task.status === 'blocked').length,
      ready_for_merge: activeTasks.filter((task) => task.status === 'ready_for_merge').length,
      pending_approvals: pendingApprovals.length,
      activity_entries: activity.length,
      active_goals: goals.filter((goal) => goal.open > 0).length,
      average_cycle_hours: completedCycleHours.length
        ? Math.round((completedCycleHours.reduce((sum, value) => sum + value, 0) / completedCycleHours.length) * 10) / 10
        : null,
      oldest_in_flight_hours: activeAges.length ? Math.max(...activeAges) : null,
      wip,
      goals,
    },
    agents,
    lanes,
    activity,
    warRoom: {
      roster,
      recentRuns: recentWarRoomRuns,
      commands: ['/agent work', '/agent blockers', '/agent prs', '/agent captain'],
      suggestedPrompt: 'Ask the team for status, blockers, overlap risk, or the next safe handoff.',
    },
  }
}

export async function buildAgentSwarmBoardSnapshot(): Promise<AgentSwarmBoardSnapshot> {
  if (!supabaseAdmin) throw new Error('Database not available')
  const db = supabaseAdmin

  const projectsRes = await db
    .from('client_projects')
    .select('id, project_name, client_name, client_email, contact_submission_id, project_status, estimated_end_date, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (projectsRes.error) throw new Error(projectsRes.error.message)

  const projects = (projectsRes.data ?? []) as ClientProjectRow[]
  const contactIds = [...new Set(projects
    .map((project) => project.contact_submission_id)
    .filter((id): id is number | string => id !== null && id !== undefined)
    .map(Number)
    .filter((id) => Number.isFinite(id)))]
  const clientEmails = [...new Set(projects
    .map((project) => project.client_email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email)))]

  const [contactsByIdRes, contactsByEmailRes, auditsByContactRes, auditsByEmailRes, roadmapsRes, tasksRes, reportsRes, runsRes, approvalsRes] = await Promise.all([
    contactIds.length
      ? db
          .from('contact_submissions')
          .select('id, email, website_tech_stack, client_verified_tech_stack')
          .in('id', contactIds)
      : Promise.resolve({ data: [], error: null }),
    clientEmails.length
      ? db
          .from('contact_submissions')
          .select('id, email, website_tech_stack, client_verified_tech_stack')
          .in('email', clientEmails)
      : Promise.resolve({ data: [], error: null }),
    contactIds.length
      ? db
          .from('diagnostic_audits')
          .select('id, contact_submission_id, contact_email, audit_type, tech_stack, automation_needs, ai_readiness, budget_timeline, decision_making, enriched_tech_stack, completed_at, updated_at, created_at')
          .in('contact_submission_id', contactIds)
          .order('completed_at', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    clientEmails.length
      ? db
          .from('diagnostic_audits')
          .select('id, contact_submission_id, contact_email, audit_type, tech_stack, automation_needs, ai_readiness, budget_timeline, decision_making, enriched_tech_stack, completed_at, updated_at, created_at')
          .in('contact_email', clientEmails)
          .order('completed_at', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    db
      .from('client_ai_ops_roadmaps')
      .select('id, client_project_id, title, status, snapshot, updated_at')
      .not('client_project_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(75),
    db
      .from('client_ai_ops_roadmap_tasks')
      .select('id, roadmap_id, task_key, title, status, priority, owner_type, due_date, metadata')
      .order('created_at', { ascending: false })
      .limit(250),
    db
      .from('client_ai_ops_roadmap_reports')
      .select('roadmap_id, report_type, status, generated_at, monitoring_summary')
      .order('generated_at', { ascending: false })
      .limit(100),
    db
      .from('agent_runs')
      .select('id, agent_key, runtime, kind, title, status, subject_type, subject_id, subject_label, current_step, error_message, started_at, completed_at, metadata')
      .order('started_at', { ascending: false })
      .limit(150),
    db
      .from('agent_approvals')
      .select('id, run_id, approval_type, status, requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(75),
  ])

  for (const result of [contactsByIdRes, contactsByEmailRes, auditsByContactRes, auditsByEmailRes, roadmapsRes, tasksRes, reportsRes, runsRes, approvalsRes]) {
    if (result.error) throw new Error(result.error.message)
  }

  const contacts = [...((contactsByIdRes.data ?? []) as ContactSubmissionRow[]), ...((contactsByEmailRes.data ?? []) as ContactSubmissionRow[])]
    .filter((contact, index, rows) => rows.findIndex((item) => item.id === contact.id) === index)
  const audits = [...((auditsByContactRes.data ?? []) as DiagnosticAuditRow[]), ...((auditsByEmailRes.data ?? []) as DiagnosticAuditRow[])]
    .filter((audit, index, rows) => rows.findIndex((item) => String(item.id) === String(audit.id)) === index)

  return buildAgentSwarmBoardSnapshotFromRows({
    projects,
    roadmaps: (roadmapsRes.data ?? []) as RoadmapRow[],
    tasks: (tasksRes.data ?? []) as RoadmapTaskRow[],
    reports: (reportsRes.data ?? []) as RoadmapReportRow[],
    runs: (runsRes.data ?? []) as AgentRunRow[],
    approvals: (approvalsRes.data ?? []) as ApprovalRow[],
    contacts,
    audits,
  })
}

export async function buildAgentOrgBoardSnapshot(): Promise<AgentOrgBoardSnapshot> {
  if (!supabaseAdmin) throw new Error('Database not available')
  const db = supabaseAdmin

  const [runsRes, eventsRes, workItemsRes, approvalsRes] = await Promise.all([
    db
      .from('agent_runs')
      .select('id, agent_key, runtime, kind, title, status, subject_type, subject_id, subject_label, current_step, error_message, started_at, completed_at, metadata')
      .order('started_at', { ascending: false })
      .limit(150),
    db
      .from('agent_run_events')
      .select('id, run_id, event_type, severity, message, occurred_at, metadata')
      .order('occurred_at', { ascending: false })
      .limit(120),
    db
      .from('agent_work_items')
      .select('id, title, objective, status, priority, owner_agent_key, owner_runtime, active_run_id, parent_work_item_id, branch_name, worktree_path, pr_number, pr_url, overlap_group, blocker_summary, validation_summary, approval_id, metadata, completed_at, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100),
    db
      .from('agent_approvals')
      .select('id, run_id, approval_type, status, requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(75),
  ])

  for (const result of [runsRes, eventsRes, workItemsRes, approvalsRes]) {
    if (result.error) throw new Error(result.error.message)
  }

  return buildAgentOrgBoardSnapshotFromRows({
    runs: (runsRes.data ?? []) as AgentRunRow[],
    events: (eventsRes.data ?? []) as AgentRunEventRow[],
    workItems: (workItemsRes.data ?? []) as AgentWorkItemRow[],
    approvals: (approvalsRes.data ?? []) as ApprovalRow[],
  })
}
