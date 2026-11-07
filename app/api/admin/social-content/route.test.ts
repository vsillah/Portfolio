import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  extractMeetingTitle: vi.fn(),
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

vi.mock('@/lib/social-content', () => ({
  extractMeetingTitle: mocks.extractMeetingTitle,
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
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.or.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  return query
}

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/social-content${query}`)
}

function mockListTables(listResult: QueryResult) {
  const listQuery = thenableQuery(listResult)
  const statsQuery = thenableQuery({ data: [], error: null })
  const lastRunQuery = thenableQuery({ data: null, error: null })
  let queueCalls = 0
  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_queue') {
      queueCalls += 1
      return queueCalls === 1 ? listQuery : statsQuery
    }
    if (table === 'social_content_extraction_runs') return lastRunQuery
    throw new Error(`Unexpected table: ${table}`)
  })
  return { listQuery, statsQuery, lastRunQuery }
}

describe('GET /api/admin/social-content', () => {
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

  it('applies no status or platform filter when those params are all or omitted', async () => {
    // status === 'all' / platform === 'all' or omitted → no restriction
    const omitted = mockListTables({ data: [], error: null, count: 0 })
    const omittedRes = await GET(makeRequest())
    expect(omittedRes.status).toBe(200)
    expect(omitted.listQuery.eq).not.toHaveBeenCalled()
    expect(omitted.listQuery.or).not.toHaveBeenCalled()

    const allFilters = mockListTables({ data: [], error: null, count: 0 })
    await GET(makeRequest('?status=all&platform=all'))
    expect(allFilters.listQuery.eq).not.toHaveBeenCalledWith('status', 'all')
    expect(allFilters.listQuery.eq).not.toHaveBeenCalledWith('platform', 'all')
    expect(allFilters.listQuery.eq).not.toHaveBeenCalled()
  })

  it('filters a concrete status and platform and interpolates search into or()', async () => {
    const { listQuery } = mockListTables({ data: [], error: null, count: 0 })

    const response = await GET(makeRequest('?status=draft&platform=linkedin&search=hello'))

    expect(response.status).toBe(200)
    expect(listQuery.eq).toHaveBeenCalledWith('status', 'draft')
    expect(listQuery.eq).toHaveBeenCalledWith('platform', 'linkedin')
    expect(listQuery.or).toHaveBeenCalledWith('post_text.ilike.%hello%,cta_text.ilike.%hello%')
  })

  it('returns empty-queue stats and a null last extraction run', async () => {
    mockListTables({ data: [], error: null, count: 0 })

    const response = await GET(makeRequest('?page=2&limit=10'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      items: [],
      lastExtractionRun: null,
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      stats: { draft: 0, approved: 0, scheduled: 0, published: 0, rejected: 0, total: 0 },
    })
  })
})
