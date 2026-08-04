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

import { DELETE, GET, PUT } from './route'

function makeRequest(method: 'GET' | 'PUT' | 'DELETE', body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/sales/bundles/bundle-1', {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function params(id = 'bundle-1') {
  return { params: { id } }
}

describe('/api/admin/sales/bundles/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('GET', () => {
    it('rejects unauthenticated requests before reading bundles', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeRequest('GET'), params())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 404 when the bundle is missing', async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } })
      const eq = vi.fn().mockReturnValue({ single })
      const select = vi.fn().mockReturnValue({ eq })
      mocks.from.mockReturnValue({ select })

      const response = await GET(makeRequest('GET'), params())

      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toEqual({ error: 'Bundle not found' })
      expect(mocks.from).toHaveBeenCalledWith('offer_bundles')
    })

    it('returns the bundle with item count, parent/base names, and fork count', async () => {
      const bundle = {
        id: 'bundle-1',
        name: 'Custom Pack',
        parent_bundle_id: 'parent-1',
        base_bundle_id: 'base-1',
        bundle_items: [{ content_type: 'service', content_id: 'svc-1' }],
      }

      let offerSelectCalls = 0
      mocks.from.mockImplementation((table: string) => {
        if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
        offerSelectCalls += 1
        if (offerSelectCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: bundle, error: null }),
              }),
            }),
          }
        }
        if (offerSelectCalls === 2) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { name: 'Parent Bundle' }, error: null }),
              }),
            }),
          }
        }
        if (offerSelectCalls === 3) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { name: 'Base Bundle' }, error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
          }),
        }
      })

      const response = await GET(makeRequest('GET'), params())
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.bundle).toEqual(
        expect.objectContaining({
          id: 'bundle-1',
          item_count: 1,
          parent_name: 'Parent Bundle',
          base_bundle_name: 'Base Bundle',
          fork_count: 2,
        }),
      )
    })
  })

  describe('PUT', () => {
    it('rejects unauthenticated requests before updating', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await PUT(
        makeRequest('PUT', { name: 'Updated', pricing_page_segments: ['smb'] }),
        params(),
      )

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('strips pricing_page_segments when updating a custom bundle', async () => {
      const updatePayload = vi.fn()
      let selectCalls = 0

      mocks.from.mockImplementation((table: string) => {
        if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
        selectCalls += 1
        if (selectCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { bundle_type: 'custom' },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {
          update: vi.fn((data: Record<string, unknown>) => {
            updatePayload(data)
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'bundle-1', name: 'Renamed Custom', bundle_type: 'custom' },
                    error: null,
                  }),
                }),
              }),
            }
          }),
        }
      })

      const response = await PUT(
        makeRequest('PUT', {
          name: 'Renamed Custom',
          pricing_page_segments: ['smb', 'enterprise'],
          tagline: 'Keep me',
        }),
        params(),
      )

      expect(response.status).toBe(200)
      expect(updatePayload).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Renamed Custom',
          tagline: 'Keep me',
        }),
      )
      expect(updatePayload.mock.calls[0][0]).not.toHaveProperty('pricing_page_segments')
    })

    it('allows pricing_page_segments updates for non-custom bundles', async () => {
      const updatePayload = vi.fn()
      let selectCalls = 0

      mocks.from.mockImplementation((table: string) => {
        if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
        selectCalls += 1
        if (selectCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { bundle_type: 'standard' },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {
          update: vi.fn((data: Record<string, unknown>) => {
            updatePayload(data)
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'bundle-1', pricing_page_segments: ['smb'] },
                    error: null,
                  }),
                }),
              }),
            }
          }),
        }
      })

      const response = await PUT(
        makeRequest('PUT', { pricing_page_segments: ['smb'] }),
        params(),
      )

      expect(response.status).toBe(200)
      expect(updatePayload).toHaveBeenCalledWith(
        expect.objectContaining({ pricing_page_segments: ['smb'] }),
      )
    })

    it('recalculates totals from overrides when bundle_items are provided', async () => {
      const updatePayload = vi.fn()
      let offerCalls = 0

      mocks.from.mockImplementation((table: string) => {
        if (table === 'offer_bundles') {
          offerCalls += 1
          if (offerCalls === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { bundle_type: 'standard' },
                    error: null,
                  }),
                }),
              }),
            }
          }
          return {
            update: vi.fn((data: Record<string, unknown>) => {
              updatePayload(data)
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: 'bundle-1', ...data },
                      error: null,
                    }),
                  }),
                }),
              }
            }),
          }
        }
        if (table === 'content_offer_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      })

      const response = await PUT(
        makeRequest('PUT', {
          bundle_items: [
            {
              content_type: 'service',
              content_id: 'svc-1',
              override_price: 1000,
              override_perceived_value: 1500,
            },
            {
              content_type: 'product',
              content_id: 'prod-1',
              override_price: 250,
            },
          ],
        }),
        params(),
      )

      expect(response.status).toBe(200)
      expect(updatePayload).toHaveBeenCalledWith(
        expect.objectContaining({
          total_retail_value: 1250,
          total_perceived_value: 1750,
        }),
      )
    })
  })

  describe('DELETE', () => {
    it('rejects unauthenticated requests before soft-deleting', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await DELETE(makeRequest('DELETE'), params())

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('soft-deletes the bundle and notes when forks still reference it', async () => {
      const update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      let selectCalls = 0

      mocks.from.mockImplementation((table: string) => {
        if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
        selectCalls += 1
        if (selectCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
            }),
          }
        }
        return { update }
      })

      const response = await DELETE(makeRequest('DELETE'), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        success: true,
        message: 'Bundle deactivated. Note: 3 derived bundles still reference this bundle.',
      })
      expect(update).toHaveBeenCalledWith({ is_active: false })
    })

    it('soft-deletes without a fork warning when there are no children', async () => {
      const update = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })
      let selectCalls = 0

      mocks.from.mockImplementation((table: string) => {
        if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
        selectCalls += 1
        if (selectCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }
        }
        return { update }
      })

      const response = await DELETE(makeRequest('DELETE'), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        success: true,
        message: 'Bundle deactivated successfully.',
      })
    })
  })
})
