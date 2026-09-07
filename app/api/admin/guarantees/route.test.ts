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

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/guarantees${query}`)
}

function thenable<T extends Record<string, unknown>>(
  value: T,
  extra: Record<string, unknown> = {},
) {
  return {
    ...extra,
    then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(value).then(onFulfilled, onRejected)
    },
  }
}

describe('GET /api/admin/guarantees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before querying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not restrict status when the filter is omitted', async () => {
    // omitted status → no restriction on guarantee_instances.status
    const statusEq = vi.fn()
    const result = { data: [{ id: 'g-1', status: 'expired' }], error: null, count: 1 }
    const range = vi.fn().mockReturnValue(
      thenable(result, { eq: statusEq, ilike: vi.fn() }),
    )
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ range }),
      }),
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(range).toHaveBeenCalledWith(0, 49)
    expect(statusEq).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({ data: result.data, total: 1 })
  })

  it('still applies eq(status, all) when the filter is the string all', async () => {
    // current behavior: any truthy status, including "all", is sent to .eq()
    const statusEq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    })
    const range = vi.fn().mockReturnValue(
      thenable({ data: [], error: null, count: 0 }, { eq: statusEq, ilike: vi.fn() }),
    )
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ range }),
      }),
    })

    const response = await GET(request('?status=all'))

    expect(response.status).toBe(200)
    expect(statusEq).toHaveBeenCalledWith('status', 'all')
  })

  it('filters by a concrete status and client email', async () => {
    const result = { data: [{ id: 'g-2', status: 'active' }], error: null, count: 1 }
    const ilike = vi.fn().mockResolvedValue(result)
    const statusEq = vi.fn().mockReturnValue(thenable(result, { ilike }))
    const range = vi.fn().mockReturnValue(thenable(result, { eq: statusEq, ilike }))
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ range }),
      }),
    })

    const response = await GET(request('?status=active&email=Ada&limit=10&offset=10'))

    expect(response.status).toBe(200)
    expect(range).toHaveBeenCalledWith(10, 19)
    expect(statusEq).toHaveBeenCalledWith('status', 'active')
    expect(ilike).toHaveBeenCalledWith('client_email', '%Ada%')
    expect(await response.json()).toEqual({ data: result.data, total: 1 })
  })

  it('returns an empty list when the instances table is missing', async () => {
    const result = { data: null, error: { code: '42P01', message: 'missing' }, count: null }
    const range = vi.fn().mockReturnValue(thenable(result, { eq: vi.fn(), ilike: vi.fn() }))
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ range }),
      }),
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [], total: 0 })
  })

  it('passes through error.message on unexpected failures', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('connection reset')
    })

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'connection reset' })
  })
})
