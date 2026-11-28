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

import { DELETE, GET, POST, PUT } from './route'

type QueryResult = { data?: unknown; error?: unknown }

function makeQuery(result: QueryResult = { data: [], error: null }) {
  const query: Record<string, unknown> = {}
  const self = () => query
  for (const method of ['select', 'eq', 'or', 'order', 'upsert', 'update', 'delete', 'single']) {
    query[method] = vi.fn(self)
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return query as {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    or: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/value-evidence/benchmarks${query}`)
}

function makeBodyRequest(method: string, body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/value-evidence/benchmarks', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validCreate = {
  industry: 'healthcare',
  company_size_range: '11-50',
  benchmark_type: 'hourly_rate',
  value: 0,
  source: 'BLS',
  year: 2026,
}

describe('/api/admin/value-evidence/benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated GET before listing benchmarks', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('interpolates industry into the PostgREST or() filter and groups rows', async () => {
    const query = makeQuery({
      data: [
        { id: 'b-1', industry: 'healthcare' },
        { id: 'b-2', industry: '_default' },
        { id: 'b-3', industry: 'healthcare' },
      ],
      error: null,
    })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeGetRequest('?industry=healthcare'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(query.or).toHaveBeenCalledWith('industry.eq.healthcare,industry.eq._default')
    expect(body.grouped).toEqual({
      healthcare: [
        { id: 'b-1', industry: 'healthcare' },
        { id: 'b-3', industry: 'healthcare' },
      ],
      _default: [{ id: 'b-2', industry: '_default' }],
    })
  })

  it('does not apply an industry or() filter when industry is omitted', async () => {
    const query = makeQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(200)
    expect(query.or).not.toHaveBeenCalled()
  })

  it('requires create fields and allows value=0', async () => {
    const missing = await POST(makeBodyRequest('POST', { industry: 'healthcare' }))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({
      error: 'industry, company_size_range, benchmark_type, value, source, and year are required',
    })
    expect(mocks.from).not.toHaveBeenCalled()

    const query = makeQuery({ data: { id: 'b-1' }, error: null })
    mocks.from.mockReturnValue(query)
    const response = await POST(makeBodyRequest('POST', validCreate))

    expect(response.status).toBe(200)
    expect(query.upsert).toHaveBeenCalledWith(
      {
        industry: 'healthcare',
        company_size_range: '11-50',
        benchmark_type: 'hourly_rate',
        value: 0,
        source: 'BLS',
        source_url: null,
        year: 2026,
        notes: null,
      },
      { onConflict: 'industry,company_size_range,benchmark_type,year' },
    )
  })

  it('requires an id on PUT and allowlists editable fields', async () => {
    const missing = await PUT(makeBodyRequest('PUT', { value: 10 }))
    expect(missing.status).toBe(400)

    const empty = await PUT(makeBodyRequest('PUT', { id: 'b-1', industry: 'retail' }))
    expect(empty.status).toBe(400)
    await expect(empty.json()).resolves.toEqual({ error: 'No fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()

    const query = makeQuery({ data: { id: 'b-1' }, error: null })
    mocks.from.mockReturnValue(query)
    const response = await PUT(
      makeBodyRequest('PUT', {
        id: 'b-1',
        value: 55,
        source: 'Updated',
        industry: 'retail',
      }),
    )

    expect(response.status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({ value: 55, source: 'Updated' })
  })

  it('hard-deletes by id query param', async () => {
    const missing = await DELETE(
      new NextRequest('http://localhost/api/admin/value-evidence/benchmarks', { method: 'DELETE' }),
    )
    expect(missing.status).toBe(400)

    const query = makeQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/value-evidence/benchmarks?id=b-1', {
        method: 'DELETE',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'b-1')
  })
})
