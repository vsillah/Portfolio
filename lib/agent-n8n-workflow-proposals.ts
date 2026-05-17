import { createAgentWorkItem, type AgentWorkItem } from '@/lib/agent-work-items'

export type N8nWorkflowProposalAction = 'inspect_workflow' | 'draft_workflow' | 'stage_workflow' | 'request_activation'

export type CreateN8nWorkflowProposalInput = {
  action: N8nWorkflowProposalAction
  title: string
  objective: string
  workflowFamily?: string | null
  automationGoalSeedId?: string | null
  goalId?: string | null
  goalTitle?: string | null
  goalSessionHref?: string | null
  existingWorkflowId?: string | null
  proposedWorkflowName?: string | null
  trigger?: string | null
  requiredEnvVars?: string[]
  credentialNeeds?: string[]
  nodePlan?: string[]
  ingestCallbacks?: string[]
  testEvidence?: string | null
  rollbackPath?: string | null
  requestedByUserId?: string | null
}

const ALLOWED_ACTIONS: N8nWorkflowProposalAction[] = [
  'inspect_workflow',
  'draft_workflow',
  'stage_workflow',
  'request_activation',
]

export function isN8nWorkflowProposalAction(value: string): value is N8nWorkflowProposalAction {
  return ALLOWED_ACTIONS.includes(value as N8nWorkflowProposalAction)
}

export async function createN8nWorkflowProposal(input: CreateN8nWorkflowProposalInput): Promise<AgentWorkItem> {
  if (!isN8nWorkflowProposalAction(input.action)) {
    throw new Error('Invalid n8n workflow proposal action')
  }

  const title = input.title.trim()
  const objective = input.objective.trim()
  if (!title || !objective) {
    throw new Error('title and objective are required')
  }

  return createAgentWorkItem({
    title: `n8n proposal: ${title}`,
    objective,
    priority: input.action === 'request_activation' ? 'high' : 'medium',
    status: 'proposed',
    ownerAgentKey: 'automation-systems',
    ownerRuntime: 'n8n',
    source: {
      type: 'n8n_workflow_proposal',
      id: input.automationGoalSeedId ?? input.existingWorkflowId ?? title,
      label: 'n8n workflow proposal',
    },
    metadata: {
      n8n_workflow_proposal: true,
      n8n_proposal_action: input.action,
      workflow_family: input.workflowFamily ?? null,
      automation_goal_seed_id: input.automationGoalSeedId ?? null,
      goal_id: input.goalId ?? (input.automationGoalSeedId ? `automation:${input.automationGoalSeedId}` : null),
      goal_title: input.goalTitle ?? null,
      goal_status: input.goalId || input.automationGoalSeedId ? 'proposed' : null,
      goal_role: input.goalId || input.automationGoalSeedId ? 'task' : null,
      goal_progress_weight: input.goalId || input.automationGoalSeedId ? 1 : null,
      goal_session_href: input.goalSessionHref ?? (input.goalId ? `/admin/agents/standup?goal=${encodeURIComponent(input.goalId)}` : null),
      existing_workflow_id: input.existingWorkflowId ?? null,
      proposed_workflow_name: input.proposedWorkflowName ?? null,
      trigger: input.trigger ?? null,
      required_env_vars: input.requiredEnvVars ?? [],
      credential_needs: input.credentialNeeds ?? [],
      node_plan: input.nodePlan ?? [],
      ingest_callbacks: input.ingestCallbacks ?? [],
      test_evidence: input.testEvidence ?? null,
      rollback_path: input.rollbackPath ?? null,
      approval_gate: 'Production activation, credential changes, outbound sends, public publishing, and client-visible mutation require approval.',
      requested_by_user_id: input.requestedByUserId ?? null,
    },
    idempotencyKey: `n8n-workflow-proposal:${input.action}:${input.automationGoalSeedId ?? input.existingWorkflowId ?? title}`,
  })
}
