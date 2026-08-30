import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/referrals/code')
}

describe('GET /api/referrals/code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires an authenticated user', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns an existing referral code without inserting', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'abcdefgh-user' })
    const insert = vi.fn()
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: () =>
              Promise.resolve({
                data: { referral_code: 'REFEXISTING' },
                error: null,
              }),
          }),
        }),
      }),
      insert,
    })

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      referralCode: 'REFEXISTING',
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('creates a deterministic-prefix referral code when the user has none', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'abcdefgh-user' })
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789)
    const insert = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          limit: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: { message: 'not found' },
              }),
          }),
        }),
      }),
      insert,
    })

    const suffix = (0.123456789).toString(36).substring(2, 6).toUpperCase()
    const expected = `REFABCDEFGH${suffix}`

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ referralCode: expected })
    expect(insert).toHaveBeenCalledWith({
      referrer_user_id: 'abcdefgh-user',
      referral_code: expected,
    })
  })
})
