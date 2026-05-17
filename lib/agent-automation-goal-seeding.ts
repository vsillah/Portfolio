import {
  getAutomationGoalSeed,
  listAutomationGoalSeeds,
  type AutomationGoalSeed,
} from '@/lib/agent-automation-goals'
import {
  createAgentWorkItem,
  listAgentWorkItems,
  type AgentWorkItem,
} from '@/lib/agent-work-items'

export type AutomationGoalSeedState = {
  seedId: string
  parent: AgentWorkItem | null
  children: AgentWorkItem[]
  n8nProposals: AgentWorkItem[]
}

export type SeedAutomationGoalsInput = {
  seedIds?: string[]
  tier?: 1 | 2
  triggeredByUserId?: string | null
}

export type SeededAutomationGoal = {
  seed: AutomationGoalSeed
  parent: AgentWorkItem
  children: AgentWorkItem[]
}

const GOAL_SOURCE_TYPE = 'automation_goal_seed'
const GOAL_TASK_SOURCE_TYPE = 'automation_goal_seed_task'

function goalIdForSeed(seed: AutomationGoalSeed) {
  return `automation:${seed.id}`
}

function goalSessionHref(seed: AutomationGoalSeed) {
  return `/admin/agents/standup?goal=${encodeURIComponent(goalIdForSeed(seed))}`
}

function kanbanGoalHref(seed: AutomationGoalSeed) {
  return `/admin/agents/swarm-board?goal=${encodeURIComponent(goalIdForSeed(seed))}`
}

function parentIdempotencyKey(seed: AutomationGoalSeed) {
  return `automation-goal:${seed.id}:parent`
}

function taskIdempotencyKey(seed: AutomationGoalSeed, index: number) {
  return `automation-goal:${seed.id}:task:${index + 1}`
}

function baseMetadata(seed: AutomationGoalSeed, triggeredByUserId?: string | null) {
  const goalId = goalIdForSeed(seed)
  return {
    automation_seed: true,
    automation_goal_seed_id: seed.id,
    workflow_family: seed.workflowFamily,
    automation_level: seed.automationLevel,
    source_routes: seed.sourceRoutes,
    source_docs: seed.sourceDocs,
    n8n_workflows: seed.n8nWorkflows,
    requires_new_workflow: seed.requiresNewWorkflow,
    approval_gate: seed.approvalGate,
    goal_id: goalId,
    goal_title: seed.title,
    goal_status: 'seeded',
    goal_session_href: goalSessionHref(seed),
    goal_kanban_href: kanbanGoalHref(seed),
    seeded_by_user_id: triggeredByUserId ?? null,
  }
}

export async function listAutomationGoalSeedStates(limit = 250): Promise<AutomationGoalSeedState[]> {
  const items = await listAgentWorkItems({ limit })
  const seededItems = items.filter((item) => item.metadata?.automation_seed === true)
  const n8nProposalItems = items.filter((item) => item.source_type === 'n8n_workflow_proposal' || item.metadata?.n8n_workflow_proposal === true)

  return listAutomationGoalSeeds().map((seed) => {
    const goalId = goalIdForSeed(seed)
    const parent = seededItems.find((item) => item.idempotency_key === parentIdempotencyKey(seed)) ?? null
    const children = seededItems
      .filter((item) => item.metadata?.automation_goal_seed_id === seed.id && item.metadata?.goal_role === 'task')
      .sort((a, b) => Number(a.metadata?.goal_sequence ?? 0) - Number(b.metadata?.goal_sequence ?? 0))
    const n8nProposals = n8nProposalItems
      .filter((item) => item.metadata?.automation_goal_seed_id === seed.id || item.metadata?.goal_id === goalId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return { seedId: seed.id, parent, children, n8nProposals }
  })
}

export async function seedAutomationGoals(input: SeedAutomationGoalsInput = {}): Promise<SeededAutomationGoal[]> {
  const seeds = resolveSeeds(input)
  const seeded: SeededAutomationGoal[] = []

  for (const seed of seeds) {
    const metadata = baseMetadata(seed, input.triggeredByUserId)
    const parent = await createAgentWorkItem({
      title: `Goal: ${seed.title}`,
      objective: seed.objective,
      priority: 'high',
      status: 'queued',
      ownerAgentKey: 'chief-of-staff',
      source: { type: GOAL_SOURCE_TYPE, id: seed.id, label: 'Automation goal seed' },
      expectedFiles: seed.sourceRoutes,
      metadata: {
        ...metadata,
        goal_role: 'parent',
        goal_progress_weight: 0,
        owner_agent_key: seed.ownerAgentKey,
        collaborator_agent_keys: seed.collaboratorAgentKeys,
        next_action: seed.nextAction,
      },
      idempotencyKey: parentIdempotencyKey(seed),
    })

    const children: AgentWorkItem[] = []
    for (const [index, task] of seed.tasks.entries()) {
      const child = await createAgentWorkItem({
        title: task.title,
        objective: task.objective,
        priority: task.priority,
        status: 'assigned',
        ownerAgentKey: task.ownerAgentKey,
        parentWorkItemId: parent.id,
        source: { type: GOAL_TASK_SOURCE_TYPE, id: `${seed.id}:${index + 1}`, label: seed.title },
        expectedFiles: task.expectedFiles ?? [],
        metadata: {
          ...metadata,
          goal_role: 'task',
          goal_parent_work_item_id: parent.id,
          goal_sequence: index + 1,
          goal_progress_weight: task.progressWeight,
          acceptance_criteria: task.acceptanceCriteria,
          risk_notes: task.riskNotes,
          requires_approval: task.requiresApproval,
          task_owner_agent_key: task.ownerAgentKey,
        },
        idempotencyKey: taskIdempotencyKey(seed, index),
      })
      children.push(child)
    }

    seeded.push({ seed, parent, children })
  }

  return seeded
}

function resolveSeeds(input: SeedAutomationGoalsInput) {
  if (input.seedIds?.length) {
    return input.seedIds.map((seedId) => {
      const seed = getAutomationGoalSeed(seedId)
      if (!seed) throw new Error(`Unknown automation goal seed: ${seedId}`)
      return seed
    })
  }

  return listAutomationGoalSeeds(input.tier ?? 1)
}
