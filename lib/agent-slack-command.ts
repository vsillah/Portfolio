import { runAgentOpsMorningReview } from '@/lib/agent-ops-morning-review'
import { supabaseAdmin } from '@/lib/supabase'

type SlackCommandName = 'help' | 'status' | 'failed' | 'approvals' | 'morning-review'

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
  return 'help'
}

function formatHelp() {
  return [
    '*Agent Ops commands*',
    '`/agent status` - active runs, recent failures, pending approvals, and cost events.',
    '`/agent failed` - latest failed or stale runs.',
    '`/agent approvals` - pending approval checkpoints.',
    '`/agent morning-review` - run the approved Agent Ops morning review trace.',
  ].join('\n')
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
            : formatHelp()

  return { responseType: 'ephemeral', text }
}

export const agentSlackCommandInternals = {
  commandFromText,
  formatHelp,
}
