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

import { DELETE, GET, POST } from './route'

function params(id = 'camp-1') {
  return { params: { id } }
}

function makeGet() {
  return new NextRequest('http://localhost/api/admin/campaigns/camp-1/eligible-bundles')
}

function makePost(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/campaigns/camp-1/eligible-bundles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDelete(query = '') {
  return new NextRequest(
    `http://localhost/api/admin/campaigns/camp-1/eligible-bundles${query}`,
    { method: 'DELETE' },
  )
}

describe('admin campaign eligible-bundles routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('GET /api/admin/campaigns/[id]/eligible-bundles', () => {
    it('rejects unauthenticated requests before listing eligible bundles', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeGet(), params())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns eligible bundles for the campaign', async () => {
      const rows = [
        {
          id: 'ceb-1',
          campaign_id: 'camp-1',
          bundle_id: 'bundle-1',
          offer_bundles: { id: 'bundle-1', name: 'Starter' },
        },
      ]
      const eq = vi.fn().mockResolvedValue({ data: rows, error: null })
      const select = vi.fn().mockReturnValue({ eq })
      mocks.from.mockReturnValue({ select })

      const response = await GET(makeGet(), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ data: rows })
      expect(mocks.from).toHaveBeenCalledWith('campaign_eligible_bundles')
      expect(eq).toHaveBeenCalledWith('campaign_id', 'camp-1')
    })
  })

  describe('POST /api/admin/campaigns/[id]/eligible-bundles', () => {
    it('rejects unauthenticated requests before inserting', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await POST(makePost({ bundle_id: 'bundle-1' }), params())

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('requires bundle_id', async () => {
      const response = await POST(makePost({ override_min_amount: 100 }), params())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'bundle_id is required' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 409 when the bundle is already eligible', async () => {
      const single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      })
      const select = vi.fn().mockReturnValue({ single })
      const insert = vi.fn().mockReturnValue({ select })
      mocks.from.mockReturnValue({ insert })

      const response = await POST(makePost({ bundle_id: 'bundle-1' }), params())

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toEqual({
        error: 'This bundle is already eligible for this campaign',
      })
      expect(insert).toHaveBeenCalledWith({
        campaign_id: 'camp-1',
        bundle_id: 'bundle-1',
        override_min_amount: null,
      })
    })

    it('inserts an eligible bundle with optional override_min_amount', async () => {
      const created = {
        id: 'ceb-2',
        campaign_id: 'camp-1',
        bundle_id: 'bundle-2',
        override_min_amount: 250,
      }
      const single = vi.fn().mockResolvedValue({ data: created, error: null })
      const select = vi.fn().mockReturnValue({ single })
      const insert = vi.fn().mockReturnValue({ select })
      mocks.from.mockReturnValue({ insert })

      const response = await POST(
        makePost({ bundle_id: 'bundle-2', override_min_amount: 250 }),
        params(),
      )

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual({ data: created })
      expect(insert).toHaveBeenCalledWith({
        campaign_id: 'camp-1',
        bundle_id: 'bundle-2',
        override_min_amount: 250,
      })
    })
  })

  describe('DELETE /api/admin/campaigns/[id]/eligible-bundles', () => {
    it('rejects unauthenticated requests before deleting', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await DELETE(makeDelete('?bundle_id=bundle-1'), params())

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('requires bundle_id query param', async () => {
      const response = await DELETE(makeDelete(), params())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'bundle_id query param is required',
      })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('deletes the eligible bundle scoped to the campaign', async () => {
      const eqBundle = vi.fn().mockResolvedValue({ error: null })
      const eqCampaign = vi.fn().mockReturnValue({ eq: eqBundle })
      const del = vi.fn().mockReturnValue({ eq: eqCampaign })
      mocks.from.mockReturnValue({ delete: del })

      const response = await DELETE(makeDelete('?bundle_id=bundle-1'), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ success: true })
      expect(mocks.from).toHaveBeenCalledWith('campaign_eligible_bundles')
      expect(eqCampaign).toHaveBeenCalledWith('campaign_id', 'camp-1')
      expect(eqBundle).toHaveBeenCalledWith('bundle_id', 'bundle-1')
    })
  })
})
