import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  expandBundleItems: vi.fn(),
  from: vi.fn(),
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

vi.mock('@/lib/bundle-expand', () => ({
  expandBundleItems: mocks.expandBundleItems,
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/sales/bundles/bundle-1/resolve', {
    method: 'GET',
  })
}

function params(id = 'bundle-1') {
  return { params: { id } }
}

describe('GET /api/admin/sales/bundles/[id]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before reading bundles', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.expandBundleItems).not.toHaveBeenCalled()
  })

  it('returns 404 when the bundle is missing', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Bundle not found' })
    expect(mocks.from).toHaveBeenCalledWith('offer_bundles')
    expect(mocks.expandBundleItems).not.toHaveBeenCalled()
  })

  it('resolves items with overrides, skips missing content, and uses blended cost override', async () => {
    const bundle = {
      id: 'bundle-1',
      name: 'Growth Pack',
      description: 'Resolved offer',
      parent_bundle_id: null,
      bundle_price: 3900,
      blended_cost_override: 900,
      default_discount_percent: 10,
    }

    mocks.expandBundleItems.mockResolvedValue([
      {
        content_type: 'service',
        content_id: 'svc-1',
        display_order: 1,
        override_title: 'Custom Advisory',
        override_price: 4000,
      },
      {
        content_type: 'product',
        content_id: '999',
        display_order: 0,
      },
      {
        content_type: 'service',
        content_id: 'svc-missing',
        display_order: 2,
      },
    ])

    mocks.from.mockImplementation((table: string) => {
      if (table === 'offer_bundles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: bundle, error: null }),
            }),
          }),
        }
      }

      if (table === 'services') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'svc-1',
                  title: 'Advisory Sprint',
                  description: 'Canonical',
                  service_type: 'consulting',
                  price: 5000,
                  image_url: 'https://cdn.example/svc.png',
                  is_active: true,
                  display_order: 0,
                  created_at: '2026-01-01T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }
      }

      if (table === 'products') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: '999',
                  title: 'Workbook',
                  description: 'Printable',
                  type: 'digital',
                  price: 49,
                  image_url: null,
                  is_active: true,
                  display_order: 0,
                  created_at: '2026-01-02T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }
      }

      if (table === 'content_offer_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((_column: string, ids: string[]) => {
                if (ids.includes('svc-1')) {
                  return Promise.resolve({
                    data: [
                      {
                        id: 'role-svc-1',
                        content_type: 'service',
                        content_id: 'svc-1',
                        offer_role: 'core_offer',
                        retail_price: 5000,
                        offer_price: 4500,
                        perceived_value: 8000,
                        unit_cost: 1200,
                        dream_outcome_description: 'Ship faster',
                        likelihood_multiplier: 1,
                        time_reduction: 2,
                        effort_reduction: 1,
                        bonus_name: null,
                        bonus_description: null,
                        qualifying_actions: null,
                        payout_type: null,
                      },
                    ],
                    error: null,
                  })
                }
                return Promise.resolve({
                  data: [
                    {
                      id: 'role-product-999',
                      content_type: 'product',
                      content_id: '999',
                      offer_role: 'bonus',
                      retail_price: 49,
                      offer_price: 49,
                      perceived_value: 120,
                      unit_cost: 5,
                      dream_outcome_description: null,
                      likelihood_multiplier: null,
                      time_reduction: null,
                      effort_reduction: null,
                      bonus_name: 'Workbook bonus',
                      bonus_description: null,
                      qualifying_actions: null,
                      payout_type: null,
                    },
                  ],
                  error: null,
                })
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest(), params())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.expandBundleItems).toHaveBeenCalledWith('bundle-1')
    expect(payload.bundle).toEqual({
      id: 'bundle-1',
      name: 'Growth Pack',
      description: 'Resolved offer',
      parent_bundle_id: null,
      bundle_price: 3900,
      blended_cost_override: 900,
      default_discount_percent: 10,
    })
    expect(payload.items).toHaveLength(2)
    expect(payload.items[0]).toMatchObject({
      content_type: 'product',
      content_id: '999',
      title: 'Workbook',
      offer_role: 'bonus',
      display_order: 0,
      has_overrides: false,
    })
    expect(payload.items[1]).toMatchObject({
      content_type: 'service',
      content_id: 'svc-1',
      title: 'Custom Advisory',
      role_retail_price: 4000,
      has_overrides: true,
      display_order: 1,
    })
    expect(payload.totals).toEqual({
      itemCount: 2,
      totalRetailValue: 4049,
      totalPerceivedValue: 8120,
      totalCost: 1205,
      effectiveTotalCost: 900,
      blendedMarginPercent: 78,
      overriddenCount: 1,
    })
  })

  it('returns a generic 500 when resolution throws unexpectedly', async () => {
    mocks.from.mockImplementation(() => {
      throw new Error('db down')
    })

    const response = await GET(makeRequest(), params())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Internal server error' })
  })
})
