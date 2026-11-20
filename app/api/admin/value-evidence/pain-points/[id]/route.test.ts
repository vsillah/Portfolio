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

import { GET, PATCH } from './route'

type QueryResult = { data?: unknown; error?: unknown }

function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {}
  const self = () => query
  for (const method of ['select', 'eq', 'order', 'limit', 'update', 'single']) {
    query[method] = vi.fn(self)
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return query as {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
  }
}

function makeGetRequest() {
  return new NextRequest('http://localhost/api/admin/value-evidence/pain-points/pp-1')
}

function makePatchRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/value-evidence/pain-points/pp-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/value-evidence/pain-points/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated GET before loading the chain', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest(), { params: { id: 'pp-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the category is missing', async () => {
    mocks.from.mockReturnValue(makeQuery({ data: null, error: { message: 'missing' } }))

    const response = await GET(makeGetRequest(), { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Pain point not found' })
  })

  it('loads evidence, active calculations, and content mappings for the category', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'pain_point_categories') {
        return makeQuery({ data: { id: 'pp-1', display_name: 'Scheduling' }, error: null })
      }
      if (table === 'pain_point_evidence') {
        const query = makeQuery({ data: [{ id: 'ev-1' }], error: null })
        return query
      }
      if (table === 'value_calculations') {
        return makeQuery({ data: [{ id: 'calc-1' }], error: null })
      }
      if (table === 'content_pain_point_map') {
        return makeQuery({ data: [{ id: 'map-1' }], error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeGetRequest(), { params: { id: 'pp-1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      category: { id: 'pp-1', display_name: 'Scheduling' },
      evidence: [{ id: 'ev-1' }],
      calculations: [{ id: 'calc-1' }],
      contentMappings: [{ id: 'map-1' }],
    })
  })

  it('allowlists PATCH fields and still updates when the allowlist is empty', async () => {
    const emptyQuery = makeQuery({ data: { id: 'pp-1' }, error: null })
    mocks.from.mockReturnValue(emptyQuery)

    const empty = await PATCH(makePatchRequest({ name: 'ignored', frequency_count: 99 }), {
      params: { id: 'pp-1' },
    })

    expect(empty.status).toBe(200)
    expect(emptyQuery.update).toHaveBeenCalledWith({})

    const query = makeQuery({ data: { id: 'pp-1', display_name: 'New' }, error: null })
    mocks.from.mockReturnValue(query)
    const response = await PATCH(
      makePatchRequest({
        display_name: 'New',
        description: 'Updated',
        related_services: ['ops'],
        related_products: ['widget'],
        industry_tags: ['healthcare'],
        is_active: false,
        name: 'ignored',
      }),
      { params: { id: 'pp-1' } },
    )

    expect(response.status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({
      display_name: 'New',
      description: 'Updated',
      related_services: ['ops'],
      related_products: ['widget'],
      industry_tags: ['healthcare'],
      is_active: false,
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'pp-1')
  })
})
