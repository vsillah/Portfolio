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

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/chat-escalations${query}`)
}

function thenableQuery(result: { data: unknown; error: unknown; count?: number }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    range: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    not: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    is: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.not.mockReturnValue(query)
  query.is.mockReturnValue(query)
  return query
}

describe('GET /api/admin/chat-escalations', () => {
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

  it('applies no source or linked filter when those params are omitted', async () => {
    // omitted source/linked → no restriction on source or contact_submission_id
    const query = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      escalations: [],
      total: 0,
      page: 1,
      limit: 20,
    })
    expect(query.eq).not.toHaveBeenCalled()
    expect(query.not).not.toHaveBeenCalled()
    expect(query.is).not.toHaveBeenCalled()
  })

  it('filters by source and unlinked contact when requested', async () => {
    const query = thenableQuery({ data: [{ id: 1 }], error: null, count: 1 })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest('?source=text&linked=false&contact=abc'))

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('source', 'text')
    expect(query.is).toHaveBeenCalledWith('contact_submission_id', null)
    expect(query.eq).not.toHaveBeenCalledWith('contact_submission_id', expect.anything())
  })

  it('filters by linked contact id when the value is numeric', async () => {
    const query = thenableQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(query)

    await GET(makeRequest('?linked=true&contact=12'))

    expect(query.not).toHaveBeenCalledWith('contact_submission_id', 'is', null)
    expect(query.eq).toHaveBeenCalledWith('contact_submission_id', 12)
  })
})
