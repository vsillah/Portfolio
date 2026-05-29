import { createHash } from 'node:crypto'
import type { AgentReadinessAssessment, AgentReadinessLevel } from './agent-readiness-assessment'
import type { SwarmBoardColumnKey, SwarmHandoffStage } from './agent-swarm-board'
import {
  buildClientConnectorReadiness,
  type BuildClientConnectorReadinessInput,
  type ClientConnectorAuditSignal,
  type ClientConnectorReadiness,
} from './client-connector-readiness'

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
  productPurchased?: string | null
  proposalId?: string | null
  clientProjectId?: string | null
  contactSubmissionId?: number | null
  stackSignals?: string[]
  verifiedStack?: Record<string, unknown> | null
  builtWithStack?: Record<string, unknown> | null
  auditSignals?: ClientConnectorAuditSignal[]
  implementationRequirements?: Record<string, unknown> | null
}

export type RoadmapServiceProfileKey = 'open_brain_companion_app'

export interface RoadmapServiceProfile {
  key: RoadmapServiceProfileKey
  label: string
  componentLabel: string
  clientOwner: string | null
  deliveryModel: 'white_label_client_ai_ops'
  canonicalSource: string
  portfolioRole: string
  reusablePattern: string
  status: 'staging_ready' | 'needs_client_setup' | 'active'
  connectorSignals: string[]
  approvalGates: string[]
}

export type RoadmapRuntimePlacementKey = 'client_local_node' | 'cloud_runtime' | 'hybrid_local_cloud'

export interface RoadmapRuntimePlacementOption {
  key: RoadmapRuntimePlacementKey
  label: string
  description: string
  alwaysOn: boolean
  dataResidence: 'client_device' | 'cloud' | 'hybrid'
  approvalNote: string
}

export interface RoadmapPhaseDraft {
  phaseKey: RoadmapPhaseKey
  phaseOrder: number
  title: string
  objective: string
  status: RoadmapPhaseStatus
  acceptanceCriteria: string[]
}

export type RoadmapOrgBoardProjection = {
  column: SwarmBoardColumnKey
  stage: SwarmHandoffStage
  ownerAgentKey: string
  ownerAgentLabel: string
  approvalPosture: 'none' | 'required' | 'pending'
  isolationRequired: boolean
  clientVisibleLabel?: string
  internalHandoffLabel?: string
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
  orgBoard?: RoadmapOrgBoardProjection
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
  serviceProfile: RoadmapServiceProfile | null
  runtimePlacementOptions: RoadmapRuntimePlacementOption[]
  connectorReadiness: ClientConnectorReadiness
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

export interface RoadmapClientReportSummary {
  title: string
  reportType: string
  status: string
  generatedAt: string | null
  summary: string | null
  clientActions: string[]
  amadutownActionsCount: number
  approvalNeededCount: number
  monitoringSummary: {
    overdueTasks?: number
    staleCostItems?: number
    reportMissing?: boolean
    checkedAt?: string | null
  } | null
}

export interface RoadmapClientProjectionStatus {
  tasksTotal: number
  tasksComplete: number
  blockedTasks: number
  clientActionCount: number
  amadutownActionCount: number
  sharedActionCount: number
  approvalNeededCount: number
  isolationRequiredCount: number
  overdueTasks: number
  staleCostItems: number
  reportMissing: boolean
  nextReportingAction: string
}

export interface RoadmapClientView {
  title: string
  status: RoadmapStatus
  clientSummary: string | null
  serviceProfile: RoadmapServiceProfile | null
  runtimePlacementOptions: RoadmapRuntimePlacementOption[]
  connectorReadiness: ClientConnectorReadiness
  phases: RoadmapClientPhase[]
  costSummary: RoadmapCostRollup
  projectionStatus: RoadmapClientProjectionStatus
  nextActions: Array<{ title: string; ownerType: RoadmapTaskOwner; priority: RoadmapPriority; dueDate: string | null }>
  latestReport: RoadmapClientReportSummary | null
}

export const DEFAULT_RUNTIME_PLACEMENT_OPTIONS: RoadmapRuntimePlacementOption[] = [
  {
    key: 'client_local_node',
    label: 'Client-owned local node',
    description: 'Run the data store, local LLM repository, or automation worker on a client-owned Mac mini, mini PC, or equivalent always-on device.',
    alwaysOn: true,
    dataResidence: 'client_device',
    approvalNote: 'Requires client-owned hardware, named remote access, backup, monitoring, and approval before production runtime changes.',
  },
  {
    key: 'cloud_runtime',
    label: 'Cloud runtime host',
    description: 'Run the data store, local model fallback, or agent worker in a cloud environment for 24/7 access when client hardware is not practical.',
    alwaysOn: true,
    dataResidence: 'cloud',
    approvalNote: 'Requires provider, region, cost owner, credential boundary, and deployment approval before provisioning.',
  },
  {
    key: 'hybrid_local_cloud',
    label: 'Hybrid local plus cloud fallback',
    description: 'Keep sensitive data or local models on a client-owned node while using cloud hosting for uptime, failover, or remote access.',
    alwaysOn: true,
    dataResidence: 'hybrid',
    approvalNote: 'Requires a clear split between local data, cloud services, backups, monitoring, and failover approval.',
  },
]

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
    objective: 'Choose where the data and local LLM repository will live, then configure the local device, cloud runtime, or hybrid fallback for 24/7 access.',
    status: 'pending',
    acceptanceCriteria: ['Runtime placement selected', 'Remote access gated by named accounts', 'Backup and monitoring baseline recorded'],
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

const ORG_BOARD_PROJECTIONS: Record<string, RoadmapOrgBoardProjection> = {
  'client-vault': {
    column: 'discovery',
    stage: 'discovery',
    ownerAgentKey: 'chief-of-staff',
    ownerAgentLabel: 'Shaka (Zulu) - Chief of Staff',
    approvalPosture: 'required',
    isolationRequired: false,
    clientVisibleLabel: 'Set up controlled access',
    internalHandoffLabel: 'Confirm vault ownership and named maintainer access before any credential handling.',
  },
  'ownership-map': {
    column: 'discovery',
    stage: 'discovery',
    ownerAgentKey: 'research-source-register',
    ownerAgentLabel: 'Askia Muhammad (Songhai) - Research Source Register',
    approvalPosture: 'none',
    isolationRequired: false,
    clientVisibleLabel: 'Confirm ownership map',
    internalHandoffLabel: 'Document account, data, and approval ownership before build work.',
  },
  'hardware-decision': {
    column: 'decision_packet',
    stage: 'technology_decision',
    ownerAgentKey: 'technology-evaluator',
    ownerAgentLabel: 'Imhotep (Kemet) - Technology Evaluator',
    approvalPosture: 'none',
    isolationRequired: false,
    clientVisibleLabel: 'Choose runtime placement',
    internalHandoffLabel: 'Prepare local, cloud, or hybrid runtime decision packet.',
  },
  'secure-remote-access': {
    column: 'provisioning_plan',
    stage: 'provisioning_plan',
    ownerAgentKey: 'automation-systems',
    ownerAgentLabel: 'Yaa Asantewaa (Ashanti) - Automation Systems',
    approvalPosture: 'required',
    isolationRequired: true,
    clientVisibleLabel: 'Configure secure access',
    internalHandoffLabel: 'Prepare remote access provisioning packet behind approval.',
  },
  'backup-monitoring': {
    column: 'provisioning_plan',
    stage: 'provisioning_plan',
    ownerAgentKey: 'automation-systems',
    ownerAgentLabel: 'Yaa Asantewaa (Ashanti) - Automation Systems',
    approvalPosture: 'none',
    isolationRequired: true,
    clientVisibleLabel: 'Set monitoring baseline',
    internalHandoffLabel: 'Create backup and health-check provisioning plan.',
  },
  'data-source-map': {
    column: 'discovery',
    stage: 'discovery',
    ownerAgentKey: 'research-source-register',
    ownerAgentLabel: 'Askia Muhammad (Songhai) - Research Source Register',
    approvalPosture: 'none',
    isolationRequired: false,
    clientVisibleLabel: 'Map approved sources',
    internalHandoffLabel: 'Classify approved and forbidden data sources.',
  },
  'ai-runtime-selection': {
    column: 'decision_packet',
    stage: 'technology_decision',
    ownerAgentKey: 'technology-evaluator',
    ownerAgentLabel: 'Imhotep (Kemet) - Technology Evaluator',
    approvalPosture: 'none',
    isolationRequired: false,
    clientVisibleLabel: 'Select AI runtime',
    internalHandoffLabel: 'Prepare model/runtime decision packet with cost and governance notes.',
  },
  'agent-registry': {
    column: 'build_configure',
    stage: 'build_configure',
    ownerAgentKey: 'automation-systems',
    ownerAgentLabel: 'Yaa Asantewaa (Ashanti) - Automation Systems',
    approvalPosture: 'required',
    isolationRequired: true,
    clientVisibleLabel: 'Register approved agents',
    internalHandoffLabel: 'Create registry and policy records after approval gates are clear.',
  },
  'workflow-validation': {
    column: 'qa_isolation',
    stage: 'qa_isolation',
    ownerAgentKey: 'engineering-copilot',
    ownerAgentLabel: 'Piye (Kush) - Engineering Copilot',
    approvalPosture: 'none',
    isolationRequired: true,
    clientVisibleLabel: 'Validate workflows',
    internalHandoffLabel: 'Run synthetic validation and escalation behavior checks.',
  },
  'handoff-training': {
    column: 'active_monitoring',
    stage: 'reporting',
    ownerAgentKey: 'chief-of-staff',
    ownerAgentLabel: 'Shaka (Zulu) - Chief of Staff',
    approvalPosture: 'none',
    isolationRequired: false,
    clientVisibleLabel: 'Complete handoff',
    internalHandoffLabel: 'Prepare handoff and support cadence summary.',
  },
  'monthly-reporting': {
    column: 'active_monitoring',
    stage: 'reporting',
    ownerAgentKey: 'chief-of-staff',
    ownerAgentLabel: 'Shaka (Zulu) - Chief of Staff',
    approvalPosture: 'none',
    isolationRequired: false,
    clientVisibleLabel: 'Start health reporting',
    internalHandoffLabel: 'Generate first monitored roadmap report.',
  },
  'open-brain-source-crosswalk': {
    column: 'discovery',
    stage: 'discovery',
    ownerAgentKey: 'research-source-register',
    ownerAgentLabel: 'Askia Muhammad (Songhai) - Research Source Register',
    approvalPosture: 'none',
    isolationRequired: false,
    clientVisibleLabel: 'Map Open Brain sources',
    internalHandoffLabel: 'Create source/event crosswalk from staging records into client-owned Open Brain records.',
  },
  'protected-companion-app': {
    column: 'provisioning_plan',
    stage: 'provisioning_plan',
    ownerAgentKey: 'engineering-copilot',
    ownerAgentLabel: 'Piye (Kush) - Engineering Copilot',
    approvalPosture: 'required',
    isolationRequired: true,
    clientVisibleLabel: 'Prepare protected app',
    internalHandoffLabel: 'Keep deployment protected until SSO, DNS, emergency disable, and data ownership are approved.',
  },
  'crm-readonly-context': {
    column: 'decision_packet',
    stage: 'technology_decision',
    ownerAgentKey: 'technology-evaluator',
    ownerAgentLabel: 'Imhotep (Kemet) - Technology Evaluator',
    approvalPosture: 'required',
    isolationRequired: true,
    clientVisibleLabel: 'Review CRM context path',
    internalHandoffLabel: 'Confirm CRM access method and keep writeback disabled until field mapping and approval gates pass.',
  },
  'portfolio-client-projection': {
    column: 'active_monitoring',
    stage: 'reporting',
    ownerAgentKey: 'chief-of-staff',
    ownerAgentLabel: 'Shaka (Zulu) - Chief of Staff',
    approvalPosture: 'none',
    isolationRequired: false,
    clientVisibleLabel: 'Show Portfolio status',
    internalHandoffLabel: 'Project approved, client-safe status into Portfolio while the client Open Brain remains canonical.',
  },
}

const DEFAULT_TASKS: RoadmapTaskDraft[] = [
  task('client-vault', 'discovery_ownership', 'Create client-owned password vault', 'Client creates the shared vault and invites named AmaduTown maintainer access.', 'client', 'high', true, true, 'access_security', 0, 'Vault exists and access is named, logged, and revocable.'),
  task('ownership-map', 'discovery_ownership', 'Confirm ownership and access map', 'Document who owns accounts, data, hardware, logs, and approval decisions.', 'shared', 'high', true, true, 'other', 0, 'Ownership map is visible in project record.'),
  task('hardware-decision', 'infrastructure_access', 'Select data and local LLM repository placement', 'Choose whether the client data store, local LLM repository, or automation worker runs on a Mac mini, mini PC, cloud runtime, or hybrid local/cloud path for 24/7 access.', 'shared', 'high', true, true, 'hardware', 1200, 'Selected path has expected startup, monthly, backup, monitoring, and approval requirements.'),
  task('secure-remote-access', 'infrastructure_access', 'Configure secure remote access', 'Set up private access for maintenance without exposing admin surfaces publicly.', 'amadutown', 'high', false, true, 'access_security', 20, 'Maintainer access works through named account and MFA.'),
  task('backup-monitoring', 'infrastructure_access', 'Set backup and monitoring baseline', 'Configure backup status and core health checks for the selected infrastructure path.', 'amadutown', 'medium', true, true, 'backup', 150, 'Backup and health check status are visible in roadmap report.'),
  task('data-source-map', 'data_ai_foundation', 'Map approved data sources and permissions', 'Identify documents, databases, tools, and user groups the AI system may access.', 'shared', 'high', true, true, 'other', 0, 'Approved and forbidden data sources are documented.'),
  task('ai-runtime-selection', 'data_ai_foundation', 'Select AI/runtime path', 'Choose embedded platform AI, workflow agent, hosted model, or local runtime path.', 'amadutown', 'medium', true, true, 'ai_runtime', 50, 'Runtime choice includes cost, governance, and fallback notes.'),
  task('agent-registry', 'agent_automation_deployment', 'Register deployed agents and approval gates', 'Define each agent job, tools, data access, forbidden actions, and approvals.', 'amadutown', 'high', true, true, 'automation', 0, 'Each deployed agent has registry and approval policy records.'),
  task('workflow-validation', 'agent_automation_deployment', 'Run workflow and agent validation', 'Validate happy path, failed tool calls, escalation behavior, and client-visible outputs.', 'amadutown', 'high', false, true, 'monitoring', 0, 'Validation run is recorded with pass/fail status.'),
  task('handoff-training', 'launch_reporting_continuity', 'Complete client handoff and training', 'Walk through ownership, access, dashboard, approvals, and support cadence.', 'shared', 'medium', true, true, 'implementation_labor', 0, 'Client knows how to view status and request changes.'),
  task('monthly-reporting', 'launch_reporting_continuity', 'Start monthly health reporting', 'Generate the first roadmap report with progress, costs, blockers, monitoring, and recommendations.', 'amadutown', 'medium', true, true, 'monitoring', 0, 'First report is generated and linked to project.'),
]

const OPEN_BRAIN_TASKS: RoadmapTaskDraft[] = [
  task('open-brain-source-crosswalk', 'data_ai_foundation', 'Create client-owned Open Brain source crosswalk', 'Map staging source IDs into the client-owned Open Brain so Gmail, Drive, CRM, automation, and derived summaries stay separated.', 'shared', 'high', true, true, 'other', 0, 'Source, event, memory, proposal, approval, workflow, and audit records have client-owned IDs and privacy classes.'),
  task('protected-companion-app', 'infrastructure_access', 'Stand up protected Open Brain companion app', 'Prepare the private app surface, protected deployment posture, and client-owned data-plane decision before any public or staff-facing launch.', 'amadutown', 'high', true, true, 'access_security', 0, 'Private repo, protected preview, auth plan, data-plane decision, and emergency disable owner are recorded.'),
  task('crm-readonly-context', 'data_ai_foundation', 'Add CRM context as read-only relationship signals', 'Bring supporter, donor, campaign, activity, and note context into review packets without allowing CRM mutation in v1.', 'shared', 'high', true, true, 'saas', 0, 'CRM context is represented as source-backed relationship signals with writeback blocked.'),
  task('portfolio-client-projection', 'launch_reporting_continuity', 'Project approved status into Portfolio client dashboard', 'Show the client-safe roadmap, approvals, connector readiness, and next actions in Portfolio while the client Open Brain remains the source of truth.', 'amadutown', 'high', true, true, 'monitoring', 0, 'Portfolio dashboard displays the linked service profile and open action counts without exposing raw client material.'),
]

const DEFAULT_COST_ITEMS: RoadmapCostItemDraft[] = [
  cost('local-node', 'infrastructure_access', 'hardware', 'Client-owned local runtime node', 'Mac mini, mini PC, or equivalent always-on device for local data, local LLM repository, or automation workers.', 'client', 'one_time', 1200, 'needs_review'),
  cost('cloud-runtime-host', 'infrastructure_access', 'ai_runtime', 'Cloud runtime host or fallback', 'Cloud host for 24/7 access when client-owned hardware is not practical or when hybrid failover is needed.', 'client', 'monthly', 75, 'needs_review'),
  cost('remote-access', 'infrastructure_access', 'access_security', 'Secure remote access', 'Private access layer for maintenance and support.', 'client', 'monthly', 20, 'needs_review'),
  cost('credential-vault', 'discovery_ownership', 'access_security', 'Password vault', 'Client-owned credential vault for setup and maintenance access.', 'client', 'monthly', 25, 'needs_review'),
  cost('backup', 'infrastructure_access', 'backup', 'Runtime and repository backup', 'Encrypted backup drive, NAS allocation, or cloud backup path for the selected data/local LLM repository placement.', 'client', 'one_time', 150, 'needs_review'),
  cost('ai-runtime', 'data_ai_foundation', 'ai_runtime', 'AI/runtime usage', 'Model, API, local runtime, or embedded AI subscription costs.', 'client', 'monthly', 50, 'needs_review'),
  cost('automation', 'agent_automation_deployment', 'automation', 'Workflow automation tooling', 'n8n, workflow runtime, connectors, or equivalent automation layer.', 'client', 'monthly', 30, 'needs_review'),
]

const OPEN_BRAIN_COST_ITEMS: RoadmapCostItemDraft[] = [
  cost('protected-app-hosting', 'infrastructure_access', 'ai_runtime', 'Protected companion app hosting', 'Vercel, Cloudflare, or equivalent protected hosting for the private client app surface after access controls are approved.', 'client', 'monthly', 20, 'quote_required'),
  cost('open-brain-data-plane', 'data_ai_foundation', 'saas', 'Open Brain data plane', 'Supabase, Postgres, or approved client-owned database for source, event, relationship, proposal, approval, workflow, and audit records.', 'client', 'monthly', 25, 'quote_required'),
  cost('crm-context-intake', 'data_ai_foundation', 'implementation_labor', 'CRM read-only context intake', 'Field mapping, export/API review, and read-only relationship-signal normalization for the client CRM.', 'amadutown', 'one_time', null, 'quote_required'),
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
    orgBoard: ORG_BOARD_PROJECTIONS[taskKey],
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

function getAgentReadinessAssessment(context: RoadmapContext): AgentReadinessAssessment | null {
  const maybeAssessment = context.implementationRequirements?.agentReadinessAssessment
    ?? context.implementationRequirements?.agent_readiness_assessment

  if (!maybeAssessment || typeof maybeAssessment !== 'object') return null

  const assessment = maybeAssessment as Partial<AgentReadinessAssessment>
  if (
    !assessment.overallLevel ||
    !assessment.clientSummary ||
    !assessment.roadmapRecommendation ||
    typeof assessment.contextReadinessScore !== 'number' ||
    typeof assessment.workflowReadinessScore !== 'number' ||
    typeof assessment.agentReadinessScore !== 'number'
  ) {
    return null
  }

  return assessment as AgentReadinessAssessment
}

function phaseAdjustmentsForReadiness(level: AgentReadinessLevel): Partial<Record<RoadmapPhaseKey, Pick<RoadmapPhaseDraft, 'objective' | 'acceptanceCriteria'>>> {
  switch (level) {
    case 'organize_first':
      return {
        discovery_ownership: {
          objective: 'Inventory messy sources, confirm owners, clean up access, and define the minimum structure needed before agent work.',
          acceptanceCriteria: ['Source inventory completed', 'System owners confirmed', 'Cleanup priorities approved'],
        },
        data_ai_foundation: {
          objective: 'Create the context and source map AI needs before workflow automation or autonomous actions are considered.',
          acceptanceCriteria: ['Context layer scope approved', 'Priority sources normalized', 'Access boundaries tested'],
        },
      }
    case 'context_layer_first':
      return {
        data_ai_foundation: {
          objective: 'Build a governed context layer across approved sources before changing workflow states.',
          acceptanceCriteria: ['Approved data sources mapped', 'Permission groups documented', 'Retrieval passes source attribution checks'],
        },
      }
    case 'workflow_copilot':
      return {
        agent_automation_deployment: {
          objective: 'Deploy workflow copilots that draft, recommend, and route work while people approve state changes.',
          acceptanceCriteria: ['Copilot scopes documented', 'Human approval paths tested', 'Workflow draft quality reviewed'],
        },
      }
    case 'approval_gated_agent':
      return {
        agent_automation_deployment: {
          objective: 'Deploy bounded agents with explicit approval gates for structured systems and higher-risk changes.',
          acceptanceCriteria: ['Agent action policy approved', 'Approval gates tested', 'Rollback procedure documented'],
        },
      }
    case 'bounded_autonomy':
      return {
        agent_automation_deployment: {
          objective: 'Deploy monitored agents for low-risk reversible actions while keeping sensitive actions approval-gated.',
          acceptanceCriteria: ['Autonomous action list approved', 'Monitoring alerts tested', 'Rollback procedure documented'],
        },
      }
  }
}

function contextText(context: RoadmapContext): string {
  return [
    context.clientName,
    context.clientCompany,
    context.projectName,
    context.productPurchased,
    ...(context.stackSignals ?? []),
  ].filter(Boolean).join(' ').toLowerCase()
}

function explicitServiceProfile(context: RoadmapContext): RoadmapServiceProfile | null {
  const maybeProfile = context.implementationRequirements?.serviceProfile
    ?? context.implementationRequirements?.service_profile
  if (!maybeProfile || typeof maybeProfile !== 'object') return null

  const profile = maybeProfile as Partial<RoadmapServiceProfile>
  if (
    profile.key === 'open_brain_companion_app' &&
    profile.label &&
    profile.componentLabel &&
    profile.canonicalSource &&
    profile.portfolioRole &&
    profile.reusablePattern
  ) {
    return {
      key: profile.key,
      label: profile.label,
      componentLabel: profile.componentLabel,
      clientOwner: profile.clientOwner ?? context.clientName ?? null,
      deliveryModel: 'white_label_client_ai_ops',
      canonicalSource: profile.canonicalSource,
      portfolioRole: profile.portfolioRole,
      reusablePattern: profile.reusablePattern,
      status: profile.status ?? 'needs_client_setup',
      connectorSignals: Array.isArray(profile.connectorSignals) ? profile.connectorSignals : [],
      approvalGates: Array.isArray(profile.approvalGates) ? profile.approvalGates : [],
    }
  }

  return null
}

function inferClientAiOpsServiceProfile(context: RoadmapContext): RoadmapServiceProfile | null {
  const explicit = explicitServiceProfile(context)
  if (explicit) return explicit

  const text = contextText(context)
  const isMentorRi = text.includes('mentorri') || text.includes('mentor ri') || text.includes('mentor rhode island') || text.includes('janine achen')
  const needsOpenBrain = isMentorRi || text.includes('open brain') || text.includes('client ai ops') || text.includes('white label') || text.includes('companion app')
  if (!needsOpenBrain) return null

  const clientCompany = context.clientCompany || (isMentorRi ? 'MentorRI' : 'Client')
  return {
    key: 'open_brain_companion_app',
    label: isMentorRi ? 'MentorRI Open Brain Console' : `${clientCompany} Open Brain Console`,
    componentLabel: 'Client AI Ops / white-label Open Brain',
    clientOwner: context.clientName ?? (isMentorRi ? 'Janine Achen' : null),
    deliveryModel: 'white_label_client_ai_ops',
    canonicalSource: isMentorRi
      ? 'MentorRI local Open Brain remains the source of truth.'
      : 'Client-owned Open Brain remains the source of truth.',
    portfolioRole: 'Portfolio projects approved status, connector readiness, and client-safe next actions into the client dashboard.',
    reusablePattern: 'Repeatable client AI Ops component for private Open Brain companion apps, protected app surfaces, review packets, and approval-gated connector setup.',
    status: isMentorRi ? 'staging_ready' : 'needs_client_setup',
    connectorSignals: isMentorRi
      ? ['WordPress', 'Google Workspace', 'Gmail', 'Google Drive', 'Bonterra Network for Good', 'n8n', 'Vercel', 'Supabase Vector']
      : ['Google Workspace', 'n8n', 'Vercel', 'Supabase Vector'],
    approvalGates: [
      'Client-owned account and admin owner confirmed',
      'Google Workspace SSO and role mapping approved',
      'CRM read-only context path approved',
      'No CRM, email, Drive, or automation writeback until per-action approval',
    ],
  }
}

export function buildDefaultClientAiOpsRoadmap(context: RoadmapContext = {}): RoadmapDraft {
  const name = context.clientCompany || context.clientName || 'Client'
  const agentReadiness = getAgentReadinessAssessment(context)
  const adjustments = agentReadiness ? phaseAdjustmentsForReadiness(agentReadiness.overallLevel) : {}
  const serviceProfile = inferClientAiOpsServiceProfile(context)
  const connectorReadiness = buildRoadmapConnectorReadiness(context, serviceProfile)
  const serviceTasks = serviceProfile ? OPEN_BRAIN_TASKS.map((t) => ({ ...t })) : []
  const serviceCosts = serviceProfile ? OPEN_BRAIN_COST_ITEMS.map((item) => ({ ...item })) : []

  return {
    title: `${name} AI Ops Roadmap`,
    clientSummary: agentReadiness
      ? `${agentReadiness.clientSummary} ${agentReadiness.roadmapRecommendation}`
      : serviceProfile
        ? `${serviceProfile.label} is tracked as a ${serviceProfile.componentLabel}. The client Open Brain remains canonical while Portfolio shows the client-safe roadmap, connector readiness, approvals, and next actions.`
        : 'A phased implementation plan for client-owned AI infrastructure, 24/7 data and local LLM repository placement, transparent setup costs, agent deployment, monitoring, and continuity reporting.',
    inputHash: hashContext(context),
    serviceProfile,
    runtimePlacementOptions: DEFAULT_RUNTIME_PLACEMENT_OPTIONS.map((option) => ({ ...option })),
    connectorReadiness,
    phases: DEFAULT_PHASES.map((phase) => {
      const adjustment = adjustments[phase.phaseKey]
      return {
        ...phase,
        ...(adjustment ? { objective: adjustment.objective } : {}),
        acceptanceCriteria: adjustment?.acceptanceCriteria
          ? [...adjustment.acceptanceCriteria]
          : [...phase.acceptanceCriteria],
      }
    }),
    tasks: [...DEFAULT_TASKS.map((t) => ({ ...t })), ...serviceTasks],
    costItems: [...DEFAULT_COST_ITEMS.map((item) => ({ ...item })), ...serviceCosts],
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

function buildRoadmapConnectorReadiness(context: RoadmapContext, serviceProfile: RoadmapServiceProfile | null = null): ClientConnectorReadiness {
  const requirements = context.implementationRequirements ?? {}
  const connectorInput = requirements.connectorReadinessInput && typeof requirements.connectorReadinessInput === 'object'
    ? requirements.connectorReadinessInput as Partial<BuildClientConnectorReadinessInput>
    : {}
  const auditSignals = context.auditSignals
    ?? (Array.isArray(requirements.auditSignals) ? requirements.auditSignals as ClientConnectorAuditSignal[] : [])

  return buildClientConnectorReadiness({
    verifiedStack: context.verifiedStack
      ?? (requirements.verifiedStack && typeof requirements.verifiedStack === 'object' ? requirements.verifiedStack as Record<string, unknown> : null)
      ?? connectorInput.verifiedStack
      ?? null,
    auditSignals: auditSignals.length > 0 ? auditSignals : connectorInput.auditSignals ?? [],
    builtWithStack: context.builtWithStack
      ?? (requirements.builtWithStack && typeof requirements.builtWithStack === 'object' ? requirements.builtWithStack as Record<string, unknown> : null)
      ?? connectorInput.builtWithStack
      ?? null,
    roadmapSnapshot: {
      stackSignals: [...(context.stackSignals ?? []), ...(serviceProfile?.connectorSignals ?? [])],
      projectName: context.projectName ?? null,
      clientName: context.clientName ?? null,
      serviceProfile: serviceProfile
        ? {
            key: serviceProfile.key,
            label: serviceProfile.label,
            componentLabel: serviceProfile.componentLabel,
          }
        : null,
      ...connectorInput.roadmapSnapshot,
    },
    roadmapTasks: connectorInput.roadmapTasks ?? [],
    projectMetadata: {
      project_name: context.projectName ?? null,
      client_name: context.clientName ?? null,
      client_company: context.clientCompany ?? null,
      product_purchased: context.productPurchased ?? null,
      service_profile_key: serviceProfile?.key ?? null,
      service_profile_label: serviceProfile?.label ?? null,
      ...connectorInput.projectMetadata,
    },
  })
}

export function buildClientRoadmapView(input: {
  roadmap: { title: string; status: RoadmapStatus; client_summary: string | null; snapshot?: Record<string, unknown> | null }
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
  tasks: Array<{
    phase_id: string
    title: string
    owner_type: RoadmapTaskOwner
    priority: RoadmapPriority
    status: RoadmapTaskStatus
    due_date: string | null
    client_visible: boolean
    metadata?: Record<string, unknown> | null
  }>
  costItems: Array<Pick<RoadmapCostItemDraft, 'payer' | 'costType' | 'amount' | 'category'>>
  reports?: Array<{
    title: string
    report_type: string
    status: string
    generated_at: string | null
    summary: string | null
    client_actions?: string[] | null
    amadutown_actions?: string[] | null
    approval_needed?: string[] | null
    monitoring_summary?: Record<string, unknown> | null
  }>
}): RoadmapClientView {
  const visibleTasks = input.tasks.filter((task) => task.client_visible)
  const latestReport = input.reports?.[0]
  const monitoringSummary = latestReport?.monitoring_summary
  const overdueTasks = typeof monitoringSummary?.overdue_tasks === 'number' ? monitoringSummary.overdue_tasks : 0
  const staleCostItems = typeof monitoringSummary?.stale_cost_items === 'number' ? monitoringSummary.stale_cost_items : 0
  const reportMissing = typeof monitoringSummary?.report_missing === 'boolean' ? monitoringSummary.report_missing : !latestReport
  const approvalNeededCount = input.tasks.filter(taskRequiresApproval).length
    + (Array.isArray(latestReport?.approval_needed) ? latestReport.approval_needed.length : 0)
  const projectionStatus: RoadmapClientProjectionStatus = {
    tasksTotal: visibleTasks.length,
    tasksComplete: visibleTasks.filter((task) => task.status === 'complete').length,
    blockedTasks: visibleTasks.filter((task) => task.status === 'blocked').length,
    clientActionCount: visibleTasks.filter((task) => task.owner_type === 'client' && task.status !== 'complete' && task.status !== 'cancelled').length,
    amadutownActionCount: visibleTasks.filter((task) => task.owner_type === 'amadutown' && task.status !== 'complete' && task.status !== 'cancelled').length,
    sharedActionCount: visibleTasks.filter((task) => task.owner_type === 'shared' && task.status !== 'complete' && task.status !== 'cancelled').length,
    approvalNeededCount,
    isolationRequiredCount: input.tasks.filter(taskRequiresIsolation).length,
    overdueTasks,
    staleCostItems,
    reportMissing,
    nextReportingAction: nextRoadmapReportingAction({
      blockedTasks: visibleTasks.filter((task) => task.status === 'blocked').length,
      approvalNeededCount,
      overdueTasks,
      staleCostItems,
      reportMissing,
      clientActionCount: visibleTasks.filter((task) => task.owner_type === 'client' && task.status !== 'complete' && task.status !== 'cancelled').length,
    }),
  }
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
    serviceProfile: serviceProfileFromSnapshot(input.roadmap.snapshot),
    runtimePlacementOptions: Array.isArray(input.roadmap.snapshot?.runtime_placement_options)
      ? input.roadmap.snapshot.runtime_placement_options as RoadmapRuntimePlacementOption[]
      : DEFAULT_RUNTIME_PLACEMENT_OPTIONS.map((option) => ({ ...option })),
    connectorReadiness: connectorReadinessFromSnapshot(input.roadmap.snapshot),
    phases,
    costSummary: rollUpRoadmapCosts(input.costItems),
    projectionStatus,
    nextActions: visibleTasks
      .filter((task) => task.status !== 'complete' && task.status !== 'cancelled')
      .slice(0, 5)
      .map((task) => ({
        title: task.title,
        ownerType: task.owner_type,
        priority: task.priority,
        dueDate: task.due_date,
      })),
    latestReport: latestReport
      ? {
          title: latestReport.title,
          reportType: latestReport.report_type,
          status: latestReport.status,
          generatedAt: latestReport.generated_at,
          summary: latestReport.summary,
          clientActions: Array.isArray(latestReport.client_actions) ? latestReport.client_actions : [],
          amadutownActionsCount: Array.isArray(latestReport.amadutown_actions) ? latestReport.amadutown_actions.length : 0,
          approvalNeededCount: Array.isArray(latestReport.approval_needed) ? latestReport.approval_needed.length : 0,
          monitoringSummary: latestReport.monitoring_summary
            ? {
                overdueTasks: typeof latestReport.monitoring_summary.overdue_tasks === 'number' ? latestReport.monitoring_summary.overdue_tasks : undefined,
                staleCostItems: typeof latestReport.monitoring_summary.stale_cost_items === 'number' ? latestReport.monitoring_summary.stale_cost_items : undefined,
                reportMissing: typeof latestReport.monitoring_summary.report_missing === 'boolean' ? latestReport.monitoring_summary.report_missing : undefined,
                checkedAt: typeof latestReport.monitoring_summary.checked_at === 'string' ? latestReport.monitoring_summary.checked_at : null,
              }
            : null,
        }
      : null,
  }
}

function serviceProfileFromSnapshot(snapshot: Record<string, unknown> | null | undefined): RoadmapServiceProfile | null {
  const serviceProfile = snapshot?.service_profile
  if (!serviceProfile || typeof serviceProfile !== 'object') return null
  const profile = serviceProfile as Partial<RoadmapServiceProfile>
  if (profile.key !== 'open_brain_companion_app' || !profile.label || !profile.componentLabel) return null
  return {
    key: profile.key,
    label: profile.label,
    componentLabel: profile.componentLabel,
    clientOwner: profile.clientOwner ?? null,
    deliveryModel: 'white_label_client_ai_ops',
    canonicalSource: profile.canonicalSource ?? 'Client-owned Open Brain remains the source of truth.',
    portfolioRole: profile.portfolioRole ?? 'Portfolio projects approved status and client-safe next actions.',
    reusablePattern: profile.reusablePattern ?? 'Repeatable client AI Ops component for private Open Brain companion apps.',
    status: profile.status ?? 'needs_client_setup',
    connectorSignals: Array.isArray(profile.connectorSignals) ? profile.connectorSignals : [],
    approvalGates: Array.isArray(profile.approvalGates) ? profile.approvalGates : [],
  }
}

function connectorReadinessFromSnapshot(snapshot: Record<string, unknown> | null | undefined): ClientConnectorReadiness {
  const connectorReadiness = snapshot?.connector_readiness
  if (connectorReadiness && typeof connectorReadiness === 'object') {
    const readiness = connectorReadiness as Partial<ClientConnectorReadiness>
    if (Array.isArray(readiness.items) && typeof readiness.requiredConnectorCount === 'number') {
      return readiness as ClientConnectorReadiness
    }
  }
  return buildClientConnectorReadiness({ roadmapSnapshot: snapshot ?? null })
}

function taskOrgBoard(task: { metadata?: Record<string, unknown> | null }): Record<string, unknown> | null {
  const orgBoard = task.metadata?.org_board
  return orgBoard && typeof orgBoard === 'object' ? orgBoard as Record<string, unknown> : null
}

function taskRequiresApproval(task: { metadata?: Record<string, unknown> | null }): boolean {
  const approvalPosture = taskOrgBoard(task)?.approval_posture
  return approvalPosture === 'required' || approvalPosture === 'pending'
}

function taskRequiresIsolation(task: { metadata?: Record<string, unknown> | null }): boolean {
  return taskOrgBoard(task)?.isolation_required === true
}

function nextRoadmapReportingAction(input: {
  blockedTasks: number
  approvalNeededCount: number
  overdueTasks: number
  staleCostItems: number
  reportMissing: boolean
  clientActionCount: number
}): string {
  if (input.reportMissing) return 'Generate first roadmap report'
  if (input.blockedTasks > 0) return 'Resolve blocked roadmap tasks'
  if (input.approvalNeededCount > 0) return 'Review approval-gated roadmap work'
  if (input.overdueTasks > 0) return 'Escalate overdue roadmap tasks'
  if (input.staleCostItems > 0) return 'Refresh stale roadmap cost assumptions'
  if (input.clientActionCount > 0) return 'Follow up on client-owned roadmap actions'
  return 'Continue scheduled roadmap monitoring'
}
