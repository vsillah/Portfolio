import { createAgentEngagementRun } from '@/lib/agent-engagement'
import { runAgentWarRoom } from '@/lib/agent-war-room'
import { getAgentByKey } from '@/lib/agent-organization'
import { buildAgentMissionControlSnapshot } from '@/lib/agent-mission-control'
import type { AgentInboxItem } from '@/lib/agent-mission-control'

export type AgentInboxRouteActor = {
  id: string
  label: string
  type: 'admin_user' | 'slack_command'
  userId?: string | null
}

export type AgentInboxRouteResult = {
  item: AgentInboxItem
  runId: string
  routeAction: 'war_room_standup' | 'agent_engagement'
  status: 'queued' | 'completed'
  executionMode: 'read_only' | 'queued_for_review'
}

export function findAgentInboxItem(items: AgentInboxItem[], itemRef: string) {
  const trimmed = itemRef.trim()
  const numericIndex = Number.parseInt(trimmed, 10)
  if (Number.isFinite(numericIndex) && `${numericIndex}` === trimmed && numericIndex > 0) {
    return items[numericIndex - 1]
  }

  return items.find((item) => item.id === trimmed)
}

export function buildAgentInboxRouteNote(item: AgentInboxItem) {
  return [
    `Agent Inbox item: ${item.title}`,
    `Priority: ${item.priority}`,
    `Reason: ${item.reason}`,
    `Owning agent: ${item.agent_name}`,
    item.source_run_id ? `Source run: ${item.source_run_id}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function routeAgentInboxItem(input: {
  itemRef: string
  actor: AgentInboxRouteActor
  triggerSource: string
}): Promise<AgentInboxRouteResult> {
  const snapshot = await buildAgentMissionControlSnapshot()
  const item = findAgentInboxItem(snapshot.agent_inbox, input.itemRef)
  if (!item) {
    throw new Error('Agent Inbox item not found')
  }

  if (item.id === 'chief-of-staff:standup') {
    const result = await runAgentWarRoom({
      command: 'standup',
      triggerSource: input.triggerSource,
      actor: {
        id: input.actor.id,
        label: input.actor.label,
        type: input.actor.type,
      },
    })

    return {
      item,
      runId: result.runId,
      routeAction: 'war_room_standup',
      status: 'completed',
      executionMode: 'read_only',
    }
  }

  const agent = getAgentByKey(item.agent_key) ?? getAgentByKey('chief-of-staff')
  if (!agent) {
    throw new Error('No routeable agent found for inbox item')
  }

  const result = await createAgentEngagementRun({
    agent,
    actor: {
      subjectType: 'agent_inbox_item',
      subjectId: item.id,
      subjectLabel: item.title,
      userId: input.actor.userId ?? null,
    },
    triggerSource: input.triggerSource,
    note: buildAgentInboxRouteNote(item),
    requestedEventMessage: `${input.actor.label} routed Agent Inbox item: ${item.title}`,
    eventMetadata: {
      agent_inbox_item_id: item.id,
      agent_inbox_priority: item.priority,
      source_run_id: item.source_run_id,
      route_action: 'agent_engagement',
      routed_by: input.actor.type,
    },
  })

  return {
    item,
    runId: result.runId,
    routeAction: 'agent_engagement',
    status: result.status,
    executionMode: result.executionMode,
  }
}
