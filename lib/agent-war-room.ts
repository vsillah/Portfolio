import {
  attachAgentArtifact,
  endAgentRun,
  recordAgentEvent,
  recordAgentStep,
  startAgentRun,
} from '@/lib/agent-run'
import { AGENT_ORGANIZATION, AGENT_PODS } from '@/lib/agent-organization'
import { buildAgentMissionControlSnapshot } from '@/lib/agent-mission-control'

export type AgentWarRoomCommand = 'standup' | 'discuss'

export interface RunAgentWarRoomInput {
  command: AgentWarRoomCommand
  message?: string | null
  triggerSource: string
  actor?: {
    id?: string | null
    label?: string | null
    type?: string | null
  }
}

function assertCommand(command: string): asserts command is AgentWarRoomCommand {
  if (command !== 'standup' && command !== 'discuss') {
    throw new Error('Invalid war room command')
  }
}

function podName(podKey: string) {
  return AGENT_PODS.find((pod) => pod.key === podKey)?.name ?? podKey
}

function selectAgents(command: AgentWarRoomCommand, message: string | null) {
  const callable = AGENT_ORGANIZATION.filter((agent) => agent.status !== 'planned')
  if (command === 'standup') return callable.slice(0, 8)

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

function agentUpdate(agent: (typeof AGENT_ORGANIZATION)[number], command: AgentWarRoomCommand, message: string | null) {
  const activeWorkflows = agent.n8nWorkflows.filter((workflow) => workflow.active).length
  const scope =
    command === 'standup'
      ? `Current posture: ${agent.status}; ${activeWorkflows} active mapped workflow(s).`
      : `Perspective on "${message}": ${agent.responsibility}`

  return {
    agent_key: agent.key,
    agent_name: agent.name,
    pod: podName(agent.podKey),
    runtime: agent.primaryRuntime,
    status: agent.status,
    update: scope,
    next_action: agent.status === 'active'
      ? 'Ready for read-only engagement through Agent Ops.'
      : 'Use Chief of Staff routing before assigning production work.',
    approval_gate: agent.approvalGate,
  }
}

function synthesize(command: AgentWarRoomCommand, updates: ReturnType<typeof agentUpdate>[], attentionCount: number) {
  if (command === 'standup') {
    const ready = updates.filter((update) => update.status === 'active').length
    const partial = updates.filter((update) => update.status === 'partial').length
    return `Standup complete: ${ready} active agent(s), ${partial} partial agent(s), and ${attentionCount} item(s) in the attention queue. Start with the attention queue, then route the next task through Chief of Staff.`
  }

  const pods = Array.from(new Set(updates.map((update) => update.pod))).join(', ')
  return `Discussion complete across ${pods}. Treat this as advisory context: use Chief of Staff to convert it into one traced engagement or approval-gated action.`
}

export async function runAgentWarRoom(input: RunAgentWarRoomInput) {
  assertCommand(input.command)
  const message = input.message?.trim().slice(0, 1000) || null
  if (input.command === 'discuss' && !message) {
    throw new Error('Message is required for discuss')
  }

  const title = input.command === 'standup' ? 'Agent War Room standup' : 'Agent War Room discussion'
  const run = await startAgentRun({
    agentKey: 'chief-of-staff',
    runtime: 'manual',
    kind: input.command === 'standup' ? 'agent_war_room_standup' : 'agent_war_room_discussion',
    title,
    status: 'running',
    subject: {
      type: input.actor?.type ?? 'agent_war_room',
      id: input.actor?.id ?? input.command,
      label: input.actor?.label ?? 'Agent War Room',
    },
    triggerSource: input.triggerSource,
    currentStep: 'Collecting mission control state',
    metadata: {
      command: input.command,
      message_preview: message,
      executes_action: false,
    },
  })

  const snapshot = await buildAgentMissionControlSnapshot()
  const agents = selectAgents(input.command, message)
  const updates = agents.map((agent) => agentUpdate(agent, input.command, message))
  const synthesis = synthesize(input.command, updates, snapshot.attention_queue.length)

  await recordAgentStep({
    runId: run.id,
    stepKey: 'collect_war_room_context',
    name: 'Collected mission control state',
    status: 'completed',
    outputSummary: `${snapshot.status_strip.active} active run(s), ${snapshot.attention_queue.length} attention item(s)`,
    metadata: {
      status_strip: snapshot.status_strip,
      attention_queue_count: snapshot.attention_queue.length,
    },
  })

  await recordAgentStep({
    runId: run.id,
    stepKey: 'agent_updates',
    name: input.command === 'standup' ? 'Collected agent standup updates' : 'Collected agent discussion updates',
    status: 'completed',
    outputSummary: `${updates.length} agent update(s)`,
    metadata: { updates },
  })

  await attachAgentArtifact({
    runId: run.id,
    artifactType: input.command === 'standup' ? 'war_room_standup_transcript' : 'war_room_discussion_transcript',
    title: input.command === 'standup' ? 'Agent standup transcript' : 'Agent discussion transcript',
    refType: 'agent_war_room',
    refId: input.command,
    metadata: {
      command: input.command,
      message,
      updates,
      synthesis,
      status_strip: snapshot.status_strip,
      executes_action: false,
    },
    idempotencyKey: `${run.id}:war-room-transcript`,
  })

  await recordAgentEvent({
    runId: run.id,
    eventType: input.command === 'standup' ? 'war_room_standup_completed' : 'war_room_discussion_completed',
    severity: 'info',
    message: synthesis,
    metadata: { command: input.command, update_count: updates.length },
  })

  await endAgentRun({
    runId: run.id,
    status: 'completed',
    currentStep: input.command === 'standup' ? 'Standup synthesis ready' : 'Discussion synthesis ready',
    outcome: {
      command: input.command,
      update_count: updates.length,
      synthesis,
      executes_action: false,
    },
  })

  return {
    runId: run.id,
    command: input.command,
    updates,
    synthesis,
  }
}
