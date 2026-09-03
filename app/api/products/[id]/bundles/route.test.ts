import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  expandBundleItems: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/bundle-expand', () => ({
  expandBundleItems: mocks.expandBundleItems,
}))

import { GET } from './route'

function params(id: string) {
  return { params: { id } }
}

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/products/${id}/bundles`)
}

function bundleQuery(result: { data: unknown; error: unknown }) {
  const neq = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ neq })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, neq }
}

describe('GET /api/products/[id]/bundles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.expandBundleItems.mockResolvedValue([])
  })

  it('returns 400 when the product id is missing', async () => {
    const response = await GET(makeRequest(''), params(''))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Product ID is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('matches product ids by string equality and uses the bundle id as slug fallback', async () => {
    mocks.from.mockReturnValue(bundleQuery({
      data: [
        { id: 'bundle-9', name: 'Starter', pricing_tier_slug: null, pricing_page_segments: ['nonprofit'] },
      ],
      error: null,
    }))
    mocks.expandBundleItems.mockResolvedValue([
      { content_type: 'product', content_id: 44 },
    ])

    const response = await GET(makeRequest('44'), params('44'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.bundles).toEqual([
      {
        bundleId: 'bundle-9',
        name: 'Starter',
        slug: 'bundle-9',
        segment: 'nonprofit',
        pricingUrl: '/pricing?segment=nonprofit#bundle-9',
      },
    ])
  })

  it('omits bundles that do not contain the product', async () => {
    mocks.from.mockReturnValue(bundleQuery({
      data: [{ id: 'bundle-1', name: 'Other', pricing_tier_slug: 'other', pricing_page_segments: ['smb'] }],
      error: null,
    }))
    mocks.expandBundleItems.mockResolvedValue([
      { content_type: 'service', content_id: '44' },
    ])

    const response = await GET(makeRequest('44'), params('44'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ bundles: [] })
  })
})
