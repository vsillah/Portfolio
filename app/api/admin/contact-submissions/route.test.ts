import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/contact-submissions${query}`)
}

function chain(result: { data?: unknown; error?: unknown } = {}) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = vi.fn(self)
  query.is = vi.fn(self)
  query.eq = vi.fn(self)
  query.or = vi.fn(self)
  query.order = vi.fn(self)
  query.limit = vi.fn(self)
  query.then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({ data: result.data ?? [], error: result.error ?? null }).then(
      onFulfilled,
      onRejected,
    )
  return query as typeof query & {
    is: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    or: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
  }
}

describe('GET /api/admin/contact-submissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('always excludes removed and do-not-contact leads and caps the limit', async () => {
    const query = chain({ data: [{ id: 1, name: 'Ada', email: 'ada@example.com' }] })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'contact_submissions') throw new Error(`Unexpected table: ${table}`)
      return query
    })

    const response = await GET(request('?limit=900'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      submissions: [{ id: 1, name: 'Ada', email: 'ada@example.com' }],
    })
    expect(query.is).toHaveBeenCalledWith('removed_at', null)
    expect(query.eq).toHaveBeenCalledWith('do_not_contact', false)
    expect(query.limit).toHaveBeenCalledWith(500)
    expect(query.or).not.toHaveBeenCalled()
  })

  it('applies a name or email search only when search text is present', async () => {
    const query = chain({ data: [] })
    mocks.from.mockImplementation(() => query)

    await GET(request('?search=ada'))

    expect(query.or).toHaveBeenCalledWith('name.ilike.%ada%,email.ilike.%ada%')
  })

  it('returns a generic 500 when the list query fails', async () => {
    mocks.from.mockImplementation(() => chain({ error: { message: 'relation missing' } }))

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch leads' })
  })
})
