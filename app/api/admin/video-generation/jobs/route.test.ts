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
    is: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    eq: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/video-generation/jobs${query}`)
}

describe('GET /api/admin/video-generation/jobs', () => {
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
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists live jobs only and applies no status or channel filter when omitted', async () => {
    const query = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ jobs: [], total: 0, limit: 50, offset: 0 })
    expect(mocks.from).toHaveBeenCalledWith('video_generation_jobs')
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
    expect(query.eq).not.toHaveBeenCalled()
    expect(query.range).toHaveBeenCalledWith(0, 49)
  })

  it('caps limit at 100 and treats invalid limit/offset as the defaults', async () => {
    const capped = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(capped)
    await GET(makeRequest('?limit=500&offset=10'))
    expect(capped.range).toHaveBeenCalledWith(10, 109)

    const invalid = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(invalid)
    const response = await GET(makeRequest('?limit=abc&offset=nope'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ jobs: [], total: 0, limit: 50, offset: 0 })
    expect(invalid.range).toHaveBeenCalledWith(0, 49)
  })

  it('filters by concrete heygen status and channel', async () => {
    const query = thenableQuery({ data: [{ id: 'job-1' }], error: null, count: 1 })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest('?status=failed&channel=youtube'))

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('heygen_status', 'failed')
    expect(query.eq).toHaveBeenCalledWith('channel', 'youtube')
  })
})
