import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  authResult: {
    user: { id: 'user-1' },
    isAdmin: false,
  } as { user?: { id: string }; isAdmin?: boolean; error?: string; status?: number },
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: vi.fn(async () => mocks.authResult),
  isAuthError: (result: { error?: string }) => 'error' in result,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/campaigns/my-enrollments', {
    headers: { authorization: 'Bearer user-token' },
  })
}

function enrollmentsQuery(result: { data: unknown; error: { code?: string; message: string } | null }) {
  const resolved = Promise.resolve(result)
  const chain: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: typeof resolved.then
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (onFulfilled, onRejected) => resolved.then(onFulfilled, onRejected),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  return chain
}

describe('GET /api/campaigns/my-enrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authResult = { user: { id: 'user-1' }, isAdmin: false }
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before querying enrollments', async () => {
    mocks.authResult = { error: 'Authentication required', status: 401 }

    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('scopes the enrollment query to the authenticated user', async () => {
    const rows = [{ id: 'enroll-1', user_id: 'user-1' }]
    const chain = enrollmentsQuery({ data: rows, error: null })
    mocks.from.mockReturnValue(chain)

    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: rows })
    expect(mocks.from).toHaveBeenCalledWith('campaign_enrollments')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.eq).not.toHaveBeenCalledWith('user_id', 'someone-else')
  })

  it('returns an empty list when campaign tables have not been applied', async () => {
    mocks.from.mockReturnValue(
      enrollmentsQuery({ data: null, error: { code: '42P01', message: 'missing' } }),
    )

    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [] })
  })
})
