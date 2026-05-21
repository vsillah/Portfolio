import { buildAgentGovernanceSnapshot, type AgentGovernanceSnapshot } from '@/lib/agent-governance'

export type AgentGovernanceExportScope = {
  run_id?: string
  client_project_id?: string
  from?: string
  to?: string
  matching_run_count?: number
}

type ScopedRunRow = {
  id: string
  subject_id: string | null
  subject_label: string | null
  started_at: string
  metadata: Record<string, unknown> | null
}

type ScopedApprovalRow = {
  run_id: string
  approval_type: string
  status: string
  requested_at: string
}

type ScopedEventRow = {
  run_id: string
  event_type: string
  severity: string
  message: string | null
  occurred_at: string
  metadata: Record<string, unknown> | null
}

const CLIENT_PROJECT_METADATA_KEYS = [
  'client_project_id',
  'clientProjectId',
  'project_id',
  'projectId',
  'client_id',
  'clientId',
]
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function queryValue(searchParams: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key)?.trim()
    if (value) return value
  }
  return undefined
}

function normalizeDate(value: string | undefined, key: 'from' | 'to', errors: string[]) {
  if (!value) return undefined
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const normalized = dateOnly && key === 'from'
    ? `${value}T00:00:00.000Z`
    : dateOnly && key === 'to'
      ? `${value}T23:59:59.999Z`
      : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    errors.push(`${key} must be an ISO date or YYYY-MM-DD value`)
    return undefined
  }
  return date.toISOString()
}

export function parseAgentGovernanceExportScope(searchParams: URLSearchParams) {
  const errors: string[] = []
  const runId = queryValue(searchParams, 'runId', 'run_id')
  const from = normalizeDate(queryValue(searchParams, 'from', 'start'), 'from', errors)
  const to = normalizeDate(queryValue(searchParams, 'to', 'end'), 'to', errors)

  if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
    errors.push('from must be before or equal to to')
  }
  if (runId && !UUID_PATTERN.test(runId)) {
    errors.push('runId must be a UUID')
  }

  const scope: AgentGovernanceExportScope = {
    run_id: runId,
    client_project_id: queryValue(searchParams, 'clientProjectId', 'client_project_id'),
    from,
    to,
  }
  const has_scope = Boolean(scope.run_id || scope.client_project_id || scope.from || scope.to)

  return { scope, has_scope, errors }
}

function metadataValue(metadata: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === 'string' || typeof value === 'number') return String(value)
  }
  return undefined
}

function matchesClientProject(run: ScopedRunRow, clientProjectId: string) {
  const expected = clientProjectId.toLowerCase()
  return [
    run.subject_id,
    run.subject_label,
    metadataValue(run.metadata, CLIENT_PROJECT_METADATA_KEYS),
  ].some((value) => String(value ?? '').toLowerCase() === expected)
}

function applyDateRange<T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T }>(
  query: T,
  column: string,
  scope: AgentGovernanceExportScope,
) {
  let next = query
  if (scope.from) next = next.gte(column, scope.from)
  if (scope.to) next = next.lte(column, scope.to)
  return next
}

export async function buildScopedAgentGovernanceSnapshot(
  scope: AgentGovernanceExportScope,
): Promise<{ governance: AgentGovernanceSnapshot; scope: AgentGovernanceExportScope }> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  let runsQuery = supabaseAdmin
    .from('agent_runs')
    .select('id, subject_id, subject_label, started_at, metadata')
    .order('started_at', { ascending: false })
    .limit(250)

  if (scope.run_id) runsQuery = runsQuery.eq('id', scope.run_id)
  runsQuery = applyDateRange(runsQuery, 'started_at', scope)

  const runsRes = await runsQuery
  if (runsRes.error) throw new Error(runsRes.error.message)

  const runs = ((runsRes.data ?? []) as ScopedRunRow[])
    .filter((run) => !scope.client_project_id || matchesClientProject(run, scope.client_project_id))
  const runIds = runs.map((run) => run.id)
  const shouldQueryScopedRuns = Boolean(scope.run_id || scope.client_project_id)

  let approvals: ScopedApprovalRow[] = []
  let events: ScopedEventRow[] = []

  if (!shouldQueryScopedRuns || runIds.length > 0) {
    let approvalsQuery = supabaseAdmin
      .from('agent_approvals')
      .select('run_id, approval_type, status, requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })
      .limit(50)
    let eventsQuery = supabaseAdmin
      .from('agent_run_events')
      .select('run_id, event_type, severity, message, occurred_at, metadata')
      .eq('event_type', 'delegation_decision_recorded')
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (runIds.length > 0) {
      approvalsQuery = approvalsQuery.in('run_id', runIds)
      eventsQuery = eventsQuery.in('run_id', runIds)
    }

    approvalsQuery = applyDateRange(approvalsQuery, 'requested_at', scope)
    eventsQuery = applyDateRange(eventsQuery, 'occurred_at', scope)

    const [approvalsRes, eventsRes] = await Promise.all([approvalsQuery, eventsQuery])
    if (approvalsRes.error) throw new Error(approvalsRes.error.message)
    if (eventsRes.error) throw new Error(eventsRes.error.message)
    approvals = (approvalsRes.data ?? []) as ScopedApprovalRow[]
    events = (eventsRes.data ?? []) as ScopedEventRow[]
  }

  return {
    governance: buildAgentGovernanceSnapshot({ approvals, events }),
    scope: {
      ...scope,
      matching_run_count: runIds.length,
    },
  }
}
