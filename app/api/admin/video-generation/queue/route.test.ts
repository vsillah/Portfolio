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

type QueryResult = { data?: unknown; error?: unknown }

function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {}
  const self = () => query
  for (const method of ['select', 'eq', 'order']) {
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
  }
}

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/video-generation/queue${query}`)
}

describe('GET /api/admin/video-generation/queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before listing the queue', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults to status=pending', async () => {
    const query = makeQuery({ data: [{ id: 'q-1' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ items: [{ id: 'q-1' }] })
    expect(query.eq).toHaveBeenCalledWith('status', 'pending')
    expect(query.order).toHaveBeenCalledWith('detected_at', { ascending: false })
  })

  it('does not special-case status=all and eqs the raw value', async () => {
    const query = makeQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(request('?status=all'))

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('status', 'all')
  })

  it('returns a generic 500 when the list query fails', async () => {
    mocks.from.mockReturnValue(makeQuery({ data: null, error: { message: 'relation missing' } }))

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to list queue' })
  })
})
