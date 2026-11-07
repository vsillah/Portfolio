import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

import { POST } from './route'

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/social-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/social-share', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires orderId and platform', async () => {
    const response = await POST(makeRequest({ orderId: 'ord-1' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Order ID and platform are required',
    })
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
  })

  it('requires a signed-in user', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await POST(makeRequest({ orderId: 'ord-1', platform: 'x' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not record a share for another user\'s order', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'ord-1', user_id: 'someone-else' },
            error: null,
          }),
        }),
      }),
    })

    const response = await POST(makeRequest({ orderId: 'ord-1', platform: 'linkedin' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Order not found or unauthorized',
    })
  })

  it('returns alreadyShared without inserting a duplicate', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ord-1', user_id: 'user-1' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'social_shares') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'share-1' }, error: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn(),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await POST(makeRequest({ orderId: 'ord-1', platform: 'linkedin' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      alreadyShared: true,
      discountEarned: 0,
    })
    expect(mocks.from).not.toHaveBeenCalledWith('store_settings')
  })

  it('records a first share using the dollar discount from store settings', async () => {
    const insertSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: 'share-2', discount_earned: 8 },
        error: null,
      }),
    })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'orders') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'ord-1', user_id: 'user-1' },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'social_shares') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
          insert,
        }
      }
      if (table === 'store_settings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { value: { type: 'fixed', value: 8 } },
                error: null,
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    })

    const response = await POST(
      makeRequest({ orderId: 'ord-1', platform: 'linkedin', shareUrl: 'https://x.test/s' }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      share: { id: 'share-2', discount_earned: 8 },
      discountEarned: 8,
    })
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      order_id: 'ord-1',
      platform: 'linkedin',
      share_url: 'https://x.test/s',
      discount_earned: 8,
    })
  })
})
