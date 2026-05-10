import { runChiefOfStaffChat } from '@/lib/chief-of-staff-chat'

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

  const result = await runChiefOfStaffChat({
    message,
    userId: `slack:${user}`,
    triggerSource: 'slack_agent_chat',
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
