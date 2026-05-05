import { actionRequiresApproval, type AgentAction } from '@/lib/agent-policy'
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

type ClientProjectRow = {
  id: string
  project_name: string
  client_name: string
  project_status: string
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

type SwarmBoardBuildInput = {
  projects: ClientProjectRow[]
  roadmaps: RoadmapRow[]
  tasks: RoadmapTaskRow[]
  reports: RoadmapReportRow[]
  runs: AgentRunRow[]
  approvals: ApprovalRow[]
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
      return { key: 'research-source-register', label: 'Research & Source Register Agent' }
    case 'decision_packet':
      return { key: 'technology-evaluator', label: 'Technology Evaluator' }
    case 'provisioning_plan':
      return { key: 'automation-systems', label: 'Automation Systems Agent' }
    case 'build_configure':
      return { key: 'engineering-copilot', label: 'Engineering Copilot Agent' }
    case 'qa_isolation':
      return { key: 'engineering-copilot', label: 'QA & Isolation Agent' }
    case 'waiting_approval':
      return { key: 'approval-steward', label: 'Approval Steward' }
    case 'blocked_escalated':
      return { key: 'chief-of-staff', label: 'Chief of Staff Agent' }
    case 'active_monitoring':
      return { key: 'chief-of-staff', label: 'Client Swarm Monitor' }
    default:
      return { key: 'chief-of-staff', label: 'Chief of Staff Agent' }
  }
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

  const cards = input.projects.map((project): SwarmBoardCard => {
    const roadmap = roadmapsByProject.get(project.id) ?? null
    const tasks = roadmap ? tasksByRoadmap.get(roadmap.id) ?? [] : []
    const reports = roadmap ? reportsByRoadmap.get(roadmap.id) ?? [] : []
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
    const agent = currentAgentForColumn(column)
    const latestRun = runs[0] ?? null
    const health = moduleHealth({ pendingApprovals, failedOrStaleRuns, isolationStatus, reports })

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
      riskLabel: pendingApprovals > 0 ? 'approval gated' : failedOrStaleRuns > 0 ? 'triage required' : 'read-only handoff safe',
      approvalState: pendingApprovals > 0 ? 'pending' : column === 'waiting_approval' ? 'required' : 'none',
      isolationStatus,
      moduleHealth: health,
      latestRunId: latestRun?.id ?? null,
      latestRunStatus: latestRun?.status ?? null,
      failedOrStaleRuns,
      pendingApprovals,
      activeRuns: activeRuns.length,
      roadmapStatus: roadmap?.status ?? null,
      dueDate: openTasks.find((task) => task.due_date)?.due_date ?? project.estimated_end_date,
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

export async function buildAgentSwarmBoardSnapshot(): Promise<AgentSwarmBoardSnapshot> {
  if (!supabaseAdmin) throw new Error('Database not available')
  const db = supabaseAdmin

  const [projectsRes, roadmapsRes, tasksRes, reportsRes, runsRes, approvalsRes] = await Promise.all([
    db
      .from('client_projects')
      .select('id, project_name, client_name, project_status, estimated_end_date, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
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

  for (const result of [projectsRes, roadmapsRes, tasksRes, reportsRes, runsRes, approvalsRes]) {
    if (result.error) throw new Error(result.error.message)
  }

  return buildAgentSwarmBoardSnapshotFromRows({
    projects: (projectsRes.data ?? []) as ClientProjectRow[],
    roadmaps: (roadmapsRes.data ?? []) as RoadmapRow[],
    tasks: (tasksRes.data ?? []) as RoadmapTaskRow[],
    reports: (reportsRes.data ?? []) as RoadmapReportRow[],
    runs: (runsRes.data ?? []) as AgentRunRow[],
    approvals: (approvalsRes.data ?? []) as ApprovalRow[],
  })
}
