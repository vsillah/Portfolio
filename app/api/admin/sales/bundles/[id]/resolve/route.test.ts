import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  expandBundleItems: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/bundle-expand', () => ({
  expandBundleItems: mocks.expandBundleItems,
}))

import { GET } from './route'

function makeRequest(id = 'bundle-1') {
  return new NextRequest(`http://localhost/api/admin/sales/bundles/${id}/resolve`)
}

function params(id = 'bundle-1') {
  return { params: { id } }
}

function mockBundle(row: Record<string, unknown> | null, error: { message?: string } | null = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'offer_bundles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single }),
        }),
      }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  return { single }
}

describe('GET /api/admin/sales/bundles/[id]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.expandBundleItems.mockResolvedValue([])
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the bundle is missing', async () => {
    mockBundle(null, { message: 'not found' })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Bundle not found' })
    expect(mocks.expandBundleItems).not.toHaveBeenCalled()
  })

  it('returns empty-item totals and uses blended_cost_override when present', async () => {
    mockBundle({
      id: 'bundle-1',
      name: 'Starter',
      description: 'Core stack',
      parent_bundle_id: null,
      bundle_price: 900,
      blended_cost_override: 120,
      default_discount_percent: 10,
    })

    const response = await GET(makeRequest(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.expandBundleItems).toHaveBeenCalledWith('bundle-1')
    expect(body.bundle).toEqual({
      id: 'bundle-1',
      name: 'Starter',
      description: 'Core stack',
      parent_bundle_id: null,
      bundle_price: 900,
      blended_cost_override: 120,
      default_discount_percent: 10,
    })
    expect(body.items).toEqual([])
    expect(body.totals).toEqual({
      itemCount: 0,
      totalRetailValue: 0,
      totalPerceivedValue: 0,
      totalCost: 0,
      effectiveTotalCost: 120,
      blendedMarginPercent: null,
      overriddenCount: 0,
    })
  })

  it('skips missing content rows and computes retail, cost, and override totals', async () => {
    mockBundle({
      id: 'bundle-1',
      name: 'Starter',
      description: null,
      parent_bundle_id: null,
      bundle_price: 500,
      blended_cost_override: null,
      default_discount_percent: null,
    })
    mocks.expandBundleItems.mockResolvedValue([
      { content_type: 'product', content_id: 'prod-1', display_order: 2, override_price: 80 },
      { content_type: 'product', content_id: 'missing', display_order: 1 },
    ])

    const productIn = vi.fn().mockResolvedValue({
      data: [{
        id: 'prod-1',
        title: 'Curriculum',
        description: 'Training pack',
        type: 'training',
        price: 49,
        image_url: 'https://cdn.example/curriculum.png',
        is_active: true,
        display_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
      }],
      error: null,
    })
    const roleIn = vi.fn().mockResolvedValue({
      data: [{
        content_id: 'prod-1',
        id: 'role-1',
        offer_role: 'core_offer',
        retail_price: 100,
        perceived_value: 140,
        unit_cost: 25,
      }],
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'offer_bundles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'bundle-1',
                  name: 'Starter',
                  description: null,
                  parent_bundle_id: null,
                  bundle_price: 500,
                  blended_cost_override: null,
                  default_discount_percent: null,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'products') {
        return { select: vi.fn().mockReturnValue({ in: productIn }) }
      }
      if (table === 'content_offer_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ in: roleIn }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest(), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toEqual(expect.objectContaining({
      content_id: 'prod-1',
      title: 'Curriculum',
      has_overrides: true,
      role_retail_price: 80,
      perceived_value: 140,
      unit_cost: 25,
    }))
    expect(body.totals).toEqual({
      itemCount: 1,
      totalRetailValue: 80,
      totalPerceivedValue: 140,
      totalCost: 25,
      effectiveTotalCost: 25,
      blendedMarginPercent: 69,
      overriddenCount: 1,
    })
  })
})
