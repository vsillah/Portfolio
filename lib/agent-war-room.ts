import {
  attachAgentArtifact,
  endAgentRun,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import { AGENT_ORGANIZATION, AGENT_PODS, getAgentByKey, type AgentOrganizationNode } from '@/lib/agent-organization'
import { buildAgentMissionControlSnapshot } from '@/lib/agent-mission-control'
import { buildAgentOrgBoardSnapshot, type AgentOrgBoardSnapshot, type AgentOrgBoardTask } from '@/lib/agent-swarm-board'
import { createAgentWorkItem, type AgentWorkItem, type AgentWorkItemPriority } from '@/lib/agent-work-items'

export type AgentWarRoomCommand = 'standup' | 'discuss' | 'ask_agent' | 'draft_goal' | 'approve_goal'

export interface AgentGoalDraftTask {
  id: string
  title: string
  objective: string
  owner_agent_key: string
  priority: AgentWorkItemPriority
  dependencies: string[]
  expected_files: string[]
  acceptance_criteria: string[]
  risk_notes: string
  goal_progress_weight: number
}

export interface AgentGoalDraft {
  goal_id: string
  title: string
  objective: string
  recommendation: string
  risk_notes: string
  draft_run_id?: string | null
  tasks: AgentGoalDraftTask[]
}

export interface AgentWarRoomMessage {
  id: string
  role: 'system' | 'user' | 'agent'
  agent_key?: string
  agent_name?: string
  content: string
  created_at: string
}

export interface RunAgentWarRoomInput {
  command: AgentWarRoomCommand
  message?: string | null
  targetAgentKey?: string | null
  targetAgentKeys?: string[] | null
  goalId?: string | null
  goal?: string | null
  draft?: AgentGoalDraft | null
  triggerSource: string
  actor?: {
    id?: string | null
    label?: string | null
    type?: string | null
  }
}

function assertCommand(command: string): asserts command is AgentWarRoomCommand {
  if (!['standup', 'discuss', 'ask_agent', 'draft_goal', 'approve_goal'].includes(command)) {
    throw new Error('Invalid war room command')
  }
}

function podName(podKey: string) {
  return AGENT_PODS.find((pod) => pod.key === podKey)?.name ?? podKey
}

function callableAgents() {
  return AGENT_ORGANIZATION.filter((agent) => agent.status !== 'planned')
}

function selectedCallableAgents(targetAgentKeys?: string[] | null) {
  if (!targetAgentKeys?.length) return []
  const seen = new Set<string>()
  return targetAgentKeys.map((key) => {
    const agent = getAgentByKey(key)
    if (!agent || agent.status === 'planned') throw new Error(`Invalid agent key: ${key}`)
    return agent
  }).filter((agent) => {
    if (seen.has(agent.key)) return false
    seen.add(agent.key)
    return true
  })
}

function selectAgents(command: AgentWarRoomCommand, message: string | null, targetAgentKey?: string | null, targetAgentKeys?: string[] | null) {
  if (command === 'ask_agent') {
    const agent = getAgentByKey(targetAgentKey ?? '')
    if (!agent || agent.status === 'planned') throw new Error('Invalid agent key')
    return [agent]
  }

  if (command === 'standup' || command === 'discuss') {
    const selected = selectedCallableAgents(targetAgentKeys)
    if (selected.length) return selected
  }

  const callable = callableAgents()
  if (command === 'standup') return callable.slice(0, 8)
  if (command === 'draft_goal' || command === 'approve_goal') {
    return [
      getAgentByKey('chief-of-staff'),
      getAgentByKey('engineering-copilot'),
      getAgentByKey('automation-systems'),
      getAgentByKey('research-source-register'),
      getAgentByKey('risk-compliance-intelligence'),
    ].filter(Boolean) as AgentOrganizationNode[]
  }

  const text = (message ?? '').toLowerCase()
  const ranked = callable
    .map((agent) => {
      const haystack = [
        agent.name,
        podName(agent.podKey),
        agent.responsibility,
        agent.engagementPath,
      ].join(' ').toLowerCase()
      const score = text
        .split(/\W+/)
        .filter((word) => word.length > 3 && haystack.includes(word)).length
      return { agent, score }
    })
    .sort((a, b) => b.score - a.score)

  const picked = ranked.filter((item) => item.score > 0).map((item) => item.agent)
  return (picked.length ? picked : callable).slice(0, 5)
}

function isOpenTask(task: AgentOrgBoardTask) {
  return !['merged', 'deployed', 'cancelled'].includes(task.status)
}

function hoursSince(value: string, now = new Date()) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.round(((now.getTime() - time) / 36e5) * 10) / 10)
}

function workContextForAgent(agent: AgentOrganizationNode, snapshot: AgentOrgBoardSnapshot) {
  const tasks = snapshot.lanes
    .flatMap((lane) => lane.tasks)
    .filter((task) => task.ownerAgentKey === agent.key && isOpenTask(task))
  const blocked = tasks.filter((task) => task.status === 'blocked' || Boolean(task.blockerSummary))
  const reviewReady = tasks.filter((task) => task.status === 'ready_for_review' || task.status === 'ready_for_merge')
  const oldest = [...tasks].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] ?? null
  const nextTask = blocked[0] ?? reviewReady[0] ?? oldest
  const agentSnapshot = snapshot.agents.find((item) => item.key === agent.key)
  const oldestHours = oldest ? hoursSince(oldest.createdAt) : null

  return {
    activeCount: tasks.length,
    blockedCount: blocked.length,
    reviewReadyCount: reviewReady.length,
    oldestHours,
    nextTask,
    latestRunId: agentSnapshot?.latestRunId ?? null,
    latestAction: agentSnapshot?.latestAction ?? 'No recent traced activity',
  }
}

function summarizeWorkContext(context: ReturnType<typeof workContextForAgent>) {
  if (!context.activeCount) return 'No active Kanban work is assigned right now.'

  const age = context.oldestHours != null ? ` Oldest in-flight item: ${context.oldestHours}h.` : ''
  const next = context.nextTask
    ? ` Next: ${context.nextTask.title} (${context.nextTask.status.replace(/_/g, ' ')}).${context.nextTask.blockerSummary ? ` Blocker: ${context.nextTask.blockerSummary}.` : ''}`
    : ''
  return `${context.activeCount} active Kanban item(s), ${context.blockedCount} blocked, ${context.reviewReadyCount} review-ready.${age}${next}`
}

function agentUpdate(agent: AgentOrganizationNode, command: AgentWarRoomCommand, message: string | null, orgSnapshot: AgentOrgBoardSnapshot) {
  const activeWorkflows = agent.n8nWorkflows.filter((workflow) => workflow.active).length
  const workContext = workContextForAgent(agent, orgSnapshot)
  const workSummary = summarizeWorkContext(workContext)
  const scope =
    command === 'standup'
      ? `Current posture: ${agent.status}; ${activeWorkflows} active mapped workflow(s). ${workSummary}`
      : command === 'ask_agent'
        ? `Direct update on "${message}": ${workSummary} Role scope: ${agent.responsibility}.`
        : `Perspective on "${message}": ${workSummary} Role scope: ${agent.responsibility}.`

  return {
    agent_key: agent.key,
    agent_name: agent.name,
    pod: podName(agent.podKey),
    runtime: agent.primaryRuntime,
    status: agent.status,
    update: scope,
    next_action: agent.status === 'active'
      ? workContext.nextTask?.activeRunId
        ? `Open trace ${workContext.nextTask.activeRunId} or ask for the next handoff.`
        : 'Ready for read-only engagement through Agent Ops.'
      : 'Use Shaka routing before assigning production work.',
    approval_gate: agent.approvalGate,
    active_work_count: workContext.activeCount,
    blocked_work_count: workContext.blockedCount,
    review_ready_count: workContext.reviewReadyCount,
    latest_run_id: workContext.latestRunId,
  }
}

function synthesize(command: AgentWarRoomCommand, updates: ReturnType<typeof agentUpdate>[], attentionCount: number) {
  if (command === 'standup') {
    const ready = updates.filter((update) => update.status === 'active').length
    const partial = updates.filter((update) => update.status === 'partial').length
    return `Standup complete: ${ready} active agent(s), ${partial} partial agent(s), and ${attentionCount} item(s) in the attention queue. Start with the attention queue, then route the next task through Shaka.`
  }
  if (command === 'ask_agent') {
    return `${updates[0]?.agent_name ?? 'Selected agent'} responded with scoped Agent Ops context.`
  }
  if (command === 'draft_goal') {
    return 'Goal draft ready for operator review. No work items were created.'
  }
  if (command === 'approve_goal') {
    return 'Goal approved and converted into traceable Agent Ops work items.'
  }

  const pods = Array.from(new Set(updates.map((update) => update.pod))).join(', ')
  return `Discussion complete across ${pods}. Treat this as advisory context until Shaka converts it into traced work.`
}

function messageFromUpdate(update: ReturnType<typeof agentUpdate>, index: number): AgentWarRoomMessage {
  return {
    id: `agent-${index}-${update.agent_key}`,
    role: 'agent',
    agent_key: update.agent_key,
    agent_name: update.agent_name,
    content: `${update.update} Next action: ${update.next_action}`,
    created_at: new Date().toISOString(),
  }
}

function goalIdFromTitle(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'goal'
  return `goal-${slug}-${Date.now().toString(36)}`
}

function draftGoal(goal: string): AgentGoalDraft {
  const title = goal.trim().replace(/\s+/g, ' ').slice(0, 120)
  const goalId = goalIdFromTitle(title)
  const tasks: AgentGoalDraftTask[] = [
    {
      id: `${goalId}-scope`,
      title: `Frame the goal and acceptance gate`,
      objective: `Shaka converts "${title}" into a reviewable execution packet with scope, owners, and approval boundaries.`,
      owner_agent_key: 'chief-of-staff',
      priority: 'high',
      dependencies: [],
      expected_files: ['app/admin/agents/**', 'lib/agent-*.ts'],
      acceptance_criteria: ['Goal scope is explicit', 'Approval and rollback gates are named', 'Kanban owner lanes are assigned'],
      risk_notes: 'Scope can sprawl if the goal is not constrained before worker assignment.',
      goal_progress_weight: 1,
    },
    {
      id: `${goalId}-implementation`,
      title: `Implement the primary change set`,
      objective: 'Piye owns the code path or product surface that most directly satisfies the approved goal.',
      owner_agent_key: 'engineering-copilot',
      priority: 'high',
      dependencies: [`${goalId}-scope`],
      expected_files: ['app/**', 'components/**', 'lib/**'],
      acceptance_criteria: ['Feature works in the relevant admin surface', 'Focused tests cover the new behavior', 'No unrelated draft work is swept in'],
      risk_notes: 'Implementation should remain in a feature branch until validation passes.',
      goal_progress_weight: 2,
    },
    {
      id: `${goalId}-automation`,
      title: `Check workflow and trace impact`,
      objective: 'Yaa Asantewaa verifies whether existing automation, trace, or operator workflows need updates for the goal.',
      owner_agent_key: 'automation-systems',
      priority: 'medium',
      dependencies: [`${goalId}-scope`],
      expected_files: ['app/api/admin/agents/**', 'lib/agent-run.ts', 'lib/agent-work-items.ts'],
      acceptance_criteria: ['Trace behavior is visible', 'Mutation gates stay review-gated', 'Operator workflow has clear next steps'],
      risk_notes: 'Avoid production workflow mutation unless a separate approval packet exists.',
      goal_progress_weight: 1,
    },
    {
      id: `${goalId}-evidence`,
      title: `Attach supporting context and validation notes`,
      objective: 'Askia Muhammad captures evidence, references, and validation notes so the goal can be audited later.',
      owner_agent_key: 'research-source-register',
      priority: 'medium',
      dependencies: [`${goalId}-implementation`],
      expected_files: ['docs/**', 'app/admin/agents/**.test.tsx', 'lib/**.test.ts'],
      acceptance_criteria: ['Validation commands are documented', 'Known risks are recorded', 'Trace and PR links are preserved'],
      risk_notes: 'Evidence should summarize private traces without exposing secrets or raw private data.',
      goal_progress_weight: 1,
    },
    {
      id: `${goalId}-risk`,
      title: `Review risk, governance, and rollout path`,
      objective: 'Moremi reviews blast radius, approval gates, and rollback path before merge or deployment.',
      owner_agent_key: 'risk-compliance-intelligence',
      priority: 'medium',
      dependencies: [`${goalId}-implementation`, `${goalId}-automation`],
      expected_files: ['docs/**', 'app/admin/agents/**'],
      acceptance_criteria: ['Rollback path is clear', 'Production mutation remains gated', 'User-facing claims are supported'],
      risk_notes: 'Risk review is advisory in V1 and should not imply deployment approval.',
      goal_progress_weight: 1,
    },
  ]

  return {
    goal_id: goalId,
    title,
    objective: `Accomplish: ${title}`,
    recommendation: 'Approve the packet if the scope is right, then track each child task on Agent Kanban with the shared goal tag.',
    risk_notes: 'V1 creates reviewable work items only after approval; merge and deploy gates remain outside this room.',
    tasks,
  }
}

function assertDraft(value: AgentGoalDraft | null | undefined): AgentGoalDraft {
  if (!value || typeof value.goal_id !== 'string' || typeof value.title !== 'string' || !Array.isArray(value.tasks)) {
    throw new Error('Invalid goal draft')
  }
  for (const task of value.tasks) {
    if (!task.title || !task.owner_agent_key || !getAgentByKey(task.owner_agent_key)) {
      throw new Error('Invalid goal draft task')
    }
    task.dependencies = normalizeDraftStringArray(task.dependencies)
    task.expected_files = normalizeDraftStringArray(task.expected_files)
    task.acceptance_criteria = normalizeDraftStringArray(task.acceptance_criteria)
    task.risk_notes = typeof task.risk_notes === 'string' ? task.risk_notes : ''
  }
  return value
}

function normalizeDraftStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : []
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function resolveGoalDependencyIds(dependencies: string[], draftTaskIdToWorkItemId: Map<string, string>) {
  return dependencies
    .map((dependency) => {
      if (isUuid(dependency)) return dependency
      return draftTaskIdToWorkItemId.get(dependency) ?? null
    })
    .filter((dependencyId): dependencyId is string => Boolean(dependencyId))
}

function goalSessionHref(goalId: string) {
  return `/admin/agents/standup?goal=${encodeURIComponent(goalId)}`
}

async function approveGoalDraft(runId: string, draft: AgentGoalDraft) {
  const draftRunId = draft.draft_run_id ?? null
  const sessionHref = goalSessionHref(draft.goal_id)
  const parent = await createAgentWorkItem({
    title: `Goal: ${draft.title}`,
    objective: draft.objective,
    priority: 'high',
    status: 'queued',
    ownerAgentKey: 'chief-of-staff',
    source: { type: 'agent_standup_goal', id: draft.goal_id, label: 'Standup Room goal' },
    sourceRunId: runId,
    metadata: {
      goal_id: draft.goal_id,
      goal_title: draft.title,
      goal_status: 'approved',
      goal_role: 'parent',
      goal_created_by_run_id: runId,
      goal_draft_run_id: draftRunId,
      goal_approved_by_run_id: runId,
      goal_session_href: sessionHref,
      goal_progress_weight: 0,
      recommendation: draft.recommendation,
    },
    idempotencyKey: `agent-goal:${draft.goal_id}:parent`,
  })

  const children: AgentWorkItem[] = []
  const draftTaskIdToWorkItemId = new Map<string, string>()
  for (const [index, task] of draft.tasks.entries()) {
    const child = await createAgentWorkItem({
      title: task.title,
      objective: task.objective,
      priority: task.priority,
      status: 'assigned',
      ownerAgentKey: task.owner_agent_key,
      source: { type: 'agent_standup_goal_task', id: task.id, label: draft.title },
      sourceRunId: runId,
      parentWorkItemId: parent.id,
      expectedFiles: task.expected_files,
      dependencyIds: resolveGoalDependencyIds(task.dependencies, draftTaskIdToWorkItemId),
      metadata: {
        goal_id: draft.goal_id,
        goal_title: draft.title,
        goal_sequence: index + 1,
        goal_status: 'approved',
        goal_role: 'task',
        goal_created_by_run_id: runId,
        goal_draft_run_id: draftRunId,
        goal_approved_by_run_id: runId,
        goal_parent_work_item_id: parent.id,
        goal_session_href: sessionHref,
        goal_progress_weight: task.goal_progress_weight,
        goal_task_id: task.id,
        goal_dependencies: task.dependencies,
        acceptance_criteria: task.acceptance_criteria,
        risk_notes: task.risk_notes,
      },
      idempotencyKey: `agent-goal:${draft.goal_id}:task:${index + 1}`,
    })
    children.push(child)
    draftTaskIdToWorkItemId.set(task.id, child.id)
  }

  return { parent, children }
}

export async function runAgentWarRoom(input: RunAgentWarRoomInput) {
  assertCommand(input.command)
  const message = input.message?.trim().slice(0, 1000) || null
  const goal = input.goal?.trim().slice(0, 1000) || null
  const contextGoalId = input.goalId?.trim().slice(0, 160) || null
  if ((input.command === 'discuss' || input.command === 'ask_agent') && !message) {
    throw new Error(`Message is required for ${input.command}`)
  }
  if (input.command === 'draft_goal' && !goal) {
    throw new Error('Goal is required for draft_goal')
  }
  if (input.command === 'ask_agent') {
    const agent = getAgentByKey(input.targetAgentKey ?? '')
    if (!agent || agent.status === 'planned') throw new Error('Invalid agent key')
  }
  if (input.command === 'approve_goal') {
    assertDraft(input.draft)
  }

  const titles: Record<AgentWarRoomCommand, string> = {
    standup: 'Agent Standup Room session',
    discuss: 'Agent Standup Room discussion',
    ask_agent: 'Agent Standup Room direct ask',
    draft_goal: 'Agent Standup Room goal draft',
    approve_goal: 'Agent Standup Room goal approval',
  }
  const precomputedGoalDraft = input.command === 'draft_goal' ? draftGoal(goal ?? '') : null
  const draftGoalId = input.command === 'approve_goal' ? input.draft?.goal_id ?? null : precomputedGoalDraft?.goal_id ?? null
  const activeGoalId = draftGoalId ?? contextGoalId
  const draftRunId = input.command === 'approve_goal' ? input.draft?.draft_run_id ?? null : null
  const run = await startAgentRun({
    agentKey: 'chief-of-staff',
    runtime: 'manual',
    kind: `agent_war_room_${input.command}`,
    title: titles[input.command],
    status: 'running',
    subject: {
      type: input.actor?.type ?? 'agent_war_room',
      id: input.actor?.id ?? input.command,
      label: input.actor?.label ?? 'Agent Standup Room',
    },
    triggerSource: input.triggerSource,
    currentStep: 'Collecting Agent Ops context',
    metadata: {
      command: input.command,
      message_preview: message,
      target_agent_key: input.targetAgentKey ?? null,
      target_agent_keys: input.targetAgentKeys ?? null,
      goal_preview: goal,
      goal_id: activeGoalId,
      goal_session_href: activeGoalId ? goalSessionHref(activeGoalId) : null,
      goal_draft_run_id: draftRunId,
      goal_approved_by_run_id: input.command === 'approve_goal' ? null : null,
      executes_action: input.command === 'approve_goal',
    },
  })

  const [snapshot, orgSnapshot] = await Promise.all([
    buildAgentMissionControlSnapshot(),
    buildAgentOrgBoardSnapshot(),
  ])
  const agents = selectAgents(input.command, message ?? goal, input.targetAgentKey, input.targetAgentKeys)
  const updates = agents.map((agent) => agentUpdate(agent, input.command, message ?? goal, orgSnapshot))
  const synthesis = synthesize(input.command, updates, snapshot.attention_queue.length)
  const messages: AgentWarRoomMessage[] = [
    ...(message ? [{
      id: 'operator-message',
      role: 'user' as const,
      content: message,
      created_at: new Date().toISOString(),
    }] : []),
    ...updates.map(messageFromUpdate),
    {
      id: 'shaka-synthesis',
      role: 'agent',
      agent_key: 'chief-of-staff',
      agent_name: 'Shaka (Zulu) - Chief of Staff',
      content: synthesis,
      created_at: new Date().toISOString(),
    },
  ]

  let goalDraft: AgentGoalDraft | null = null
  let createdWorkItems: { parent: AgentWorkItem; children: AgentWorkItem[] } | null = null
  if (input.command === 'draft_goal') {
    goalDraft = precomputedGoalDraft ? { ...precomputedGoalDraft, draft_run_id: run.id } : null
  }
  if (input.command === 'approve_goal') {
    const draft = assertDraft(input.draft)
    createdWorkItems = await approveGoalDraft(run.id, draft)
  }

  await recordAgentStep({
    runId: run.id,
    stepKey: 'collect_war_room_context',
    name: 'Collected Agent Ops context',
    status: 'completed',
    outputSummary: `${snapshot.status_strip.active} active run(s), ${snapshot.attention_queue.length} attention item(s)`,
    metadata: {
      status_strip: snapshot.status_strip,
      attention_queue_count: snapshot.attention_queue.length,
    },
  })

  await recordAgentStep({
    runId: run.id,
    stepKey: input.command === 'approve_goal' ? 'goal_work_items_created' : 'agent_updates',
    name: input.command === 'approve_goal' ? 'Created approved goal work items' : 'Collected agent responses',
    status: 'completed',
    outputSummary: input.command === 'approve_goal'
      ? `${createdWorkItems?.children.length ?? 0} child work item(s)`
      : `${updates.length} agent response(s)`,
    metadata: { updates, goalDraft, createdWorkItems },
  })

  const finalGoalId = goalDraft?.goal_id ?? input.draft?.goal_id ?? contextGoalId
  const finalGoalSessionHref = finalGoalId ? goalSessionHref(finalGoalId) : null
  const createdParentId = createdWorkItems?.parent.id ?? null
  const createdChildIds = createdWorkItems?.children.map((item) => item.id) ?? []

  await attachAgentArtifact({
    runId: run.id,
    artifactType: input.command === 'draft_goal' ? 'war_room_goal_draft' : 'war_room_transcript',
    title: input.command === 'draft_goal' ? 'Standup Room goal draft' : 'Standup Room transcript',
    refType: 'agent_war_room',
    refId: input.command,
    metadata: {
      command: input.command,
      message,
      goal,
      target_agent_key: input.targetAgentKey ?? null,
      updates,
      synthesis,
      messages,
      goal_draft: goalDraft,
      created_work_items: createdWorkItems,
      goal_id: finalGoalId,
      goal_session_href: finalGoalSessionHref,
      goal_draft_run_id: goalDraft?.draft_run_id ?? input.draft?.draft_run_id ?? null,
      goal_approved_by_run_id: input.command === 'approve_goal' ? run.id : null,
      created_parent_work_item_id: createdParentId,
      created_child_work_item_ids: createdChildIds,
      status_strip: snapshot.status_strip,
      executes_action: input.command === 'approve_goal',
    },
    idempotencyKey: `${run.id}:war-room-artifact`,
  })

  await recordAgentEvent({
    runId: run.id,
    eventType: `war_room_${input.command}_completed`,
    severity: 'info',
    message: synthesis,
    metadata: {
      command: input.command,
      update_count: updates.length,
      goal_id: finalGoalId,
      goal_session_href: finalGoalSessionHref,
      goal_draft_run_id: goalDraft?.draft_run_id ?? input.draft?.draft_run_id ?? null,
      goal_approved_by_run_id: input.command === 'approve_goal' ? run.id : null,
    },
  })

  await endAgentRun({
    runId: run.id,
    status: 'completed',
    currentStep: synthesis,
    outcome: {
      command: input.command,
      update_count: updates.length,
      synthesis,
      executes_action: input.command === 'approve_goal',
      goal_id: finalGoalId,
      goal_session_href: finalGoalSessionHref,
      goal_draft_run_id: goalDraft?.draft_run_id ?? input.draft?.draft_run_id ?? null,
      goal_approved_by_run_id: input.command === 'approve_goal' ? run.id : null,
      created_parent_work_item_id: createdParentId,
      created_child_work_item_ids: createdChildIds,
      created_child_count: createdWorkItems?.children.length ?? 0,
    },
  })

  return {
    runId: run.id,
    command: input.command,
    updates,
    synthesis,
    messages,
    goalDraft,
    createdWorkItems,
  }
}
