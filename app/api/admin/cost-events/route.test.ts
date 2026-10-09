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

import { GET, POST } from './route'

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/cost-events${query}`)
}

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/cost-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function thenableQuery(result: { data: unknown; error: unknown; count?: number | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    range: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    eq: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  query.gte.mockReturnValue(query)
  query.lte.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}

describe('GET /api/admin/cost-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(getRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not restrict source when the filter is omitted or all', async () => {
    // omitted source / source=all → no restriction on cost_events.source
    const omitted = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(omitted)

    const omittedResponse = await GET(getRequest())
    expect(omittedResponse.status).toBe(200)
    expect(omitted.eq).not.toHaveBeenCalled()

    const allQuery = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(allQuery)

    const allResponse = await GET(getRequest('?source=all'))
    expect(allResponse.status).toBe(200)
    expect(allQuery.eq).not.toHaveBeenCalled()
  })

  it('filters by source, date range, and caps page size at 200', async () => {
    const query = thenableQuery({
      data: [{ id: 'evt-1', source: 'llm_openai' }],
      error: null,
      count: 1,
    })
    mocks.from.mockReturnValue(query)

    const response = await GET(
      getRequest('?source=llm_openai&from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z&page=2&limit=500'),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('source', 'llm_openai')
    expect(query.gte).toHaveBeenCalledWith('occurred_at', '2026-01-01T00:00:00Z')
    expect(query.lte).toHaveBeenCalledWith('occurred_at', '2026-01-31T23:59:59Z')
    expect(query.range).toHaveBeenCalledWith(200, 399)
    expect(body).toEqual({
      items: [{ id: 'evt-1', source: 'llm_openai' }],
      pagination: { page: 2, limit: 200, total: 1, totalPages: 1 },
    })
  })

  it('returns 500 when the list query fails', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'db down' }, count: null }))

    const response = await GET(getRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch cost events' })
  })
})

describe('POST /api/admin/cost-events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before inserting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      postRequest({ occurred_at: '2026-01-01T00:00:00Z', source: 'other', amount: 1 }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing required fields before touching the database', async () => {
    const response = await POST(postRequest({ source: 'other' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'occurred_at, source, and amount are required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unknown source without inserting', async () => {
    const response = await POST(
      postRequest({ occurred_at: '2026-01-01T00:00:00Z', source: 'not_a_source', amount: 1 }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Invalid source. Must be one of: llm_openai, llm_anthropic, vapi_call, stripe_fee, printful_fulfillment, replicate, twilio, elevenlabs, other',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a negative amount without inserting', async () => {
    const response = await POST(
      postRequest({ occurred_at: '2026-01-01T00:00:00Z', source: 'other', amount: -1 }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'amount must be a non-negative number' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(postRequest('{'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid request body' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('inserts a parsed string amount and defaults currency to usd', async () => {
    const inserted = {
      id: 'evt-2',
      occurred_at: '2026-01-01T00:00:00Z',
      source: 'stripe_fee',
      amount: 2.5,
      currency: 'usd',
    }
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: inserted, error: null }),
      }),
    })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'cost_events') throw new Error(`Unexpected table: ${table}`)
      return { insert }
    })

    const response = await POST(
      postRequest({
        occurred_at: '2026-01-01T00:00:00Z',
        source: 'stripe_fee',
        amount: '2.5',
      }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual(inserted)
    expect(insert).toHaveBeenCalledWith({
      occurred_at: '2026-01-01T00:00:00Z',
      source: 'stripe_fee',
      amount: 2.5,
      currency: 'usd',
      reference_type: null,
      reference_id: null,
      agent_run_id: null,
      metadata: {},
    })
  })

  it('maps unique-constraint collisions to 409', async () => {
    mocks.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate' },
          }),
        }),
      }),
    })

    const response = await POST(
      postRequest({ occurred_at: '2026-01-01T00:00:00Z', source: 'other', amount: 1 }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Duplicate cost event (idempotency: same source, reference, occurred_at)',
    })
  })

  it('maps a non-negative check violation to 400', async () => {
    mocks.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23514', message: 'check' },
          }),
        }),
      }),
    })

    const response = await POST(
      postRequest({ occurred_at: '2026-01-01T00:00:00Z', source: 'other', amount: 1 }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'amount must be non-negative' })
  })
})
