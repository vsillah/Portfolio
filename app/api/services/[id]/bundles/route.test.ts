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
  return new NextRequest(`http://localhost/api/services/${id}/bundles`)
}

function bundleQuery(result: { data: unknown; error: unknown }) {
  const neq = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ neq })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, neq }
}

describe('GET /api/services/[id]/bundles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.expandBundleItems.mockResolvedValue([])
  })

  it('returns 400 when the service id is missing', async () => {
    const response = await GET(makeRequest(''), params(''))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Service ID is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns a generic 500 when active bundles cannot be loaded', async () => {
    mocks.from.mockReturnValue(bundleQuery({ data: null, error: { message: 'db down' } }))

    const response = await GET(makeRequest('svc-1'), params('svc-1'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch bundles' })
    expect(mocks.expandBundleItems).not.toHaveBeenCalled()
  })

  it('includes matching services, defaults the segment to smb, and skips unrelated bundles', async () => {
    mocks.from.mockReturnValue(bundleQuery({
      data: [
        { id: 'bundle-1', name: 'Accelerator', pricing_tier_slug: 'accelerator', pricing_page_segments: ['smb', 'enterprise'] },
        { id: 'bundle-2', name: 'No slug', pricing_tier_slug: null, pricing_page_segments: null },
      ],
      error: null,
    }))
    mocks.expandBundleItems.mockImplementation(async (bundleId: string) => {
      if (bundleId === 'bundle-1') {
        return [{ content_type: 'service', content_id: 'svc-1' }]
      }
      return [{ content_type: 'product', content_id: 'svc-1' }]
    })

    const response = await GET(makeRequest('svc-1'), params('svc-1'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.bundles).toEqual([
      {
        name: 'Accelerator',
        slug: 'accelerator',
        segment: 'smb',
        pricingUrl: '/pricing?segment=smb#accelerator',
      },
      {
        name: 'Accelerator',
        slug: 'accelerator',
        segment: 'enterprise',
        pricingUrl: '/pricing?segment=enterprise#accelerator',
      },
    ])
    expect(mocks.from).toHaveBeenCalledWith('offer_bundles')
  })
})
