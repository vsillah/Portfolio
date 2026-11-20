import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(search = '') {
  return new NextRequest(`http://localhost/api/admin/sales${search}`)
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    not: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    in: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.not.mockReturnValue(query)
  query.in.mockReturnValue(query)
  return query
}

function queueByTable(tableResults: Record<string, Array<{ data?: unknown; error?: { message?: string } | null }>>) {
  const indexes: Record<string, number> = {}
  const queries: Record<string, ReturnType<typeof thenableQuery>[]> = {}
  mocks.from.mockImplementation((table: string) => {
    const i = indexes[table] ?? 0
    indexes[table] = i + 1
    const result = tableResults[table]?.[i] ?? { data: [], error: null }
    const query = thenableQuery(result)
    if (!queries[table]) queries[table] = []
    queries[table].push(query)
    return query
  })
  return queries
}

describe('GET /api/admin/sales', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults audit status to completed and returns empty leads when no contacts exist', async () => {
    const queries = queueByTable({
      diagnostic_audits: [{
        data: [{
          id: 'audit-orphan',
          contact_submission_id: null,
          urgency_score: 8,
          opportunity_score: 2,
          created_at: '2026-01-01T00:00:00.000Z',
        }],
        error: null,
      }],
      sales_sessions: [{ data: [], error: null }],
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.leads).toEqual([])
    expect(body.stats).toMatchObject({
      total_leads: 1,
      total_audits: 1,
      high_urgency: 1,
      high_opportunity: 0,
      pending_follow_up: 0,
      converted: 0,
    })
    expect(queries.diagnostic_audits[0].eq).toHaveBeenCalledWith('status', 'completed')
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })

  it('forwards an explicit audit status filter', async () => {
    queueByTable({
      diagnostic_audits: [{ data: [], error: null }],
      sales_sessions: [{ data: [], error: null }],
    })

    await GET(request('?status=in_progress'))

    const first = mocks.from.mock.results[0]?.value as ReturnType<typeof thenableQuery>
    expect(first.eq).toHaveBeenCalledWith('status', 'in_progress')
  })

  it('unifies audit and conversation contacts and prefers an in-progress session', async () => {
    queueByTable({
      diagnostic_audits: [{
        data: [{
          id: 'audit-1',
          contact_submission_id: 1,
          urgency_score: 8,
          opportunity_score: 4,
          created_at: '2026-02-01T00:00:00.000Z',
        }],
        error: null,
      }],
      sales_sessions: [
        {
          data: [{
            id: 'sess-conv',
            contact_submission_id: 2,
            diagnostic_audit_id: null,
            outcome: 'in_progress',
            funnel_stage: 'discovery',
            next_follow_up: null,
            created_at: '2026-03-01T00:00:00.000Z',
          }],
          error: null,
        },
        {
          data: [
            {
              id: 'sess-converted',
              contact_submission_id: 1,
              diagnostic_audit_id: 'audit-1',
              outcome: 'converted',
              funnel_stage: 'close',
              next_follow_up: null,
              created_at: '2026-04-01T00:00:00.000Z',
            },
            {
              id: 'sess-open',
              contact_submission_id: 1,
              diagnostic_audit_id: 'audit-1',
              outcome: 'in_progress',
              funnel_stage: 'proposal',
              next_follow_up: '2026-04-02',
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
          error: null,
        },
      ],
      contact_submissions: [{
        data: [
          { id: 1, name: 'Ada', email: 'ada@example.com', company: 'Ada Co', message: null, industry: null, employee_count: null, created_at: '2026-01-01T00:00:00.000Z' },
          { id: 2, name: 'Bo', email: 'bo@example.com', company: 'Bo Co', message: null, industry: null, employee_count: null, created_at: '2026-01-02T00:00:00.000Z' },
        ],
        error: null,
      }],
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.leads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contact_id: 1,
        name: 'Ada',
        has_diagnostic_audit: true,
        has_conversation: true,
        session: expect.objectContaining({ id: 'sess-open', outcome: 'in_progress' }),
      }),
      expect.objectContaining({
        contact_id: 2,
        name: 'Bo',
        has_diagnostic_audit: false,
        has_conversation: true,
      }),
    ]))
    expect(body.stats.pending_follow_up).toBe(2)
    expect(body.stats.converted).toBe(0)
  })

  it('excludes conversation-only leads when a min_urgency filter is set', async () => {
    queueByTable({
      diagnostic_audits: [{
        data: [{
          id: 'audit-low',
          contact_submission_id: 1,
          urgency_score: 3,
          opportunity_score: 9,
          created_at: '2026-02-01T00:00:00.000Z',
        }],
        error: null,
      }],
      sales_sessions: [
        {
          data: [{
            id: 'sess-conv',
            contact_submission_id: 2,
            diagnostic_audit_id: null,
            outcome: 'in_progress',
            funnel_stage: 'discovery',
            next_follow_up: null,
            created_at: '2026-03-01T00:00:00.000Z',
          }],
          error: null,
        },
        { data: [], error: null },
      ],
      contact_submissions: [{
        data: [
          { id: 1, name: 'Ada', email: 'ada@example.com', company: null, message: null, industry: null, employee_count: null, created_at: null },
          { id: 2, name: 'Bo', email: 'bo@example.com', company: null, message: null, industry: null, employee_count: null, created_at: null },
        ],
        error: null,
      }],
    })

    const response = await GET(request('?min_urgency=7'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.leads).toEqual([])
    expect(body.stats.total_leads).toBe(0)
  })
})
