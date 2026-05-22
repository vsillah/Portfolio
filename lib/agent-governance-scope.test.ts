import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildScopedAgentGovernanceSnapshot,
  parseAgentGovernanceExportScope,
} from './agent-governance-scope'

type QueryResult = {
  data: unknown[] | null
  error: { message: string } | null
}

type QueryMock = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  then: Promise<QueryResult>['then']
}

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

function queryReturning(result: QueryResult) {
  const query: QueryMock = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  return query
}

function success(data: unknown[] = []): QueryResult {
  return { data, error: null }
}

describe('agent governance export scope parsing', () => {
  it('accepts run, client project, and date filters', () => {
    const result = parseAgentGovernanceExportScope(new URLSearchParams({
      runId: '11111111-1111-4111-8111-111111111111',
      clientProjectId: 'client-456',
      from: '2026-05-01',
      to: '2026-05-21',
    }))

    expect(result.errors).toEqual([])
    expect(result.has_scope).toBe(true)
    expect(result.scope).toMatchObject({
      run_id: '11111111-1111-4111-8111-111111111111',
      client_project_id: 'client-456',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-21T23:59:59.999Z',
    })
  })

  it('accepts snake-case aliases', () => {
    const result = parseAgentGovernanceExportScope(new URLSearchParams({
      run_id: '22222222-2222-4222-8222-222222222222',
      client_project_id: 'client-snake',
    }))

    expect(result.errors).toEqual([])
    expect(result.scope.run_id).toBe('22222222-2222-4222-8222-222222222222')
    expect(result.scope.client_project_id).toBe('client-snake')
  })

  it('rejects invalid date windows and run IDs', () => {
    const invalidDate = parseAgentGovernanceExportScope(new URLSearchParams({ from: 'not-a-date' }))
    const invertedRange = parseAgentGovernanceExportScope(new URLSearchParams({
      from: '2026-05-22',
      to: '2026-05-21',
    }))
    const invalidRunId = parseAgentGovernanceExportScope(new URLSearchParams({ runId: 'run-123' }))

    expect(invalidDate.errors[0]).toContain('from must be an ISO date')
    expect(invertedRange.errors).toContain('from must be before or equal to to')
    expect(invalidRunId.errors).toContain('runId must be a UUID')
  })
})

describe('scoped agent governance snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-22T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('matches client project scope against run metadata aliases before querying evidence', async () => {
    const runsQuery = queryReturning(success([
      {
        id: 'run-client',
        subject_id: null,
        subject_label: null,
        started_at: '2026-05-21T10:00:00.000Z',
        metadata: { clientProjectId: 'client-456' },
      },
      {
        id: 'run-other',
        subject_id: 'client-999',
        subject_label: null,
        started_at: '2026-05-21T09:00:00.000Z',
        metadata: { client_project_id: 'client-999' },
      },
    ]))
    const approvalsQuery = queryReturning(success([
      {
        run_id: 'run-client',
        approval_type: 'payment_create_refund',
        status: 'pending',
        requested_at: '2026-05-21T10:02:00.000Z',
      },
    ]))
    const eventsQuery = queryReturning(success([
      {
        run_id: 'run-client',
        event_type: 'delegation_decision_recorded',
        severity: 'info',
        message: 'Matched scoped client project.',
        occurred_at: '2026-05-21T10:01:00.000Z',
        metadata: {
          selected_agent_key: 'automation-systems',
          selected_agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
          task_type: 'client_delivery',
          risk_class: 'read_only',
          confidence: 0.91,
        },
      },
    ]))
    mocks.from
      .mockReturnValueOnce(runsQuery)
      .mockReturnValueOnce(approvalsQuery)
      .mockReturnValueOnce(eventsQuery)

    const snapshot = await buildScopedAgentGovernanceSnapshot({
      client_project_id: 'CLIENT-456',
    })

    expect(snapshot.scope.matching_run_count).toBe(1)
    expect(approvalsQuery.in).toHaveBeenCalledWith('run_id', ['run-client'])
    expect(eventsQuery.in).toHaveBeenCalledWith('run_id', ['run-client'])
    expect(snapshot.governance.summary.pending_authority_approvals).toBe(1)
    expect(snapshot.governance.recent_delegation_decisions[0]).toMatchObject({
      run_id: 'run-client',
      selected_agent_key: 'automation-systems',
      task_type: 'client_delivery',
    })
  })

  it('does not query approval or event evidence when scoped runs have no matches', async () => {
    const runsQuery = queryReturning(success([
      {
        id: 'run-other',
        subject_id: 'client-999',
        subject_label: null,
        started_at: '2026-05-21T09:00:00.000Z',
        metadata: null,
      },
    ]))
    mocks.from.mockReturnValueOnce(runsQuery)

    const snapshot = await buildScopedAgentGovernanceSnapshot({
      client_project_id: 'client-missing',
    })

    expect(snapshot.scope.matching_run_count).toBe(0)
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('agent_runs')
    expect(snapshot.governance.pending_authority_approvals).toEqual([])
    expect(snapshot.governance.recent_delegation_decisions).toEqual([])
  })

  it('applies date-only filters and restricts evidence to matching run IDs', async () => {
    const runsQuery = queryReturning(success([
      {
        id: 'run-window',
        subject_id: null,
        subject_label: null,
        started_at: '2026-05-21T10:00:00.000Z',
        metadata: null,
      },
    ]))
    const approvalsQuery = queryReturning(success([
      {
        run_id: 'run-window',
        approval_type: 'payment_create_refund',
        status: 'pending',
        requested_at: '2026-05-21T12:00:00.000Z',
      },
    ]))
    const eventsQuery = queryReturning(success([
      {
        run_id: 'run-window',
        event_type: 'delegation_decision_recorded',
        severity: 'info',
        message: 'Date-filtered delegation decision.',
        occurred_at: '2026-05-21T12:01:00.000Z',
        metadata: {
          selected_agent_key: 'chief-of-staff',
          selected_agent_name: 'Shaka (Zulu) - Chief of Staff',
          task_type: 'governance',
          risk_class: 'read_only',
          confidence: 0.88,
        },
      },
    ]))
    mocks.from
      .mockReturnValueOnce(runsQuery)
      .mockReturnValueOnce(approvalsQuery)
      .mockReturnValueOnce(eventsQuery)

    const snapshot = await buildScopedAgentGovernanceSnapshot({
      from: '2026-05-21T00:00:00.000Z',
      to: '2026-05-21T23:59:59.999Z',
    })

    expect(snapshot.scope.matching_run_count).toBe(1)
    expect(runsQuery.gte).toHaveBeenCalledWith('started_at', '2026-05-21T00:00:00.000Z')
    expect(runsQuery.lte).toHaveBeenCalledWith('started_at', '2026-05-21T23:59:59.999Z')
    expect(approvalsQuery.in).toHaveBeenCalledWith('run_id', ['run-window'])
    expect(eventsQuery.in).toHaveBeenCalledWith('run_id', ['run-window'])
    expect(approvalsQuery.gte).toHaveBeenCalledWith('requested_at', '2026-05-21T00:00:00.000Z')
    expect(approvalsQuery.lte).toHaveBeenCalledWith('requested_at', '2026-05-21T23:59:59.999Z')
    expect(eventsQuery.gte).toHaveBeenCalledWith('occurred_at', '2026-05-21T00:00:00.000Z')
    expect(eventsQuery.lte).toHaveBeenCalledWith('occurred_at', '2026-05-21T23:59:59.999Z')
    expect(snapshot.governance.pending_authority_approvals[0]?.run_id).toBe('run-window')
    expect(snapshot.governance.recent_delegation_decisions[0]?.run_id).toBe('run-window')
  })

  it('keeps date-only evidence queries active when no run rows match the window', async () => {
    const runsQuery = queryReturning(success([]))
    const approvalsQuery = queryReturning(success([
      {
        run_id: 'run-approval-in-window',
        approval_type: 'payment_create_refund',
        status: 'pending',
        requested_at: '2026-05-21T12:00:00.000Z',
      },
    ]))
    const eventsQuery = queryReturning(success([
      {
        run_id: 'run-event-in-window',
        event_type: 'delegation_decision_recorded',
        severity: 'info',
        message: 'Evidence timestamp matched the date-only export window.',
        occurred_at: '2026-05-21T12:01:00.000Z',
        metadata: {
          selected_agent_key: 'chief-of-staff',
          selected_agent_name: 'Shaka (Zulu) - Chief of Staff',
          task_type: 'governance',
          risk_class: 'read_only',
          confidence: 0.87,
        },
      },
    ]))
    mocks.from
      .mockReturnValueOnce(runsQuery)
      .mockReturnValueOnce(approvalsQuery)
      .mockReturnValueOnce(eventsQuery)

    const snapshot = await buildScopedAgentGovernanceSnapshot({
      from: '2026-05-21T00:00:00.000Z',
      to: '2026-05-21T23:59:59.999Z',
    })

    expect(snapshot.scope.matching_run_count).toBe(0)
    expect(mocks.from).toHaveBeenCalledTimes(3)
    expect(approvalsQuery.in).not.toHaveBeenCalled()
    expect(eventsQuery.in).not.toHaveBeenCalled()
    expect(approvalsQuery.gte).toHaveBeenCalledWith('requested_at', '2026-05-21T00:00:00.000Z')
    expect(eventsQuery.lte).toHaveBeenCalledWith('occurred_at', '2026-05-21T23:59:59.999Z')
    expect(snapshot.governance.pending_authority_approvals[0]?.run_id).toBe('run-approval-in-window')
    expect(snapshot.governance.recent_delegation_decisions[0]?.run_id).toBe('run-event-in-window')
  })
})
