import {
  attachAgentArtifact,
  endAgentRun,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import { AGENT_PODS } from '@/lib/agent-organization'
import type { AgentOrganizationNode } from '@/lib/agent-organization'

export type AgentEngagementExecutionMode = 'read_only' | 'queued_for_review'

export interface CreateAgentEngagementRunInput {
  agent: AgentOrganizationNode
  actor: {
    subjectType: string
    subjectId: string
    subjectLabel: string
    userId?: string | null
  }
  triggerSource: string
  note?: string | null
  requestedEventMessage: string
  idempotencyKey?: string | null
  eventMetadata?: Record<string, unknown>
}

export interface AgentEngagementRunResult {
  runId: string
  status: 'queued' | 'completed'
  executionMode: AgentEngagementExecutionMode
  workPacketAttached: boolean
  dispatchArtifactAttached: boolean
}

export type AgentFirstTaskTemplate = {
  objective: string
  checklist: string[]
  output: string
}

export const AGENT_FIRST_TASKS: Record<string, AgentFirstTaskTemplate> = {
  'chief-of-staff': {
    objective: 'Produce a current operating brief across runs, approvals, failures, and the next agent to engage.',
    checklist: [
      'Review active, failed, stale, and approval-waiting runs.',
      'Identify the highest-risk blocker or unresolved handoff.',
      'Recommend one next read-only agent engagement or one approval checkpoint.',
    ],
    output: 'Executive operations brief with blocker, owner, next action, and trace link.',
  },
  'research-source-register': {
    objective: 'Prepare a source-backed research brief for the current decision without publishing or exposing private material.',
    checklist: [
      'Clarify the decision, claim, or content point that needs evidence.',
      'List available source surfaces and whether each is public, private, or client-derived.',
      'Return a citation-ready source register and flag material requiring approval before public use.',
    ],
    output: 'Research source register with source class, relevance, usage boundary, and approval risk.',
  },
  'voice-content-architect': {
    objective: 'Turn a source-backed idea into Vambah-aligned content structure while preserving privacy boundaries.',
    checklist: [
      'Identify the narrative tension, audience, and desired operating outcome.',
      'Map the idea into a reusable post, script, carousel, or campaign structure.',
      'Flag any private-to-public content risk before drafting publishable copy.',
    ],
    output: 'Content architecture brief with angle, structure, proof points, and approval boundary.',
  },
  'automation-systems': {
    objective: 'Review mapped automation workflow posture and identify the safest next operational action.',
    checklist: [
      'Summarize active production and staging workflow coverage.',
      'Identify workflows that are safe to monitor versus workflows that require approval before mutation.',
      'Recommend whether to inspect status, run a known admin path, or create an approval checkpoint.',
    ],
    output: 'Automation posture brief with workflow coverage, risk boundary, and next safe action.',
  },
  'inbox-follow-up': {
    objective: 'Prepare a follow-up readiness brief without sending external messages.',
    checklist: [
      'Separate draft, reply-detection, nurture, and meeting-intake workflow coverage.',
      'Flag any email send or public message action that requires human approval.',
      'Recommend the safest next review surface for outbound or follow-up work.',
    ],
    output: 'Follow-up readiness brief with channel, workflow, approval gate, and next review step.',
  },
}

function firstTaskForAgent(agent: AgentOrganizationNode): AgentFirstTaskTemplate {
  return AGENT_FIRST_TASKS[agent.key] ?? {
    objective: 'Define the next narrow read-only task before allowing this agent to perform side effects.',
    checklist: [
      'Confirm the agent responsibility and mapped runtime.',
      'Identify the current evidence or workflow surface to inspect.',
      'Return a reviewable artifact and keep production side effects behind the approval gate.',
    ],
    output: 'Read-only work brief with evidence, next action, and approval boundary.',
  }
}

export function buildAgentEngagementWorkPacket(agent: AgentOrganizationNode, note: string | null) {
  const pod = AGENT_PODS.find((item) => item.key === agent.podKey)
  const activeWorkflows = agent.n8nWorkflows.filter((workflow) => workflow.active)
  const workflowLines = activeWorkflows.length
    ? activeWorkflows
        .slice(0, 8)
        .map((workflow) => `- ${workflow.name} (${workflow.environment})`)
        .join('\n')
    : '- No active n8n workflow is mapped as the primary runtime yet.'

  const nextAction =
    agent.status === 'planned'
      ? 'Define a first narrow, read-only task before assigning production automation.'
      : agent.primaryRuntime === 'n8n'
        ? 'Review mapped workflow health and decide whether to trigger the existing admin or n8n path.'
        : agent.primaryRuntime === 'codex'
          ? 'Use Codex to draft or implement the next scoped artifact, then route through PR/deploy gates if code changes are needed.'
          : 'Use the listed engagement path and keep any production side effect behind the approval gate.'

  const summaryMarkdown = [
    `## ${agent.name} Work Packet`,
    '',
    `**Pod:** ${pod?.name ?? agent.podKey}`,
    `**Status:** ${agent.status}`,
    `**Primary runtime:** ${agent.primaryRuntime}`,
    '',
    `**Responsibility:** ${agent.responsibility}`,
    '',
    `**Engagement path:** ${agent.engagementPath}`,
    '',
    `**Approval gate:** ${agent.approvalGate}`,
    '',
    '### Suggested next action',
    nextAction,
    '',
    '### Workflow coverage',
    workflowLines,
    note ? ['', '### Operator note', note].join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    pod: pod?.name ?? agent.podKey,
    nextAction,
    activeWorkflowCount: activeWorkflows.length,
    workflowCount: agent.n8nWorkflows.length,
    summaryMarkdown,
  }
}

export function canRunReadOnlyAgentDispatch(agent: AgentOrganizationNode) {
  return agent.status !== 'planned'
}

export function buildReadOnlyAgentDispatch(agent: AgentOrganizationNode, note: string | null) {
  const activeWorkflows = agent.n8nWorkflows.filter((workflow) => workflow.active)
  const productionWorkflows = activeWorkflows.filter((workflow) => workflow.environment === 'production')
  const stagingWorkflows = activeWorkflows.filter((workflow) => workflow.environment === 'staging')
  const firstTask = firstTaskForAgent(agent)

  const nextActions =
    agent.key === 'chief-of-staff'
      ? [
          'Review active and failed Agent Ops runs.',
          'Route approval-sensitive work through the approval queue.',
          'Escalate stale or failed runtime work before assigning new automation.',
        ]
      : agent.primaryRuntime === 'n8n'
        ? [
            'Confirm mapped production workflows are active before triggering downstream work.',
            'Use existing admin surfaces for workflow-specific writes.',
            'Keep config or workflow changes behind an approval checkpoint.',
          ]
        : [
            'Use the work packet to define the next scoped artifact.',
            'Keep this run read-only until a human approves a specific mutation.',
            'Attach evidence, drafts, or implementation branches back to Agent Ops.',
          ]

  const summaryMarkdown = [
    `## ${agent.name} Read-Only Dispatch`,
    '',
    `**Runtime posture:** ${agent.primaryRuntime}`,
    `**Execution:** read-only`,
    `**Production workflows active:** ${productionWorkflows.length}`,
    `**Staging workflows active:** ${stagingWorkflows.length}`,
    '',
    `**Current responsibility:** ${agent.responsibility}`,
    '',
    '### Suggested next actions',
    ...nextActions.map((action) => `- ${action}`),
    '',
    '### First task',
    firstTask.objective,
    '',
    '### First task checklist',
    ...firstTask.checklist.map((item) => `- ${item}`),
    '',
    '### Expected output',
    firstTask.output,
    '',
    '### Approval boundary',
    agent.approvalGate,
    note ? ['', '### Operator note', note].join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    nextActions,
    activeWorkflowCount: activeWorkflows.length,
    productionWorkflowCount: productionWorkflows.length,
    stagingWorkflowCount: stagingWorkflows.length,
    firstTask,
    summaryMarkdown,
  }
}

export async function createAgentEngagementRun(
  input: CreateAgentEngagementRunInput,
): Promise<AgentEngagementRunResult> {
  const { agent } = input
  const note = input.note ? input.note.trim().slice(0, 500) : null
  const workPacket = buildAgentEngagementWorkPacket(agent, note)

  const run = await startAgentRun({
    agentKey: agent.key,
    runtime: 'manual',
    kind: 'agent_engagement_request',
    title: `Engage ${agent.name}`,
    status: 'queued',
    subject: {
      type: input.actor.subjectType,
      id: input.actor.subjectId,
      label: input.actor.subjectLabel,
    },
    triggerSource: input.triggerSource,
    triggeredByUserId: input.actor.userId ?? null,
    currentStep: 'Engagement request queued',
    metadata: {
      requested_agent: agent.key,
      requested_agent_name: agent.name,
      pod: agent.podKey,
      pod_name: workPacket.pod,
      status: agent.status,
      primary_runtime: agent.primaryRuntime,
      approval_gate: agent.approvalGate,
      engagement_path: agent.engagementPath,
      suggested_next_action: workPacket.nextAction,
      note,
      executes_action: false,
    },
    idempotencyKey: input.idempotencyKey ?? null,
  })

  await recordAgentEvent({
    runId: run.id,
    eventType: 'agent_engagement_requested',
    severity: 'info',
    message: input.requestedEventMessage,
    metadata: {
      agent_key: agent.key,
      note,
      ...(input.eventMetadata ?? {}),
    },
    idempotencyKey: `${run.id}:${input.triggerSource}:requested`,
  }).catch(() => {})

  const artifact = await attachAgentArtifact({
    runId: run.id,
    artifactType: 'agent_engagement_work_packet',
    title: `${agent.name} work packet`,
    refType: 'agent',
    refId: agent.key,
    metadata: {
      summary_markdown: workPacket.summaryMarkdown,
      requested_agent: agent.key,
      requested_agent_name: agent.name,
      pod: agent.podKey,
      pod_name: workPacket.pod,
      primary_runtime: agent.primaryRuntime,
      approval_gate: agent.approvalGate,
      engagement_path: agent.engagementPath,
      suggested_next_action: workPacket.nextAction,
      workflow_count: workPacket.workflowCount,
      active_workflow_count: workPacket.activeWorkflowCount,
      executes_action: false,
    },
    idempotencyKey: `${run.id}:agent-engagement-work-packet`,
  })

  let status: AgentEngagementRunResult['status'] = 'queued'
  let dispatchArtifactAttached = false

  if (canRunReadOnlyAgentDispatch(agent)) {
    const dispatch = buildReadOnlyAgentDispatch(agent, note)
    await recordAgentStep({
      runId: run.id,
      stepKey: 'read_only_dispatch',
      name: 'Prepared read-only agent dispatch',
      status: 'completed',
      inputSummary: `Agent: ${agent.name}`,
      outputSummary: `${dispatch.activeWorkflowCount} active mapped workflow(s); no production data mutation.`,
      metadata: {
        requested_agent: agent.key,
        execution_mode: 'read_only',
        production_workflow_count: dispatch.productionWorkflowCount,
        staging_workflow_count: dispatch.stagingWorkflowCount,
        next_actions: dispatch.nextActions,
        first_task: dispatch.firstTask,
        executes_action: false,
      },
      idempotencyKey: `${run.id}:read-only-dispatch-step`,
    })

    const dispatchArtifact = await attachAgentArtifact({
      runId: run.id,
      artifactType: 'agent_read_only_dispatch',
      title: `${agent.name} read-only dispatch`,
      refType: 'agent',
      refId: agent.key,
      metadata: {
        summary_markdown: dispatch.summaryMarkdown,
        requested_agent: agent.key,
        requested_agent_name: agent.name,
        execution_mode: 'read_only',
        production_workflow_count: dispatch.productionWorkflowCount,
        staging_workflow_count: dispatch.stagingWorkflowCount,
        next_actions: dispatch.nextActions,
        first_task: dispatch.firstTask,
        approval_gate: agent.approvalGate,
        executes_action: false,
      },
      idempotencyKey: `${run.id}:agent-read-only-dispatch`,
    })
    dispatchArtifactAttached = Boolean(dispatchArtifact)

    await endAgentRun({
      runId: run.id,
      status: 'completed',
      currentStep: 'Read-only dispatch ready',
      outcome: {
        requested_agent: agent.key,
        execution_mode: 'read_only',
        active_workflow_count: dispatch.activeWorkflowCount,
        work_packet_attached: Boolean(artifact),
        dispatch_artifact_attached: dispatchArtifactAttached,
        first_task: dispatch.firstTask,
        executes_action: false,
      },
    })
    status = 'completed'
  }

  return {
    runId: run.id,
    status,
    executionMode: status === 'completed' ? 'read_only' : 'queued_for_review',
    workPacketAttached: Boolean(artifact),
    dispatchArtifactAttached,
  }
}
