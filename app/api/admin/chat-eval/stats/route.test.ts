import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

const queries: Array<{ gte: ReturnType<typeof vi.fn>; not: ReturnType<typeof vi.fn> }> = []

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/chat-eval/stats${query}`)
}

function nextQuery(result: unknown) {
  const query = {
    select: vi.fn(),
    gte: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.gte.mockReturnValue(query)
  query.not.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  queries.push(query)
  return query
}

function dateFromDays(days: number) {
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)
  return dateFrom.toISOString()
}

describe('GET /api/admin/chat-eval/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    queries.length = 0
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockImplementation(
      (result: { error?: string } | null) => Boolean(result) && typeof result === 'object' && 'error' in result
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects non-admins', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('aggregates ratings, channels, categories, and alignment for the default 30-day window', async () => {
    const results = [
      { count: 2 },
      { count: 5 },
      { data: [{ rating: 'good' }, { rating: 'good' }, { rating: 'bad' }, { rating: 'meh' }] },
      {
        data: [
          { category_id: 'a', evaluation_categories: { name: 'Accuracy', color: '#111' } },
          { category_id: 'b', evaluation_categories: null },
          { category_id: 'a', evaluation_categories: { name: 'Accuracy', color: '#111' } },
        ],
      },
      {
        data: [
          {
            session_id: 'sess-1',
            chat_messages: [{ metadata: { source: 'voice' } }, { metadata: { source: 'sms' } }],
          },
          { session_id: 'sess-2', chat_messages: [{ metadata: { source: 'text' } }] },
        ],
      },
      { data: [{ human_alignment: true }, { human_alignment: true }, { human_alignment: false }] },
      {
        data: [
          {
            session_id: 'sess-1',
            rating: 'good',
            evaluated_at: '2026-09-20T00:00:00.000Z',
            evaluation_categories: { name: 'Accuracy' },
          },
        ],
      },
    ]
    mocks.from.mockImplementation(() => nextQuery(results.shift()))

    const response = await GET(request('?days='))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(queries[0].gte).toHaveBeenCalledWith('created_at', dateFromDays(30))
    expect(queries[1].gte).toHaveBeenCalledWith('evaluated_at', dateFromDays(30))
    expect(body.overview).toEqual({
      total_sessions: 2,
      evaluated_sessions: 5,
      unevaluated_sessions: -3,
      success_rate: 67,
      good_count: 2,
      bad_count: 1,
    })
    expect(body.channels).toEqual({ voice: 1, text: 1, email: 0, chatbot: 1 })
    expect(body.categories).toEqual([
      { name: 'Accuracy', color: '#111', count: 2 },
      { name: 'Unknown', color: '#6B7280', count: 1 },
    ])
    expect(body.llm_alignment).toEqual({ total_compared: 3, aligned_count: 2, alignment_rate: 67 })
    expect(body.recent_evaluations).toEqual([
      {
        session_id: 'sess-1',
        rating: 'good',
        category: 'Accuracy',
        evaluated_at: '2026-09-20T00:00:00.000Z',
      },
    ])
    expect(body.period_days).toBe(30)
  })

  it('keeps days=0 as a same-day window and returns null alignment when nothing was compared', async () => {
    const results = [
      { count: null },
      { count: 0 },
      { data: [] },
      { data: [] },
      { data: [] },
      { data: [] },
      { data: null },
    ]
    mocks.from.mockImplementation(() => nextQuery(results.shift()))

    const response = await GET(request('?days=0'))
    const body = await response.json()

    expect(queries[0].gte).toHaveBeenCalledWith('created_at', dateFromDays(0))
    expect(body.overview.success_rate).toBe(0)
    expect(body.overview.unevaluated_sessions).toBe(0)
    expect(body.llm_alignment).toEqual({ total_compared: 0, aligned_count: 0, alignment_rate: null })
    expect(body.recent_evaluations).toEqual([])
    expect(body.period_days).toBe(0)
  })

  it('returns a generic error when days is not a number', async () => {
    mocks.from.mockImplementation(() => nextQuery({ count: 1 }))

    const response = await GET(request('?days=abc'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(queries[0].gte).not.toHaveBeenCalled()
  })
})
