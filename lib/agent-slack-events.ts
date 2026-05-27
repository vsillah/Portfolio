import { runChiefOfStaffChat } from '@/lib/chief-of-staff-chat'
import { handleSlackAgentAction } from '@/lib/agent-slack-actions'
import { decodeSlackActionValue, type SlackAgentActionValue } from '@/lib/agent-slack-blocks'
import { supabaseAdmin } from '@/lib/supabase'

export type SlackAgentEvent = {
  type?: string
  channel?: string
  channel_type?: string
  user?: string
  text?: string
  ts?: string
  thread_ts?: string
  bot_id?: string
  subtype?: string
}

export type SlackAgentEventPayload = {
  type?: string
  challenge?: string
  event_id?: string
  event?: SlackAgentEvent
}

type SlackPostMessageInput = {
  channel: string
  text: string
  threadTs?: string
}

type HandleableSlackAgentEvent = SlackAgentEvent & {
  channel: string
  user: string
}

type SlackThreadContext = {
  runId: string
  actions: SlackAgentActionValue[]
}

export function shouldHandleSlackAgentEvent(event: SlackAgentEvent | undefined): event is HandleableSlackAgentEvent {
  if (!event) return false
  if (event.bot_id || event.subtype) return false
  if (!event.user || !event.channel) return false
  if (event.type === 'app_mention') return true
  return event.type === 'message' && event.channel_type === 'im'
}

export function normalizeSlackAgentMessage(event: SlackAgentEvent) {
  return (event.text || '')
    .replace(/<@[A-Z0-9]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatChiefOfStaffSlackReply(result: Awaited<ReturnType<typeof runChiefOfStaffChat>>) {
  const parts = [
    result.reply,
    result.suggestedActions.length
      ? `*Suggested next actions*\n${result.suggestedActions.map((action) => `- ${action}`).join('\n')}`
      : null,
    result.agentEngagements.length
      ? `*Relevant agents*\n${result.agentEngagements
        .map((agent) => `- \`${agent.agentKey}\` - ${agent.rationale}`)
        .join('\n')}`
      : null,
    `Trace: ${baseUrl()}/admin/agents/runs/${result.runId}`,
  ]

  return parts.filter(Boolean).join('\n\n')
}

function uniqueActionKey(value: SlackAgentActionValue) {
  return [value.action, value.approvalId, value.workItemId, value.runId, value.agentKey].filter(Boolean).join(':')
}

function extractSlackActionValues(blocks: unknown) {
  if (!Array.isArray(blocks)) return []
  const values: SlackAgentActionValue[] = []
  const seen = new Set<string>()
  for (const block of blocks) {
    if (!block || typeof block !== 'object' || !('elements' in block) || !Array.isArray(block.elements)) continue
    for (const element of block.elements) {
      if (!element || typeof element !== 'object' || !('value' in element) || typeof element.value !== 'string') continue
      const decoded = decodeSlackActionValue(element.value)
      if (!decoded) continue
      const key = uniqueActionKey(decoded)
      if (seen.has(key)) continue
      seen.add(key)
      values.push(decoded)
    }
  }
  return values
}

async function findSlackThreadContext(channel: string, threadTs: string): Promise<SlackThreadContext | null> {
  if (!supabaseAdmin) return null

  const { data: run, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id')
    .eq('kind', 'slack_mobile_notification')
    .filter('outcome->>slack_channel', 'eq', channel)
    .filter('outcome->>slack_thread_ts', 'eq', threadTs)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !run?.id) return null

  const { data: event } = await supabaseAdmin
    .from('agent_run_events')
    .select('metadata')
    .eq('run_id', run.id)
    .eq('event_type', 'slack_mobile_notification_sent')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const metadata = event?.metadata && typeof event.metadata === 'object'
    ? event.metadata as { blocks?: unknown }
    : null

  return {
    runId: run.id as string,
    actions: extractSlackActionValues(metadata?.blocks),
  }
}

function noteFromReply(message: string, fallback: string) {
  const colonIndex = message.indexOf(':')
  if (colonIndex >= 0) {
    const note = message.slice(colonIndex + 1).trim()
    if (note) return note
  }
  return message.trim() || fallback
}

function singleTargetAction(actions: SlackAgentActionValue[], predicate: (value: SlackAgentActionValue) => boolean) {
  const candidates = actions.filter(predicate)
  const targetKeys = new Set(candidates.map((value) => value.approvalId || value.workItemId || value.runId).filter(Boolean))
  return targetKeys.size === 1 ? candidates[0] : null
}

function singleWorkItemId(actions: SlackAgentActionValue[]) {
  const workItemIds = new Set(actions.map((value) => value.workItemId).filter((value): value is string => Boolean(value)))
  return workItemIds.size === 1 ? [...workItemIds][0] : null
}

function replyActionFromMessage(message: string, context: SlackThreadContext): SlackAgentActionValue | null {
  const normalized = message.trim().toLowerCase()
  const assignMatch = normalized.match(/^assign\s+([a-z0-9_-]+)/)
  if (assignMatch) {
    const workItemId = singleWorkItemId(context.actions)
    return workItemId ? { action: 'work.assign', workItemId, agentKey: assignMatch[1] } : null
  }

  const handoffMatch = normalized.match(/^handoff(?:\s+to)?\s+([a-z0-9_-]+)/)
  if (handoffMatch) {
    const workItemId = singleWorkItemId(context.actions)
    return workItemId
      ? {
          action: 'work.handoff',
          workItemId,
          agentKey: handoffMatch[1],
          note: noteFromReply(message, 'Handoff requested from Slack thread reply.'),
        }
      : null
  }

  if (/^(ack|acknowledge|seen|got it)\b/.test(normalized)) {
    const target = singleTargetAction(context.actions, (value) => value.action === 'work.acknowledge' || Boolean(value.workItemId))
    return target?.workItemId
      ? { action: 'work.acknowledge', workItemId: target.workItemId, note: noteFromReply(message, 'Blocker acknowledged from Slack thread reply.') }
      : null
  }

  if (/^(ready|mark ready|mark it ready|ready for review)\b/.test(normalized)) {
    const target = singleTargetAction(context.actions, (value) => value.action === 'work.ready' || Boolean(value.workItemId))
    return target?.workItemId
      ? { action: 'work.ready', workItemId: target.workItemId, note: noteFromReply(message, 'Marked ready from Slack thread reply.') }
      : null
  }

  if (/^(request revision|revise|needs revision|changes requested)\b/.test(normalized)) {
    const target = singleTargetAction(context.actions, (value) => value.action === 'work.revision' || Boolean(value.workItemId))
    return target?.workItemId
      ? { action: 'work.revision', workItemId: target.workItemId, note: noteFromReply(message, 'Revision requested from Slack thread reply.') }
      : null
  }

  if (/^approve\b/.test(normalized)) {
    const target = singleTargetAction(context.actions, (value) => value.action === 'approval.approve')
    return target?.approvalId
      ? { action: 'approval.approve', approvalId: target.approvalId, runId: target.runId, note: noteFromReply(message, 'Approved from Slack thread reply.') }
      : null
  }

  if (/^(reject|decline)\b/.test(normalized)) {
    const target = singleTargetAction(context.actions, (value) => Boolean(value.approvalId))
    return target?.approvalId
      ? { action: 'approval.reject', approvalId: target.approvalId, runId: target.runId, note: noteFromReply(message, 'Rejected from Slack thread reply.') }
      : null
  }

  return null
}

export async function handleSlackAgentEvent(payload: SlackAgentEventPayload) {
  const event = payload.event
  if (!shouldHandleSlackAgentEvent(event)) {
    return { handled: false as const, reason: 'unsupported_event' }
  }

  const channel = event.channel
  const user = event.user
  const message = normalizeSlackAgentMessage(event)
  if (!message) {
    await postSlackAgentMessage({
      channel,
      threadTs: event.thread_ts || event.ts,
      text: 'Ask me a question or tell me what Agent Ops should inspect. For deterministic controls, use `/agent help`.',
    })
    return { handled: true as const, reason: 'empty_message' }
  }

  const threadContext = event.thread_ts
    ? await findSlackThreadContext(channel, event.thread_ts)
    : null
  const replyAction = threadContext ? replyActionFromMessage(message, threadContext) : null
  if (replyAction) {
    const actionResult = await handleSlackAgentAction({
      type: 'block_actions',
      user: { id: user },
      action_ts: event.ts,
      container: { message_ts: event.thread_ts },
      actions: [{ value: JSON.stringify(replyAction) }],
    })

    await postSlackAgentMessage({
      channel,
      threadTs: event.thread_ts || event.ts,
      text: actionResult.text,
    })

    return { handled: true as const, reason: 'thread_reply_action' }
  }

  const contextRef = threadContext ? { type: 'run' as const, id: threadContext.runId } : null
  const result = await runChiefOfStaffChat({
    message,
    userId: `slack:${user}`,
    triggerSource: contextRef ? 'slack_agent_thread_reply' : 'slack_agent_chat',
    ...(contextRef ? { contextRef } : {}),
  })

  await postSlackAgentMessage({
    channel,
    threadTs: event.thread_ts || event.ts,
    text: formatChiefOfStaffSlackReply(result),
  })

  return { handled: true as const, runId: result.runId }
}

export async function postSlackAgentMessage(input: SlackPostMessageInput) {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[agent-slack-events] SLACK_BOT_TOKEN not configured; skipping Slack reply')
    return { ok: false, skipped: true, error: 'missing_slack_bot_token' }
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel: input.channel,
      text: input.text,
      thread_ts: input.threadTs,
      unfurl_links: false,
      unfurl_media: false,
    }),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok || body?.ok === false) {
    console.warn('[agent-slack-events] Slack reply failed:', response.status, body)
  }

  return body
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://amadutown.com'
}
