import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

type QueryResult = {
  data: unknown[] | null
  error?: unknown
}

function listQuery(result: QueryResult) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue({ data: result.data, error: result.error ?? null }),
  }
}

function request(url = 'http://localhost/api/admin/cost-revenue/summary') {
  return new Request(url, {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/cost-revenue/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-28T10:02:13.957Z'))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin auth before querying finance tables', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults to month-to-date and applies inclusive day boundaries', async () => {
    const ordersQuery = listQuery({ data: [] })
    const proposalsQuery = listQuery({ data: [] })
    const costsQuery = listQuery({ data: [] })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') return ordersQuery
      if (table === 'proposals') return proposalsQuery
      if (table === 'cost_events') return costsQuery
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      from: '2026-06-01',
      to: '2026-06-28',
      revenue: {
        total: 0,
        orders: 0,
        subscriptions: 0,
        proposals: 0,
      },
      cost: {
        total: 0,
        bySource: [],
      },
      grossProfit: 0,
      grossMarginPercent: null,
      profitCostRatio: null,
    })
    expect(ordersQuery.gte).toHaveBeenCalledWith('created_at', '2026-06-01T00:00:00.000Z')
    expect(ordersQuery.lte).toHaveBeenCalledWith('created_at', '2026-06-28T23:59:59.999Z')
    expect(proposalsQuery.gte).toHaveBeenCalledWith('paid_at', '2026-06-01T00:00:00.000Z')
    expect(proposalsQuery.lte).toHaveBeenCalledWith('paid_at', '2026-06-28T23:59:59.999Z')
    expect(costsQuery.gte).toHaveBeenCalledWith('occurred_at', '2026-06-01T00:00:00.000Z')
    expect(costsQuery.lte).toHaveBeenCalledWith('occurred_at', '2026-06-28T23:59:59.999Z')
  })

  it('aggregates revenue and costs with rounding and source fallback', async () => {
    const ordersQuery = listQuery({
      data: [{ final_amount: 100.255 }, { final_amount: '50.245' }, { final_amount: null }],
    })
    const proposalsQuery = listQuery({
      data: [{ total_amount: '25.5' }, { total_amount: 'not-a-number' }],
    })
    const costsQuery = listQuery({
      data: [
        { source: 'stripe', amount: 10.115 },
        { source: 'stripe', amount: '0.115' },
        { source: null, amount: '5.4' },
        { source: '', amount: '2.22' },
      ],
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') return ordersQuery
      if (table === 'proposals') return proposalsQuery
      if (table === 'cost_events') return costsQuery
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(
      request('http://localhost/api/admin/cost-revenue/summary?from=2026-06-10&to=2026-06-20') as never
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      from: '2026-06-10',
      to: '2026-06-20',
      revenue: {
        total: 176,
        orders: 150.5,
        subscriptions: 0,
        proposals: 25.5,
      },
      cost: {
        total: 17.85,
        bySource: [
          { source: 'stripe', amount: 10.23 },
          { source: 'other', amount: 7.62 },
        ],
      },
      grossProfit: 158.15,
      grossMarginPercent: 89.9,
      profitCostRatio: 8.9,
    })
    expect(ordersQuery.eq).toHaveBeenCalledWith('status', 'completed')
    expect(proposalsQuery.not).toHaveBeenCalledWith('paid_at', 'is', null)
    expect(proposalsQuery.is).toHaveBeenCalledWith('order_id', null)
  })

  it('returns a safe 500 response when cost aggregation fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ordersQuery = listQuery({ data: [{ final_amount: 100 }] })
    const proposalsQuery = listQuery({ data: [{ total_amount: 25 }] })
    const costsQuery = listQuery({ data: null, error: new Error('database timeout') })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') return ordersQuery
      if (table === 'proposals') return proposalsQuery
      if (table === 'cost_events') return costsQuery
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(
      request('http://localhost/api/admin/cost-revenue/summary?from=2026-06-10&to=2026-06-20') as never
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch cost summary' })
    expect(consoleError).toHaveBeenCalledWith('Error fetching cost_events:', expect.any(Error))

    consoleError.mockRestore()
  })
})
