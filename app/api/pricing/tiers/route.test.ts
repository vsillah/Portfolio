import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  expandBundleItems: vi.fn(),
  resolveBundleItemsToTierItems: vi.fn(),
  getUpsellPathsForTier: vi.fn(),
  applyDynamicPricing: vi.fn(),
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

vi.mock('@/lib/upsell-paths', () => ({
  getUpsellPathsForTier: mocks.getUpsellPathsForTier,
}))

vi.mock('@/lib/dynamic-pricing', () => ({
  applyDynamicPricing: mocks.applyDynamicPricing,
}))

import { GET } from './route'

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/pricing/tiers${query}`)
}

function thenableQuery(result: { data: unknown; error: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    neq: ReturnType<typeof vi.fn>
    contains: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    neq: vi.fn(),
    contains: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.neq.mockReturnValue(query)
  query.contains.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  return query
}

describe('GET /api/pricing/tiers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.expandBundleItems.mockResolvedValue([])
    mocks.resolveBundleItemsToTierItems.mockResolvedValue([])
    mocks.getUpsellPathsForTier.mockResolvedValue([])
    mocks.applyDynamicPricing.mockImplementation((tiers: unknown[], _benchmarks, segment) => ({
      tiers,
      context: { segment },
    }))
  })

  it('requires a known pricing segment', async () => {
    const missing = await GET(makeRequest())
    const invalid = await GET(makeRequest('?segment=enterprise'))

    expect(missing.status).toBe(400)
    expect(invalid.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({
      error: 'Invalid or missing segment. Use smb, midmarket, or nonprofit.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('loads only active non-custom bundles for the requested segment', async () => {
    const benchmarks = thenableQuery({ data: [], error: null })
    const bundles = thenableQuery({ data: [], error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'industry_benchmarks') return benchmarks
      if (table === 'offer_bundles') return bundles
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('?segment=smb'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      tiers: [],
      decoyComparisons: null,
      calculationContext: { segment: 'smb' },
    })
    expect(bundles.contains).toHaveBeenCalledWith('pricing_page_segments', ['smb'])
    expect(bundles.neq).toHaveBeenCalledWith('bundle_type', 'custom')
    expect(bundles.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('pairs nonprofit decoys with same-set premiums and attaches the first upsell path', async () => {
    const benchmarks = thenableQuery({ data: [], error: null })
    const bundles = thenableQuery({
      data: [
        {
          id: 'bundle-ci',
          name: 'CI Starter',
          description: null,
          bundle_items: [],
          total_retail_value: 4000,
          total_perceived_value: 4000,
          bundle_price: 0,
          pricing_tier_slug: 'ci-starter',
          tagline: null,
          target_audience_display: null,
          pricing_display_order: 1,
          is_featured: false,
          is_decoy: true,
          mirrors_tier_id: 'quick-win',
          has_guarantee: false,
          guarantee_name: null,
          guarantee_description: null,
          cta_text: null,
          cta_href: null,
        },
        {
          id: 'bundle-qw',
          name: 'Quick Win',
          description: null,
          bundle_items: [],
          total_retail_value: 9000,
          total_perceived_value: 9000,
          bundle_price: 2500,
          pricing_tier_slug: 'quick-win',
          tagline: null,
          target_audience_display: null,
          pricing_display_order: 2,
          is_featured: true,
          is_decoy: false,
          mirrors_tier_id: null,
          has_guarantee: true,
          guarantee_name: '30-day guarantee',
          guarantee_description: 'Money back if unused',
          cta_text: 'Book',
          cta_href: '/contact',
        },
      ],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'industry_benchmarks') return benchmarks
      if (table === 'offer_bundles') return bundles
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.getUpsellPathsForTier.mockResolvedValue([
      {
        next_problem: 'Need a live workshop',
        value_frame_text: 'Keep the audit, add coaching',
        risk_reversal_text: 'Credit applies',
        credit_previous_investment: true,
        credit_note: 'Workshop credited',
        incremental_cost: 2500,
        incremental_value: 5000,
      },
    ])

    const response = await GET(makeRequest('?segment=nonprofit'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.calculationContext).toEqual({ segment: 'nonprofit' })
    expect(body.decoyComparisons).toHaveLength(1)
    expect(body.decoyComparisons[0].decoyTier.id).toBe('ci-starter')
    expect(body.decoyComparisons[0].premiumTier.id).toBe('quick-win')
    expect(body.decoyComparisons[0].keyDifferences[0]).toEqual({
      feature: 'Workshop',
      decoyValue: 'Recorded (self-paced)',
      premiumValue: 'Live half-day session',
    })
    expect(body.decoyComparisons[0].upsellContext).toEqual({
      nextProblem: 'Need a live workshop',
      valueFrame: 'Keep the audit, add coaching',
      riskReversal: 'Credit applies',
      creditNote: 'Workshop credited',
      incrementalCost: 2500,
      incrementalValue: 5000,
    })
    expect(mocks.getUpsellPathsForTier).toHaveBeenCalledWith('ci-starter')
    expect(body.tiers[1].guarantee).toEqual({
      name: '30-day guarantee',
      type: 'conditional',
      durationDays: 30,
      description: 'Money back if unused',
      payoutType: 'refund',
    })
  })

  it('omits decoys that do not name a mirrored premium', async () => {
    const benchmarks = thenableQuery({ data: [], error: null })
    const bundles = thenableQuery({
      data: [
        {
          id: 'bundle-ci',
          name: 'CI Starter',
          description: null,
          bundle_items: [],
          total_retail_value: 4000,
          total_perceived_value: 4000,
          bundle_price: 0,
          pricing_tier_slug: 'ci-starter',
          tagline: null,
          target_audience_display: null,
          pricing_display_order: 1,
          is_featured: false,
          is_decoy: true,
          mirrors_tier_id: null,
          has_guarantee: false,
          guarantee_name: null,
          guarantee_description: null,
          cta_text: null,
          cta_href: null,
        },
      ],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'industry_benchmarks') return benchmarks
      if (table === 'offer_bundles') return bundles
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('?segment=nonprofit'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.decoyComparisons).toEqual([])
    expect(mocks.getUpsellPathsForTier).not.toHaveBeenCalled()
  })

  it('loads SMB premiums when the nonprofit tab is decoy-only', async () => {
    const benchmarks = thenableQuery({ data: [], error: null })
    const nonprofitBundles = thenableQuery({
      data: [
        {
          id: 'bundle-ci',
          name: 'CI Starter',
          description: null,
          bundle_items: [],
          total_retail_value: 4000,
          total_perceived_value: 4000,
          bundle_price: 0,
          pricing_tier_slug: 'ci-starter',
          tagline: null,
          target_audience_display: null,
          pricing_display_order: 1,
          is_featured: false,
          is_decoy: true,
          mirrors_tier_id: 'quick-win',
          has_guarantee: false,
          guarantee_name: null,
          guarantee_description: null,
          cta_text: null,
          cta_href: null,
        },
      ],
      error: null,
    })
    const smbBundles = thenableQuery({
      data: [
        {
          id: 'bundle-qw',
          name: 'Quick Win',
          description: null,
          bundle_items: [],
          total_retail_value: 9000,
          total_perceived_value: 9000,
          bundle_price: 2500,
          pricing_tier_slug: 'quick-win',
          tagline: null,
          target_audience_display: null,
          pricing_display_order: 1,
          is_featured: true,
          is_decoy: false,
          mirrors_tier_id: null,
          has_guarantee: false,
          guarantee_name: null,
          guarantee_description: null,
          cta_text: null,
          cta_href: null,
        },
      ],
      error: null,
    })
    let offerCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'industry_benchmarks') return benchmarks
      if (table === 'offer_bundles') {
        offerCalls += 1
        return offerCalls === 1 ? nonprofitBundles : smbBundles
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('?segment=nonprofit'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(offerCalls).toBe(2)
    expect(smbBundles.contains).toHaveBeenCalledWith('pricing_page_segments', ['smb'])
    expect(body.decoyComparisons).toHaveLength(1)
    expect(body.decoyComparisons[0].premiumTier.id).toBe('quick-win')
    expect(body.decoyComparisons[0].premiumTier.isDecoy).toBe(false)
  })
})

