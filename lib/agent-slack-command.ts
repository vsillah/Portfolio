import { runAgentOpsMorningReview } from '@/lib/agent-ops-morning-review'
import { createAgentEngagementRun } from '@/lib/agent-engagement'
import { routeAgentInboxItem } from '@/lib/agent-inbox-routing'
import { buildAgentMissionControlSnapshot } from '@/lib/agent-mission-control'
import { runAgentWarRoom } from '@/lib/agent-war-room'
import { AGENT_ORGANIZATION, getAgentByKey } from '@/lib/agent-organization'
import {
  highSignalInsightsSlackBlocks,
  highSignalInsightsSlackText,
} from '@/lib/agent-slack-insights'
import { supabaseAdmin } from '@/lib/supabase'
import {
  claimAgentWorkItem,
  getAgentWorkItem,
  handoffAgentWorkItem,
  listAgentWorkItems,
  type AgentWorkItem,
} from '@/lib/agent-work-items'
import {
  mrkdwn,
  slackButton,
  truncateSlack,
  type SlackButtonElement,
  type SlackBlock,
} from '@/lib/agent-slack-blocks'
import {
  createMoremiWarningWorkItems,
  getLatestMoremiMonitorReview,
  MOREMI_WARNING_WORK_ITEMS_CONFIRMATION,
} from '@/lib/moremi-monitor-review'

type SlackCommandName =
  | 'help'
  | 'status'
  | 'failed'
  | 'approvals'
  | 'morning-review'
  | 'risk'
  | 'agents'
  | 'engagements'
  | 'insights'
  | 'unblock'
  | 'work-items'
  | 'claim'
  | 'handoff'
  | 'blockers'
  | 'prs'
  | 'captain'
  | 'inbox'
  | 'brief'
  | 'route'
  | 'run'
  | 'standup'
  | 'discuss'

export type AgentSlackCommandInput = {
  text: string
  userId?: string | null
  userName?: string | null
}

export type AgentSlackCommandResult = {
  responseType: 'ephemeral'
  text: string
  blocks?: SlackBlock[]
}

type CountQueryResult = {
  count: number | null
  error: { message: string } | null
}

type AgentRunRow = {
  id: string
  title: string
  runtime: string
  status: string
  subject_label: string | null
  current_step: string | null
  error_message: string | null
  started_at: string
}

type AgentApprovalRow = {
  id: string
  run_id: string
  approval_type: string
  status: string
  requested_at: string
  metadata?: Record<string, unknown> | null
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.PORTFOLIO_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://amadutown.com'
  ).replace(/\/$/, '')
}

function agentRunsUrl(runId?: string) {
  return `${baseUrl()}/admin/agents/runs${runId ? `/${runId}` : ''}`
}

function agentCoordinationUrl() {
  return `${baseUrl()}/admin/agents/coordination`
}

function agentKanbanUrl() {
  return `${baseUrl()}/admin/agents/swarm-board`
}

function since24h() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

function commandFromText(text: string): SlackCommandName {
  const [command] = text.trim().toLowerCase().split(/\s+/)
  if (!command || command === 'help') return 'help'
  if (command === 'status') return 'status'
  if (command === 'failed' || command === 'failures') return 'failed'
  if (command === 'approval' || command === 'approvals') return 'approvals'
  if (command === 'morning-review' || command === 'morning' || command === 'review') return 'morning-review'
  if (command === 'risk' || command === 'moremi') return 'risk'
  if (command === 'agents' || command === 'list') return 'agents'
  if (command === 'engagements' || command === 'queue') return 'engagements'
  if (command === 'insights' || command === 'signals') return 'insights'
  if (command === 'unblock' || command === 'mobile') return 'unblock'
  if (command === 'work') return 'work-items'
  if (command === 'claim') return 'claim'
  if (command === 'handoff') return 'handoff'
  if (command === 'blockers') return 'blockers'
  if (command === 'prs') return 'prs'
  if (command === 'captain') return 'captain'
  if (command === 'inbox') return 'inbox'
  if (command === 'brief') return 'brief'
  if (command === 'route') return 'route'
  if (command === 'run' || command === 'start') return 'run'
  if (command === 'standup') return 'standup'
  if (command === 'discuss') return 'discuss'
  return 'help'
}

function commandArgs(text: string) {
  return text.trim().split(/\s+/).slice(1)
}

function formatHelp() {
  return [
    '*Agent Ops commands*',
    '`/agent status` - active runs, recent failures, pending approvals, and cost events.',
    '`/agent failed` - latest failed or stale runs.',
    '`/agent approvals` - pending approval checkpoints.',
    '`/agent morning-review` - run the approved Agent Ops morning review trace.',
    '`/agent risk` - show Moremi risk monitor coverage and latest trace.',
    '`/agent risk review create_moremi_warning_work_items` - create or reuse proposed work items from latest Moremi warnings.',
    '`/agent agents` - list currently mapped agents and engagement keys.',
    '`/agent engagements` - show the latest routed engagement work queue.',
    '`/agent insights` - show high-signal AI insight themes and mobile-safe research actions.',
    '`/agent unblock` - show the mobile unblock packet across approvals, blockers, inbox, and work items.',
    '`/agent work [id]` - show coordination work items or one work packet.',
    '`/agent claim <id> [agent-key]` - claim a coordination work item.',
    '`/agent handoff <id> <agent-key>` - request an agent-to-agent handoff.',
    '`/agent blockers` - show blocked coordination work.',
    '`/agent prs` - show work waiting on PR review or merge.',
    '`/agent captain` - show the Integration Captain coordination queue.',
    '`/agent inbox` - show numbered Agent Inbox items.',
    '`/agent brief` - show the current Daily Operating Brief.',
    '`/agent route <number-or-id>` - route an Agent Inbox item through Chief of Staff.',
    '`/agent run <agent-key>` - create a traceable engagement request for an agent.',
    '`/agent standup` - run a text War Room standup across active/partial agents.',
    '`/agent discuss <question>` - gather agent perspectives and a Chief of Staff synthesis.',
  ].join('\n')
}

function formatWorkItemLine(item: AgentWorkItem, index?: number) {
  const number = typeof index === 'number' ? `${index + 1}. ` : '- '
  const owner = item.owner_agent_key ? `${item.owner_agent_key}/${item.owner_runtime}` : item.owner_runtime
  const branch = item.branch_name ? ` branch=${item.branch_name}` : ''
  const pr = item.pr_url ? ` <${item.pr_url}|PR ${item.pr_number ?? ''}>` : ''
  const approval = item.approval_id ? ' approval-linked' : ''
  return `${number}*${item.title}* [${item.status}/${owner}]${branch}${pr}${approval}\n   ${item.objective}`
}

function riskLabelForApproval(approvalType: string) {
  if (approvalType === 'vercel_deployment_research_proposal') return 'low'
  if (approvalType === 'n8n_workflow_activation') return 'high'
  if (
    approvalType.includes('payment') ||
    approvalType.includes('production_config') ||
    approvalType.includes('send_email') ||
    approvalType.includes('publishing') ||
    approvalType.includes('private_material') ||
    approvalType.includes('merge')
  ) {
    return 'high'
  }
  return 'review'
}

function metadataString(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata || typeof metadata !== 'object') return null
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function approvalRecommendation(approval: AgentApprovalRow) {
  const metadata = approval.metadata ?? null
  const actionPayload = metadata && typeof metadata.action_payload === 'object' && metadata.action_payload
    ? metadata.action_payload as Record<string, unknown>
    : null
  return metadataString(metadata, ['recommendation', 'recommended_action', 'review_summary', 'result_summary'])
    ?? metadataString(actionPayload, ['recommendation', 'recommendedAction', 'summary'])
    ?? (canDecideApprovalInSlack(approval.approval_type)
      ? 'Safe mobile decision is available after reviewing the trace evidence.'
      : 'Open Portfolio for the final decision because this crosses a protected boundary.')
}

function approvalNextSafeAction(approval: AgentApprovalRow) {
  if (canDecideApprovalInSlack(approval.approval_type)) {
    return 'Approve, decline, request revision, or ask Shaka for a risk summary.'
  }
  return 'Open the trace in Portfolio; Slack will not perform this action directly.'
}

function canDecideApprovalInSlack(approvalType: string) {
  return approvalType === 'vercel_deployment_research_proposal'
}

function approvalBlocks(input: {
  approvals: AgentApprovalRow[]
  runsById: Map<string, AgentRunRow>
}): SlackBlock[] {
  if (!input.approvals.length) {
    return [
      {
        type: 'section',
        text: mrkdwn(`*Pending agent approvals*\nNo pending approvals need mobile action.`),
      },
      {
        type: 'actions',
        elements: [
          slackButton({ label: 'Open Run Console', actionId: 'agent_open_runs', url: agentRunsUrl() }),
        ],
      },
    ]
  }

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn('*Pending agent approvals*\nReview low-risk decisions here. High-risk changes deep-link back to Portfolio.'),
    },
  ]

  input.approvals.slice(0, 5).forEach((approval) => {
    const run = input.runsById.get(approval.run_id)
    const title = run?.title ?? approval.run_id
    const risk = riskLabelForApproval(approval.approval_type)
    const safe = canDecideApprovalInSlack(approval.approval_type)
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(title, 120)}*`,
        `Type: \`${approval.approval_type}\` · Risk: *${risk}*`,
        run?.current_step ? `Step: ${truncateSlack(run.current_step, 140)}` : null,
        `Recommendation: ${truncateSlack(approvalRecommendation(approval), 180)}`,
        `Next safe action: ${approvalNextSafeAction(approval)}`,
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: [
        ...(safe ? [
          slackButton({
            label: 'Approve',
            actionId: 'agent_approval_approve',
            style: 'primary',
            value: { action: 'approval.approve', approvalId: approval.id, runId: approval.run_id },
            confirmText: `Approve ${title}?`,
          }),
          slackButton({
            label: 'Decline',
            actionId: 'agent_approval_decline',
            style: 'danger',
            value: {
              action: 'approval.reject',
              approvalId: approval.id,
              runId: approval.run_id,
              note: 'Declined from Slack.',
            },
            confirmText: `Decline ${title}?`,
          }),
          slackButton({
            label: 'Request revision',
            actionId: 'agent_approval_revision',
            value: {
              action: 'approval.revision',
              approvalId: approval.id,
              runId: approval.run_id,
              note: 'Revision requested from Slack.',
            },
          }),
        ] : []),
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_approval_ask_shaka',
          value: { action: 'approval.ask_shaka', approvalId: approval.id, runId: approval.run_id },
        }),
        slackButton({ label: 'Open trace', actionId: 'agent_open_trace', url: agentRunsUrl(approval.run_id) }),
      ].slice(0, 5),
    })
  })

  return blocks
}

function workItemRisk(item: AgentWorkItem) {
  if (item.approval_id || item.status === 'ready_for_merge' || item.status === 'deployed') return 'portfolio review'
  if (item.priority === 'urgent' || item.status === 'blocked') return 'high attention'
  if (item.priority === 'high' || item.pr_url) return 'review'
  return 'routine'
}

function workItemRecommendation(item: AgentWorkItem) {
  return metadataString(item.metadata, ['recommendation', 'recommended_action', 'next_recommendation'])
    ?? item.validation_summary
    ?? item.blocker_summary
    ?? (item.owner_agent_key
      ? 'Ask Shaka for the next step or mark ready after trace evidence is complete.'
      : 'Assign an owner before more work moves.')
}

function workItemNextSafeAction(item: AgentWorkItem) {
  if (!item.owner_agent_key) return 'Assign owner'
  if (item.status === 'blocked') return 'Ask Shaka or acknowledge the blocker before routing follow-up.'
  if (item.status === 'ready_for_review' || item.status === 'ready_for_merge') return 'Open trace or request revision.'
  return 'Mark ready when the work has enough trace evidence.'
}

function priorityWeight(priority: AgentWorkItem['priority']) {
  if (priority === 'urgent') return 0
  if (priority === 'high') return 1
  if (priority === 'medium') return 2
  return 3
}

function statusWeight(status: AgentWorkItem['status']) {
  if (status === 'blocked') return 0
  if (status === 'ready_for_merge') return 1
  if (status === 'ready_for_review') return 2
  if (status === 'proposed') return 3
  if (status === 'queued') return 4
  if (status === 'assigned') return 5
  if (status === 'in_progress') return 6
  return 7
}

function activeWorkItems(items: AgentWorkItem[]) {
  return items.filter((item) => !['merged', 'deployed', 'cancelled'].includes(item.status))
}

function pickMobileUnblockWorkItems(items: AgentWorkItem[], limit: number) {
  return [...activeWorkItems(items)]
    .sort((a, b) => {
      const statusDelta = statusWeight(a.status) - statusWeight(b.status)
      if (statusDelta !== 0) return statusDelta
      return priorityWeight(a.priority) - priorityWeight(b.priority)
    })
    .slice(0, limit)
}

function workItemActionButtons(item: AgentWorkItem) {
  const elements: SlackButtonElement[] = []
  if (!item.owner_agent_key) {
    elements.push(slackButton({
      label: 'Assign owner',
      actionId: 'agent_work_assign_captain',
      value: { action: 'work.assign', workItemId: item.id, agentKey: 'integration-captain' },
    }))
  } else {
    elements.push(slackButton({
      label: 'Handoff',
      actionId: 'agent_work_handoff_captain',
      value: { action: 'work.handoff', workItemId: item.id, agentKey: 'integration-captain' },
    }))
  }

  if (item.status === 'blocked' && item.blocker_summary) {
    elements.push(slackButton({
      label: 'Acknowledge',
      actionId: 'agent_work_acknowledge_blocker',
      value: {
        action: 'work.acknowledge',
        workItemId: item.id,
        runId: item.active_run_id ?? undefined,
        note: 'Blocker acknowledged from Slack.',
      },
    }))
  } else if (item.status !== 'ready_for_review' && item.status !== 'ready_for_merge') {
    elements.push(slackButton({
      label: 'Mark ready',
      actionId: 'agent_work_ready',
      value: {
        action: 'work.ready',
        workItemId: item.id,
        note: 'Marked ready from Slack. Review trace and continue from Kanban.',
      },
    }))
  }

  elements.push(
    slackButton({
      label: 'Ask Shaka',
      actionId: 'agent_work_ask_shaka',
      value: { action: 'work.ask_shaka', workItemId: item.id, runId: item.active_run_id ?? undefined },
    }),
    slackButton({
      label: 'Request revision',
      actionId: 'agent_work_revision',
      value: {
        action: 'work.revision',
        workItemId: item.id,
        runId: item.active_run_id ?? undefined,
        note: 'Revision requested from Slack.',
      },
    }),
    slackButton({
      label: item.active_run_id ? 'Open trace' : 'Open Kanban',
      actionId: item.active_run_id ? 'agent_open_trace' : 'agent_open_kanban',
      url: item.active_run_id ? agentRunsUrl(item.active_run_id) : agentKanbanUrl(),
    }),
  )

  return elements.slice(0, 5)
}

async function pendingApprovalRows(limit = 5) {
  if (!supabaseAdmin) return { approvals: [] as AgentApprovalRow[], runsById: new Map<string, AgentRunRow>() }

  const { data: approvals, error } = await supabaseAdmin
    .from('agent_approvals')
    .select('id, run_id, approval_type, status, requested_at, metadata')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  const pending = (approvals || []) as AgentApprovalRow[]
  const runIds = pending.map((approval) => approval.run_id)
  const { data: runs, error: runsError } = runIds.length
    ? await supabaseAdmin
        .from('agent_runs')
        .select('id, title, runtime, status, subject_label, current_step, error_message, started_at')
        .in('id', runIds)
    : { data: [] as AgentRunRow[], error: null }

  if (runsError) throw new Error(runsError.message)

  return {
    approvals: pending,
    runsById: new Map(((runs || []) as AgentRunRow[]).map((run) => [run.id, run])),
  }
}

function workItemBlocks(input: {
  title: string
  items: AgentWorkItem[]
  emptyText: string
}): SlackBlock[] {
  if (!input.items.length) {
    return [
      { type: 'section', text: mrkdwn(`*${input.title}*\n${input.emptyText}`) },
      { type: 'actions', elements: [slackButton({ label: 'Open Kanban', actionId: 'agent_open_kanban', url: agentKanbanUrl() })] },
    ]
  }

  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn(`*${input.title}*\nUse these buttons for safe mobile routing. Merge, deploy, activation, outbound, and credential work stays in Portfolio.`) },
  ]

  input.items.slice(0, 5).forEach((item) => {
    const owner = item.owner_agent_key ?? 'unassigned'
    const blocker = item.blocker_summary ? `\nBlocker: ${truncateSlack(item.blocker_summary, 140)}` : ''
    blocks.push({
      type: 'section',
      text: mrkdwn([
        `*${truncateSlack(item.title, 120)}*`,
        `Status: \`${item.status}\` · Owner: \`${owner}\` · Priority: \`${item.priority}\` · Risk: *${workItemRisk(item)}*`,
        `Recommendation: ${truncateSlack(workItemRecommendation(item), 180)}`,
        `Next safe action: ${workItemNextSafeAction(item)}`,
        blocker.trim() || null,
      ].filter(Boolean).join('\n')),
    })
    blocks.push({
      type: 'actions',
      elements: workItemActionButtons(item),
    })
  })

  return blocks
}

function mobileUnblockBlocks(input: {
  workItems: AgentWorkItem[]
  approvals: AgentApprovalRow[]
  runsById: Map<string, AgentRunRow>
  inboxCount: number
}): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: mrkdwn([
        '*Agent Ops mobile unblock*',
        'Use this packet for quick routing. Merge, deploy, external sends, credentials, production config, payments, and n8n activation stay in Portfolio.',
        `Approvals: ${input.approvals.length} · Inbox: ${input.inboxCount} · Work items: ${input.workItems.length}`,
      ].join('\n')),
    },
    {
      type: 'actions',
      elements: [
        slackButton({ label: 'Mission Control', actionId: 'agent_open_mission_control', url: `${baseUrl()}/admin/agents` }),
        slackButton({ label: 'Kanban', actionId: 'agent_open_kanban', url: agentKanbanUrl() }),
        slackButton({ label: 'Run Console', actionId: 'agent_open_runs', url: agentRunsUrl() }),
      ],
    },
  ]

  if (input.approvals.length) {
    blocks.push(...approvalBlocks({ approvals: input.approvals.slice(0, 2), runsById: input.runsById }))
  }

  blocks.push(...workItemBlocks({
    title: 'Highest-priority mobile work items',
    items: input.workItems.slice(0, input.approvals.length ? 3 : 5),
    emptyText: 'No active work items need mobile action.',
  }))

  if (input.inboxCount > 0) {
    blocks.push({
      type: 'context',
      elements: [mrkdwn(`Inbox also has ${input.inboxCount} item(s). Use \`/agent inbox\` or \`/agent route <number>\` for inbox-specific routing.`)],
    })
  }

  return blocks.slice(0, 20)
}

function inboxBlocks(items: Array<{
  id?: string
  priority: string
  agent_name: string
  title: string
  reason: string
  source_run_id?: string | null
}>): SlackBlock[] {
  if (!items.length) {
    return [
      { type: 'section', text: mrkdwn('*Agent Inbox*\nNo inbox items need mobile action.') },
      { type: 'actions', elements: [slackButton({ label: 'Open Mission Control', actionId: 'agent_open_mission_control', url: `${baseUrl()}/admin/agents` })] },
    ]
  }

  const blocks: SlackBlock[] = [
    { type: 'section', text: mrkdwn('*Agent Inbox*\nRoute failures, stale runs, and attention items without waiting to get back to Mission Control.') },
  ]

  items.slice(0, 5).forEach((item, index) => {
    blocks.push({
      type: 'section',
      text: mrkdwn(`*${item.priority.toUpperCase()}* ${truncateSlack(item.title, 120)}\n${truncateSlack(item.reason, 180)}\nAgent: ${item.agent_name}`),
    })
    blocks.push({
      type: 'actions',
      elements: [
        slackButton({
          label: 'Route',
          actionId: 'agent_inbox_route',
          value: { action: 'inbox.route', workItemId: String(index + 1) },
          style: 'primary',
        }),
        slackButton({
          label: 'Ask Shaka',
          actionId: 'agent_inbox_ask_shaka',
          value: {
            action: 'inbox.ask_shaka',
            workItemId: item.id ?? String(index + 1),
            runId: item.source_run_id ?? undefined,
          },
        }),
        slackButton({
          label: item.source_run_id ? 'Open trace' : 'Open Mission Control',
          actionId: item.source_run_id ? 'agent_open_trace' : 'agent_open_mission_control',
          url: item.source_run_id ? agentRunsUrl(item.source_run_id) : `${baseUrl()}/admin/agents`,
        }),
      ],
    })
  })

  return blocks
}

export async function buildAgentWorkItemsSlackText(input: AgentSlackCommandInput) {
  const [itemId] = commandArgs(input.text)
  try {
    if (itemId) {
      const item = await getAgentWorkItem(itemId)
      if (!item) return `Work item not found: \`${itemId}\``
      return [
        '*Agent work item*',
        formatWorkItemLine(item),
        item.blocker_summary ? `Blocker: ${item.blocker_summary}` : null,
        item.validation_summary ? `Validation: ${item.validation_summary}` : null,
        item.latest_handoff ? `Latest handoff: ${item.latest_handoff.from_agent_key ?? 'unknown'} -> ${item.latest_handoff.to_agent_key ?? 'unknown'}` : null,
        item.active_run_id ? `Trace: ${agentRunsUrl(item.active_run_id)}` : null,
        `Review: ${agentCoordinationUrl()}`,
      ].filter(Boolean).join('\n')
    }

    const items = (await listAgentWorkItems({ limit: 8 }))
      .filter((item) => !['merged', 'deployed', 'cancelled'].includes(item.status))
      .slice(0, 8)
    if (items.length === 0) return `No active agent coordination work items. Review: ${agentCoordinationUrl()}`
    return ['*Agent coordination work*', ...items.map(formatWorkItemLine), `Review: ${agentCoordinationUrl()}`].join('\n')
  } catch (error) {
    return `Agent work lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function buildAgentWorkItemsSlackResult(input: AgentSlackCommandInput): Promise<AgentSlackCommandResult> {
  const text = await buildAgentWorkItemsSlackText(input)
  const [itemId] = commandArgs(input.text)
  try {
    if (itemId) {
      const item = await getAgentWorkItem(itemId)
      return {
        responseType: 'ephemeral',
        text,
        blocks: item
          ? workItemBlocks({
              title: 'Agent work item',
              items: [item],
              emptyText: `Work item not found: ${itemId}`,
            })
          : undefined,
      }
    }
    const items = (await listAgentWorkItems({ limit: 8 }))
      .filter((item) => !['merged', 'deployed', 'cancelled'].includes(item.status))
      .slice(0, 5)
    return {
      responseType: 'ephemeral',
      text,
      blocks: workItemBlocks({
        title: 'Agent coordination work',
        items,
        emptyText: 'No active coordination work needs mobile action.',
      }),
    }
  } catch {
    return { responseType: 'ephemeral', text }
  }
}

export async function buildAgentUnblockSlackResult(limit = 5): Promise<AgentSlackCommandResult> {
  let items: AgentWorkItem[] = []
  let approvals: AgentApprovalRow[] = []
  let runsById = new Map<string, AgentRunRow>()
  let inboxCount = 0
  const warnings: string[] = []

  try {
    items = await listAgentWorkItems({ limit: 50 })
  } catch (error) {
    warnings.push(`Work items unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  try {
    const pending = await pendingApprovalRows(limit)
    approvals = pending.approvals
    runsById = pending.runsById
  } catch (error) {
    warnings.push(`Approvals unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  try {
    const snapshot = await buildAgentMissionControlSnapshot()
    inboxCount = snapshot.agent_inbox.length
  } catch (error) {
    warnings.push(`Inbox unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  const activeItems = activeWorkItems(items)
  const blocked = activeItems.filter((item) => item.status === 'blocked')
  const review = activeItems.filter((item) => item.status === 'ready_for_review' || item.status === 'ready_for_merge')
  const proposed = activeItems.filter((item) => item.status === 'proposed')
  const topItems = pickMobileUnblockWorkItems(activeItems, limit)

  const nextSafeAction = approvals.length
    ? 'Review pending approvals first; Slack only decides low-risk approval packets.'
    : blocked.length
      ? 'Start with blockers and ask Shaka for the smallest safe unblock.'
      : review.length
        ? 'Open PR-ready work in Kanban and leave merge authority with the Integration Captain.'
        : proposed.length
          ? 'Claim or hand off one proposed item after confirming the owner and boundary.'
          : inboxCount > 0
            ? 'Open `/agent inbox` and route the highest-priority inbox item.'
            : 'No immediate mobile unblock is visible.'

  const lines = [
    '*Agent Ops mobile unblock*',
    `Pending approvals: ${approvals.length}`,
    `Blocked work items: ${blocked.length}`,
    `Review/merge candidates: ${review.length}`,
    `Proposed work items: ${proposed.length}`,
    `Inbox items: ${inboxCount}`,
    `Next safe action: ${nextSafeAction}`,
    warnings.length ? `Warnings: ${warnings.join('; ')}` : null,
    `Mission Control: ${baseUrl()}/admin/agents`,
    `Kanban: ${agentKanbanUrl()}`,
  ].filter(Boolean)

  return {
    responseType: 'ephemeral',
    text: lines.join('\n'),
    blocks: mobileUnblockBlocks({ workItems: topItems, approvals, runsById, inboxCount }),
  }
}

export async function claimAgentWorkItemSlackText(input: AgentSlackCommandInput) {
  const [itemId, agentKeyArg] = commandArgs(input.text)
  if (!itemId) return 'Missing work item. Use `/agent work`, then `/agent claim <id> [agent-key]`.'
  const ownerAgentKey = agentKeyArg || 'manual-admin'
  try {
    const actor = input.userName || input.userId || 'Slack user'
    const item = await claimAgentWorkItem({
      id: itemId,
      ownerAgentKey,
      actorLabel: actor,
    })
    return [
      '*Agent work item claimed*',
      formatWorkItemLine(item),
      item.active_run_id ? `Trace: ${agentRunsUrl(item.active_run_id)}` : `Review: ${agentCoordinationUrl()}`,
    ].join('\n')
  } catch (error) {
    return `Agent work claim failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function handoffAgentWorkItemSlackText(input: AgentSlackCommandInput) {
  const [itemId, toAgentKey, ...summaryParts] = commandArgs(input.text)
  if (!itemId || !toAgentKey) return 'Missing handoff details. Use `/agent handoff <id> <agent-key> [summary]`.'
  try {
    const actor = input.userName || input.userId || 'Slack user'
    const result = await handoffAgentWorkItem({
      id: itemId,
      toAgentKey,
      fromAgentKey: 'manual-admin',
      summary: summaryParts.join(' ').trim() || `${actor} requested handoff to ${toAgentKey}`,
      acceptanceCriteria: 'Review the work packet, update status, and attach PR or blocker evidence.',
    })
    return [
      '*Agent work item handed off*',
      formatWorkItemLine(result.workItem),
      result.handoffId ? `Handoff: ${result.handoffId}` : null,
      result.workItem.active_run_id ? `Trace: ${agentRunsUrl(result.workItem.active_run_id)}` : `Review: ${agentCoordinationUrl()}`,
    ].filter(Boolean).join('\n')
  } catch (error) {
    return `Agent work handoff failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function buildAgentBlockersSlackText() {
  try {
    const items = await listAgentWorkItems({ status: 'blocked', limit: 8 })
    if (items.length === 0) return `No blocked coordination work. Review: ${agentCoordinationUrl()}`
    return ['*Blocked agent coordination work*', ...items.map(formatWorkItemLine), `Review: ${agentCoordinationUrl()}`].join('\n')
  } catch (error) {
    return `Agent blocker lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function buildAgentBlockersSlackResult(): Promise<AgentSlackCommandResult> {
  const text = await buildAgentBlockersSlackText()
  try {
    const items = await listAgentWorkItems({ status: 'blocked', limit: 5 })
    return {
      responseType: 'ephemeral',
      text,
      blocks: workItemBlocks({
        title: 'Blocked agent coordination work',
        items,
        emptyText: 'No blocked coordination work needs mobile action.',
      }),
    }
  } catch {
    return { responseType: 'ephemeral', text }
  }
}

export async function buildAgentPrsSlackText() {
  try {
    const items = (await listAgentWorkItems({ limit: 50 }))
      .filter((item) => item.status === 'ready_for_review' || item.status === 'ready_for_merge')
      .slice(0, 8)
    if (items.length === 0) return `No coordination PRs are waiting for review or merge. Review: ${agentCoordinationUrl()}`
    return ['*Coordination PR queue*', ...items.map(formatWorkItemLine), `Review: ${agentCoordinationUrl()}`].join('\n')
  } catch (error) {
    return `Agent PR queue lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function buildCaptainQueueSlackText() {
  try {
    const items = await listAgentWorkItems({ limit: 100 })
    const review = items.filter((item) => item.status === 'ready_for_review' || item.status === 'ready_for_merge')
    const blocked = items.filter((item) => item.status === 'blocked')
    const approval = items.filter((item) => Boolean(item.approval_id))
    return [
      '*Integration Captain queue*',
      `Review/merge candidates: ${review.length}`,
      `Blocked: ${blocked.length}`,
      `Approval-linked: ${approval.length}`,
      review.slice(0, 5).map(formatWorkItemLine).join('\n') || 'No PR-ready work items.',
      `Review: ${agentCoordinationUrl()}`,
    ].join('\n')
  } catch (error) {
    return `Captain queue lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function buildAgentEngagementQueueSlackText(limit = 5) {
  try {
    const snapshot = await buildAgentMissionControlSnapshot()
    const items = snapshot.engagement_queue.slice(0, limit)
    if (items.length === 0) {
      return `*Engagement Work Queue*\nNo routed engagement requests yet.\nReview: ${baseUrl()}/admin/agents`
    }

    const lines = items.map((item, index) => {
      const source = item.source_run_id ? ` from <${agentRunsUrl(item.source_run_id)}|inbox trace>` : ''
      const step = item.current_step ?? item.next_action ?? 'Engagement request queued.'
      return `${index + 1}. <${agentRunsUrl(item.run_id)}|${item.agent_name}> [${item.status}/${item.execution_mode}]${source}\n   ${step}`
    })

    return [
      '*Engagement Work Queue*',
      ...lines,
      `Review: ${baseUrl()}/admin/agents`,
    ].join('\n')
  } catch (error) {
    return `Engagement queue lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function buildHighSignalInsightsSlackResult(): Promise<AgentSlackCommandResult> {
  try {
    const snapshot = await buildAgentMissionControlSnapshot()
    const insights = snapshot.high_signal_ai_insights ?? []
    return {
      responseType: 'ephemeral',
      text: highSignalInsightsSlackText(insights),
      blocks: highSignalInsightsSlackBlocks({ insights, baseUrl: baseUrl() }),
    }
  } catch (error) {
    return {
      responseType: 'ephemeral',
      text: `High-signal insight lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export async function buildAgentInboxSlackText(limit = 5) {
  try {
    const snapshot = await buildAgentMissionControlSnapshot()
    const items = snapshot.agent_inbox.slice(0, limit)
    if (items.length === 0) {
      return `*Agent Inbox*\nNo inbox items need attention.\nReview: ${baseUrl()}/admin/agents`
    }

    const lines = items.map((item, index) => {
      const source = item.source_run_id ? ` <${agentRunsUrl(item.source_run_id)}|trace>` : ''
      return `${index + 1}. *${item.priority.toUpperCase()}* ${item.agent_name}: ${item.title}${source}\n   ${item.reason}`
    })

    return [
      '*Agent Inbox*',
      ...lines,
      'Route one with `/agent route <number>`.',
      `Review: ${baseUrl()}/admin/agents`,
    ].join('\n')
  } catch (error) {
    return `Agent Inbox lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function buildAgentInboxSlackResult(limit = 5): Promise<AgentSlackCommandResult> {
  const text = await buildAgentInboxSlackText(limit)
  try {
    const snapshot = await buildAgentMissionControlSnapshot()
    return {
      responseType: 'ephemeral',
      text,
      blocks: inboxBlocks(snapshot.agent_inbox.slice(0, limit)),
    }
  } catch {
    return { responseType: 'ephemeral', text }
  }
}

export async function buildAgentBriefSlackText() {
  try {
    const snapshot = await buildAgentMissionControlSnapshot()
    const brief = snapshot.daily_brief
    const trace = brief.run_id ? `\nTrace: ${agentRunsUrl(brief.run_id)}` : ''
    return [
      '*Daily Operating Brief*',
      `*${brief.headline}*`,
      brief.synthesis,
      '',
      '*Signals*',
      ...brief.signals.map((signal) => `- ${signal}`),
      '',
      '*Next actions*',
      ...brief.next_actions.slice(0, 3).map((action) => `- ${action}`),
      `${trace}\nReview: ${baseUrl()}/admin/agents`.trim(),
    ].join('\n')
  } catch (error) {
    return `Daily Operating Brief lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function buildAgentRiskMonitorSlackText(input: AgentSlackCommandInput = { text: 'risk' }) {
  try {
    const [subcommand, confirmation] = commandArgs(input.text)

    if (subcommand === 'review' && confirmation === MOREMI_WARNING_WORK_ITEMS_CONFIRMATION) {
      const result = await createMoremiWarningWorkItems()
      if (!result.review.run) {
        return [
          '*Moremi Risk Review*',
          'No Moremi monitor trace is visible yet.',
          `Review: ${baseUrl()}/admin/agents`,
        ].join('\n')
      }

      const itemLines = result.work_items.length
        ? result.work_items.map((item) => `- ${item.id}: ${item.title} [${item.status}]`)
        : ['- No warnings required new work items.']

      return [
        '*Moremi Risk Review*',
        `Latest trace: <${baseUrl()}${result.review.run.href}|${result.review.run.id}>`,
        `Warnings: ${result.review.warning_count}`,
        `Work items created or reused: ${result.work_items.length}`,
        '',
        '*Work items*',
        ...itemLines,
        `Coordination: ${baseUrl()}/admin/agents/coordination`,
      ].join('\n')
    }

    if (subcommand === 'review' && confirmation) {
      return [
        '*Moremi Risk Review*',
        `Malformed confirmation. Use \`/agent risk review ${MOREMI_WARNING_WORK_ITEMS_CONFIRMATION}\` to create proposed work items.`,
        'Slack cannot approve remediation, merge code, mutate workflows, or touch production config.',
      ].join('\n')
    }

    const review = await getLatestMoremiMonitorReview()
    if (!review.run) {
      return [
        '*Moremi Risk Monitor*',
        'No Moremi risk monitor trace is visible yet.',
        `Review: ${baseUrl()}/admin/agents`,
      ].join('\n')
    }

    const warnings = review.warnings.length
      ? review.warnings.slice(0, 5).map((warning) => `- ${warning}`)
      : ['- None']

    return [
      '*Moremi Risk Monitor*',
      `*Coverage: ${review.run.overall ?? review.run.status}*`,
      `Latest trace: <${baseUrl()}${review.run.href}|${review.run.id}>`,
      '',
      '*Details*',
      `- ${review.warning_count} warning(s)`,
      `- ${review.enabled_source_feed_count} enabled feed(s)`,
      `- ${review.disabled_source_feed_count} disabled feed(s)`,
      `- ${review.linked_work_items.length} linked work item(s)`,
      '- Read-only; remediation approval-gated',
      '',
      '*Warnings*',
      ...warnings,
      `Create proposed work items: \`/agent risk review ${MOREMI_WARNING_WORK_ITEMS_CONFIRMATION}\``,
    ].join('\n')
  } catch (error) {
    return `Moremi risk monitor lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function routeAgentInboxSlackText(input: AgentSlackCommandInput) {
  const [itemRef] = commandArgs(input.text)
  if (!itemRef) return 'Missing inbox item. Use `/agent inbox`, then `/agent route <number>`.'

  try {
    const actor = input.userName || input.userId || 'Slack user'
    const result = await routeAgentInboxItem({
      itemRef,
      actor: {
        id: input.userId ?? actor,
        label: actor,
        type: 'slack_command',
      },
      triggerSource: 'slack_agent_inbox_route_command',
    })

    return [
      '*Agent Inbox item routed*',
      `Item: ${result.item.title}`,
      `Route action: ${result.routeAction.replace(/_/g, ' ')}`,
      `Execution mode: ${result.executionMode}`,
      `Review: ${agentRunsUrl(result.runId)}`,
    ].join('\n')
  } catch (error) {
    return `Agent Inbox routing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

function formatDbUnavailable() {
  return 'Agent Ops database is not available in this environment. Check Portfolio server env vars before using Slack commands.'
}

async function countRows(query: PromiseLike<CountQueryResult>) {
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function buildAgentStatusSlackText() {
  if (!supabaseAdmin) return formatDbUnavailable()

  try {
    const since = since24h()
    const [activeRuns, failedRuns, staleRuns, pendingApprovals, costEvents] = await Promise.all([
      countRows(
        supabaseAdmin
          .from('agent_runs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['queued', 'running', 'waiting_for_approval']),
      ),
      countRows(
        supabaseAdmin
          .from('agent_runs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('started_at', since),
      ),
      countRows(
        supabaseAdmin
          .from('agent_runs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'stale')
          .gte('started_at', since),
      ),
      countRows(
        supabaseAdmin
          .from('agent_approvals')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ),
      countRows(
        supabaseAdmin
          .from('cost_events')
          .select('id', { count: 'exact', head: true })
          .gte('occurred_at', since),
      ),
    ])

    return [
      '*Agent Ops status*',
      `Active runs: ${activeRuns}`,
      `Failed runs, last 24h: ${failedRuns}`,
      `Stale runs, last 24h: ${staleRuns}`,
      `Pending approvals: ${pendingApprovals}`,
      `Cost events, last 24h: ${costEvents}`,
      `Review: ${agentRunsUrl()}`,
    ].join('\n')
  } catch (error) {
    return `Agent Ops status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

function formatRunLine(run: AgentRunRow) {
  const subject = run.subject_label ? ` - ${run.subject_label}` : ''
  const step = run.current_step ? ` (${run.current_step})` : ''
  const error = run.error_message ? `: ${run.error_message}` : ''
  return `- <${agentRunsUrl(run.id)}|${run.title}> [${run.runtime}/${run.status}]${subject}${step}${error}`
}

export async function buildFailedRunsSlackText(limit = 5) {
  if (!supabaseAdmin) return formatDbUnavailable()

  const { data, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id, title, runtime, status, subject_label, current_step, error_message, started_at')
    .in('status', ['failed', 'stale'])
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) return `Failed run lookup failed: ${error.message}`

  const runs = (data || []) as AgentRunRow[]
  if (runs.length === 0) return `No failed or stale agent runs found. Review: ${agentRunsUrl()}`

  return ['*Latest failed or stale agent runs*', ...runs.map(formatRunLine)].join('\n')
}

export async function buildApprovalsSlackText(limit = 5) {
  if (!supabaseAdmin) return formatDbUnavailable()

  const { data: approvals, error } = await supabaseAdmin
    .from('agent_approvals')
    .select('id, run_id, approval_type, status, requested_at, metadata')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(limit)

  if (error) return `Approval lookup failed: ${error.message}`

  const pending = (approvals || []) as AgentApprovalRow[]
  if (pending.length === 0) return `No pending agent approvals. Review: ${agentRunsUrl()}`

  const runIds = pending.map((approval) => approval.run_id)
  const { data: runs, error: runsError } = await supabaseAdmin
    .from('agent_runs')
    .select('id, title, runtime, status, subject_label, current_step, error_message, started_at')
    .in('id', runIds)

  if (runsError) return `Approval run lookup failed: ${runsError.message}`

  const typedRuns = (runs || []) as AgentRunRow[]
  const runsById = new Map(typedRuns.map((run) => [run.id, run]))
  const lines = pending.map((approval) => {
    const run = runsById.get(approval.run_id)
    const title = run?.title ?? approval.run_id
    const runtime = run ? ` [${run.runtime}/${run.status}]` : ''
    return `- <${agentRunsUrl(approval.run_id)}|${title}>${runtime}: ${approval.approval_type}`
  })

  return ['*Pending agent approvals*', ...lines].join('\n')
}

export async function buildApprovalsSlackResult(limit = 5): Promise<AgentSlackCommandResult> {
  const text = await buildApprovalsSlackText(limit)
  if (!supabaseAdmin) return { responseType: 'ephemeral', text }

  try {
    const { approvals, runsById } = await pendingApprovalRows(limit)
    return {
      responseType: 'ephemeral',
      text,
      blocks: approvalBlocks({ approvals, runsById }),
    }
  } catch {
    return { responseType: 'ephemeral', text }
  }
}

export async function runMorningReviewSlackText(input: AgentSlackCommandInput) {
  try {
    const result = await runAgentOpsMorningReview('slack_agent_ops_command')
    const actor = input.userName || input.userId || 'Slack user'
    return [
      '*Agent Ops morning review complete*',
      `Triggered by: ${actor}`,
      `Overall: ${result.overall}`,
      `Stale marked: ${result.staleSweep.marked}`,
      `Slack notification: ${result.slackNotified ? 'sent' : 'skipped'}`,
      `Review: ${agentRunsUrl(result.runId)}`,
    ].join('\n')
  } catch (error) {
    return `Agent Ops morning review failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

function formatAgentListSlackText() {
  const active = AGENT_ORGANIZATION.filter((agent) => agent.status === 'active')
  const partial = AGENT_ORGANIZATION.filter((agent) => agent.status === 'partial')
  const plannedCount = AGENT_ORGANIZATION.filter((agent) => agent.status === 'planned').length
  const lines = [...active, ...partial].map(
    (agent) => `- \`${agent.key}\` - ${agent.name} [${agent.primaryRuntime}/${agent.status}]`,
  )

  return [
    '*Agent organization*',
    ...lines,
    `Planned agents hidden from this quick list: ${plannedCount}`,
    `Use \`/agent run <agent-key>\` to create a traceable engagement request.`,
    `Review: ${baseUrl()}/admin/agents`,
  ].join('\n')
}

export async function createAgentEngagementSlackText(input: AgentSlackCommandInput) {
  const [agentKey] = commandArgs(input.text)
  if (!agentKey) {
    return [
      'Missing agent key.',
      'Use `/agent agents` to see available keys, then `/agent run <agent-key>`.',
    ].join('\n')
  }

  const agent = getAgentByKey(agentKey)
  if (!agent) {
    return [
      `Unknown agent key: \`${agentKey}\``,
      'Use `/agent agents` to see available keys.',
    ].join('\n')
  }

  try {
    const actor = input.userName || input.userId || 'Slack user'
    const result = await createAgentEngagementRun({
      agent,
      actor: {
        subjectType: 'slack_command',
        subjectId: input.userId ?? actor,
        subjectLabel: actor,
      },
      triggerSource: 'slack_agent_run_command',
      requestedEventMessage: `${actor} requested ${agent.name} from Slack`,
      eventMetadata: {
        slack_user_id: input.userId ?? null,
        slack_user_name: input.userName ?? null,
      },
    })

    return [
      result.status === 'completed'
        ? `*${agent.name} read-only dispatch ready*`
        : `*${agent.name} engagement queued*`,
      `Agent key: \`${agent.key}\``,
      `Runtime path: ${agent.primaryRuntime}`,
      `Execution mode: ${result.executionMode}`,
      `Current guardrail: ${agent.approvalGate}`,
      `Review: ${agentRunsUrl(result.runId)}`,
    ].join('\n')
  } catch (error) {
    return `Agent engagement request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function runWarRoomStandupSlackText(input: AgentSlackCommandInput) {
  try {
    const actor = input.userName || input.userId || 'Slack user'
    const result = await runAgentWarRoom({
      command: 'standup',
      triggerSource: 'slack_agent_standup_command',
      actor: {
        id: input.userId ?? actor,
        label: actor,
        type: 'slack_command',
      },
    })

    const lines = result.updates
      .slice(0, 6)
      .map((update) => `- ${update.agent_name}: ${update.update}`)

    return [
      '*Agent War Room standup complete*',
      ...lines,
      `Chief of Staff: ${result.synthesis}`,
      `Review: ${agentRunsUrl(result.runId)}`,
    ].join('\n')
  } catch (error) {
    return `Agent War Room standup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function runWarRoomDiscussSlackText(input: AgentSlackCommandInput) {
  const message = commandArgs(input.text).join(' ').trim()
  if (!message) return 'Missing discussion topic. Use `/agent discuss <question>`.'

  try {
    const actor = input.userName || input.userId || 'Slack user'
    const result = await runAgentWarRoom({
      command: 'discuss',
      message,
      triggerSource: 'slack_agent_discuss_command',
      actor: {
        id: input.userId ?? actor,
        label: actor,
        type: 'slack_command',
      },
    })

    const lines = result.updates
      .slice(0, 5)
      .map((update) => `- ${update.agent_name}: ${update.update}`)

    return [
      '*Agent War Room discussion complete*',
      ...lines,
      `Chief of Staff: ${result.synthesis}`,
      `Review: ${agentRunsUrl(result.runId)}`,
    ].join('\n')
  } catch (error) {
    return `Agent War Room discussion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function handleAgentSlackCommand(input: AgentSlackCommandInput): Promise<AgentSlackCommandResult> {
  const command = commandFromText(input.text)
  if (command === 'approvals') return buildApprovalsSlackResult()
  if (command === 'work-items') return buildAgentWorkItemsSlackResult(input)
  if (command === 'blockers') return buildAgentBlockersSlackResult()
  if (command === 'inbox') return buildAgentInboxSlackResult()
  if (command === 'insights') return buildHighSignalInsightsSlackResult()
  if (command === 'unblock') return buildAgentUnblockSlackResult()

  const text =
    command === 'status'
      ? await buildAgentStatusSlackText()
      : command === 'failed'
        ? await buildFailedRunsSlackText()
        : command === 'morning-review'
          ? await runMorningReviewSlackText(input)
          : command === 'risk'
            ? await buildAgentRiskMonitorSlackText(input)
            : command === 'agents'
              ? formatAgentListSlackText()
              : command === 'engagements'
                ? await buildAgentEngagementQueueSlackText()
                : command === 'claim'
                  ? await claimAgentWorkItemSlackText(input)
                  : command === 'handoff'
                    ? await handoffAgentWorkItemSlackText(input)
                    : command === 'prs'
                      ? await buildAgentPrsSlackText()
                      : command === 'captain'
                        ? await buildCaptainQueueSlackText()
                        : command === 'brief'
                          ? await buildAgentBriefSlackText()
                          : command === 'route'
                            ? await routeAgentInboxSlackText(input)
                            : command === 'run'
                              ? await createAgentEngagementSlackText(input)
                              : command === 'standup'
                                ? await runWarRoomStandupSlackText(input)
                                : command === 'discuss'
                                  ? await runWarRoomDiscussSlackText(input)
                                  : formatHelp()

  return { responseType: 'ephemeral', text }
}

export const agentSlackCommandInternals = {
  commandFromText,
  commandArgs,
  formatAgentListSlackText,
  formatHelp,
}
