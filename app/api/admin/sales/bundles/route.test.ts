import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
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

import { POST } from './route'

function makePost(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/sales/bundles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/sales/bundles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before creating a bundle', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makePost({ name: 'Starter' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a bundle name', async () => {
    const response = await POST(makePost({ bundle_price: 1000 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Bundle name is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forces custom bundle_type when parent_bundle_id is set and strips pricing-page fields', async () => {
    const created = {
      id: 'bundle-fork-1',
      name: 'Client Custom',
      bundle_type: 'custom',
      parent_bundle_id: 'parent-1',
    }
    const insertSingle = vi.fn().mockResolvedValue({ data: created, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'offer_bundles') return { insert }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      makePost({
        name: 'Client Custom',
        parent_bundle_id: 'parent-1',
        bundle_type: 'standard',
        pricing_tier_slug: 'growth',
        tagline: 'Should not persist on forks',
        bundle_items: [],
        bundle_price: 2500,
      }),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ bundle: created })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Client Custom',
        parent_bundle_id: 'parent-1',
        bundle_type: 'custom',
        created_by: 'admin-1',
        is_active: true,
        bundle_price: 2500,
      }),
    )
    const inserted = insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted).not.toHaveProperty('pricing_tier_slug')
    expect(inserted).not.toHaveProperty('tagline')
  })
})
