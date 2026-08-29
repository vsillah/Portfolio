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

import { GET, POST } from './route'

function makeGetRequest() {
  return new NextRequest('http://localhost/api/referrals')
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/referrals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires authentication before listing referrals', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns only the current user\'s referrals', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'ref-1', referrer_user_id: 'user-1' }],
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      referrals: [{ id: 'ref-1', referrer_user_id: 'user-1' }],
    })
    expect(eq).toHaveBeenCalledWith('referrer_user_id', 'user-1')
  })
})

describe('POST /api/referrals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
  })

  it('requires a referral code when validating', async () => {
    const response = await POST(makePostRequest({ action: 'validate' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Referral code is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown referral code', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await POST(makePostRequest({ action: 'validate', referralCode: 'NOPE' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid referral code' })
  })

  it('requires authentication before applying a referral', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    const response = await POST(
      makePostRequest({ action: 'apply', referralCode: 'SAVE10', orderId: '12' }),
    )

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks self-referral before attaching a discount', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'ref-1', referrer_user_id: 'user-1' },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    const update = vi.fn()
    mocks.from.mockReturnValue({ select, update })

    const response = await POST(
      makePostRequest({ action: 'apply', referralCode: 'MINE', orderId: '12' }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Cannot use your own referral code' })
    expect(update).not.toHaveBeenCalled()
  })

  it('applies a $10 referrer discount to a valid third-party code', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'ref-1', referrer_user_id: 'other-user' },
      error: null,
    })
    const selectEq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq: selectEq })
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    mocks.from.mockReturnValue({ select, update })

    const response = await POST(
      makePostRequest({ action: 'apply', referralCode: 'FRIEND', orderId: '42' }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, discountAmount: 10 })
    expect(update).toHaveBeenCalledWith({
      order_id: 42,
      discount_applied: 10,
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'ref-1')
  })

  it('rejects unknown actions', async () => {
    const response = await POST(makePostRequest({ action: 'explode' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid action' })
  })
})
