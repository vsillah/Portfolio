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

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/sales/bundles/save-as', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function resolvedItem(overrides: Record<string, unknown> = {}) {
  return {
    content_type: 'service',
    content_id: 'svc-1',
    display_order: 0,
    is_optional: false,
    has_overrides: false,
    title: 'AI Audit',
    role_retail_price: 2000,
    perceived_value: 3500,
    price: 2000,
    ...overrides,
  }
}

describe('POST /api/admin/sales/bundles/save-as', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated requests before validating the payload', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ name: 'Forked', items: [resolvedItem()] }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a bundle name', async () => {
    const response = await POST(makeRequest({ items: [resolvedItem()] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Bundle name is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires at least one item', async () => {
    const response = await POST(makeRequest({ name: 'Empty Fork', items: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'At least one item is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unknown parent_bundle_id before insert', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })

    const response = await POST(
      makeRequest({
        name: 'Derived Pack',
        items: [resolvedItem()],
        parent_bundle_id: 'missing-parent',
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Parent bundle not found' })
    expect(mocks.from).toHaveBeenCalledWith('offer_bundles')
  })

  it('inserts a custom bundle with totals and creator, never pricing-page type', async () => {
    const insertPayload = vi.fn()
    let calls = 0

    mocks.from.mockImplementation((table: string) => {
      if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
      calls += 1
      if (calls === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'parent-1', name: 'Parent' },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        insert: vi.fn((data: Record<string, unknown>) => {
          insertPayload(data)
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'new-bundle', ...data },
                error: null,
              }),
            }),
          }
        }),
      }
    })

    const response = await POST(
      makeRequest({
        name: 'Session Save',
        description: 'From sales session',
        items: [
          resolvedItem({ role_retail_price: 2000, perceived_value: 3500 }),
          resolvedItem({
            content_type: 'product',
            content_id: 'prod-1',
            display_order: 1,
            role_retail_price: 500,
            perceived_value: 700,
            price: 500,
          }),
        ],
        parent_bundle_id: 'parent-1',
        notes: 'Keep pricing off the public page',
      }),
    )

    expect(response.status).toBe(201)
    const payload = await response.json()
    expect(payload.message).toContain('derived from parent bundle')
    expect(payload.bundle).toEqual(
      expect.objectContaining({
        id: 'new-bundle',
        name: 'Session Save',
        bundle_type: 'custom',
      }),
    )
    expect(insertPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Session Save',
        description: 'From sales session',
        parent_bundle_id: 'parent-1',
        bundle_type: 'custom',
        created_by: 'admin-user-1',
        is_active: true,
        total_retail_value: 2500,
        total_perceived_value: 4200,
        bundle_price: 2500,
        notes: 'Keep pricing off the public page',
      }),
    )
    expect(insertPayload.mock.calls[0][0]).not.toHaveProperty('pricing_page_segments')
  })
})
