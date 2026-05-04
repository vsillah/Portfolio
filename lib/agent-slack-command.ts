import { runAgentOpsMorningReview } from '@/lib/agent-ops-morning-review'
import { createAgentEngagementRun } from '@/lib/agent-engagement'
import { routeAgentInboxItem } from '@/lib/agent-inbox-routing'
import { buildAgentMissionControlSnapshot } from '@/lib/agent-mission-control'
import { runAgentWarRoom } from '@/lib/agent-war-room'
import { AGENT_ORGANIZATION, getAgentByKey } from '@/lib/agent-organization'
import { supabaseAdmin } from '@/lib/supabase'

type SlackCommandName =
  | 'help'
  | 'status'
  | 'failed'
  | 'approvals'
  | 'morning-review'
  | 'agents'
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
  if (command === 'agents' || command === 'list') return 'agents'
  if (command === 'inbox' || command === 'queue') return 'inbox'
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
    '`/agent agents` - list currently mapped agents and engagement keys.',
    '`/agent inbox` - show numbered Agent Inbox items.',
    '`/agent brief` - show the current Daily Operating Brief.',
    '`/agent route <number-or-id>` - route an Agent Inbox item through Chief of Staff.',
    '`/agent run <agent-key>` - create a traceable engagement request for an agent.',
    '`/agent standup` - run a text War Room standup across active/partial agents.',
    '`/agent discuss <question>` - gather agent perspectives and a Chief of Staff synthesis.',
  ].join('\n')
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
    .select('id, run_id, approval_type, status, requested_at')
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
  const text =
    command === 'status'
      ? await buildAgentStatusSlackText()
      : command === 'failed'
        ? await buildFailedRunsSlackText()
        : command === 'approvals'
          ? await buildApprovalsSlackText()
          : command === 'morning-review'
            ? await runMorningReviewSlackText(input)
            : command === 'agents'
              ? formatAgentListSlackText()
              : command === 'inbox'
                ? await buildAgentInboxSlackText()
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
