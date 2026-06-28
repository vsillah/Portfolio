import { runChiefOfStaffChat } from '@/lib/chief-of-staff-chat'
import { handleSlackAgentAction } from '@/lib/agent-slack-actions'
import { decodeSlackActionValue, type SlackAgentActionValue } from '@/lib/agent-slack-blocks'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveBusinessEmailConfig } from '@/lib/business-email-config'
import { sendUserGmailDraft } from '@/lib/gmail-user-api'
import { decryptRefreshToken } from '@/lib/gmail-user-oauth-crypto'

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

type RevenueReplyApprovalCommand =
  | { action: 'safe_to_send' }
  | { action: 'hold'; note?: string }
  | { action: 'modify'; note: string }

type RevenueReplyApprovalContext = {
  appDraftId: string
  gmailDraftId: string
}

export function shouldHandleSlackAgentEvent(event: SlackAgentEvent | undefined): event is HandleableSlackAgentEvent {
  if (!event) return false
  if (event.bot_id || event.subtype) return false
  if (!event.user || !event.channel) return false
  if (event.type === 'app_mention') return true
  if (event.type === 'message' && event.thread_ts && parseRevenueReplyApprovalCommand(normalizeSlackAgentMessage(event))) {
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

export function parseRevenueReplyApprovalCommand(message: string): RevenueReplyApprovalCommand | null {
  const trimmed = message.trim()
  const normalized = trimmed.toLowerCase()
  if (/^safe\s+to\s+send[.!]?$/.test(normalized)) return { action: 'safe_to_send' }
  if (/^hold\b/.test(normalized)) return { action: 'hold', note: noteFromReply(trimmed, 'Held from Slack thread reply.') }
  const modifyMatch = trimmed.match(/^modify\s*:\s*([\s\S]+)/i)
  if (modifyMatch?.[1]?.trim()) return { action: 'modify', note: modifyMatch[1].trim() }
  return null
}

function parseRevenueReplyApprovalContext(text: string): RevenueReplyApprovalContext | null {
  if (!/Revenue reply ready for approval/i.test(text)) return null

  const appDraftId = text.match(/\*?App draft ID:\*?\s*`?([0-9a-f-]{36})`?/i)?.[1]
  const gmailDraftId = text.match(/\*?Gmail draft ID:\*?\s*`?([A-Za-z0-9_-]+)`?/i)?.[1]
  if (!appDraftId || !gmailDraftId) return null
  return { appDraftId, gmailDraftId }
}

async function findRevenueReplyApprovalContext(channel: string, threadTs: string): Promise<RevenueReplyApprovalContext | null> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return null

  const url = new URL('https://slack.com/api/conversations.replies')
  url.searchParams.set('channel', channel)
  url.searchParams.set('ts', threadTs)
  url.searchParams.set('limit', '20')
  url.searchParams.set('inclusive', 'true')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.ok === false || !Array.isArray(body?.messages)) {
    console.warn('[agent-slack-events] Slack thread fetch failed:', response.status, body)
    return null
  }

  const parent = body.messages.find((message: { ts?: string }) => message.ts === threadTs) ?? body.messages[0]
  const text = typeof parent?.text === 'string' ? parent.text : ''
  return parseRevenueReplyApprovalContext(text)
}

async function handleRevenueReplyApprovalCommand(command: RevenueReplyApprovalCommand, context: RevenueReplyApprovalContext) {
  if (!supabaseAdmin) {
    return 'Revenue reply approval could not run because the database is not available. No email was sent.'
  }

  const { data: draft, error: draftError } = await supabaseAdmin
    .from('client_update_drafts')
    .select('id, status, subject, client_email')
    .eq('id', context.appDraftId)
    .single()

  if (draftError || !draft?.id) {
    console.warn('[agent-slack-events] Revenue reply draft lookup failed:', draftError)
    return `I could not find app draft ${context.appDraftId}. No email was sent.`
  }

  if (command.action === 'hold') {
    return `Held. App draft ${context.appDraftId} remains unsent.`
  }

  if (command.action === 'modify') {
    return [
      `Modification request captured for app draft ${context.appDraftId}.`,
      `Requested change: ${command.note}`,
      'No email was sent. Continue iterating in Codex or update the draft, then reply `safe to send` when approved.',
    ].join('\n')
  }

  if (draft.status === 'sent') {
    return `App draft ${context.appDraftId} is already marked sent. No duplicate email was sent.`
  }

  const requiredSender = resolveBusinessEmailConfig().fromEmail.toLowerCase()
  const { data: credential, error: credentialError } = await supabaseAdmin
    .from('admin_gmail_user_credentials')
    .select('google_email, refresh_token_cipher, refresh_token_iv, refresh_token_tag')
    .ilike('google_email', requiredSender)
    .limit(1)
    .maybeSingle()

  if (credentialError || !credential?.refresh_token_cipher || !credential?.refresh_token_iv || !credential?.refresh_token_tag) {
    console.warn('[agent-slack-events] Revenue reply Gmail credential lookup failed:', credentialError)
    return `No connected Gmail credential was found for ${requiredSender}. No email was sent.`
  }

  const refreshToken = decryptRefreshToken(
    credential.refresh_token_cipher as string,
    credential.refresh_token_iv as string,
    credential.refresh_token_tag as string,
  )
  await sendUserGmailDraft(refreshToken, context.gmailDraftId)

  const { error: updateError } = await supabaseAdmin
    .from('client_update_drafts')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_via: 'email',
    })
    .eq('id', context.appDraftId)
    .eq('status', 'draft')
    .select('id')
    .single()

  if (updateError) {
    console.warn('[agent-slack-events] Revenue reply sent but draft status update failed:', updateError)
    return `Sent Gmail draft ${context.gmailDraftId}, but Portfolio could not mark app draft ${context.appDraftId} as sent.`
  }

  return `Sent Gmail draft ${context.gmailDraftId} from ${requiredSender} and marked app draft ${context.appDraftId} as sent.`
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
  const revenueReplyCommand = event.thread_ts ? parseRevenueReplyApprovalCommand(message) : null
  if (revenueReplyCommand) {
    const revenueReplyContext = await findRevenueReplyApprovalContext(channel, event.thread_ts as string)
    if (revenueReplyContext) {
      const text = await handleRevenueReplyApprovalCommand(revenueReplyCommand, revenueReplyContext)
      await postSlackAgentMessage({
        channel,
        threadTs: event.thread_ts || event.ts,
        text,
      })
      return { handled: true as const, reason: 'revenue_reply_approval_action' }
    }
  }

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
