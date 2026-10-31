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

function request(search = '') {
  return new NextRequest(`http://localhost/api/admin/value-evidence/reports${search}`)
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.limit.mockImplementation(() => Promise.resolve(result))
  return query
}

describe('GET /api/admin/value-evidence/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('lists reports without type or contact filters and defaults the limit to 50', async () => {
    const query = thenableQuery({ data: [{ id: 'rep-1' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ reports: [{ id: 'rep-1' }] })
    expect(query.eq).not.toHaveBeenCalled()
    expect(query.limit).toHaveBeenCalledWith(50)
  })

  it('applies type and contact filters and caps limit at 100', async () => {
    const query = thenableQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    await GET(request('?type=industry&contact_id=12&limit=500'))

    expect(query.eq).toHaveBeenCalledWith('report_type', 'industry')
    expect(query.eq).toHaveBeenCalledWith('contact_submission_id', 12)
    expect(query.limit).toHaveBeenCalledWith(100)
  })

  it('treats an invalid limit as 50', async () => {
    const query = thenableQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    await GET(request('?limit=abc'))

    expect(query.limit).toHaveBeenCalledWith(50)
  })

  it('exposes the query error message on 500', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'relation missing' } }))

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'relation missing' })
  })
})
