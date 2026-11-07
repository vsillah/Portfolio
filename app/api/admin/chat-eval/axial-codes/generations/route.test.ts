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

function thenableQuery(result: { data: unknown; error: unknown; count?: number | null }) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => query
  for (const method of ['select', 'eq', 'order', 'range']) {
    query[method] = vi.fn(chain)
  }
  query.then = vi.fn((onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected))
  return query
}

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/chat-eval/axial-codes/generations${query}`)
}

describe('GET /api/admin/chat-eval/axial-codes/generations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('applies no status filter when status is omitted and paginates the default window', async () => {
    // status omitted → no restriction on status
    const query = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(query)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      generations: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })
    expect(query.eq).not.toHaveBeenCalled()
    expect(query.range).toHaveBeenCalledWith(0, 19)
  })

  it('still filters status=all and uses the database count for total pages', async () => {
    // status=all still eqs the raw value
    const query = thenableQuery({
      data: [{
        id: 'gen-1',
        source_session_ids: ['s1', 's2'],
        source_open_codes: null,
        generated_axial_codes: ['a'],
        model_used: 'claude',
        status: 'all',
        created_at: '2026-09-01T00:00:00.000Z',
        axial_code_reviews: [
          { status: 'pending' },
          { status: 'approved' },
          { status: 'modified' },
          { status: 'rejected' },
        ],
      }],
      error: null,
      count: 21,
    })
    mocks.from.mockReturnValue(query)

    const response = await GET(request('?status=all&page=2&limit=10'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      generations: [{
        id: 'gen-1',
        source_session_count: 2,
        source_open_code_count: 0,
        axial_code_count: 1,
        model_used: 'claude',
        status: 'all',
        created_at: '2026-09-01T00:00:00.000Z',
        review_stats: { total: 4, pending: 1, approved: 2, rejected: 1 },
      }],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    })
    expect(query.eq).toHaveBeenCalledWith('status', 'all')
    expect(query.range).toHaveBeenCalledWith(10, 19)
  })

  it('treats an empty limit as 20 and turns non-numeric page math into null JSON', async () => {
    const emptyLimit = thenableQuery({ data: [], error: null, count: 1 })
    mocks.from.mockReturnValueOnce(emptyLimit)
    const fallback = await GET(request('?limit='))
    expect(fallback.status).toBe(200)
    await expect(fallback.json()).resolves.toMatchObject({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })
    expect(emptyLimit.range).toHaveBeenCalledWith(0, 19)

    const badPage = thenableQuery({ data: [], error: null, count: 5 })
    mocks.from.mockReturnValueOnce(badPage)
    const nan = await GET(request('?page=abc&limit=0'))
    const body = await nan.json()
    expect(body.pagination.page).toBeNull()
    expect(body.pagination.totalPages).toBeNull()
    expect(badPage.range).toHaveBeenCalledWith(Number.NaN, Number.NaN)
  })

  it('returns a generic list error', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'relation missing' }, count: null }))

    const response = await GET(request('?status=pending'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch generations' })
  })
})
