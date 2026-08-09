import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  expandBundleItems: vi.fn(),
  resolveBundleItemsToTierItems: vi.fn(),
  applyDynamicPricing: vi.fn(),
  getUpsellPathsForTier: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('@/lib/bundle-expand', () => ({
  expandBundleItems: mocks.expandBundleItems,
}))

vi.mock('@/lib/bundle-resolve', () => ({
  resolveBundleItemsToTierItems: mocks.resolveBundleItemsToTierItems,
}))

vi.mock('@/lib/dynamic-pricing', () => ({
  applyDynamicPricing: mocks.applyDynamicPricing,
}))

vi.mock('@/lib/upsell-paths', () => ({
  getUpsellPathsForTier: mocks.getUpsellPathsForTier,
}))

import { GET } from './route'

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/pricing/tiers${query}`)
}

describe('GET /api/pricing/tiers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.expandBundleItems.mockResolvedValue([])
    mocks.resolveBundleItemsToTierItems.mockResolvedValue([])
    mocks.applyDynamicPricing.mockImplementation((tiers: unknown[]) => ({
      tiers,
      context: { segment: 'smb' },
    }))
  })

  it('rejects missing or invalid segment values before querying bundles', async () => {
    const missing = await GET(makeRequest())
    const invalid = await GET(makeRequest('?segment=enterprise'))

    expect(missing.status).toBe(400)
    expect(invalid.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({
      error: 'Invalid or missing segment. Use smb, midmarket, or nonprofit.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns only active non-custom bundles for the requested segment', async () => {
    const contains = vi.fn().mockReturnValue({
      neq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'bundle-1',
                name: 'CI Starter',
                description: null,
                bundle_items: [],
                total_retail_value: 5000,
                total_perceived_value: 5000,
                bundle_price: 2500,
                pricing_tier_slug: 'ci-starter',
                tagline: 'Start here',
                target_audience_display: 'SMBs',
                pricing_display_order: 1,
                is_featured: true,
                is_decoy: false,
                mirrors_tier_id: null,
                has_guarantee: true,
                guarantee_name: '30-day guarantee',
                guarantee_description: 'Money back if unused',
                cta_text: null,
                cta_href: null,
              },
            ],
            error: null,
          }),
        }),
      }),
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'industry_benchmarks') {
        return {
          select: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      if (table === 'offer_bundles') {
        return {
          select: vi.fn().mockReturnValue({
            contains,
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    mocks.expandBundleItems.mockResolvedValue([{ content_id: 'item-1' }])
    mocks.resolveBundleItemsToTierItems.mockResolvedValue([
      {
        title: 'Workshop',
        perceivedValue: 5000,
        offerRole: 'core_offer',
        description: '',
        isDeployed: false,
      },
    ])

    const response = await GET(makeRequest('?segment=smb'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(contains).toHaveBeenCalledWith('pricing_page_segments', ['smb'])
    expect(mocks.expandBundleItems).toHaveBeenCalledWith('bundle-1')
    expect(body.tiers).toHaveLength(1)
    expect(body.tiers[0]).toMatchObject({
      id: 'ci-starter',
      bundleId: 'bundle-1',
      price: 2500,
      totalRetailValue: 5000,
      savingsPercent: 50,
      featured: true,
      ctaText: 'Get Started',
      guarantee: {
        name: '30-day guarantee',
        payoutType: 'refund',
      },
    })
    expect(body.decoyComparisons).toBeNull()
  })

  it('returns a generic 500 when the bundles query fails', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'industry_benchmarks') {
        return {
          select: vi.fn().mockReturnValue({
            neq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }
      }
      if (table === 'offer_bundles') {
        return {
          select: vi.fn().mockReturnValue({
            contains: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'db down' },
                  }),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('?segment=midmarket'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch pricing tiers',
    })
  })
})
