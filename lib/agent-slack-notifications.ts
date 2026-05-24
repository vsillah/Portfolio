import { endAgentRun, recordAgentEvent, startAgentRun } from '@/lib/agent-run'
import { listAgentWorkItems, type AgentWorkItem } from '@/lib/agent-work-items'
import { mrkdwn, slackButton, truncateSlack, type SlackBlock } from '@/lib/agent-slack-blocks'
import { supabaseAdmin } from '@/lib/supabase'

export type AgentSlackNotificationKind =
  | 'pending_approvals'
  | 'blockers'
  | 'review_ready'
  | 'goal_decisions'
  | 'standup_blockers'
  | 'selected_agent_question'

export type AgentSlackNotificationInput = {
  kind: AgentSlackNotificationKind
  message?: string
  targetAgentKeys?: string[]
  goalId?: string | null
  force?: boolean
  actorLabel?: string | null
  triggerSource?: string | null
}

export type AgentSlackNotificationResult = {
  ok: boolean
  runId: string
  sent: boolean
  skipped: boolean
  deduped: boolean
  reason?: string
  itemCount: number
  text: string
}

type PendingApprovalRow = {
  id: string
  run_id: string
  approval_type: string
  status: string
  metadata: Record<string, unknown> | null
}

type AgentRunSummaryRow = {
  id: string
  title: string | null
  current_step: string | null
  status: string | null
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PORTFOLIO_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://amadutown.com'
  ).replace(/\/$/, '')
}

function agentUrl(path: string) {
  return `${baseUrl()}${path}`
}

function dedupeWindowKey() {
  const now = new Date()
  return now.toISOString().slice(0, 13)
}

function normalizeTargetAgentKeys(keys?: string[]) {
  return [...new Set((keys ?? []).map((key) => key.trim()).filter(Boolean))].sort()
}

function notificationIdempotencyKey(input: AgentSlackNotificationInput) {
  const targetKey = normalizeTargetAgentKeys(input.targetAgentKeys).join(',') || 'all'
  const goalKey = input.goalId || 'no-goal'
  return `slack-mobile-notification:${input.kind}:${goalKey}:${targetKey}:${dedupeWindowKey()}`
}

async function existingNotificationRun(idempotencyKey: string) {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id, status, metadata')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (error) return null
  return data as { id: string; status?: string | null; metadata?: Record<string, unknown> | null } | null
}

async function pendingApprovals(limit = 5) {
  if (!supabaseAdmin) throw new Error('Database not available')
  const { data, error } = await supabaseAdmin
    .from('agent_approvals')
    .select('id, run_id, approval_type, status, metadata')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`Failed to read pending approvals: ${error.message}`)
  return (data ?? []) as PendingApprovalRow[]
}

async function runsById(runIds: string[]) {
  if (!supabaseAdmin || !runIds.length) return new Map<string, AgentRunSummaryRow>()
  const { data } = await supabaseAdmin
    .from('agent_runs')
    .select('id, title, current_step, status')
    .in('id', runIds)
  const rows = (data ?? []) as AgentRunSummaryRow[]
  return new Map(rows.map((row) => [row.id, row]))
}

function workItemHref(item: AgentWorkItem) {
  if (item.active_run_id) return agentUrl(`/admin/agents/runs/${item.active_run_id}`)
  if (item.source_run_id) return agentUrl(`/admin/agents/runs/${item.source_run_id}`)
  return agentUrl(`/admin/agents/swarm-board?work_item=${encodeURIComponent(item.id)}`)
}

function prioritySort(left: AgentWorkItem, right: AgentWorkItem) {
  const weight = { urgent: 4, high: 3, medium: 2, low: 1 }
  return weight[right.priority] - weight[left.priority] || right.updated_at.localeCompare(left.updated_at)
}

function filterTargetAgents(items: AgentWorkItem[], targetAgentKeys: string[]) {
  if (!targetAgentKeys.length) return items
  return items.filter((item) => item.owner_agent_key && targetAgentKeys.includes(item.owner_agent_key))
}

function itemSummary(item: AgentWorkItem) {
  const owner = item.owner_agent_key ?? 'unassigned'
  const blocker = item.blocker_summary ? `\nBlocker: ${truncateSlack(item.blocker_summary, 140)}` : ''
  const next = item.validation_summary ? `\nNext: ${truncateSlack(item.validation_summary, 140)}` : ''
  return `*${truncateSlack(item.title, 110)}*\nOwner: \`${owner}\` - Status: \`${item.status}\` - Priority: \`${item.priority}\`${blocker}${next}`
}

function workItemBlocks(title: string, intro: string, items: AgentWorkItem[]) {
  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn(`*${title}*\n${intro}`) },
  ]
  if (!items.length) {
    blocks.push({ type: 'section', text: mrkdwn('No matching Agent Ops work items need mobile attention.') })
    blocks.push({
      type: 'actions',
      elements: [slackButton({ label: 'Open Mission Control', actionId: 'open_mission_control', url: agentUrl('/admin/agents') })],
    })
    return blocks
  }
  for (const item of items.slice(0, 5)) {
    blocks.push({ type: 'section', text: mrkdwn(itemSummary(item)) })
    blocks.push({
      type: 'actions',
      elements: [
        slackButton({ label: 'Open trace', actionId: 'open_trace', url: workItemHref(item) }),
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_work_ask_shaka',
          value: { action: 'work.ask_shaka', workItemId: item.id, runId: item.active_run_id ?? undefined },
        }),
      ],
    })
  }
  blocks.push({
    type: 'actions',
    elements: [slackButton({ label: 'Open Kanban', actionId: 'open_kanban', url: agentUrl('/admin/agents/swarm-board') })],
  })
  return blocks
}

async function buildPendingApprovalPayload() {
  const approvals = await pendingApprovals()
  const runs = await runsById(approvals.map((approval) => approval.run_id))
  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn('*Pending Agent Ops approvals*\nUse Slack for low-risk decisions. High-risk packets stay in Portfolio.') },
  ]
  if (!approvals.length) {
    blocks.push({ type: 'section', text: mrkdwn('No pending approvals need mobile action.') })
  }
  for (const approval of approvals) {
    const run = runs.get(approval.run_id)
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(run?.title ?? approval.run_id, 120)}*`,
        `Type: \`${approval.approval_type}\` - Status: \`${approval.status}\``,
        run?.current_step ? `Step: ${truncateSlack(run.current_step, 140)}` : null,
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_approval_ask_shaka',
          value: { action: 'approval.ask_shaka', approvalId: approval.id, runId: approval.run_id },
        }),
        slackButton({ label: 'Open decision', actionId: 'open_decision', url: agentUrl(`/admin/agents/coordination?approvalRunId=${approval.run_id}`) }),
        slackButton({ label: 'Open trace', actionId: 'open_trace', url: agentUrl(`/admin/agents/runs/${approval.run_id}`) }),
      ],
    })
  }
  return {
    text: `${approvals.length} pending Agent Ops approval(s) need review.`,
    blocks,
    itemCount: approvals.length,
  }
}

async function buildWorkItemPayload(input: AgentSlackNotificationInput) {
  const targetAgentKeys = normalizeTargetAgentKeys(input.targetAgentKeys)
  const allItems = await listAgentWorkItems({ limit: 75 })
  let items: AgentWorkItem[] = []
  let title = 'Agent Ops mobile unblock'
  let intro = 'Review the items that need a quick mobile decision.'

  if (input.kind === 'blockers' || input.kind === 'standup_blockers') {
    items = allItems.filter((item) => item.status === 'blocked' || Boolean(item.blocker_summary))
    title = input.kind === 'standup_blockers' ? "Today's standup blockers" : 'Agent Ops blockers'
    intro = 'Start here when work is stuck or waiting on an owner decision.'
  } else if (input.kind === 'review_ready') {
    items = allItems.filter((item) => item.status === 'ready_for_review' || item.status === 'ready_for_merge')
    title = 'Review-ready Agent Ops work'
    intro = 'These cards are waiting for review, trace inspection, or merge readiness.'
  } else if (input.kind === 'goal_decisions') {
    items = allItems.filter((item) => {
      const metadata = item.metadata ?? {}
      const goalId = typeof metadata.goal_id === 'string' ? metadata.goal_id : null
      const needsDecision = Boolean(item.blocker_summary) || item.status === 'blocked' || item.status === 'proposed'
      return Boolean(goalId) && (!input.goalId || goalId === input.goalId) && needsDecision
    })
    title = 'Goal tasks needing a decision'
    intro = 'These goal-tagged tasks need an owner, unblock decision, or Shaka follow-up.'
  } else if (input.kind === 'selected_agent_question') {
    title = 'Standup question for selected agents'
    intro = input.message?.trim() || 'Selected agents need a quick mobile standup response.'
    items = filterTargetAgents(allItems, targetAgentKeys)
      .filter((item) => !['merged', 'deployed', 'cancelled'].includes(item.status))
  }

  items = filterTargetAgents(items, targetAgentKeys).sort(prioritySort).slice(0, 5)
  return {
    text: `${title}: ${items.length} item(s).`,
    blocks: workItemBlocks(title, intro, items),
    itemCount: items.length,
  }
}

export async function buildAgentSlackNotificationPayload(input: AgentSlackNotificationInput) {
  if (input.kind === 'pending_approvals') return buildPendingApprovalPayload()
  return buildWorkItemPayload(input)
}

async function postToSlack(text: string, blocks: SlackBlock[]) {
  const webhookUrl = process.env.SLACK_AGENT_OPS_WEBHOOK_URL
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return { sent: false, reason: 'SLACK_AGENT_OPS_WEBHOOK_URL is not configured.' }
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, blocks }),
  })
  if (!response.ok) {
    return { sent: false, reason: `Slack webhook returned HTTP ${response.status}.` }
  }
  return { sent: true, reason: null }
}

export async function sendAgentSlackNotification(input: AgentSlackNotificationInput): Promise<AgentSlackNotificationResult> {
  const idempotencyKey = notificationIdempotencyKey(input)
  const existing = input.force ? null : await existingNotificationRun(idempotencyKey)
  if (existing?.id) {
    return {
      ok: true,
      runId: existing.id,
      sent: false,
      skipped: true,
      deduped: true,
      reason: 'A matching Slack mobile notification was already prepared in this hourly window.',
      itemCount: Number(existing.metadata?.item_count ?? 0),
      text: String(existing.metadata?.text ?? 'Agent Ops Slack notification already prepared.'),
    }
  }

  const payload = await buildAgentSlackNotificationPayload(input)
  const run = await startAgentRun({
    agentKey: 'chief-of-staff',
    runtime: 'manual',
    kind: 'slack_mobile_notification',
    title: `Send Slack mobile notification: ${input.kind.replace(/_/g, ' ')}`,
    status: 'running',
    triggerSource: input.triggerSource ?? 'admin_agent_slack_mobile_bridge',
    currentStep: 'Preparing Slack payload',
    metadata: {
      notification_kind: input.kind,
      target_agent_keys: normalizeTargetAgentKeys(input.targetAgentKeys),
      goal_id: input.goalId ?? null,
      actor_label: input.actorLabel ?? null,
      item_count: payload.itemCount,
      text: payload.text,
    },
    idempotencyKey,
  })

  const delivery = await postToSlack(payload.text, payload.blocks)
  await recordAgentEvent({
    runId: run.id,
    eventType: delivery.sent ? 'slack_mobile_notification_sent' : 'slack_mobile_notification_skipped',
    severity: delivery.sent ? 'info' : 'warning',
    message: delivery.sent ? payload.text : delivery.reason,
    metadata: {
      notification_kind: input.kind,
      item_count: payload.itemCount,
      reason: delivery.reason,
      blocks: payload.blocks,
    },
    idempotencyKey: `${idempotencyKey}:delivery`,
  })
  await endAgentRun({
    runId: run.id,
    status: delivery.sent ? 'completed' : 'cancelled',
    currentStep: delivery.sent ? 'Slack notification sent' : 'Slack notification skipped',
    outcome: {
      sent: delivery.sent,
      skipped: !delivery.sent,
      reason: delivery.reason,
      item_count: payload.itemCount,
    },
  })

  return {
    ok: true,
    runId: run.id,
    sent: delivery.sent,
    skipped: !delivery.sent,
    deduped: false,
    reason: delivery.reason ?? undefined,
    itemCount: payload.itemCount,
    text: payload.text,
  }
}
