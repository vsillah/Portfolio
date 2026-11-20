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
  for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete', 'single']) {
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
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/value-evidence/calculations${query}`)
}

function makeBodyRequest(method: string, body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/value-evidence/calculations', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validCreate = {
  pain_point_category_id: 'pp-1',
  industry: 'healthcare',
  company_size_range: '11-50',
  calculation_method: 'hours_saved',
  formula_inputs: { hours: 10 },
  formula_expression: '10 hrs × $45',
  annual_value: 0,
}

describe('/api/admin/value-evidence/calculations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated GET before listing calculations', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('always lists active calculations and applies optional filters', async () => {
    const query = makeQuery({ data: [{ id: 'calc-1' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(
      makeGetRequest('?industry=healthcare&company_size=11-50&pain_point_id=pp-1'),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ calculations: [{ id: 'calc-1' }] })
    expect(query.eq).toHaveBeenCalledWith('is_active', true)
    expect(query.eq).toHaveBeenCalledWith('industry', 'healthcare')
    expect(query.eq).toHaveBeenCalledWith('company_size_range', '11-50')
    expect(query.eq).toHaveBeenCalledWith('pain_point_category_id', 'pp-1')
    expect(query.limit).toHaveBeenCalledWith(100)
  })

  it('requires the create fields and allows annual_value=0', async () => {
    const missing = await POST(makeBodyRequest('POST', { industry: 'healthcare' }))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'Missing required fields' })
    expect(mocks.from).not.toHaveBeenCalled()

    const query = makeQuery({ data: { id: 'calc-1' }, error: null })
    mocks.from.mockReturnValue(query)
    const response = await POST(makeBodyRequest('POST', validCreate))

    expect(response.status).toBe(200)
    expect(query.insert).toHaveBeenCalledWith({
      pain_point_category_id: 'pp-1',
      industry: 'healthcare',
      company_size_range: '11-50',
      calculation_method: 'hours_saved',
      formula_inputs: { hours: 10 },
      formula_expression: '10 hrs × $45',
      annual_value: 0,
      confidence_level: 'medium',
      evidence_count: 0,
      benchmark_ids: [],
      evidence_ids: [],
      generated_by: 'manual',
    })
  })

  it('requires an id on PUT and allowlists editable fields', async () => {
    const missing = await PUT(makeBodyRequest('PUT', { annual_value: 10 }))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'id is required' })

    const empty = await PUT(makeBodyRequest('PUT', { id: 'calc-1', generated_by: 'attacker' }))
    expect(empty.status).toBe(400)
    await expect(empty.json()).resolves.toEqual({ error: 'No fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()

    const query = makeQuery({ data: { id: 'calc-1' }, error: null })
    mocks.from.mockReturnValue(query)
    const response = await PUT(
      makeBodyRequest('PUT', {
        id: 'calc-1',
        formula_inputs: { hours: 4 },
        annual_value: 12,
        confidence_level: 'high',
        is_active: false,
        generated_by: 'attacker',
      }),
    )

    expect(response.status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({
      formula_inputs: { hours: 4 },
      annual_value: 12,
      confidence_level: 'high',
      is_active: false,
    })
  })

  it('soft-deletes by id query param instead of removing the row', async () => {
    const missing = await DELETE(
      new NextRequest('http://localhost/api/admin/value-evidence/calculations', { method: 'DELETE' }),
    )
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'id query param is required' })

    const query = makeQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/value-evidence/calculations?id=calc-1', {
        method: 'DELETE',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(query.update).toHaveBeenCalledWith({ is_active: false })
    expect(query.eq).toHaveBeenCalledWith('id', 'calc-1')
  })
})
