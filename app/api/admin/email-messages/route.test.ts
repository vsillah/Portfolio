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

type QueryResult = { data: unknown; error: unknown; count?: number }

function thenableQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.or.mockReturnValue(query)
  return query
}

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/email-messages${query}`)
}

describe('GET /api/admin/email-messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('applies no contact/status/kind/transport filters when those params are all or omitted', async () => {
    // contact/status/kind/transport === 'all' or omitted → no restriction on those dimensions
    const query = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(query)

    const omitted = await GET(makeRequest())
    expect(omitted.status).toBe(200)
    await expect(omitted.json()).resolves.toEqual({ items: [], total: 0, limit: 50, offset: 0 })
    expect(query.eq).not.toHaveBeenCalled()
    expect(query.or).not.toHaveBeenCalled()
    expect(query.range).toHaveBeenCalledWith(0, 49)

    const allFilters = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(allFilters)
    await GET(makeRequest('?contact=all&status=all&kind=all&transport=all'))
    expect(allFilters.eq).not.toHaveBeenCalled()
  })

  it('caps limit at 200 and filters a concrete contact and status', async () => {
    const query = thenableQuery({ data: [{ id: 'msg-1' }], error: null, count: 1 })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest('?contact=42&status=sent&limit=500&offset=10'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      items: [{ id: 'msg-1' }],
      total: 1,
      limit: 200,
      offset: 10,
    })
    expect(query.eq).toHaveBeenCalledWith('contact_submission_id', 42)
    expect(query.eq).toHaveBeenCalledWith('status', 'sent')
    expect(query.range).toHaveBeenCalledWith(10, 209)
  })

  it('does not treat a non-numeric contact value as a filter', async () => {
    const query = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(query)

    await GET(makeRequest('?contact=abc'))

    expect(query.eq).not.toHaveBeenCalledWith('contact_submission_id', expect.anything())
  })
})
