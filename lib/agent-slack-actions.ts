import { getSlackAgentSource } from '@/lib/slack-agent-environment'
import { runChiefOfStaffChat } from '@/lib/chief-of-staff-chat'
import { recordAgentEvent } from '@/lib/agent-run'
import {
  claimAgentWorkItem,
  createAgentWorkItem,
  getAgentWorkItem,
  handoffAgentWorkItem,
  markAgentWorkItemReadyForKanban,
  recordAgentWorkItemBlocker,
} from '@/lib/agent-work-items'
import { routeAgentInboxItem } from '@/lib/agent-inbox-routing'
import { supabaseAdmin } from '@/lib/supabase'
import { decodeSlackActionValue, type SlackAgentActionValue } from '@/lib/agent-slack-blocks'
import { decideSocialCommentReplyFromSlack } from '@/lib/social-comment-attention'
import {
  authorizeCalendarDraftHandoff,
  rejectCalendarDraftHandoff,
} from '@/lib/social-content-calendar-handoff'
import { decideWarmGmailSendAuthorizationFromSlack } from '@/lib/warm-outreach-slack-send-approval'
import { allowedSlackUserIds, isLocalSlackDevelopment, requireAuthorizedSlackActor } from '@/lib/slack-agent-access'

export type SlackInteractivePayload = {
  type?: string
  team?: { id?: string }
  channel?: { id?: string }
  user?: {
    id?: string
    username?: string
    name?: string
  }
  actions?: Array<{
    action_id?: string
    value?: string
    url?: string
  }>
  callback_id?: string
  trigger_id?: string
  response_url?: string
  action_ts?: string
  message?: {
    ts?: string
  }
  container?: {
    message_ts?: string
    channel_id?: string
  }
}

export type SlackAgentActionResult = {
  responseType: 'ephemeral' | 'in_channel'
  text: string
  replaceOriginal?: boolean
  actionStatus?: 'completed' | 'already_recorded' | 'blocked' | 'failed'
}

type ApprovalRow = {
  id: string
  run_id: string
  approval_type: string
  status: string
  metadata: Record<string, unknown> | null
}

function baseUrl() {
  return getSlackAgentSource().sourceOrigin
}

function agentRunsUrl(runId?: string | null) {
  return `${baseUrl()}/admin/agents/runs${runId ? `/${runId}` : ''}`
}

function agentKanbanUrl() {
  return `${baseUrl()}/admin/agents/swarm-board`
}

function isSlackDecidableApproval(approvalType: string) {
  return approvalType === 'vercel_deployment_research_proposal'
}

function actionFromPayload(payload: SlackInteractivePayload): SlackAgentActionValue | null {
  const action = payload.actions?.[0]
  return decodeSlackActionValue(action?.value)
}

function idempotencyKey(payload: SlackInteractivePayload, value: SlackAgentActionValue) {
  const warmSendTarget = value.action.startsWith('warm_gmail_send.')
    ? value.sendQueueIdempotencyKey ?? value.messageVersionKey ?? value.outreachQueueId
    : null
  const target =
    warmSendTarget ??
    value.approvalId ??
    value.workItemId ??
    value.runId ??
    value.calendarItemId ??
    value.commentId ??
    value.contentId ??
    value.sendQueueIdempotencyKey ??
    value.messageVersionKey ??
    value.outreachQueueId ??
    (typeof value.contactId === 'number' ? `contact-${value.contactId}` : 'unknown-target')

  return [
    'slack-agent-action',
    payload.team?.id ?? 'local-team',
    payload.channel?.id ?? payload.container?.channel_id ?? 'local-channel',
    payload.user?.id ?? 'unknown-user',
    payload.container?.message_ts ?? payload.message?.ts ?? 'unknown-ts',
    value.action,
    target,
    ...(value.agentKey ? [value.agentKey] : []),
  ].join(':')
}

async function hasRecordedSlackAction(key: string) {
  if (!supabaseAdmin) return false
  const { data, error } = await supabaseAdmin
    .from('agent_run_events')
    .select('id')
    .eq('idempotency_key', key)
    .maybeSingle()
  if (error) throw new Error('Could not verify the previous Slack action. No action was started.')
  return Boolean(data?.id)
}

async function recordSlackActionEvent(input: {
  key: string
  runId?: string | null
  eventType: string
  message: string
  metadata?: Record<string, unknown>
}) {
  if (!input.runId) throw new Error('No canonical run is available to record this Slack action.')
  const event = await recordAgentEvent({
    runId: input.runId,
    eventType: input.eventType,
    severity: 'info',
    message: input.message,
    metadata: input.metadata,
    idempotencyKey: input.key,
  })
  if (!event && !(await hasRecordedSlackAction(input.key))) {
    throw new Error('Slack action trace could not be confirmed.')
  }
}

function actionResult(text: string, actionStatus: SlackAgentActionResult['actionStatus']): SlackAgentActionResult {
  return { responseType: 'ephemeral', text, actionStatus }
}

// Existing decision adapters return canonical Portfolio links in their text.
// Keep those review paths on the same source as the approved Slack envelope.
function sourceReviewLinks(text: string) {
  return text.replace(/https?:\/\/[^\s<>]+/g, (link) => {
    const url = new URL(link)
    return url.pathname.startsWith('/admin/')
      ? `${baseUrl()}${url.pathname}${url.search}${url.hash}`
      : link
  })
}

// These existing adapters return text, not structured outcomes. Unknown responses
// must never be promoted to successful receipts.
function legacyDecisionStatus(text: string): NonNullable<SlackAgentActionResult['actionStatus']> {
  if (text.startsWith('Portfolio review required')) return 'blocked'
  if (text.startsWith('Already handled') || text.includes('was already recorded') || text.startsWith('Reply already has submitted')) return 'already_recorded'
  if (/^(Reply (approved|rejected) from Slack|Warm Gmail send (approved|rejected|revision requested) in Portfolio)/.test(text)) return 'completed'
  return 'failed'
}

async function decideApprovalFromSlack(input: {
  approvalId: string
  status: 'approved' | 'rejected'
  actorLabel: string
  slackUserId: string
  decisionNotes: string
  idempotencyKey: string
}) {
  if (!supabaseAdmin) throw new Error('Database not available')

  const { data: approval, error } = await supabaseAdmin
    .from('agent_approvals')
    .select('id, run_id, approval_type, status, metadata')
    .eq('id', input.approvalId)
    .maybeSingle()

  if (error || !approval?.id) throw new Error('Approval not found')
  const row = approval as ApprovalRow
  if (row.status !== 'pending') {
    return actionResult(`Approval already ${row.status}. No new execution was started. Trace: ${agentRunsUrl(row.run_id)}`, 'already_recorded')
  }
  if (!isSlackDecidableApproval(row.approval_type)) {
    return actionResult(`Portfolio review required for \`${row.approval_type}\`. Open trace: ${agentRunsUrl(row.run_id)}`, 'blocked')
  }

  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const decision = {
    status: input.status,
    decision_notes: input.decisionNotes,
    decided_by_slack_user_id: input.slackUserId,
    decided_by_label: input.actorLabel,
    decided_at: new Date().toISOString(),
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('agent_approvals')
    .update({
      status: input.status,
      decided_at: decision.decided_at,
      decision_notes: input.decisionNotes,
      metadata: {
        ...metadata,
        slack_decision: decision,
      },
    })
    .eq('id', row.id)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle()

  if (updateError) throw new Error(`Failed to update approval: ${updateError.message}`)
  if (!updated?.id) {
    const { data: winner, error: winnerError } = await supabaseAdmin
      .from('agent_approvals')
      .select('status')
      .eq('id', row.id)
      .maybeSingle()
    if (winnerError || !winner || winner.status === 'pending') {
      return actionResult(`Decision was not recorded. Reload the current approval: ${agentRunsUrl(row.run_id)}`, 'failed')
    }
    return actionResult(`Approval already ${winner.status}. Your decision did not replace it. Trace: ${agentRunsUrl(row.run_id)}`, 'already_recorded')
  }

  // The approval is authoritative. Related trace failures must not undo it or
  // imply that a worker started; reconciliation can repair these projections.
  const failures: string[] = []
  try {
    const { error: eventError } = await supabaseAdmin.from('agent_run_events').insert({
      run_id: row.run_id,
      event_type: 'slack_approval_decided',
      severity: input.status === 'rejected' ? 'warning' : 'info',
      message: `${row.approval_type}: ${input.status} from Slack`,
      metadata: {
        approval_id: row.id,
        approval_type: row.approval_type,
        slack_user_id: input.slackUserId,
        actor_label: input.actorLabel,
        decision_notes: input.decisionNotes,
      },
      idempotency_key: input.idempotencyKey,
    })
    if (eventError && eventError.code !== '23505') failures.push('decision trace')

    const workItemId = typeof metadata.work_item_id === 'string' ? metadata.work_item_id : null
    if (workItemId) {
      const { data: workItem, error: workError } = await supabaseAdmin
        .from('agent_work_items')
        .update({
          validation_summary:
            input.status === 'approved'
              ? 'Slack approval recorded. Execution has not been started by this decision.'
              : `Slack approval rejected: ${input.decisionNotes}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workItemId)
        .select('id')
        .maybeSingle()
      if (workError || !workItem?.id) failures.push('work item summary')
    }

    const { error: runError } = await supabaseAdmin
      .from('agent_runs')
      .update({
        current_step: input.status === 'approved'
          ? 'Approval recorded; governed continuation not started'
          : 'Approval rejected; review required',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.run_id)
      .eq('status', 'waiting_for_approval')
    if (runError) failures.push('run summary')
  } catch {
    failures.push('downstream synchronization')
  }

  return actionResult([
    `Approval ${input.status} from Slack. No execution was started.`,
    failures.length ? `Decision saved, but synchronization failed for ${failures.join(', ')}. Review the trace before retrying.` : null,
    `Trace: ${agentRunsUrl(row.run_id)}`,
  ].filter(Boolean).join('\n'), failures.length ? 'failed' : 'completed')
}

async function runIdForWorkItem(workItemId: string) {
  const item = await getAgentWorkItem(workItemId)
  return item?.active_run_id ?? item?.source_run_id ?? null
}

function socialCalendarUrl(calendarItemId: string) {
  return `${baseUrl()}/admin/agents/content-intelligence?section=calendar&calendar_item=${encodeURIComponent(calendarItemId)}`
}

function socialContentUrl(contentId?: string | null) {
  return contentId ? `${baseUrl()}/admin/social-content/${contentId}` : null
}

async function decideSocialCalendarDraftHandoffFromSlack(input: {
  calendarItemId: string
  status: 'authorized' | 'rejected'
  slackUserId: string
  decisionNotes: string
}) {
  const auth = { user: { id: `slack:${input.slackUserId}` } }

  if (input.status === 'authorized') {
    const result = await authorizeCalendarDraftHandoff(input.calendarItemId, auth)
    const contentUrl = socialContentUrl(result.socialContentId)
    return actionResult([
      result.alreadyAuthorized
        ? 'Content calendar draft handoff was already authorized.'
        : 'Content calendar draft handoff authorized from Slack.',
      contentUrl ? `Content readiness: ${contentUrl}` : `Calendar: ${socialCalendarUrl(input.calendarItemId)}`,
      result.handoffWorkItemId ? `Handoff work item: ${result.handoffWorkItemId}` : null,
      'External publishing, provider calls, uploads, scheduling, Gmail, and SMS remain disabled.',
    ].filter(Boolean).join('\n'), result.alreadyAuthorized ? 'already_recorded' : 'completed')
  }

  const result = await rejectCalendarDraftHandoff({
    id: input.calendarItemId,
    decisionNote: input.decisionNotes,
    auth,
  })
  return actionResult([
    result.alreadyRejected
      ? 'Content calendar draft handoff was already rejected.'
      : 'Content calendar draft handoff rejected from Slack.',
    result.revisionWorkItemId ? `Revision work item: ${result.revisionWorkItemId}` : null,
    `Calendar: ${socialCalendarUrl(input.calendarItemId)}`,
    'No external action was taken.',
  ].filter(Boolean).join('\n'), result.alreadyRejected ? 'already_recorded' : 'completed')
}

export function prepareSlackAgentAction(payload: SlackInteractivePayload) {
  const reject = (text: string) => ({ ok: false as const, result: actionResult(text, 'blocked') })
  if (!payload || typeof payload !== 'object') return reject('Slack action rejected: invalid payload.')
  const authorization = requireAuthorizedSlackActor({
    userId: payload.user?.id,
    userName: payload.user?.username || payload.user?.name,
    teamId: payload.team?.id,
  })
  if (!authorization.ok) return reject(authorization.text)
  try {
    baseUrl()
  } catch {
    return reject('Slack action rejected: source environment or origin is not configured. Request a fresh review card after configuration is corrected.')
  }
  if (payload.type !== 'block_actions' || !Array.isArray(payload.actions) || payload.actions.length !== 1) {
    return reject('Slack action rejected: expected one block action.')
  }

  const value = actionFromPayload(payload)
  if (!value) {
    const rawUrl = payload.actions?.[0]?.url
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
    if (url) {
      try {
        const gate = new URL(url)
        if (gate.origin !== baseUrl()) return reject(`Open a fresh Portfolio review card for this source: ${baseUrl()}/admin/agents`)
        if (!gate.pathname.startsWith('/admin/')) return reject('Open a fresh Portfolio review card for this decision.')
        return reject(`Complete this decision in the current Portfolio review gate: ${baseUrl()}${gate.pathname}${gate.search}${gate.hash}`)
      } catch {
        return reject('Open a fresh Portfolio review card for this decision.')
      }
    }
    return reject('Slack action rejected: missing or invalid action payload.')
  }
  if (![payload.container?.message_ts, payload.message?.ts].some((ts) => typeof ts === 'string' && ts.trim())) {
    return reject('Slack action rejected: missing source message identity. Open a fresh Portfolio review card.')
  }
  if (payload.channel?.id && payload.container?.channel_id && payload.channel.id !== payload.container.channel_id) {
    return reject('Slack action rejected: conflicting channel identity.')
  }
  if (!isLocalSlackDevelopment() && !(payload.channel?.id || payload.container?.channel_id)) {
    return reject('Slack action rejected: missing source channel identity.')
  }
  const stringFields = ['approvalId', 'workItemId', 'runId', 'agentKey', 'contentId', 'calendarItemId', 'commentId', 'outreachQueueId', 'messageVersionKey', 'sendQueueIdempotencyKey', 'note'] as const
  if (stringFields.some((field) => value[field] !== undefined && (typeof value[field] !== 'string' || !(value[field] as string).trim()))) {
    return reject('Slack action rejected: invalid action fields.')
  }
  switch (value.action) {
    case 'approval.approve': case 'approval.reject': case 'approval.revision': case 'approval.ask_shaka':
      if (!value.approvalId) return reject('Missing approval id.')
      break
    case 'work.assign': case 'work.handoff':
      if (!value.workItemId || !value.agentKey) return reject('Missing work item or agent key.')
      break
    case 'work.ready': case 'work.revision': case 'work.acknowledge': case 'work.ask_shaka': case 'inbox.route':
      if (!value.workItemId) return reject('Missing work item id.')
      break
    case 'run.ask_shaka':
      if (!value.runId) return reject('Missing run id.')
      break
    case 'inbox.ask_shaka': break
    case 'social_comment_reply.approve': case 'social_comment_reply.reject':
      if (!value.commentId) return reject('Missing comment id.')
      break
    case 'social_calendar_draft_handoff.approve': case 'social_calendar_draft_handoff.reject':
    case 'social_calendar.approve': case 'social_calendar.reject':
      if (!value.calendarItemId) return reject('Missing content calendar item id.')
      break
    case 'warm_gmail_send.approve': case 'warm_gmail_send.reject': case 'warm_gmail_send.revise':
      if (!Number.isSafeInteger(value.contactId) || (value.contactId ?? 0) <= 0 || !value.outreachQueueId || !value.messageVersionKey || !value.sendQueueIdempotencyKey) {
        return reject('Missing warm Gmail send authorization scope. Open Portfolio and review this recipient there.')
      }
      break
    case 'insight.ask_shaka': case 'insight.draft_autoresearch':
      if (!value.contentId || !value.note) return reject('Missing insight packet.')
      break
    default: return reject('Unsupported Agent Ops Slack action.')
  }

  const key = idempotencyKey(payload, value)
  return { ok: true as const, authorization, value, key }
}

export async function handleSlackAgentAction(payload: SlackInteractivePayload): Promise<SlackAgentActionResult> {
  const prepared = prepareSlackAgentAction(payload)
  if (!prepared.ok) return prepared.result
  try {
    return await executeSlackAgentAction(prepared)
  } catch {
    return actionResult('Slack action could not be confirmed. The decision or work item may already be saved. Check the current Portfolio gate before retrying; completion is unconfirmed.', 'failed')
  }
}

async function executeSlackAgentAction({ authorization, value, key }: Extract<ReturnType<typeof prepareSlackAgentAction>, { ok: true }>): Promise<SlackAgentActionResult> {

  if (value.action === 'approval.approve' || value.action === 'approval.reject' || value.action === 'approval.revision') {
    if (!value.approvalId) return { responseType: 'ephemeral', text: 'Missing approval id.' }
    const status = value.action === 'approval.approve' ? 'approved' : 'rejected'
    return decideApprovalFromSlack({
      approvalId: value.approvalId,
      status,
      actorLabel: authorization.actorLabel,
      slackUserId: authorization.userId,
      decisionNotes: value.note || (status === 'approved' ? 'Approved from Slack.' : value.action === 'approval.revision' ? 'Revision requested from Slack.' : 'Rejected from Slack.'),
      idempotencyKey: key,
    })
  }

  if (await hasRecordedSlackAction(key)) {
    return actionResult('Already handled this Slack action. No new execution was started.', 'already_recorded')
  }

  if (value.action === 'approval.ask_shaka') {
    if (!value.approvalId) return { responseType: 'ephemeral', text: 'Missing approval id.' }
    const result = await runChiefOfStaffChat({
      message: 'Summarize this approval for a mobile decision. Include recommendation, risk, and what happens if I approve or reject.',
      userId: `slack:${authorization.userId}`,
      triggerSource: 'slack_agent_action',
      contextRef: { type: 'approval', id: value.approvalId },
    })
    return { responseType: 'ephemeral', text: `${result.reply}\n\nTrace: ${agentRunsUrl(result.runId)}` }
  }

  if (value.action === 'work.assign') {
    if (!value.workItemId || !value.agentKey) return { responseType: 'ephemeral', text: 'Missing work item or agent key.' }
    const item = await claimAgentWorkItem({
      id: value.workItemId,
      ownerAgentKey: value.agentKey,
      actorLabel: authorization.actorLabel,
    })
    await recordSlackActionEvent({
      key,
      runId: item.active_run_id,
      eventType: 'slack_work_item_assigned',
      message: `${authorization.actorLabel} assigned ${item.title} to ${value.agentKey} from Slack`,
      metadata: { work_item_id: item.id, owner_agent_key: value.agentKey, slack_user_id: authorization.userId },
    })
    return actionResult(`Assigned to ${value.agentKey}. Kanban: ${baseUrl()}/admin/agents/swarm-board`, 'completed')
  }

  if (value.action === 'work.handoff') {
    if (!value.workItemId || !value.agentKey) return { responseType: 'ephemeral', text: 'Missing work item or agent key.' }
    const result = await handoffAgentWorkItem({
      id: value.workItemId,
      toAgentKey: value.agentKey,
      fromAgentKey: 'manual-admin',
      summary: value.note || `${authorization.actorLabel} requested handoff from Slack.`,
      acceptanceCriteria: 'Review the work packet, update status, and attach trace evidence before handoff completion.',
      idempotencyKey: key,
    })
    await recordSlackActionEvent({
      key,
      runId: result.workItem.active_run_id,
      eventType: 'slack_work_item_handed_off',
      message: `${authorization.actorLabel} handed off ${result.workItem.title} to ${value.agentKey} from Slack`,
      metadata: { work_item_id: result.workItem.id, handoff_id: result.handoffId, slack_user_id: authorization.userId },
    })
    return actionResult(`Handoff requested for ${value.agentKey}. Kanban: ${baseUrl()}/admin/agents/swarm-board`, 'completed')
  }

  if (value.action === 'work.ready') {
    if (!value.workItemId) return { responseType: 'ephemeral', text: 'Missing work item id.' }
    const item = await markAgentWorkItemReadyForKanban({
      id: value.workItemId,
      definitionOfReady: value.note || 'Marked ready from Slack.',
      actorLabel: authorization.actorLabel,
    })
    await recordSlackActionEvent({
      key,
      runId: item.active_run_id,
      eventType: 'slack_work_item_ready',
      message: `${authorization.actorLabel} marked ${item.title} ready from Slack`,
      metadata: { work_item_id: item.id, slack_user_id: authorization.userId },
    })
    return actionResult(`Marked ready. Kanban: ${baseUrl()}/admin/agents/swarm-board`, 'completed')
  }

  if (value.action === 'work.revision') {
    if (!value.workItemId) return { responseType: 'ephemeral', text: 'Missing work item id.' }
    const item = await recordAgentWorkItemBlocker({
      id: value.workItemId,
      blockerSummary: value.note || 'Revision requested from Slack.',
    })
    await recordSlackActionEvent({
      key,
      runId: item.active_run_id,
      eventType: 'slack_work_item_revision_requested',
      message: `${authorization.actorLabel} requested revision for ${item.title} from Slack`,
      metadata: { work_item_id: item.id, slack_user_id: authorization.userId },
    })
    return actionResult(`Revision requested. Kanban: ${baseUrl()}/admin/agents/swarm-board`, 'completed')
  }

  if (value.action === 'work.acknowledge') {
    if (!value.workItemId) return { responseType: 'ephemeral', text: 'Missing work item id.' }
    const runId = await runIdForWorkItem(value.workItemId)
    await recordSlackActionEvent({
      key,
      runId,
      eventType: 'slack_work_item_blocker_acknowledged',
      message: `${authorization.actorLabel} acknowledged a blocker from Slack`,
      metadata: {
        work_item_id: value.workItemId,
        slack_user_id: authorization.userId,
        note: value.note ?? 'Blocker acknowledged from Slack.',
      },
    })
    return {
      responseType: 'ephemeral',
      text: `Blocker acknowledged. Ask Shaka for a next-step recommendation or open Kanban: ${baseUrl()}/admin/agents/swarm-board`,
      actionStatus: 'completed',
    }
  }

  if (value.action === 'work.ask_shaka') {
    if (!value.workItemId) return { responseType: 'ephemeral', text: 'Missing work item id.' }
    const result = await runChiefOfStaffChat({
      message: 'Summarize this work item for mobile unblock. Include owner, blocker, next action, and recommendation.',
      userId: `slack:${authorization.userId}`,
      triggerSource: 'slack_agent_action',
      contextRef: { type: 'work_item', id: value.workItemId },
    })
    return { responseType: 'ephemeral', text: `${result.reply}\n\nTrace: ${agentRunsUrl(result.runId)}` }
  }

  if (value.action === 'run.ask_shaka') {
    if (!value.runId) return { responseType: 'ephemeral', text: 'Missing run id.' }
    const result = await runChiefOfStaffChat({
      message: 'Summarize this run for mobile recovery. Include why it is stale or failed, the safest next action, and what must stay in Portfolio.',
      userId: `slack:${authorization.userId}`,
      triggerSource: 'slack_agent_action',
      contextRef: { type: 'run', id: value.runId },
    })
    return { responseType: 'ephemeral', text: `${result.reply}\n\nTrace: ${agentRunsUrl(result.runId)}` }
  }

  if (value.action === 'inbox.route') {
    const itemRef = value.workItemId
    if (!itemRef) return { responseType: 'ephemeral', text: 'Missing inbox item reference.' }
    const result = await routeAgentInboxItem({
      itemRef,
      actor: {
        id: authorization.userId,
        label: authorization.actorLabel,
        type: 'slack_command',
      },
      triggerSource: 'slack_agent_inbox_action',
    })
    return {
      responseType: 'ephemeral',
      text: `Routed inbox item: ${result.item.title}. Trace: ${agentRunsUrl(result.runId)}`,
      actionStatus: 'completed',
    }
  }

  if (value.action === 'inbox.ask_shaka') {
    const contextRef = value.runId
      ? { type: 'run' as const, id: value.runId }
      : undefined
    const result = await runChiefOfStaffChat({
      message: 'Explain what this inbox item needs and the fastest safe way to unblock it from mobile.',
      userId: `slack:${authorization.userId}`,
      triggerSource: 'slack_agent_action',
      contextRef,
    })
    return { responseType: 'ephemeral', text: `${result.reply}\n\nTrace: ${agentRunsUrl(result.runId)}` }
  }

  if (value.action === 'social_comment_reply.approve' || value.action === 'social_comment_reply.reject') {
    if (!value.commentId) return { responseType: 'ephemeral', text: 'Missing comment id.' }
    const status = value.action === 'social_comment_reply.approve' ? 'approved' : 'rejected'
    const text = await decideSocialCommentReplyFromSlack({
      commentId: value.commentId,
      status,
      actorLabel: authorization.actorLabel,
      slackUserId: authorization.userId,
      decisionNotes: value.note || (status === 'approved' ? 'Approved from Slack.' : 'Rejected from Slack.'),
      idempotencyKey: key,
    })
    return actionResult(sourceReviewLinks(text), legacyDecisionStatus(text))
  }

  if (
    value.action === 'social_calendar_draft_handoff.approve' ||
    value.action === 'social_calendar_draft_handoff.reject' ||
    value.action === 'social_calendar.approve' ||
    value.action === 'social_calendar.reject'
  ) {
    if (!value.calendarItemId) {
      return {
        responseType: 'ephemeral',
        text: 'Missing content calendar item id. Open Portfolio and use the Content Intelligence calendar decision path.',
      }
    }
    const status = value.action.endsWith('.approve') ? 'authorized' : 'rejected'
    try {
      const result = await decideSocialCalendarDraftHandoffFromSlack({
        calendarItemId: value.calendarItemId,
        status,
        slackUserId: authorization.userId,
        decisionNotes: value.note || (
          status === 'authorized'
            ? 'Authorize Draft Handoff tapped in Slack. Record internal content-readiness approval only; do not publish or call providers.'
            : 'Rejected from Slack. Keep content pipeline blocked until revised.'
        ),
      })
      return result
    } catch (error) {
      return {
        responseType: 'ephemeral',
        text: [
          `Content calendar approval blocked: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Open Portfolio: ${socialCalendarUrl(value.calendarItemId)}`,
        ].join('\n'),
        actionStatus: 'blocked',
      }
    }
  }

  if (
    value.action === 'warm_gmail_send.approve' ||
    value.action === 'warm_gmail_send.reject' ||
    value.action === 'warm_gmail_send.revise'
  ) {
    if (
      typeof value.contactId !== 'number' ||
      !value.outreachQueueId ||
      !value.messageVersionKey ||
      !value.sendQueueIdempotencyKey
    ) {
      return {
        responseType: 'ephemeral',
        text: 'Missing warm Gmail send authorization scope. Open Portfolio and review this recipient there.',
      }
    }
    const status = value.action === 'warm_gmail_send.approve'
      ? 'approved'
      : value.action === 'warm_gmail_send.reject'
        ? 'rejected'
        : 'revision_requested'
    const text = await decideWarmGmailSendAuthorizationFromSlack({
      contactId: value.contactId,
      outreachQueueId: value.outreachQueueId,
      messageVersionKey: value.messageVersionKey,
      sendQueueIdempotencyKey: value.sendQueueIdempotencyKey,
      status,
      actorLabel: authorization.actorLabel,
      slackUserId: authorization.userId,
      decisionNotes: value.note || (
        status === 'approved'
          ? 'Approve Send tapped in Slack. Record approval intent only; do not call Gmail send.'
          : status === 'rejected'
            ? 'Rejected from Slack. Keep Gmail send blocked.'
            : 'Revision requested from Slack. Keep Gmail send blocked.'
      ),
      idempotencyKey: key,
    })
    return actionResult(sourceReviewLinks(text), legacyDecisionStatus(text))
  }

  if (value.action === 'insight.ask_shaka') {
    const note = value.note?.trim()
    if (!value.contentId || !note) return { responseType: 'ephemeral', text: 'Missing insight packet.' }
    const result = await runChiefOfStaffChat({
      message: [
        'Use this high-signal social engagement packet to recommend the safest mobile next step.',
        'Do not publish, schedule, send messages, activate workflows, or mutate customer data.',
        '',
        note,
      ].join('\n'),
      userId: `slack:${authorization.userId}`,
      triggerSource: 'slack_agent_insight_action',
    })
    return { responseType: 'ephemeral', text: `${result.reply}\n\nTrace: ${agentRunsUrl(result.runId)}` }
  }

  if (value.action === 'insight.draft_autoresearch') {
    const note = value.note?.trim()
    if (!value.contentId || !note) return { responseType: 'ephemeral', text: 'Missing insight packet.' }
    const item = await createAgentWorkItem({
      title: `AutoResearch follow-up for high-signal insight`,
      objective: [
        'Draft a proposal packet for adjacent research prompted by an engagement-ranked Social Content insight.',
        'The output should identify the evidence gap, adjacent AI insight angle, recommended source path, acceptance criteria, and publishing boundary.',
        '',
        note,
      ].join('\n'),
      status: 'proposed',
      priority: 'high',
      ownerAgentKey: value.agentKey || 'research-source-register',
      source: {
        type: 'social_content_engagement_signal',
        id: value.contentId,
        label: 'High-signal AI insight',
      },
      metadata: {
        created_from_slack_action: true,
        slack_user_id: authorization.userId,
        actor_label: authorization.actorLabel,
        social_content_id: value.contentId,
        insight_packet: note,
        approval_boundary: 'Proposal only. No publishing, scheduling, outbound sends, workflow activation, credential changes, customer-data mutation, or production action.',
      },
      idempotencyKey: `slack-insight-autoresearch:${value.contentId}`,
    })
    return {
      responseType: 'ephemeral',
      text: `Drafted proposed AutoResearch work item: ${item.title}. Kanban: ${agentKanbanUrl()}?work_item=${encodeURIComponent(item.id)}`,
      actionStatus: 'completed',
    }
  }

  if (value.workItemId) {
    await recordSlackActionEvent({
      key,
      runId: await runIdForWorkItem(value.workItemId),
      eventType: 'slack_work_item_action_rejected',
      message: `Unsupported Slack action: ${value.action}`,
      metadata: { work_item_id: value.workItemId, slack_user_id: authorization.userId },
    })
  }

  return { responseType: 'ephemeral', text: 'Unsupported Agent Ops Slack action.' }
}

export const agentSlackActionInternals = {
  allowedSlackUserIds,
  idempotencyKey,
  isSlackDecidableApproval,
}
