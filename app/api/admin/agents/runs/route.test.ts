import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (value: { error?: unknown; status?: unknown } | null | undefined) =>
    Boolean(value?.error && value?.status),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/agents/runs${query}`)
}

type QueryCalls = {
  eq: Array<[string, unknown]>
  in: Array<[string, unknown]>
  limit: number[]
}

function thenableQuery(result: { data: unknown; error: unknown }, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(onFulfilled, onRejected)
    },
  }
}

function setupListQuery(
  runs: Record<string, unknown>[],
  options?: {
    costs?: Array<{ agent_run_id: string | null; amount: number | string | null }>
    approvals?: Array<{ run_id: string; status: string }>
  },
) {
  const calls: QueryCalls = { eq: [], in: [], limit: [] }
  const runsQuery = thenableQuery(
    { data: runs, error: null },
    {
      select: vi.fn(() => runsQuery),
      order: vi.fn(() => runsQuery),
      limit: vi.fn((value: number) => {
        calls.limit.push(value)
        return runsQuery
      }),
      eq: vi.fn((field: string, value: unknown) => {
        calls.eq.push([field, value])
        return runsQuery
      }),
      in: vi.fn((field: string, value: unknown) => {
        calls.in.push([field, value])
        return runsQuery
      }),
    },
  )

  mocks.from.mockImplementation((table: string) => {
    if (table === 'agent_runs') return { select: () => runsQuery }
    if (table === 'cost_events') {
      return {
        select: () => ({
          in: vi.fn().mockResolvedValue({ data: options?.costs ?? [], error: null }),
        }),
      }
    }
    if (table === 'agent_approvals') {
      return {
        select: () => ({
          in: vi.fn().mockResolvedValue({ data: options?.approvals ?? [], error: null }),
        }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return calls
}

describe('GET /api/admin/agents/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('requires admin auth before listing runs', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unknown runtime filter before querying', async () => {
    const response = await GET(request('?runtime=not-a-runtime'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid runtime filter' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unknown status filter before querying', async () => {
    const response = await GET(request('?status=not-a-status'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid status filter' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a kind filter longer than 120 characters', async () => {
    const response = await GET(request(`?kind=${'k'.repeat(121)}`))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid kind filter' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not restrict runtime or status when those filters are omitted, all, or blank', async () => {
    // filter === 'all' → no restriction on agent_runs.runtime / status / kind
    for (const query of ['', '?runtime=all&status=all&kind=all', '?runtime=&status=&kind=']) {
      const calls = setupListQuery([])
      const response = await GET(request(query))
      expect(response.status).toBe(200)
      expect(calls.eq).toEqual([])
      expect(calls.in).toEqual([])
    }
  })

  it('maps needs_review to failed and stale without applying a raw status eq', async () => {
    const calls = setupListQuery([])

    const response = await GET(request('?status=needs_review'))

    expect(response.status).toBe(200)
    expect(calls.eq.filter(([field]) => field === 'status')).toEqual([])
    expect(calls.in).toEqual([['status', ['failed', 'stale']]])
  })

  it('maps operator_checks to the operator-check kind set', async () => {
    const calls = setupListQuery([])

    const response = await GET(request('?kind=operator_checks'))

    expect(response.status).toBe(200)
    expect(calls.eq.filter(([field]) => field === 'kind')).toEqual([])
    expect(calls.in).toEqual([[
      'kind',
      ['agent_ops_morning_review', 'system_health_summary', 'approval_gate_drill', 'runtime_evaluation'],
    ]])
  })

  it('applies concrete runtime, kind, and status filters', async () => {
    const calls = setupListQuery([])

    const response = await GET(request('?runtime=n8n&kind=warm_lead_scrape&status=running'))

    expect(response.status).toBe(200)
    expect(calls.eq).toEqual([
      ['runtime', 'n8n'],
      ['kind', 'warm_lead_scrape'],
      ['status', 'running'],
    ])
  })

  it('restricts to in-flight statuses when active=true', async () => {
    const calls = setupListQuery([])

    const response = await GET(request('?active=true'))

    expect(response.status).toBe(200)
    expect(calls.in).toEqual([['status', ['queued', 'running', 'waiting_for_approval']]])
  })

  it('caps the list limit at 100 and defaults to 50', async () => {
    const defaultCalls = setupListQuery([])
    expect((await GET(request())).status).toBe(200)
    expect(defaultCalls.limit).toEqual([50])

    const cappedCalls = setupListQuery([])
    expect((await GET(request('?limit=500'))).status).toBe(200)
    expect(cappedCalls.limit).toEqual([100])
  })

  it('marks long-running rows stale and aggregates cost plus approval counts', async () => {
    const startedAt = new Date(Date.now() - 45 * 60 * 1000).toISOString()
    setupListQuery(
      [{
        id: 'run-1',
        agent_key: 'ops',
        runtime: 'n8n',
        kind: 'warm_lead_scrape',
        title: 'Warm scrape',
        status: 'running',
        subject_type: null,
        subject_id: null,
        subject_label: null,
        current_step: 'fetch',
        trigger_source: null,
        started_at: startedAt,
        completed_at: null,
        stale_after: null,
        error_message: null,
        metadata: null,
      }],
      {
        costs: [
          { agent_run_id: 'run-1', amount: 1.25 },
          { agent_run_id: 'run-1', amount: '0.005' },
          { agent_run_id: null, amount: 9 },
        ],
        approvals: [
          { run_id: 'run-1', status: 'pending' },
          { run_id: 'run-1', status: 'approved' },
          { run_id: 'run-1', status: 'rejected' },
          { run_id: 'run-1', status: 'cancelled' },
        ],
      },
    )

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.runs).toHaveLength(1)
    expect(body.runs[0]).toEqual(expect.objectContaining({
      id: 'run-1',
      stale: true,
      cost_total: 1.255,
      approvals: { pending: 1, approved: 1, rejected: 1 },
    }))
  })
})
