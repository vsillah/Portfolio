import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), calculateShipping: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }))
vi.mock('@/lib/printful', () => ({ printful: { calculateShipping: mocks.calculateShipping } }))
import { checkoutAcceleratedMemberCart } from './accelerated-member-checkout'

const recommendationId = '11111111-1111-4111-8111-111111111111'
const checkoutKey = '22222222-2222-4222-8222-222222222222'
const serviceId = '33333333-3333-4333-8333-333333333333'
const cartItems = [{ itemType: 'service' as const, serviceId, quantity: 1, recommendationId,
  reviewedAt: '2026-11-05T12:00:00.000Z', reviewedPrice: 1 }]
const input = { userId: 'member-1', cartItems, checkoutKey, discountCode: null, shippingAddress: null }

describe('reviewed member checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rpc.mockResolvedValue({ data: [{ order_id: 91, replay: false }], error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'orders') throw new Error(`Unexpected table ${table}`)
      return { select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({
        data: { id: 91, user_id: 'member-1', status: 'pending', final_amount: 79 }, error: null,
      }) }) }) }) }
    })
  })

  it('passes only the member, cart and server shipping result to the atomic checkout function', async () => {
    const result = await checkoutAcceleratedMemberCart(input)
    expect(result).toMatchObject({ ok: true, order: { id: 91, final_amount: 79 } })
    expect(mocks.rpc).toHaveBeenCalledWith('accelerated_checkout_member_cart', {
      p_user_id: 'member-1', p_checkout_key: checkoutKey, p_items: cartItems,
      p_shipping_address: null, p_shipping_cost: 0,
    })
    expect(mocks.calculateShipping).not.toHaveBeenCalled()
  })

  it('rejects a client discount before any order write', async () => {
    const result = await checkoutAcceleratedMemberCart({ ...input, discountCode: 'SAVE10' })
    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('surfaces a stale approval conflict without creating another order', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'Recommendation changed' } })
    const result = await checkoutAcceleratedMemberCart(input)
    expect(result).toEqual({ ok: false, status: 409, error: 'Recommendation changed' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns the same owned order on an idempotent replay', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ order_id: 91, replay: true }], error: null })
    const result = await checkoutAcceleratedMemberCart(input)
    expect(result).toMatchObject({ ok: true, replay: true, order: { id: 91 } })
  })
})
