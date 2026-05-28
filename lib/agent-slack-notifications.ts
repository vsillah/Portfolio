import { endAgentRun, recordAgentEvent, startAgentRun } from '@/lib/agent-run'
import { listAgentWorkItems, type AgentWorkItem } from '@/lib/agent-work-items'
import { AGENT_ORGANIZATION } from '@/lib/agent-organization'
import { mrkdwn, slackButton, truncateSlack, type SlackBlock } from '@/lib/agent-slack-blocks'
import { supabaseAdmin } from '@/lib/supabase'

export type AgentSlackNotificationKind =
  | 'pending_approvals'
  | 'blockers'
  | 'stale_runs'
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
  dedupeKey?: string | null
  dedupeWindowHours?: number | null
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
  runtime?: string | null
  error_message?: string | null
  started_at?: string | null
}

type SlackDeliveryResult = {
  sent: boolean
  reason: string | null
  mode: 'bot' | 'webhook' | 'none'
  channel?: string | null
  ts?: string | null
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

function agentDisplayName(agentKey: string) {
  return AGENT_ORGANIZATION.find((agent) => agent.key === agentKey)?.name ?? agentKey
}

function dedupeWindowKey(windowHours = 1) {
  const hours = Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 1
  const windowMs = hours * 60 * 60 * 1000
  return new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString()
}

function normalizeTargetAgentKeys(keys?: string[]) {
  return [...new Set((keys ?? []).map((key) => key.trim()).filter(Boolean))].sort()
}

function notificationIdempotencyKey(input: AgentSlackNotificationInput) {
  const targetKey = normalizeTargetAgentKeys(input.targetAgentKeys).join(',') || 'all'
  const goalKey = input.goalId || 'no-goal'
  const contentKey = input.dedupeKey?.trim() || 'default'
  return `slack-mobile-notification:${input.kind}:${goalKey}:${targetKey}:${contentKey}:${dedupeWindowKey(input.dedupeWindowHours ?? 1)}`
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

function workItemPrimaryButton(item: AgentWorkItem, kind: AgentSlackNotificationKind) {
  if (!item.owner_agent_key) {
    return slackButton({
      label: 'Assign owner',
      actionId: 'agent_work_assign_captain',
      value: { action: 'work.assign', workItemId: item.id, agentKey: 'integration-captain' },
      style: 'primary',
    })
  }
  if (kind === 'review_ready' || item.status === 'ready_for_review' || item.status === 'ready_for_merge') {
    return slackButton({
      label: 'Request revision',
      actionId: 'agent_work_revision',
      value: {
        action: 'work.revision',
        workItemId: item.id,
        runId: item.active_run_id ?? undefined,
        note: 'Revision requested from Slack notification.',
      },
    })
  }
  if (item.status === 'blocked' || item.blocker_summary) {
    return slackButton({
      label: 'Acknowledge',
      actionId: 'agent_work_acknowledge_blocker',
      value: {
        action: 'work.acknowledge',
        workItemId: item.id,
        runId: item.active_run_id ?? undefined,
        note: 'Blocker acknowledged from Slack notification.',
      },
    })
  }
  return slackButton({
    label: 'Ask Shaka',
    actionId: 'agent_work_ask_shaka',
    value: { action: 'work.ask_shaka', workItemId: item.id, runId: item.active_run_id ?? undefined },
  })
}

function workItemContextButton(item: AgentWorkItem) {
  return slackButton({
    label: item.active_run_id || item.source_run_id ? 'Open trace' : 'Open Kanban',
    actionId: item.active_run_id || item.source_run_id ? 'open_trace' : 'open_kanban',
    url: workItemHref(item),
  })
}

function workItemBlocks(title: string, intro: string, items: AgentWorkItem[], kind: AgentSlackNotificationKind) {
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
        workItemPrimaryButton(item, kind),
        workItemContextButton(item),
      ],
    })
  }
  blocks.push({
    type: 'actions',
    elements: [slackButton({ label: 'Open Kanban', actionId: 'open_kanban', url: agentUrl('/admin/agents/swarm-board') })],
  })
  return blocks
}

function selectedAgentQuestionBlocks(input: AgentSlackNotificationInput, items: AgentWorkItem[]) {
  const targetAgentKeys = normalizeTargetAgentKeys(input.targetAgentKeys)
  const selectedAgentText = targetAgentKeys.length
    ? targetAgentKeys.map((key) => `• ${agentDisplayName(key)} (\`${key}\`)`).join('\n')
    : '• No specific agents selected. Shaka can route this from the thread.'
  const question = truncateSlack(input.message?.trim() || 'No question provided.', 900)
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn([
        '*Standup question for selected agents*',
        `*Question:* ${question}`,
        '*Participants:*',
        selectedAgentText,
      ].join('\n')),
    },
    {
      type: 'context',
      elements: [
        mrkdwn('Reply in this thread to continue with Shaka. Use `acknowledge`, `ready`, `request revision`, `assign <agent>`, or `handoff to <agent>` when the thread includes one clear work card.'),
      ],
    },
  ]

  if (items.length) {
    blocks.push({ type: 'divider' })
    blocks.push({ type: 'section', text: mrkdwn('*Current work context*') })
    for (const item of items.slice(0, 5)) {
      blocks.push({ type: 'section', text: mrkdwn(itemSummary(item)) })
      blocks.push({
        type: 'actions',
        elements: [
          workItemPrimaryButton(item, 'selected_agent_question'),
          workItemContextButton(item),
        ],
      })
    }
  } else {
    blocks.push({
      type: 'section',
      text: mrkdwn('No active Kanban cards are currently assigned to the selected agents. The question is still posted as a standup thread so Shaka can capture the mobile follow-up.'),
    })
  }

  blocks.push({
    type: 'actions',
    elements: [
      slackButton({ label: 'Open Standup Room', actionId: 'open_standup_room', url: agentUrl('/admin/agents/standup') }),
      slackButton({ label: 'Open Kanban', actionId: 'open_kanban', url: agentUrl('/admin/agents/swarm-board') }),
    ],
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
    const canDecideInSlack = approval.approval_type === 'vercel_deployment_research_proposal'
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(run?.title ?? approval.run_id, 120)}*`,
        `Type: \`${approval.approval_type}\` - Status: \`${approval.status}\``,
        run?.current_step ? `Step: ${truncateSlack(run.current_step, 140)}` : null,
        canDecideInSlack
          ? 'Primary action: approve only after the trace evidence matches the packet.'
          : 'Primary action: open Portfolio because this approval crosses a protected boundary.',
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        canDecideInSlack
          ? slackButton({
              label: 'Approve',
              actionId: 'agent_approval_approve',
              style: 'primary',
              value: { action: 'approval.approve', approvalId: approval.id, runId: approval.run_id },
              confirmText: `Approve ${run?.title ?? approval.run_id}?`,
            })
          : slackButton({
              label: 'Open decision',
              actionId: 'open_decision',
              url: agentUrl(`/admin/agents/coordination?approvalRunId=${approval.run_id}`),
            }),
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_approval_ask_shaka',
          value: { action: 'approval.ask_shaka', approvalId: approval.id, runId: approval.run_id },
        }),
      ],
    })
  }
  return {
    text: `${approvals.length} pending Agent Ops approval(s) need review.`,
    blocks,
    itemCount: approvals.length,
  }
}

async function staleRuns(limit = 5) {
  if (!supabaseAdmin) throw new Error('Database not available')
  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id, title, runtime, status, current_step, error_message, started_at')
    .in('status', ['failed', 'stale'])
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Failed to read stale runs: ${error.message}`)
  return (data ?? []) as AgentRunSummaryRow[]
}

async function buildStaleRunsPayload() {
  const runs = await staleRuns()
  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn('*Stale or failed Agent Ops runs*\nUse this when a trace needs mobile recovery triage. Slack can summarize the next step; recovery mutations stay in Portfolio.') },
  ]
  if (!runs.length) {
    blocks.push({ type: 'section', text: mrkdwn('No stale or failed runs need mobile action.') })
    blocks.push({
      type: 'actions',
      elements: [slackButton({ label: 'Open Run Console', actionId: 'open_run_console', url: agentUrl('/admin/agents/runs') })],
    })
  }
  for (const run of runs) {
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(run.title ?? run.id, 120)}*`,
        `Status: \`${run.status ?? 'unknown'}\` - Runtime: \`${run.runtime ?? 'unknown'}\``,
        run.current_step ? `Step: ${truncateSlack(run.current_step, 140)}` : null,
        run.error_message ? `Problem: ${truncateSlack(run.error_message, 160)}` : null,
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_run_ask_shaka',
          value: { action: 'run.ask_shaka', runId: run.id },
        }),
        slackButton({ label: 'Open trace', actionId: 'open_trace', url: agentUrl(`/admin/agents/runs/${run.id}`) }),
      ],
    })
  }
  return {
    text: `${runs.length} stale or failed Agent Ops run(s) need mobile triage.`,
    blocks,
    itemCount: runs.length,
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
      const needsDecision = Boolean(item.blocker_summary) ||
        item.status === 'blocked' ||
        item.status === 'proposed' ||
        metadata.requires_approval === true
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
  if (input.kind === 'selected_agent_question') {
    return {
      text: `${title}: ${targetAgentKeys.length || 'all'} agent(s) asked.`,
      blocks: selectedAgentQuestionBlocks(input, items),
      itemCount: items.length,
    }
  }

  return {
    text: `${title}: ${items.length} item(s).`,
    blocks: workItemBlocks(title, intro, items, input.kind),
    itemCount: items.length,
  }
}

export async function buildAgentSlackNotificationPayload(input: AgentSlackNotificationInput) {
  if (input.kind === 'pending_approvals') return buildPendingApprovalPayload()
  if (input.kind === 'stale_runs') return buildStaleRunsPayload()
  return buildWorkItemPayload(input)
}

async function postWithBotToken(text: string, blocks: SlackBlock[]): Promise<SlackDeliveryResult | null> {
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_AGENT_OPS_CHANNEL_ID || process.env.SLACK_AGENT_OPS_CHANNEL
  if (!token || !channel) return null

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text,
      blocks,
      unfurl_links: false,
      unfurl_media: false,
    }),
  })
  const body = await response.json().catch(() => null) as { ok?: boolean; error?: string; channel?: string; ts?: string } | null
  if (!response.ok || body?.ok === false) {
    return {
      sent: false,
      reason: `Slack bot delivery returned ${body?.error ?? `HTTP ${response.status}`}.`,
      mode: 'bot',
      channel,
      ts: null,
    }
  }
  return {
    sent: true,
    reason: null,
    mode: 'bot',
    channel: body?.channel ?? channel,
    ts: body?.ts ?? null,
  }
}

async function postWithWebhook(text: string, blocks: SlackBlock[]): Promise<SlackDeliveryResult> {
  const webhookUrl = process.env.SLACK_AGENT_OPS_WEBHOOK_URL
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    return { sent: false, reason: 'Slack bot channel and webhook are not configured.', mode: 'none' }
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, blocks }),
  })
  if (!response.ok) {
    return { sent: false, reason: `Slack webhook returned HTTP ${response.status}.`, mode: 'webhook' }
  }
  return { sent: true, reason: null, mode: 'webhook' }
}

async function postToSlack(text: string, blocks: SlackBlock[]): Promise<SlackDeliveryResult> {
  const botDelivery = await postWithBotToken(text, blocks)
  if (botDelivery?.sent) return botDelivery

  const webhookDelivery = await postWithWebhook(text, blocks)
  if (webhookDelivery.sent || !botDelivery) return webhookDelivery

  return {
    ...botDelivery,
    reason: `${botDelivery.reason} Webhook fallback also failed: ${webhookDelivery.reason}`,
  }
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
      notification_dedupe_key: input.dedupeKey ?? null,
      dedupe_window_hours: input.dedupeWindowHours ?? 1,
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
      delivery_mode: delivery.mode,
      slack_channel: delivery.channel ?? null,
      slack_message_ts: delivery.ts ?? null,
      slack_thread_ts: delivery.ts ?? null,
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
      delivery_mode: delivery.mode,
      slack_channel: delivery.channel ?? null,
      slack_message_ts: delivery.ts ?? null,
      slack_thread_ts: delivery.ts ?? null,
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
