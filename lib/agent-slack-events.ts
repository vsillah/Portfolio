import { getSlackAgentSource } from '@/lib/slack-agent-environment'
import { runChiefOfStaffChat } from '@/lib/chief-of-staff-chat'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuthorizedSlackActor, requireAuthorizedSlackChannel } from '@/lib/slack-agent-access'

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
  team_id?: string
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
}

type RevenueReplyApprovalCommand =
  | { action: 'safe_to_send' }
  | { action: 'hold'; note?: string }
  | { action: 'modify'; note: string }

export function shouldHandleSlackAgentEvent(event: SlackAgentEvent | undefined): event is HandleableSlackAgentEvent {
  if (!event) return false
  if (event.bot_id || event.subtype) return false
  if (!event.user || !event.channel) return false
  if (event.type === 'app_mention') return true
  if (event.type === 'message' && event.thread_ts && isSlackTextDecision(normalizeSlackAgentMessage(event))) {
    return true
  }
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

  return { runId: run.id as string }
}

function noteFromReply(message: string, fallback: string) {
  const colonIndex = message.indexOf(':')
  if (colonIndex >= 0) {
    const note = message.slice(colonIndex + 1).trim()
    if (note) return note
  }
  return message.trim() || fallback
}

function stripSlackConnectorProvenance(message: string) {
  return message.replace(/\s*\*?Sent using\*?\s+ChatGPT\s*$/i, '').trim()
}

export function parseRevenueReplyApprovalCommand(message: string): RevenueReplyApprovalCommand | null {
  const trimmed = stripSlackConnectorProvenance(message.trim())
  const normalized = trimmed.toLowerCase()
  if (/^safe\s+to\s+send[.!]?$/.test(normalized)) return { action: 'safe_to_send' }
  if (/^hold\b/.test(normalized)) return { action: 'hold', note: noteFromReply(trimmed, 'Held from Slack thread reply.') }
  const modifyMatch = trimmed.match(/^modify\s*:\s*([\s\S]+)/i)
  if (modifyMatch?.[1]?.trim()) return { action: 'modify', note: modifyMatch[1].trim() }
  return null
}

function isSlackTextDecision(message: string) {
  const normalized = stripSlackConnectorProvenance(message).trim().toLowerCase()
  return Boolean(parseRevenueReplyApprovalCommand(normalized)) ||
    /^(approve|reject|decline|assign|claim|handoff|ack|acknowledge|seen|got it|ready|mark ready|mark it ready|request revision|revise|needs revision|changes requested|hold|modify|safe\s+to\s+send)\b/.test(normalized)
}

export async function handleSlackAgentEvent(payload: SlackAgentEventPayload) {
  const event = payload.event
  if (!shouldHandleSlackAgentEvent(event)) {
    return { handled: false as const, reason: 'unsupported_event' }
  }

  const authorization = requireAuthorizedSlackActor({ userId: event.user, teamId: payload.team_id })
  if (!authorization.ok) return { handled: false as const, reason: 'unauthorized', text: authorization.text }
  const channelAuthorization = requireAuthorizedSlackChannel(event.channel)
  if (!channelAuthorization.ok) return { handled: false as const, reason: 'unauthorized_channel', text: channelAuthorization.text }

  try {
    baseUrl()
  } catch {
    return { handled: false as const, reason: 'invalid_source_configuration' }
  }

  if (!slackBotToken()) return { handled: false as const, reason: 'missing_source_bot_token' }

  const channel = event.channel
  const user = event.user
  const message = normalizeSlackAgentMessage(event)
  if (!message) {
    const delivery = await postSlackAgentMessage({
      channel,
      threadTs: event.thread_ts || event.ts,
      text: 'Ask me a question or tell me what Agent Ops should inspect. For deterministic controls, use `/agent help`.',
    })
    return { handled: true as const, reason: 'empty_message', ...deliveryFailure(delivery) }
  }

  // Free text is not a bound receipt envelope. Do not read draft context, invoke
  // a model, or mutate canonical work while suggesting a fresh review path.
  if (isSlackTextDecision(message)) {
    const revenue = parseRevenueReplyApprovalCommand(message)
    const text = revenue
      ? `Free-text Slack replies cannot authorize Gmail sends. No send, hold, or revision was recorded. Open the current Portfolio draft review: ${baseUrl()}/admin/meeting-tasks`
      : `No decision was recorded from this text. Use the buttons on the current review card, or review in Portfolio: ${baseUrl()}/admin/agents`
    const delivery = await postSlackAgentMessage({ channel, threadTs: event.thread_ts || event.ts, text })
    return { handled: true as const, reason: 'text_decision_requires_review', ...deliveryFailure(delivery) }
  }

  const threadContext = event.thread_ts ? await findSlackThreadContext(channel, event.thread_ts) : null

  if (event.type === 'message' && event.channel_type !== 'im') {
    return { handled: false as const, reason: 'unsupported_channel_thread_reply' }
  }

  const contextRef = threadContext ? { type: 'run' as const, id: threadContext.runId } : null
  const result = await runChiefOfStaffChat({
    message,
    userId: `slack:${user}`,
    triggerSource: contextRef ? 'slack_agent_thread_reply' : 'slack_agent_chat',
    ...(contextRef ? { contextRef } : {}),
  })

  const delivery = await postSlackAgentMessage({
    channel,
    threadTs: event.thread_ts || event.ts,
    text: formatChiefOfStaffSlackReply(result),
  })

  return { handled: true as const, runId: result.runId, ...deliveryFailure(delivery) }
}

function deliveryFailure(delivery: { ok?: boolean } | null) {
  return delivery?.ok === true ? {} : { deliveryStatus: 'failed' as const }
}

export async function postSlackAgentMessage(input: SlackPostMessageInput) {
  const token = slackBotToken()
  if (!token) {
    console.warn('[agent-slack-events] Source-specific Slack bot token not configured; skipping reply')
    return { ok: false, skipped: true, error: 'missing_source_bot_token' }
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
  }).catch(() => null)
  if (!response) return { ok: false, error: 'slack_reply_failed' }

  const body = await response.json().catch(() => null)
  if (!response.ok || body?.ok !== true) {
    console.warn('[agent-slack-events] Slack reply failed:', response.status)
    return { ok: false, error: 'slack_reply_failed' }
  }

  return body
}

function slackBotToken() {
  try {
    const { sourceEnvironment } = getSlackAgentSource()
    const scoped = process.env[`SLACK_AGENT_OPS_${sourceEnvironment.toUpperCase()}_BOT_TOKEN`]
    return scoped || (sourceEnvironment === 'production' ? process.env.SLACK_BOT_TOKEN : undefined)
  } catch {
    return undefined
  }
}

function baseUrl() {
  return getSlackAgentSource().sourceOrigin
}
