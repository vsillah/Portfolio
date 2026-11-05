import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ verifyAuth: vi.fn(), isAuthError: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: mocks.verifyAuth, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc } }))
import { POST } from './route'

const id = '11111111-1111-4111-8111-111111111111'
const offerId = '22222222-2222-4222-8222-222222222222'
const reviewedAt = '2026-11-05T12:00:00.000Z'
const request = (body: unknown) => new NextRequest(`http://localhost/api/accelerated/member/recommendations/${id}/select`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const params = { params: { id } }

describe('POST member recommendation selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'member-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires authentication before an offer is selected', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Sign in', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const response = await POST(request({ reviewedAt }), params)
    expect(response.status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('binds the authenticated member and reviewed revision to the server selection', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ offer_kind: 'product', offer_id: '42', unit_price: 25, quote_based: false }], error: null })
    const response = await POST(request({ reviewedAt, variantId: 9 }), params)
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_select_member_recommendation', {
      p_user_id: 'member-1', p_recommendation_id: id, p_reviewed_at: reviewedAt, p_variant_id: 9,
    })
    expect(await response.json()).toMatchObject({ recommendationId: id, offerId: '42', price: 25, variantId: 9 })
  })

  it('returns a quote handoff without a price when the reviewed service is quote based', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ offer_kind: 'service', offer_id: offerId, unit_price: null, quote_based: true }], error: null })
    const response = await POST(request({ reviewedAt }), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ quoteBased: true, offerId, price: null })
  })

  it('fails closed when approval or catalog revision has changed', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Approved product changed' } })
    const response = await POST(request({ reviewedAt }), params)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Approved product changed' })
  })
})
