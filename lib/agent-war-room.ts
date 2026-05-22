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
import { supabaseAdmin } from '@/lib/supabase'

export type AgentWarRoomCommand = 'standup' | 'discuss' | 'ask_agent' | 'draft_goal' | 'approve_goal'
export type AgentGoalType = 'general' | 'social_outreach_linkedin_post'

export interface LinkedInContentPacket {
  id: string
  goal_statement: string
  target_audience: string
  industry_signal_summary: string
  amadutown_proof_points: string[]
  open_brain_references: string[]
  chronicle_evidence_notes: string[]
  draft_linkedin_post: string
  visual_concept: string
  image_prompt: string
  source_provenance_checklist: string[]
  approval_checklist: string[]
  social_content_draft_id?: string | null
  social_content_draft_href?: string | null
}

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
  goal_type?: AgentGoalType
  title: string
  objective: string
  recommendation: string
  risk_notes: string
  draft_run_id?: string | null
  publish_gate?: 'draft_only' | 'manual_approval_required'
  source_requirements?: string[]
  chronicle_packet_status?: 'manual_packet_required' | 'attached' | 'not_required'
  content_packet_id?: string | null
  content_packet?: LinkedInContentPacket | null
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
  goalType?: AgentGoalType | null
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

function buildLinkedInPacket(goalId: string, title: string): LinkedInContentPacket {
  const packetId = `packet-${goalId}`
  return {
    id: packetId,
    goal_statement: title,
    target_audience: 'LinkedIn audience: small business, nonprofit, and product leaders evaluating practical AI and automation adoption.',
    industry_signal_summary: 'Pending research: capture one current industry signal about operational pressure, AI adoption, or workflow automation before final copy approval.',
    amadutown_proof_points: [
      'AmaduTown has built Portfolio Agent Ops as a working control plane for governed AI and automation work.',
      'Mission Control, Standup Room, Agent Kanban, Open Brain, and Social Content surfaces show the operating model in practice.',
      'The post should frame the lesson as applied work, not abstract AI commentary.',
    ],
    open_brain_references: [
      'Use approved Open Brain memories or proposal summaries only.',
      'Do not copy raw private records, source exports, or unapproved inference into public copy.',
    ],
    chronicle_evidence_notes: [
      'Manual Chronicle packet required in V1.',
      'Attach sanitized screen notes, artifact titles, or workflow observations; do not ingest raw screen history into Portfolio.',
    ],
    draft_linkedin_post: [
      'A small business does not need another AI demo.',
      '',
      'It needs a way to see what is stuck, who owns the next step, what evidence supports the decision, and which actions still need a human approval.',
      '',
      'That is the real lesson from building AmaduTown Agent Ops: the value is not only in asking an agent for help. The value is in turning the answer into accountable work.',
      '',
      'The first draft should be revised after the research, Open Brain, and Chronicle evidence tasks are complete.',
    ].join('\n'),
    visual_concept: 'A dark operating-console illustration showing Mission Control routing a goal into research, evidence, draft, visual, QA, and approval lanes.',
    image_prompt: 'Polished AmaduTown dark operating-console illustration, navy depth, gold command accents, agent swarm turning one LinkedIn outreach goal into tracked Kanban tasks, no logos besides AmaduTown if supplied, executive dashboard composition.',
    source_provenance_checklist: [
      'Industry signal is sourced or marked pending.',
      'Open Brain references are approved/public-safe.',
      'Chronicle notes are manually sanitized.',
      'AmaduTown proof points link to Portfolio/Admin evidence where possible.',
      'No private raw exports, credentials, client data, or unsupported claims are included.',
    ],
    approval_checklist: [
      'Post matches Vambah LinkedIn voice guidance.',
      'Visual concept supports the argument instead of decorating it.',
      'CTA invites discussion without overpromising.',
      'Social Content item remains draft-only until separately approved.',
    ],
    social_content_draft_id: null,
    social_content_draft_href: null,
  }
}

function socialOutreachTasks(goalId: string, title: string): AgentGoalDraftTask[] {
  return [
    {
      id: `${goalId}-industry-research`,
      title: 'Capture the industry signal',
      objective: `Find the timely market or industry signal that makes "${title}" relevant now, and summarize it without overclaiming.`,
      owner_agent_key: 'research-source-register',
      priority: 'high',
      dependencies: [],
      expected_files: ['/admin/value-evidence', '/admin/social-content', 'docs/linkedin-voice.md'],
      acceptance_criteria: ['One source-backed industry signal is attached', 'Unsupported claims are marked pending', 'The packet states why this matters now'],
      risk_notes: 'Do not infer industry traction without a cited source or approved internal evidence.',
      goal_progress_weight: 2,
    },
    {
      id: `${goalId}-open-brain-context`,
      title: 'Pull approved Open Brain context',
      objective: 'Identify approved public-safe memories, proposals, or wiki overlays that support the post angle.',
      owner_agent_key: 'private-knowledge-librarian',
      priority: 'high',
      dependencies: [],
      expected_files: ['/admin/agents/open-brain'],
      acceptance_criteria: ['Only approved or proposal-summary context is used', 'Raw private records stay out of the packet', 'Each reference has a traceable source label'],
      risk_notes: 'Open Brain remains the memory source of truth; Portfolio only projects approved context.',
      goal_progress_weight: 2,
    },
    {
      id: `${goalId}-chronicle-packet`,
      title: 'Attach manual Chronicle evidence packet',
      objective: 'Capture sanitized Chronicle evidence notes that show how the concept has been applied without importing raw screen history.',
      owner_agent_key: 'research-source-register',
      priority: 'medium',
      dependencies: [],
      expected_files: ['Manual Chronicle packet', '/admin/agents/standup'],
      acceptance_criteria: ['Chronicle evidence is manually summarized', 'Sensitive screen details are excluded', 'Packet notes distinguish observed evidence from interpretation'],
      risk_notes: 'Direct Chronicle ingestion is out of scope for V1.',
      goal_progress_weight: 1,
    },
    {
      id: `${goalId}-amadutown-proof`,
      title: 'Select AmaduTown proof points',
      objective: 'Choose the Portfolio, Agent Ops, Open Brain, or Social Content proof points that demonstrate the applied operating model.',
      owner_agent_key: 'voice-content-architect',
      priority: 'high',
      dependencies: [`${goalId}-industry-research`, `${goalId}-open-brain-context`],
      expected_files: ['/admin/agents', '/admin/agents/swarm-board', '/admin/social-content'],
      acceptance_criteria: ['Proof points are specific to AmaduTown work', 'Each proof point has a route or artifact home', 'The post avoids generic AI hype'],
      risk_notes: 'Public copy should not expose admin-only operational details that are not safe to share.',
      goal_progress_weight: 2,
    },
    {
      id: `${goalId}-post-draft`,
      title: 'Draft the LinkedIn post',
      objective: 'Turn the approved signal and proof points into one Vambah-aligned LinkedIn draft.',
      owner_agent_key: 'voice-content-architect',
      priority: 'high',
      dependencies: [`${goalId}-amadutown-proof`, `${goalId}-chronicle-packet`],
      expected_files: ['docs/linkedin-voice.md', '/admin/social-content'],
      acceptance_criteria: ['Draft opens with a concrete tension', 'One idea is developed clearly', 'CTA invites a specific response', '3 to 5 hashtags are suggested'],
      risk_notes: 'Private-derived voice guidance can shape the draft but raw private material must not be quoted.',
      goal_progress_weight: 3,
    },
    {
      id: `${goalId}-visual-brief`,
      title: 'Create the visual brief',
      objective: 'Write a visual concept and image prompt that illustrates the operating model behind the post.',
      owner_agent_key: 'content-repurposing',
      priority: 'medium',
      dependencies: [`${goalId}-post-draft`],
      expected_files: ['/admin/social-content'],
      acceptance_criteria: ['Visual prompt matches the Mission Control aesthetic', 'Visual supports the argument', 'Generated asset remains reviewable before use'],
      risk_notes: 'Do not imply a generated image is evidence; label it as an illustration.',
      goal_progress_weight: 1,
    },
    {
      id: `${goalId}-qa-governance`,
      title: 'Run content QA and governance review',
      objective: 'Check voice fit, source support, privacy, claims, and draft-only publishing boundary.',
      owner_agent_key: 'risk-compliance-intelligence',
      priority: 'high',
      dependencies: [`${goalId}-post-draft`, `${goalId}-visual-brief`],
      expected_files: ['/admin/social-content', '/admin/agents/coordination'],
      acceptance_criteria: ['No private leakage', 'Claims are source-backed or softened', 'Publish remains separately approval-gated'],
      risk_notes: 'Approval to create a draft is not approval to publish.',
      goal_progress_weight: 2,
    },
    {
      id: `${goalId}-social-content-draft`,
      title: 'Create the Social Content draft handoff',
      objective: 'Create or link the draft-only Social Content item with the packet, visual brief, provenance, and approval notes.',
      owner_agent_key: 'content-repurposing',
      priority: 'high',
      dependencies: [`${goalId}-qa-governance`],
      expected_files: ['/admin/social-content'],
      acceptance_criteria: ['Social Content item is draft status', 'Packet id and goal id are traceable', 'No publish, schedule, DM, or external outreach is triggered'],
      risk_notes: 'Publishing remains manual and separately approved outside this goal approval.',
      goal_progress_weight: 1,
    },
  ]
}

function draftSocialOutreachGoal(goal: string, title: string, goalId: string): AgentGoalDraft {
  const packet = buildLinkedInPacket(goalId, title)
  return {
    goal_id: goalId,
    goal_type: 'social_outreach_linkedin_post',
    title,
    objective: `Produce one draft-only LinkedIn content packet for: ${goal.trim()}`,
    recommendation: 'Approve this pilot only if the output should stop at a Social Content draft. Publishing, scheduling, DMs, and outbound engagement remain outside this approval.',
    risk_notes: 'Manual Chronicle evidence and approved Open Brain context are required before public copy is approved.',
    publish_gate: 'draft_only',
    source_requirements: [
      'One source-backed industry signal',
      'Approved Open Brain reference or proposal summary',
      'Manual sanitized Chronicle packet',
      'AmaduTown proof point with an internal route or artifact home',
    ],
    chronicle_packet_status: 'manual_packet_required',
    content_packet_id: packet.id,
    content_packet: packet,
    tasks: socialOutreachTasks(goalId, title),
  }
}

function draftGoal(goal: string, goalType: AgentGoalType = 'general'): AgentGoalDraft {
  const title = goal.trim().replace(/\s+/g, ' ').slice(0, 120)
  const goalId = goalIdFromTitle(title)
  if (goalType === 'social_outreach_linkedin_post') {
    return draftSocialOutreachGoal(goal, title, goalId)
  }
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
    goal_type: 'general',
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
  if (value.goal_type && value.goal_type !== 'general' && value.goal_type !== 'social_outreach_linkedin_post') {
    throw new Error('Invalid goal draft type')
  }
  if (value.publish_gate && value.publish_gate !== 'draft_only' && value.publish_gate !== 'manual_approval_required') {
    throw new Error('Invalid goal draft publish gate')
  }
  value.source_requirements = normalizeDraftStringArray(value.source_requirements)
  if (value.content_packet && typeof value.content_packet.id !== 'string') {
    throw new Error('Invalid LinkedIn content packet')
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

async function createSocialContentDraftForGoal(draft: AgentGoalDraft) {
  if (draft.goal_type !== 'social_outreach_linkedin_post' || !draft.content_packet) return null
  if (!supabaseAdmin) throw new Error('Database not available')

  const packet = draft.content_packet
  const existing = await supabaseAdmin
    .from('social_content_queue')
    .select('id')
    .contains('rag_context', { content_packet_id: packet.id })
    .maybeSingle()

  if (existing.error) throw new Error(`Failed to read social content draft: ${existing.error.message}`)
  if (existing.data?.id) {
    return {
      id: String(existing.data.id),
      href: `/admin/social-content/${existing.data.id}`,
    }
  }

  const adminNotes = [
    'Draft-only Agent Ops social outreach pilot.',
    `Goal: ${draft.title}`,
    `Packet: ${packet.id}`,
    'Publish gate: draft_only. Do not publish or schedule from goal approval.',
    'Chronicle evidence is manual/sanitized in V1.',
    'Approval checklist:',
    ...packet.approval_checklist.map((item) => `- ${item}`),
  ].join('\n')

  const { data, error } = await supabaseAdmin
    .from('social_content_queue')
    .insert({
      platform: 'linkedin',
      status: 'draft',
      post_text: packet.draft_linkedin_post,
      cta_text: 'What part of AI adoption still feels harder than it should for your team?',
      cta_url: null,
      hashtags: ['#AIProduct', '#ProductManagement', '#AmadutownAdvisory'],
      image_prompt: packet.image_prompt,
      framework_visual_type: 'architecture',
      topic_extracted: {
        topic: 'AmaduTown agent swarm social outreach pilot',
        angle: draft.title,
        key_insight: packet.industry_signal_summary,
        personal_tie_in: 'Applied AmaduTown operating-system proof from Agent Ops, Open Brain, and Chronicle evidence.',
        framework_visual: 'architecture',
      },
      hormozi_framework: {
        framework_type: 'source_backed_operating_proof',
        hook_type: 'practical_tension',
        proof_pattern: 'AmaduTown applied workflow evidence',
        cta_pattern: 'specific operator question',
      },
      rag_context: {
        source: 'agent_ops_social_outreach_goal',
        goal_id: draft.goal_id,
        goal_type: draft.goal_type,
        content_packet_id: packet.id,
        publish_gate: draft.publish_gate ?? 'draft_only',
        open_brain_references: packet.open_brain_references,
        chronicle_packet_status: draft.chronicle_packet_status ?? 'manual_packet_required',
        chronicle_evidence_notes: packet.chronicle_evidence_notes,
        source_provenance_checklist: packet.source_provenance_checklist,
        approval_checklist: packet.approval_checklist,
      },
      admin_notes: adminNotes,
      target_platforms: ['linkedin'],
      video_generation_method: 'none',
      content_format: 'single_image',
      content_pillar: 'technology_as_equalizer',
      companion_post_text: null,
    })
    .select('id')
    .single()

  if (error || !data?.id) throw new Error(error?.message ?? 'Failed to create Social Content draft')
  return {
    id: String(data.id),
    href: `/admin/social-content/${data.id}`,
  }
}

async function approveGoalDraft(runId: string, draft: AgentGoalDraft) {
  const draftRunId = draft.draft_run_id ?? null
  const sessionHref = goalSessionHref(draft.goal_id)
  const socialContentDraft = await createSocialContentDraftForGoal(draft)
  const contentPacket = draft.content_packet && socialContentDraft
    ? {
      ...draft.content_packet,
      social_content_draft_id: socialContentDraft.id,
      social_content_draft_href: socialContentDraft.href,
    }
    : draft.content_packet ?? null
  const parent = await createAgentWorkItem({
    title: `Goal: ${draft.title}`,
    objective: draft.objective,
    priority: 'high',
    status: 'queued',
    ownerAgentKey: 'chief-of-staff',
    source: { type: 'agent_standup_goal', id: draft.goal_id, label: 'Standup Room goal' },
    sourceRunId: runId,
    metadata: {
      goal_type: draft.goal_type ?? 'general',
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
      publish_gate: draft.publish_gate ?? null,
      source_requirements: draft.source_requirements ?? [],
      chronicle_packet_status: draft.chronicle_packet_status ?? null,
      content_packet_id: draft.content_packet_id ?? contentPacket?.id ?? null,
      content_packet: contentPacket,
      social_content_draft_id: socialContentDraft?.id ?? null,
      social_content_draft_href: socialContentDraft?.href ?? null,
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
        goal_type: draft.goal_type ?? 'general',
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
        publish_gate: draft.publish_gate ?? null,
        content_packet_id: draft.content_packet_id ?? contentPacket?.id ?? null,
        social_content_draft_id: socialContentDraft?.id ?? null,
        social_content_draft_href: socialContentDraft?.href ?? null,
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
  const goalType = input.goalType === 'social_outreach_linkedin_post' ? input.goalType : 'general'
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
  const precomputedGoalDraft = input.command === 'draft_goal' ? draftGoal(goal ?? '', goalType) : null
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
      goal_type: input.command === 'draft_goal' ? goalType : input.draft?.goal_type ?? null,
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
      social_content_draft_id: createdWorkItems?.parent.metadata?.social_content_draft_id ?? null,
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
      social_content_draft_id: createdWorkItems?.parent.metadata?.social_content_draft_id ?? null,
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
      social_content_draft_id: createdWorkItems?.parent.metadata?.social_content_draft_id ?? null,
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
