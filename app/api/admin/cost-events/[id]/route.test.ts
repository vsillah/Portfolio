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

import { DELETE, GET, PUT } from './route'

type QueryResult = { data: unknown; error: unknown }

function thenableQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  return query
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/cost-events/evt-1', {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function ctx(id = 'evt-1') {
  return { params: Promise.resolve({ id }) }
}

describe('/api/admin/cost-events/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication before touching cost_events', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getRes = await GET(makeRequest('GET'), ctx())
    const putRes = await PUT(makeRequest('PUT', { amount: 1 }), ctx())
    const delRes = await DELETE(makeRequest('DELETE'), ctx())

    expect(getRes.status).toBe(401)
    expect(putRes.status).toBe(401)
    expect(delRes.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when GET hits PGRST116', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { code: 'PGRST116' } }))

    const response = await GET(makeRequest('GET'), ctx())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Not found' })
    expect(mocks.from).toHaveBeenCalledWith('cost_events')
  })

  it('rejects unknown sources, negative amounts, and empty updates without writing', async () => {
    const badSource = await PUT(makeRequest('PUT', { source: 'not_a_source' }), ctx())
    expect(badSource.status).toBe(400)
    await expect(badSource.json()).resolves.toEqual({ error: 'Invalid source' })

    const negative = await PUT(makeRequest('PUT', { amount: -1 }), ctx())
    expect(negative.status).toBe(400)
    await expect(negative.json()).resolves.toEqual({ error: 'amount must be non-negative' })

    const nanAmount = await PUT(makeRequest('PUT', { amount: 'nope' }), ctx())
    expect(nanAmount.status).toBe(400)
    await expect(nanAmount.json()).resolves.toEqual({ error: 'amount must be non-negative' })

    const empty = await PUT(makeRequest('PUT', {}), ctx())
    expect(empty.status).toBe(400)
    await expect(empty.json()).resolves.toEqual({ error: 'No fields to update' })

    const invalidJson = await PUT(makeRequest('PUT', '{'), ctx())
    expect(invalidJson.status).toBe(400)
    await expect(invalidJson.json()).resolves.toEqual({ error: 'Invalid request body' })

    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('parses string amounts and maps a check-constraint failure to 400', async () => {
    const query = thenableQuery({ data: null, error: { code: '23514' } })
    mocks.from.mockReturnValue(query)

    const response = await PUT(makeRequest('PUT', { amount: '12.50', source: 'other' }), ctx())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'amount must be non-negative' })
    expect(query.update).toHaveBeenCalledWith({ amount: 12.5, source: 'other' })
    expect(query.eq).toHaveBeenCalledWith('id', 'evt-1')
  })

  it('deletes the row and returns 204 with an empty body', async () => {
    const query = thenableQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)

    const response = await DELETE(makeRequest('DELETE'), ctx())

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'evt-1')
  })
})
