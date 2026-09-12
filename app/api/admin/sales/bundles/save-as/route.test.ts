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

function jsonRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/sales/bundles/save-as', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const resolvedItem = {
  content_type: 'service',
  content_id: 'svc-1',
  display_order: 0,
  is_optional: false,
  has_overrides: true,
  offer_role: 'core_offer',
  role_retail_price: 200,
  perceived_value: 450,
  price: 50,
  original_role: 'bonus',
  original_price: 100,
  original_perceived_value: 150,
}

function mockBundleQueries({
  parent = { data: { id: 'parent-1', name: 'Parent' }, error: null },
  created = { data: { id: 'bundle-new', name: 'Fork' }, error: null },
}: {
  parent?: { data: unknown; error: unknown }
  created?: { data: unknown; error: unknown }
} = {}) {
  const parentSingle = vi.fn().mockResolvedValue(parent)
  const parentEq = vi.fn().mockReturnValue({ single: parentSingle })
  const parentSelect = vi.fn().mockReturnValue({ eq: parentEq })
  const insertSingle = vi.fn().mockResolvedValue(created)
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
  const insert = vi.fn().mockReturnValue({ select: insertSelect })
  mocks.from.mockReturnValue({ select: parentSelect, insert })
  return { parentEq, insert, parentSingle }
}

describe('POST /api/admin/sales/bundles/save-as', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(jsonRequest({ name: 'Fork', items: [resolvedItem] }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a bundle name', async () => {
    const response = await POST(jsonRequest({ items: [resolvedItem] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Bundle name is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires at least one item', async () => {
    const response = await POST(jsonRequest({ name: 'Fork', items: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'At least one item is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing parent bundle before insert', async () => {
    mockBundleQueries({ parent: { data: null, error: { message: 'not found' } } })

    const response = await POST(jsonRequest({
      name: 'Fork',
      items: [resolvedItem],
      parent_bundle_id: 'missing-parent',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Parent bundle not found' })
  })

  it('saves a custom fork with computed totals and no pricing-page fields', async () => {
    const { insert } = mockBundleQueries({
      created: { data: { id: 'bundle-new', name: 'Fork', bundle_type: 'custom' }, error: null },
    })

    const response = await POST(jsonRequest({
      name: 'Fork',
      description: 'Session copy',
      items: [resolvedItem],
      parent_bundle_id: 'parent-1',
      default_discount_percent: 10,
      notes: 'from session',
    }))

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.message).toContain('derived from parent bundle')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Fork',
      bundle_type: 'custom',
      created_by: 'admin-1',
      is_active: true,
      parent_bundle_id: 'parent-1',
      total_retail_value: 200,
      total_perceived_value: 450,
      bundle_price: 200,
      default_discount_percent: 10,
    }))
    const inserted = insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted).not.toHaveProperty('pricing_page_segments')
    expect(inserted).not.toHaveProperty('pricing_tier_slug')
    expect(inserted.bundle_items).toEqual([
      expect.objectContaining({
        content_type: 'service',
        content_id: 'svc-1',
        override_price: 200,
        override_perceived_value: 450,
        override_role: 'core_offer',
      }),
    ])
  })
})
