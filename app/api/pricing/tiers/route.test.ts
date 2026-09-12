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
    mocks.applyDynamicPricing.mockImplementation((tiers: unknown[]) => ({
      tiers,
      context: { segment: 'smb' },
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
})
