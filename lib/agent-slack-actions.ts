import { runChiefOfStaffChat } from '@/lib/chief-of-staff-chat'
import { recordAgentEvent } from '@/lib/agent-run'
import {
  claimAgentWorkItem,
  getAgentWorkItem,
  handoffAgentWorkItem,
  markAgentWorkItemReadyForKanban,
  recordAgentWorkItemBlocker,
} from '@/lib/agent-work-items'
import { routeAgentInboxItem } from '@/lib/agent-inbox-routing'
import { supabaseAdmin } from '@/lib/supabase'
import { decodeSlackActionValue, type SlackAgentActionValue } from '@/lib/agent-slack-blocks'

export type SlackInteractivePayload = {
  type?: string
  user?: {
    id?: string
    username?: string
    name?: string
  }
  actions?: Array<{
    action_id?: string
    value?: string
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
  }
}

export type SlackAgentActionResult = {
  responseType: 'ephemeral' | 'in_channel'
  text: string
  replaceOriginal?: boolean
}

type ApprovalRow = {
  id: string
  run_id: string
  approval_type: string
  status: string
  metadata: Record<string, unknown> | null
}

type RunRow = {
  id: string
  status: string
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PORTFOLIO_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://amadutown.com'
  ).replace(/\/$/, '')
}

function agentRunsUrl(runId?: string | null) {
  return `${baseUrl()}/admin/agents/runs${runId ? `/${runId}` : ''}`
}

function allowedSlackUserIds() {
  const raw =
    process.env.SLACK_AGENT_OPS_ALLOWED_USER_IDS ||
    process.env.SLACK_AGENT_ALLOWED_USER_IDS ||
    ''
  return new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))
}

function requireAuthorizedSlackUser(payload: SlackInteractivePayload) {
  const userId = payload.user?.id
  const allowed = allowedSlackUserIds()
  const localMode =
    process.env.NODE_ENV !== 'production' &&
    !process.env.VERCEL &&
    process.env.NEXT_PUBLIC_APP_ENV !== 'staging'

  if (!userId) {
    return { ok: false as const, text: 'Slack action rejected: missing Slack user id.' }
  }
  if (allowed.size === 0 && localMode) {
    return { ok: true as const, userId, actorLabel: payload.user?.username || payload.user?.name || userId }
  }
  if (allowed.has(userId)) {
    return { ok: true as const, userId, actorLabel: payload.user?.username || payload.user?.name || userId }
  }
  return {
    ok: false as const,
    text: 'Slack action rejected: this Slack user is not configured for Agent Ops mobile approvals.',
  }
}

function isSlackDecidableApproval(approvalType: string) {
  return approvalType === 'vercel_deployment_research_proposal'
}

function actionFromPayload(payload: SlackInteractivePayload): SlackAgentActionValue | null {
  const action = payload.actions?.[0]
  return decodeSlackActionValue(action?.value)
}

function idempotencyKey(payload: SlackInteractivePayload, value: SlackAgentActionValue) {
  return [
    'slack-agent-action',
    payload.user?.id ?? 'unknown-user',
    payload.container?.message_ts ?? payload.message?.ts ?? payload.action_ts ?? 'unknown-ts',
    value.action,
    value.approvalId ?? value.workItemId ?? value.runId ?? 'unknown-target',
  ].join(':')
}

async function hasRecordedSlackAction(key: string) {
  if (!supabaseAdmin) return false
  const { data, error } = await supabaseAdmin
    .from('agent_run_events')
    .select('id')
    .eq('idempotency_key', key)
    .maybeSingle()
  if (error) return false
  return Boolean(data?.id)
}

async function recordSlackActionEvent(input: {
  key: string
  runId?: string | null
  eventType: string
  message: string
  metadata?: Record<string, unknown>
}) {
  if (!input.runId) return
  await recordAgentEvent({
    runId: input.runId,
    eventType: input.eventType,
    severity: 'info',
    message: input.message,
    metadata: input.metadata,
    idempotencyKey: input.key,
  }).catch(() => {})
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
    return `Approval already ${row.status}. Trace: ${agentRunsUrl(row.run_id)}`
  }
  if (!isSlackDecidableApproval(row.approval_type)) {
    return `Portfolio review required for \`${row.approval_type}\`. Open trace: ${agentRunsUrl(row.run_id)}`
  }

  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const decision = {
    status: input.status,
    decision_notes: input.decisionNotes,
    decided_by_slack_user_id: input.slackUserId,
    decided_by_label: input.actorLabel,
    decided_at: new Date().toISOString(),
  }

  const { error: updateError } = await supabaseAdmin
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

  if (updateError) throw new Error(`Failed to update approval: ${updateError.message}`)

  await supabaseAdmin.from('agent_run_events').insert({
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

  const workItemId = typeof metadata.work_item_id === 'string' ? metadata.work_item_id : null
  if (workItemId) {
    await supabaseAdmin
      .from('agent_work_items')
      .update({
        status: input.status === 'approved' ? 'assigned' : 'blocked',
        blocker_summary: input.status === 'approved' ? null : input.decisionNotes,
        validation_summary:
          input.status === 'approved'
            ? 'Mobile Slack approval recorded. Continue with the next governed Agent Ops action.'
            : input.decisionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workItemId)
  }

  if (input.status === 'rejected') {
    await supabaseAdmin
      .from('agent_runs')
      .update({
        status: 'failed',
        current_step: 'Approval rejected from Slack',
        error_message: input.decisionNotes,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.run_id)
  } else {
    const { data: pending } = await supabaseAdmin
      .from('agent_approvals')
      .select('id')
      .eq('run_id', row.run_id)
      .eq('status', 'pending')
      .limit(1)
    if (!pending || pending.length === 0) {
      await supabaseAdmin
        .from('agent_runs')
        .update({
          status: 'running',
          current_step: 'Approval granted from Slack',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.run_id)
        .eq('status', 'waiting_for_approval')
    }
  }

  return `Approval ${input.status} from Slack. Trace: ${agentRunsUrl(row.run_id)}`
}

async function runIdForWorkItem(workItemId: string) {
  const item = await getAgentWorkItem(workItemId)
  return item?.active_run_id ?? item?.source_run_id ?? null
}

export async function handleSlackAgentAction(payload: SlackInteractivePayload): Promise<SlackAgentActionResult> {
  const authorization = requireAuthorizedSlackUser(payload)
  if (!authorization.ok) return { responseType: 'ephemeral', text: authorization.text }

  const value = actionFromPayload(payload)
  if (!value) {
    return { responseType: 'ephemeral', text: 'Slack action rejected: missing or invalid action payload.' }
  }

  const key = idempotencyKey(payload, value)
  if (await hasRecordedSlackAction(key)) {
    return { responseType: 'ephemeral', text: 'Already handled this Slack action.' }
  }

  if (value.action === 'approval.approve' || value.action === 'approval.reject' || value.action === 'approval.revision') {
    if (!value.approvalId) return { responseType: 'ephemeral', text: 'Missing approval id.' }
    const status = value.action === 'approval.approve' ? 'approved' : 'rejected'
    const text = await decideApprovalFromSlack({
      approvalId: value.approvalId,
      status,
      actorLabel: authorization.actorLabel,
      slackUserId: authorization.userId,
      decisionNotes: value.note || (status === 'approved' ? 'Approved from Slack.' : 'Revision requested from Slack.'),
      idempotencyKey: key,
    })
    return { responseType: 'ephemeral', text }
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
    return { responseType: 'ephemeral', text: `Assigned to ${value.agentKey}. Kanban: ${baseUrl()}/admin/agents/swarm-board` }
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
    return { responseType: 'ephemeral', text: `Handoff requested for ${value.agentKey}. Kanban: ${baseUrl()}/admin/agents/swarm-board` }
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
    return { responseType: 'ephemeral', text: `Marked ready. Kanban: ${baseUrl()}/admin/agents/swarm-board` }
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
    return { responseType: 'ephemeral', text: `Revision requested. Kanban: ${baseUrl()}/admin/agents/swarm-board` }
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
