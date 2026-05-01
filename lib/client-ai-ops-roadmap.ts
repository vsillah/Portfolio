import { createHash } from 'node:crypto'

export const ROADMAP_PHASES = [
  'discovery_ownership',
  'infrastructure_access',
  'data_ai_foundation',
  'agent_automation_deployment',
  'launch_reporting_continuity',
] as const

export type RoadmapPhaseKey = (typeof ROADMAP_PHASES)[number]
export type RoadmapStatus = 'draft' | 'proposed' | 'approved' | 'active' | 'completed' | 'paused' | 'cancelled'
export type RoadmapTaskStatus = 'pending' | 'in_progress' | 'complete' | 'blocked' | 'cancelled'
export type RoadmapPhaseStatus = RoadmapTaskStatus | 'skipped'
export type RoadmapTaskOwner = 'client' | 'amadutown' | 'shared'
export type RoadmapPriority = 'high' | 'medium' | 'low'
export type RoadmapCostType = 'one_time' | 'monthly' | 'usage_based' | 'quote_required'
export type RoadmapCostPayer = 'client' | 'amadutown' | 'shared'
export type RoadmapPricingState = 'fresh' | 'needs_review' | 'stale' | 'quote_required' | 'source_unavailable'
export type RoadmapCostCategory =
  | 'hardware'
  | 'saas'
  | 'access_security'
  | 'ai_runtime'
  | 'automation'
  | 'monitoring'
  | 'backup'
  | 'implementation_labor'
  | 'optional_upgrade'
  | 'other'

export interface RoadmapContext {
  clientName?: string | null
  clientCompany?: string | null
  projectName?: string | null
  proposalId?: string | null
  clientProjectId?: string | null
  contactSubmissionId?: number | null
  stackSignals?: string[]
  implementationRequirements?: Record<string, unknown> | null
}

export interface RoadmapPhaseDraft {
  phaseKey: RoadmapPhaseKey
  phaseOrder: number
  title: string
  objective: string
  status: RoadmapPhaseStatus
  acceptanceCriteria: string[]
}

export interface RoadmapTaskDraft {
  taskKey: string
  phaseKey: RoadmapPhaseKey
  title: string
  description: string
  ownerType: RoadmapTaskOwner
  priority: RoadmapPriority
  status: RoadmapTaskStatus
  clientVisible: boolean
  meetingTaskVisible: boolean
  costCategory?: RoadmapCostCategory
  estimatedCost: number
  acceptanceCriteria: string
}

export interface RoadmapCostItemDraft {
  key: string
  phaseKey: RoadmapPhaseKey
  taskKey?: string
  category: RoadmapCostCategory
  label: string
  description: string
  payer: RoadmapCostPayer
  costType: RoadmapCostType
  amount: number | null
  pricingState: RoadmapPricingState
  sourceUrl?: string
  notes?: string
}

export interface RoadmapDraft {
  title: string
  clientSummary: string
  inputHash: string
  phases: RoadmapPhaseDraft[]
  tasks: RoadmapTaskDraft[]
  costItems: RoadmapCostItemDraft[]
}

export interface RoadmapCostRollup {
  oneTimeClientOwned: number
  monthlyClientOwned: number
  amadutownSetup: number
  quoteRequiredCount: number
  byCategory: Record<string, number>
}

export interface RoadmapClientPhase {
  id?: string
  title: string
  objective: string
  status: RoadmapPhaseStatus
  phaseOrder: number
  acceptanceCriteria: string[]
  tasksTotal: number
  tasksComplete: number
  estimatedClientStartupCost: number
  estimatedMonthlyOperatingCost: number
}

export interface RoadmapClientView {
  title: string
  status: RoadmapStatus
  clientSummary: string | null
  phases: RoadmapClientPhase[]
  costSummary: RoadmapCostRollup
  nextActions: Array<{ title: string; ownerType: RoadmapTaskOwner; priority: RoadmapPriority; dueDate: string | null }>
}

const DEFAULT_PHASES: RoadmapPhaseDraft[] = [
  {
    phaseKey: 'discovery_ownership',
    phaseOrder: 1,
    title: 'Discovery and ownership setup',
    objective: 'Confirm client-owned accounts, credential vault, admin roles, data map, and approval boundaries.',
    status: 'pending',
    acceptanceCriteria: ['Client-owned account plan confirmed', 'Credential intake path approved', 'Data ownership map drafted'],
  },
  {
    phaseKey: 'infrastructure_access',
    phaseOrder: 2,
    title: 'Infrastructure and access',
    objective: 'Configure the local or hybrid node, secure remote access, backups, and monitoring baseline.',
    status: 'pending',
    acceptanceCriteria: ['Node path selected', 'Remote access gated by named accounts', 'Backup and monitoring baseline recorded'],
  },
  {
    phaseKey: 'data_ai_foundation',
    phaseOrder: 3,
    title: 'Data and AI foundation',
    objective: 'Connect approved data sources, permissions, indexing, and AI/model routing.',
    status: 'pending',
    acceptanceCriteria: ['Approved data sources mapped', 'Permission groups documented', 'Test retrieval passes without unauthorized data'],
  },
  {
    phaseKey: 'agent_automation_deployment',
    phaseOrder: 4,
    title: 'Agent and automation deployment',
    objective: 'Deploy approved agents, workflows, tool access, and human approval gates.',
    status: 'pending',
    acceptanceCriteria: ['Agent registry entries created', 'Approval gates tested', 'Workflow validation run completed'],
  },
  {
    phaseKey: 'launch_reporting_continuity',
    phaseOrder: 5,
    title: 'Launch, reporting, and continuity',
    objective: 'Hand off the system, start health reporting, and schedule ongoing bake-off reviews.',
    status: 'pending',
    acceptanceCriteria: ['Client handoff complete', 'First health report generated', 'Continuity cadence agreed'],
  },
]

const DEFAULT_TASKS: RoadmapTaskDraft[] = [
  task('client-vault', 'discovery_ownership', 'Create client-owned password vault', 'Client creates the shared vault and invites named AmaduTown maintainer access.', 'client', 'high', true, true, 'access_security', 0, 'Vault exists and access is named, logged, and revocable.'),
  task('ownership-map', 'discovery_ownership', 'Confirm ownership and access map', 'Document who owns accounts, data, hardware, logs, and approval decisions.', 'shared', 'high', true, true, 'other', 0, 'Ownership map is visible in project record.'),
  task('hardware-decision', 'infrastructure_access', 'Select local node or cloud fallback', 'Choose Mac mini, mini PC, existing hardware, or cloud fallback based on stack and budget.', 'shared', 'high', true, true, 'hardware', 1200, 'Selected path has expected startup and monthly costs.'),
  task('secure-remote-access', 'infrastructure_access', 'Configure secure remote access', 'Set up private access for maintenance without exposing admin surfaces publicly.', 'amadutown', 'high', false, true, 'access_security', 20, 'Maintainer access works through named account and MFA.'),
  task('backup-monitoring', 'infrastructure_access', 'Set backup and monitoring baseline', 'Configure backup status and core health checks for the selected infrastructure path.', 'amadutown', 'medium', true, true, 'backup', 150, 'Backup and health check status are visible in roadmap report.'),
  task('data-source-map', 'data_ai_foundation', 'Map approved data sources and permissions', 'Identify documents, databases, tools, and user groups the AI system may access.', 'shared', 'high', true, true, 'other', 0, 'Approved and forbidden data sources are documented.'),
  task('ai-runtime-selection', 'data_ai_foundation', 'Select AI/runtime path', 'Choose embedded platform AI, workflow agent, hosted model, or local runtime path.', 'amadutown', 'medium', true, true, 'ai_runtime', 50, 'Runtime choice includes cost, governance, and fallback notes.'),
  task('agent-registry', 'agent_automation_deployment', 'Register deployed agents and approval gates', 'Define each agent job, tools, data access, forbidden actions, and approvals.', 'amadutown', 'high', true, true, 'automation', 0, 'Each deployed agent has registry and approval policy records.'),
  task('workflow-validation', 'agent_automation_deployment', 'Run workflow and agent validation', 'Validate happy path, failed tool calls, escalation behavior, and client-visible outputs.', 'amadutown', 'high', false, true, 'monitoring', 0, 'Validation run is recorded with pass/fail status.'),
  task('handoff-training', 'launch_reporting_continuity', 'Complete client handoff and training', 'Walk through ownership, access, dashboard, approvals, and support cadence.', 'shared', 'medium', true, true, 'implementation_labor', 0, 'Client knows how to view status and request changes.'),
  task('monthly-reporting', 'launch_reporting_continuity', 'Start monthly health reporting', 'Generate the first roadmap report with progress, costs, blockers, monitoring, and recommendations.', 'amadutown', 'medium', true, true, 'monitoring', 0, 'First report is generated and linked to project.'),
]

const DEFAULT_COST_ITEMS: RoadmapCostItemDraft[] = [
  cost('local-node', 'infrastructure_access', 'hardware', 'Local AI operations node', 'Mac mini, mini PC, or equivalent client-owned always-on device.', 'client', 'one_time', 1200, 'needs_review'),
  cost('remote-access', 'infrastructure_access', 'access_security', 'Secure remote access', 'Private access layer for maintenance and support.', 'client', 'monthly', 20, 'needs_review'),
  cost('credential-vault', 'discovery_ownership', 'access_security', 'Password vault', 'Client-owned credential vault for setup and maintenance access.', 'client', 'monthly', 25, 'needs_review'),
  cost('backup', 'infrastructure_access', 'backup', 'Backup storage', 'Encrypted backup drive, NAS allocation, or cloud backup path.', 'client', 'one_time', 150, 'needs_review'),
  cost('ai-runtime', 'data_ai_foundation', 'ai_runtime', 'AI/runtime usage', 'Model, API, local runtime, or embedded AI subscription costs.', 'client', 'monthly', 50, 'needs_review'),
  cost('automation', 'agent_automation_deployment', 'automation', 'Workflow automation tooling', 'n8n, workflow runtime, connectors, or equivalent automation layer.', 'client', 'monthly', 30, 'needs_review'),
]

function task(
  taskKey: string,
  phaseKey: RoadmapPhaseKey,
  title: string,
  description: string,
  ownerType: RoadmapTaskOwner,
  priority: RoadmapPriority,
  clientVisible: boolean,
  meetingTaskVisible: boolean,
  costCategory: RoadmapCostCategory,
  estimatedCost: number,
  acceptanceCriteria: string,
): RoadmapTaskDraft {
  return {
    taskKey,
    phaseKey,
    title,
    description,
    ownerType,
    priority,
    status: 'pending',
    clientVisible,
    meetingTaskVisible,
    costCategory,
    estimatedCost,
    acceptanceCriteria,
  }
}

function cost(
  key: string,
  phaseKey: RoadmapPhaseKey,
  category: RoadmapCostCategory,
  label: string,
  description: string,
  payer: RoadmapCostPayer,
  costType: RoadmapCostType,
  amount: number | null,
  pricingState: RoadmapPricingState,
): RoadmapCostItemDraft {
  return { key, phaseKey, category, label, description, payer, costType, amount, pricingState }
}

function hashContext(context: RoadmapContext): string {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex').slice(0, 16)
}

export function buildDefaultClientAiOpsRoadmap(context: RoadmapContext = {}): RoadmapDraft {
  const name = context.clientCompany || context.clientName || 'Client'
  return {
    title: `${name} AI Ops Roadmap`,
    clientSummary:
      'A phased implementation plan for client-owned AI infrastructure, transparent setup costs, agent deployment, monitoring, and continuity reporting.',
    inputHash: hashContext(context),
    phases: DEFAULT_PHASES.map((phase) => ({ ...phase, acceptanceCriteria: [...phase.acceptanceCriteria] })),
    tasks: DEFAULT_TASKS.map((t) => ({ ...t })),
    costItems: DEFAULT_COST_ITEMS.map((item) => ({ ...item })),
  }
}

export function rollUpRoadmapCosts(costItems: Array<Pick<RoadmapCostItemDraft, 'payer' | 'costType' | 'amount' | 'category'>>): RoadmapCostRollup {
  const out: RoadmapCostRollup = {
    oneTimeClientOwned: 0,
    monthlyClientOwned: 0,
    amadutownSetup: 0,
    quoteRequiredCount: 0,
    byCategory: {},
  }

  for (const item of costItems) {
    const amount = Number(item.amount ?? 0)
    out.byCategory[item.category] = Number(((out.byCategory[item.category] ?? 0) + amount).toFixed(2))
    if (item.costType === 'quote_required') out.quoteRequiredCount += 1
    if (item.payer === 'client' && item.costType === 'one_time') out.oneTimeClientOwned += amount
    if (item.payer === 'client' && item.costType === 'monthly') out.monthlyClientOwned += amount
    if (item.payer === 'amadutown' && item.costType === 'one_time') out.amadutownSetup += amount
  }

  out.oneTimeClientOwned = Number(out.oneTimeClientOwned.toFixed(2))
  out.monthlyClientOwned = Number(out.monthlyClientOwned.toFixed(2))
  out.amadutownSetup = Number(out.amadutownSetup.toFixed(2))
  return out
}

export function dashboardStatusFromRoadmap(status: RoadmapTaskStatus): 'pending' | 'in_progress' | 'complete' {
  if (status === 'complete') return 'complete'
  if (status === 'blocked') return 'in_progress'
  return status === 'cancelled' ? 'pending' : status
}

export function meetingTaskStatusFromRoadmap(status: RoadmapTaskStatus): 'pending' | 'in_progress' | 'complete' | 'cancelled' {
  if (status === 'blocked') return 'in_progress'
  return status
}

export function roadmapStatusFromProjectedTask(status: string): RoadmapTaskStatus {
  if (status === 'complete') return 'complete'
  if (status === 'in_progress') return 'in_progress'
  if (status === 'cancelled') return 'cancelled'
  return 'pending'
}

export function buildProposalRoadmapSnapshot(context: RoadmapContext = {}): RoadmapDraft & { costSummary: RoadmapCostRollup } {
  const draft = buildDefaultClientAiOpsRoadmap(context)
  return { ...draft, costSummary: rollUpRoadmapCosts(draft.costItems) }
}

export function buildClientRoadmapView(input: {
  roadmap: { title: string; status: RoadmapStatus; client_summary: string | null }
  phases: Array<{
    id?: string
    title: string
    objective: string
    status: RoadmapPhaseStatus
    phase_order: number
    acceptance_criteria?: string[] | null
    estimated_client_startup_cost?: number | string | null
    estimated_monthly_operating_cost?: number | string | null
  }>
  tasks: Array<{ phase_id: string; title: string; owner_type: RoadmapTaskOwner; priority: RoadmapPriority; status: RoadmapTaskStatus; due_date: string | null; client_visible: boolean }>
  costItems: Array<Pick<RoadmapCostItemDraft, 'payer' | 'costType' | 'amount' | 'category'>>
}): RoadmapClientView {
  const visibleTasks = input.tasks.filter((task) => task.client_visible)
  const phases = input.phases.map((phase) => {
    const phaseTasks = visibleTasks.filter((task) => task.phase_id === phase.id)
    return {
      id: phase.id,
      title: phase.title,
      objective: phase.objective,
      status: phase.status,
      phaseOrder: phase.phase_order,
      acceptanceCriteria: Array.isArray(phase.acceptance_criteria) ? phase.acceptance_criteria : [],
      tasksTotal: phaseTasks.length,
      tasksComplete: phaseTasks.filter((task) => task.status === 'complete').length,
      estimatedClientStartupCost: Number(phase.estimated_client_startup_cost ?? 0),
      estimatedMonthlyOperatingCost: Number(phase.estimated_monthly_operating_cost ?? 0),
    }
  })

  return {
    title: input.roadmap.title,
    status: input.roadmap.status,
    clientSummary: input.roadmap.client_summary,
    phases,
    costSummary: rollUpRoadmapCosts(input.costItems),
    nextActions: visibleTasks
      .filter((task) => task.status !== 'complete' && task.status !== 'cancelled')
      .slice(0, 5)
      .map((task) => ({
        title: task.title,
        ownerType: task.owner_type,
        priority: task.priority,
        dueDate: task.due_date,
      })),
  }
}
