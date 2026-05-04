import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  authResult: {
    user: { id: '00000000-0000-4000-8000-000000000001' },
    isAdmin: true,
  } as any,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: vi.fn(async () => mocks.authResult),
  isAuthError: (result: any) => 'error' in result,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { PATCH, POST } from './route'

const creatorId = '10000000-0000-4000-8000-000000000001'
const userId = '20000000-0000-4000-8000-000000000001'
const accountId = '30000000-0000-4000-8000-000000000001'

function request(method: 'POST' | 'PATCH', body: unknown) {
  return new NextRequest('https://example.com/api/admin/source-protocol/portal-accounts', {
    method,
    headers: {
      authorization: 'Bearer admin-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function lookupQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
}

describe('admin source protocol portal account route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authResult = {
      user: { id: '00000000-0000-4000-8000-000000000001' },
      isAdmin: true,
    }
  })

  it('rejects non-admin requests', async () => {
    mocks.authResult = { error: 'Admin access required', status: 403 }

    const response = await POST(request('POST', { creatorId, userId }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Admin access required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates or updates a creator portal link', async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: accountId,
            creator_id: creatorId,
            user_id: userId,
            status: 'active',
          },
          error: null,
        }),
      }),
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'source_creator_portal_accounts') return { upsert }
      return lookupQuery({ id: table === 'source_creators' ? creatorId : userId })
    })

    const response = await POST(request('POST', {
      creatorId,
      userId,
      status: 'active',
      canViewEarnings: true,
      canViewReceipts: false,
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, account: { id: accountId, status: 'active' } })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: creatorId,
        user_id: userId,
        status: 'active',
        can_view_earnings: true,
        can_view_receipts: false,
      }),
      { onConflict: 'creator_id,user_id' }
    )
  })

  it('updates portal link status and visibility', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: accountId,
              status: 'suspended',
              can_view_earnings: false,
            },
            error: null,
          }),
        }),
      }),
    })
    mocks.from.mockReturnValue({ update })

    const response = await PATCH(request('PATCH', {
      accountId,
      status: 'suspended',
      canViewEarnings: false,
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, account: { id: accountId, status: 'suspended' } })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'suspended',
      can_view_earnings: false,
    }))
  })

  it('validates UUID inputs', async () => {
    const response = await POST(request('POST', {
      creatorId: 'bad',
      userId,
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'creatorId and userId must be valid UUIDs' })
  })
})
