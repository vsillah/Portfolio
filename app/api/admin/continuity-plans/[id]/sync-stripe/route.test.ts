import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  syncContinuityPlanToStripe: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/stripe-subscriptions', () => ({
  syncContinuityPlanToStripe: mocks.syncContinuityPlanToStripe,
}))

import { POST } from './route'

type ContinuityPlanRow = {
  id: string
  name: string
  stripe_product_id: string | null
  stripe_price_id: string | null
}

function makeRequest() {
  return new NextRequest(
    'http://localhost/api/admin/continuity-plans/plan-1/sync-stripe',
    { method: 'POST' },
  )
}

function params(id = 'plan-1') {
  return { params: { id } }
}

function planRow(overrides: Partial<ContinuityPlanRow> = {}): ContinuityPlanRow {
  return {
    id: 'plan-1',
    name: 'Monthly Continuity',
    stripe_product_id: null,
    stripe_price_id: null,
    ...overrides,
  }
}

function mockPlanLookup({
  plan,
  updated = null,
  updateError = null,
}: {
  plan: ContinuityPlanRow | null
  updated?: ContinuityPlanRow | null
  updateError?: { message: string } | null
}) {
  const selectSingle = vi.fn().mockResolvedValue({
    data: plan,
    error: plan ? null : { message: 'not found' },
  })
  const selectEq = vi.fn().mockReturnValue({ single: selectSingle })
  const select = vi.fn().mockReturnValue({ eq: selectEq })

  const updateSingle = vi.fn().mockResolvedValue({
    data: updated,
    error: updateError,
  })
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle })
  const updateEq = vi.fn().mockReturnValue({ select: updateSelect })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  mocks.from.mockImplementation((table: string) => {
    if (table !== 'continuity_plans') {
      throw new Error(`Unexpected table: ${table}`)
    }
    return { select, update }
  })

  return { select, update, updateEq }
}

describe('POST /api/admin/continuity-plans/[id]/sync-stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before reading continuity plans', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.syncContinuityPlanToStripe).not.toHaveBeenCalled()
  })

  it('returns 404 when the continuity plan is missing', async () => {
    mockPlanLookup({ plan: null })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Plan not found' })
    expect(mocks.syncContinuityPlanToStripe).not.toHaveBeenCalled()
  })

  it('fails closed when Stripe sync is not configured', async () => {
    const plan = planRow()
    mockPlanLookup({ plan })
    mocks.syncContinuityPlanToStripe.mockResolvedValue(null)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.',
    })
    expect(mocks.syncContinuityPlanToStripe).toHaveBeenCalledWith(plan)
  })

  it('persists Stripe product and price ids after a successful sync', async () => {
    const plan = planRow()
    const updated = planRow({
      stripe_product_id: 'prod_123',
      stripe_price_id: 'price_456',
    })
    const { update, updateEq } = mockPlanLookup({ plan, updated })
    mocks.syncContinuityPlanToStripe.mockResolvedValue({
      stripe_product_id: 'prod_123',
      stripe_price_id: 'price_456',
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      stripe_product_id: 'prod_123',
      stripe_price_id: 'price_456',
      plan: updated,
    })
    expect(update).toHaveBeenCalledWith({
      stripe_product_id: 'prod_123',
      stripe_price_id: 'price_456',
    })
    expect(updateEq).toHaveBeenCalledWith('id', 'plan-1')
  })
})
