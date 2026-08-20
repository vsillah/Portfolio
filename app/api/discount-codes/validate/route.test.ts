import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }
const FIXED_NOW = new Date('2026-08-20T12:00:00.000Z')

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/discount-codes/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validCode(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dc-1',
    code: 'SAVE10',
    is_active: true,
    valid_until: null,
    valid_from: null,
    max_uses: null,
    used_count: 0,
    applicable_user_ids: null,
    applicable_product_ids: null,
    ...overrides,
  }
}

function discountLookup(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eqActive = vi.fn().mockReturnValue({ single })
  const eqCode = vi.fn().mockReturnValue({ eq: eqActive })
  const select = vi.fn().mockReturnValue({ eq: eqCode })
  return { select, eqCode, eqActive, single }
}

function userUsageLookup(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eqCodeId = vi.fn().mockReturnValue({ single })
  const eqUser = vi.fn().mockReturnValue({ eq: eqCodeId })
  const select = vi.fn().mockReturnValue({ eq: eqUser })
  return { select, eqUser, eqCodeId, single }
}

describe('POST /api/discount-codes/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
    mocks.getCurrentUser.mockResolvedValue(null)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    restoreEnv()
  })

  it('returns 400 when the code is missing', async () => {
    const response = await POST(makeRequest({ productIds: [1] }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Discount code is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('uppercases the submitted code and returns 404 when it is inactive or missing', async () => {
    const lookup = discountLookup({ data: null, error: { message: 'not found' } })
    mocks.from.mockReturnValue(lookup)

    const response = await POST(makeRequest({ code: 'save10' }))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Invalid or expired discount code' })
    expect(mocks.from).toHaveBeenCalledWith('discount_codes')
    expect(lookup.eqCode).toHaveBeenCalledWith('code', 'SAVE10')
    expect(lookup.eqActive).toHaveBeenCalledWith('is_active', true)
  })

  it('returns 400 when the code is expired or not yet valid', async () => {
    const expired = discountLookup({
      data: validCode({ valid_until: '2026-08-01T00:00:00.000Z' }),
      error: null,
    })
    mocks.from.mockReturnValue(expired)

    const expiredRes = await POST(makeRequest({ code: 'SAVE10' }))
    expect(expiredRes.status).toBe(400)
    expect(await expiredRes.json()).toEqual({ error: 'Discount code has expired' })

    const future = discountLookup({
      data: validCode({ valid_from: '2026-09-01T00:00:00.000Z' }),
      error: null,
    })
    mocks.from.mockReturnValue(future)

    const futureRes = await POST(makeRequest({ code: 'SAVE10' }))
    expect(futureRes.status).toBe(400)
    expect(await futureRes.json()).toEqual({ error: 'Discount code is not yet valid' })
  })

  it('returns 400 when the usage limit is exhausted', async () => {
    mocks.from.mockReturnValue(
      discountLookup({
        data: validCode({ max_uses: 3, used_count: 3 }),
        error: null,
      }),
    )

    const response = await POST(makeRequest({ code: 'SAVE10' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Discount code has reached its usage limit',
    })
  })

  it('returns 400 when the signed-in user has already used the code', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    const codes = discountLookup({ data: validCode(), error: null })
    const usage = userUsageLookup({ data: { id: 'usage-1' }, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'discount_codes') return codes
      if (table === 'user_discount_codes') return usage
      return {}
    })

    const response = await POST(makeRequest({ code: 'SAVE10' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'You have already used this discount code',
    })
    expect(usage.eqUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(usage.eqCodeId).toHaveBeenCalledWith('discount_code_id', 'dc-1')
  })

  it('requires login and matching account for user-restricted codes', async () => {
    const restricted = validCode({ applicable_user_ids: ['user-allowed'] })
    mocks.from.mockReturnValue(discountLookup({ data: restricted, error: null }))

    const anon = await POST(makeRequest({ code: 'SAVE10' }))
    expect(anon.status).toBe(401)
    expect(await anon.json()).toEqual({
      error: 'This discount code requires you to be logged in',
    })

    mocks.getCurrentUser.mockResolvedValue({ id: 'user-other' })
    const forbidden = await POST(makeRequest({ code: 'SAVE10' }))
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toEqual({
      error: 'This discount code is not valid for your account',
    })
  })

  it('returns 400 when none of the cart products are eligible', async () => {
    mocks.from.mockReturnValue(
      discountLookup({
        data: validCode({ applicable_product_ids: [10, 20] }),
        error: null,
      }),
    )

    const response = await POST(makeRequest({ code: 'SAVE10', productIds: [99] }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Discount code does not apply to items in your cart',
    })
  })

  it('returns the discount when date, usage, user, and product checks pass', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-allowed' })
    const code = validCode({
      applicable_user_ids: ['user-allowed'],
      applicable_product_ids: [10, 20],
      max_uses: 5,
      used_count: 1,
      valid_from: '2026-08-01T00:00:00.000Z',
      valid_until: '2026-09-01T00:00:00.000Z',
    })
    const codes = discountLookup({ data: code, error: null })
    const usage = userUsageLookup({ data: null, error: { code: 'PGRST116' } })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'discount_codes') return codes
      if (table === 'user_discount_codes') return usage
      return {}
    })

    const response = await POST(makeRequest({ code: 'save10', productIds: [20] }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, discountCode: code })
  })
})
