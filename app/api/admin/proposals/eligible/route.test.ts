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

function request() {
  return new NextRequest('http://localhost/api/admin/proposals/eligible')
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.in.mockReturnValue(query)
  return query
}

describe('GET /api/admin/proposals/eligible', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
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

  it('returns an empty list when there are no paid proposals', async () => {
    const proposalsQuery = thenableQuery({ data: [], error: null })
    mocks.from.mockReturnValue(proposalsQuery)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ proposals: [] })
    expect(proposalsQuery.eq).toHaveBeenCalledWith('status', 'paid')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('excludes paid proposals that already have a client project', async () => {
    const paid = [
      { id: 'prop-open', client_name: 'Open Co' },
      { id: 'prop-linked', client_name: 'Linked Co' },
    ]
    const proposalsQuery = thenableQuery({ data: paid, error: null })
    const projectsQuery = thenableQuery({ data: [{ proposal_id: 'prop-linked' }], error: null })
    mocks.from
      .mockReturnValueOnce(proposalsQuery)
      .mockReturnValueOnce(projectsQuery)

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      proposals: [{ id: 'prop-open', client_name: 'Open Co' }],
    })
    expect(mocks.from).toHaveBeenNthCalledWith(1, 'proposals')
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'client_projects')
    expect(projectsQuery.in).toHaveBeenCalledWith('proposal_id', ['prop-open', 'prop-linked'])
  })

  it('returns a generic 500 when the paid-proposal query fails', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'db down' } }))

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch proposals' })
  })
})
