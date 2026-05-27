import {
  buildAgentSwarmBoardSnapshotFromRows,
  evaluateSwarmHandoffPolicy,
  type AgentSwarmBoardSnapshot,
  type SwarmHandoffPolicyDecision,
  type SwarmHandoffStage,
} from './agent-swarm-board'
import {
  buildClientRoadmapView,
  buildProposalRoadmapSnapshot,
  type RoadmapClientView,
  type RoadmapContext,
  type RoadmapDraft,
  type RoadmapTaskDraft,
} from './client-ai-ops-roadmap'
import {
  buildClientAiOpsReadinessContract,
  type ClientAiOpsReadinessContract,
} from './client-ai-ops-readiness-contract'

type SwarmRows = Parameters<typeof buildAgentSwarmBoardSnapshotFromRows>[0]

const GENERATED_AT = '2026-05-26T12:00:00.000Z'
const PROJECT_ID = 'synthetic-client-ai-ops-project'
const ROADMAP_ID = 'synthetic-client-ai-ops-roadmap'
const CONTACT_ID = 9001

export type SyntheticClientAiOpsPilot = {
  context: RoadmapContext
  draft: RoadmapDraft
  clientView: RoadmapClientView
  readinessContract: ClientAiOpsReadinessContract
  swarmRows: SwarmRows
  swarmSnapshot: AgentSwarmBoardSnapshot
  autonomousHandoffPath: Array<{
    stage: SwarmHandoffStage
    decision: SwarmHandoffPolicyDecision
  }>
  approvalBoundary: {
    credentialSync: SwarmHandoffPolicyDecision
    outboundSend: SwarmHandoffPolicyDecision
  }
}

export function buildSyntheticClientAiOpsPilot(): SyntheticClientAiOpsPilot {
  const context = syntheticRoadmapContext()
  const draft = buildProposalRoadmapSnapshot(context)
  const phases = draft.phases.map((phase) => ({
    id: `phase-${phase.phaseOrder}`,
    title: phase.title,
    objective: phase.objective,
    status: phase.phaseOrder === 1 ? 'complete' as const : phase.status,
    phase_order: phase.phaseOrder,
    acceptance_criteria: phase.acceptanceCriteria,
  }))
  const tasks = draft.tasks.map((task) => ({
    phase_id: `phase-${draft.phases.find((phase) => phase.phaseKey === task.phaseKey)?.phaseOrder ?? 1}`,
    title: task.title,
    owner_type: task.ownerType,
    priority: task.priority,
    status: statusForSyntheticTask(task),
    due_date: null,
    client_visible: task.clientVisible,
    metadata: task.orgBoard ? { org_board: orgBoardMetadata(task) } : null,
  }))
  const clientView = buildClientRoadmapView({
    roadmap: {
      title: draft.title,
      status: 'active',
      client_summary: draft.clientSummary,
      snapshot: {
        input_hash: draft.inputHash,
        runtime_placement_options: draft.runtimePlacementOptions,
        connector_readiness: draft.connectorReadiness,
      },
    },
    phases,
    tasks,
    costItems: draft.costItems.map((item) => ({
      payer: item.payer,
      costType: item.costType,
      amount: item.amount,
      category: item.category,
    })),
    reports: [
      {
        title: 'Synthetic Client AI Ops readiness report',
        report_type: 'synthetic_pilot',
        status: 'draft',
        generated_at: GENERATED_AT,
        summary: 'Synthetic data only. Connector setup is represented as planning work and approval packets.',
        client_actions: ['Approve the connector setup packet before any OAuth, API key, or provider action.'],
        amadutown_actions: ['Run synthetic QA and prepare the provisioning plan.'],
        approval_needed: [],
        monitoring_summary: {
          overdue_tasks: 0,
          stale_cost_items: 0,
          report_missing: false,
          checked_at: GENERATED_AT,
        },
      },
    ],
  })
  const swarmRows = syntheticSwarmRows(draft)
  const swarmSnapshot = buildAgentSwarmBoardSnapshotFromRows(swarmRows)

  return {
    context,
    draft,
    clientView,
    readinessContract: buildClientAiOpsReadinessContract(clientView, {
      swarmSnapshot,
      clientProjectId: PROJECT_ID,
    }),
    swarmRows,
    swarmSnapshot,
    autonomousHandoffPath: [
      policyStep('discovery'),
      policyStep('technology_decision'),
      policyStep('provisioning_plan'),
      policyStep('qa_isolation'),
    ],
    approvalBoundary: {
      credentialSync: evaluateSwarmHandoffPolicy({
        stage: 'provisioning_plan',
        requestedActions: ['client_data_access', 'external_api_call', 'production_config_change'],
        riskLevel: 'medium',
      }),
      outboundSend: evaluateSwarmHandoffPolicy({
        stage: 'reporting',
        requestedActions: ['send_email'],
        riskLevel: 'medium',
      }),
    },
  }
}

function syntheticRoadmapContext(): RoadmapContext {
  return {
    clientName: 'Synthetic Pilot',
    clientCompany: 'Synthetic Ops Co',
    projectName: 'Synthetic Client AI Ops MVP',
    clientProjectId: PROJECT_ID,
    contactSubmissionId: CONTACT_ID,
    verifiedStack: { technologies: [{ name: 'Webflow' }] },
    builtWithStack: { technologies: [{ name: 'Google Analytics' }] },
    stackSignals: ['24/7 cloud runtime', 'local llm fallback', 'client-owned approvals'],
    auditSignals: [
      {
        id: 'synthetic-audit-1',
        audit_type: 'standalone',
        tech_stack: {
          crm: 'hubspot',
          email: 'gmail',
          marketing: 'mailchimp',
          analytics: 'google analytics',
          other_tools: ['Slack', 'Pinecone'],
          integration_readiness: 'documented but not connected',
        },
        automation_needs: { priority_areas: ['lead_follow_up', 'client_reporting'] },
        ai_readiness: { data_quality: 'integrated', previous_ai_experience: 'light experimentation' },
        budget_timeline: { budget_range: 'mvp', timeline: '30 days' },
        decision_making: { decision_maker: true, approval_process: 'solo' },
        enriched_tech_stack: { technologies: [{ name: 'Pinecone' }, { name: 'n8n' }] },
      },
    ],
  }
}

function syntheticSwarmRows(draft: RoadmapDraft): SwarmRows {
  return {
    projects: [
      {
        id: PROJECT_ID,
        project_name: 'Synthetic Client AI Ops MVP',
        client_name: 'Synthetic Pilot',
        client_email: 'pilot@example.test',
        contact_submission_id: CONTACT_ID,
        project_status: 'active',
        estimated_end_date: '2026-06-30',
        created_at: GENERATED_AT,
      },
    ],
    roadmaps: [
      {
        id: ROADMAP_ID,
        client_project_id: PROJECT_ID,
        title: draft.title,
        status: 'active',
        snapshot: {
          input_hash: draft.inputHash,
          runtime_placement_options: draft.runtimePlacementOptions,
          connector_readiness: draft.connectorReadiness,
          isolation_status: 'passed',
        },
        updated_at: GENERATED_AT,
      },
    ],
    tasks: [
      swarmTask('data-source-map', draft, 'complete'),
      swarmTask('ai-runtime-selection', draft, 'complete'),
      swarmTask('hardware-decision', draft, 'complete'),
      swarmTask('backup-monitoring', draft, 'pending'),
      swarmTask('workflow-validation', draft, 'pending'),
    ],
    reports: [
      {
        roadmap_id: ROADMAP_ID,
        report_type: 'synthetic_pilot',
        status: 'draft',
        generated_at: GENERATED_AT,
        monitoring_summary: {
          overdue_tasks: 0,
          stale_cost_items: 0,
          report_missing: false,
          checked_at: GENERATED_AT,
        },
      },
    ],
    runs: [
      run('synthetic-run-discovery', 'research-source-register', 'Discover client stack', 'completed', 'Discovery complete'),
      run('synthetic-run-decision', 'technology-evaluator', 'Prepare LLM, RAG, and auth decision packet', 'completed', 'Decision packet complete'),
      run('synthetic-run-provisioning', 'automation-systems', 'Prepare provisioning plan', 'completed', 'Provisioning plan prepared without live setup'),
      run('synthetic-run-qa', 'engineering-copilot', 'Run synthetic QA', 'running', 'Synthetic QA in progress'),
    ],
    approvals: [],
    contacts: [
      {
        id: CONTACT_ID,
        email: 'pilot@example.test',
        client_verified_tech_stack: { technologies: [{ name: 'Webflow' }] },
        website_tech_stack: { technologies: [{ name: 'Google Analytics' }] },
      },
    ],
    audits: syntheticRoadmapContext().auditSignals!.map((audit) => ({
      ...audit,
      id: audit.id ?? 'synthetic-audit-1',
      contact_submission_id: CONTACT_ID,
      contact_email: 'pilot@example.test',
      completed_at: GENERATED_AT,
      updated_at: GENERATED_AT,
      created_at: GENERATED_AT,
    })),
  }
}

function swarmTask(taskKey: string, draft: RoadmapDraft, status: string): SwarmRows['tasks'][number] {
  const task = draft.tasks.find((item) => item.taskKey === taskKey)
  if (!task) throw new Error(`Synthetic pilot task missing from roadmap draft: ${taskKey}`)
  return {
    id: `synthetic-task-${task.taskKey}`,
    roadmap_id: ROADMAP_ID,
    task_key: task.taskKey,
    title: task.title,
    status,
    priority: task.priority,
    owner_type: task.ownerType,
    due_date: null,
    metadata: task.orgBoard ? { org_board: orgBoardMetadata(task) } : null,
  }
}

function orgBoardMetadata(task: RoadmapTaskDraft) {
  return task.orgBoard
    ? {
        column: task.orgBoard.column,
        stage: task.orgBoard.stage,
        owner_agent_key: task.orgBoard.ownerAgentKey,
        owner_agent_label: task.orgBoard.ownerAgentLabel,
        approval_posture: task.orgBoard.approvalPosture,
        isolation_required: task.orgBoard.isolationRequired,
        client_visible_label: task.orgBoard.clientVisibleLabel ?? null,
        internal_handoff_label: task.orgBoard.internalHandoffLabel ?? null,
      }
    : null
}

function statusForSyntheticTask(task: RoadmapTaskDraft) {
  if (['client-vault', 'ownership-map', 'hardware-decision', 'data-source-map', 'ai-runtime-selection'].includes(task.taskKey)) {
    return 'complete' as const
  }
  return task.status
}

function policyStep(stage: SwarmHandoffStage) {
  return {
    stage,
    decision: evaluateSwarmHandoffPolicy({
      stage,
      requestedActions: ['read_files'],
      riskLevel: 'medium',
    }),
  }
}

function run(
  id: string,
  agentKey: string,
  title: string,
  status: string,
  currentStep: string,
): SwarmRows['runs'][number] {
  return {
    id,
    agent_key: agentKey,
    runtime: 'codex',
    kind: 'agent_handoff',
    title,
    status,
    subject_type: 'client_project',
    subject_id: PROJECT_ID,
    subject_label: 'Synthetic Client AI Ops MVP',
    current_step: currentStep,
    error_message: null,
    started_at: GENERATED_AT,
    completed_at: status === 'completed' ? GENERATED_AT : null,
    metadata: { client_project_id: PROJECT_ID, synthetic: true },
  }
}
