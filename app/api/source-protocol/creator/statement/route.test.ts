import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  authResult: {
    user: { id: 'user-1' },
    isAdmin: false,
  } as any,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: vi.fn(async () => mocks.authResult),
  isAuthError: (result: any) => 'error' in result,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request() {
  return new NextRequest('https://example.com/api/source-protocol/creator/statement', {
    headers: { authorization: 'Bearer test-token' },
  })
}

function portalQuery(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const limit = vi.fn().mockReturnValue({ maybeSingle })
  const order = vi.fn().mockReturnValue({ limit })
  const secondEq = vi.fn().mockReturnValue({ order })
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq })
  const select = vi.fn().mockReturnValue({ eq: firstEq })
  return { select, firstEq, secondEq, order, limit, maybeSingle }
}

describe('creator source protocol statement route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authResult = {
      user: { id: 'user-1' },
      isAdmin: false,
    }
  })

  it('rejects unauthenticated requests', async () => {
    mocks.authResult = { error: 'Authentication required', status: 401 }

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns an unlinked state when the user has no active creator portal account', async () => {
    const query = portalQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      available: true,
      linked: false,
      reason: 'No active creator portal account is linked to this login yet.',
    })
    expect(mocks.from).toHaveBeenCalledWith('source_creator_portal_accounts')
    expect(query.firstEq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.secondEq).toHaveBeenCalledWith('status', 'active')
  })

  it('returns the missing schema state when portal tables have not been applied', async () => {
    mocks.from.mockReturnValue(portalQuery({
      data: null,
      error: {
        code: '42P01',
        message: 'relation "source_creator_portal_accounts" does not exist',
      },
    }))

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      available: false,
      linked: false,
      migration: 'supabase/migrations/20260504092130_source_protocol_creator_portal.sql',
    })
  })
})
