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
  supabaseAdmin: { from: mocks.from },
}))

import { DELETE, GET, POST, PUT } from './route'

const CAMPAIGN_ID = 'campaign-1'

function params(id = CAMPAIGN_ID) {
  return { params: { id } }
}

function makeRequest(
  method: string,
  body?: Record<string, unknown>,
  url = `http://localhost/api/admin/campaigns/${CAMPAIGN_ID}/criteria`,
) {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function listChain(data: unknown, error: unknown = null) {
  const order = vi.fn().mockResolvedValue({ data, error })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, order }
}

function maxOrderChain(displayOrder: number | null) {
  const single = vi.fn().mockResolvedValue({
    data: displayOrder === null ? null : { display_order: displayOrder },
    error: null,
  })
  const limit = vi.fn().mockReturnValue({ single })
  const order = vi.fn().mockReturnValue({ limit })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, order, limit, single }
}

function insertChain(row: Record<string, unknown>, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  return { insert, select, single }
}

function updateChain(row: Record<string, unknown> | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  const select = vi.fn().mockReturnValue({ single })
  const eqCampaign = vi.fn().mockReturnValue({ select })
  const eqId = vi.fn().mockReturnValue({ eq: eqCampaign })
  const update = vi.fn().mockReturnValue({ eq: eqId })
  return { update, eqId, eqCampaign, select, single }
}

function deleteChain(error: unknown = null) {
  const eqCampaign = vi.fn().mockResolvedValue({ error })
  const eqId = vi.fn().mockReturnValue({ eq: eqCampaign })
  const del = vi.fn().mockReturnValue({ eq: eqId })
  return { delete: del, eqId, eqCampaign }
}

describe('/api/admin/campaigns/[id]/criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('GET', () => {
    it('rejects unauthenticated requests before listing criteria', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeRequest('GET'), params())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('lists criteria templates for the campaign ordered by display_order', async () => {
      const rows = [{ id: 'c-1', display_order: 0 }]
      const chain = listChain(rows)
      mocks.from.mockReturnValue(chain)

      const response = await GET(makeRequest('GET'), params())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ data: rows })
      expect(mocks.from).toHaveBeenCalledWith('campaign_criteria_templates')
      expect(chain.eq).toHaveBeenCalledWith('campaign_id', CAMPAIGN_ID)
      expect(chain.order).toHaveBeenCalledWith('display_order', { ascending: true })
    })
  })

  describe('POST', () => {
    it('rejects unauthenticated creates before writing', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await POST(
        makeRequest('POST', { label_template: 'Watch the intro video' }),
        params(),
      )

      expect(response.status).toBe(403)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('requires a non-empty label template', async () => {
      const response = await POST(makeRequest('POST', { label_template: '   ' }), params())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'Label template is required' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('rejects invalid tracking sources before insert', async () => {
      const response = await POST(
        makeRequest('POST', {
          label_template: 'Complete diagnostic',
          tracking_source: 'spreadsheet',
        }),
        params(),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'Invalid tracking source' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('rejects invalid criteria types before insert', async () => {
      const response = await POST(
        makeRequest('POST', {
          label_template: 'Complete diagnostic',
          criteria_type: 'bonus',
        }),
        params(),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'Invalid criteria type' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('auto-assigns the next display_order and defaults required tracking fields', async () => {
      const maxOrder = maxOrderChain(2)
      const inserted = {
        id: 'crit-new',
        campaign_id: CAMPAIGN_ID,
        label_template: 'Watch the intro video',
        display_order: 3,
      }
      const insert = insertChain(inserted)
      mocks.from.mockReturnValue({
        select: maxOrder.select,
        insert: insert.insert,
      })

      const response = await POST(
        makeRequest('POST', {
          label_template: '  Watch the intro video  ',
          tracking_source: 'video_watch',
        }),
        params(),
      )

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual({ data: inserted })
      expect(insert.insert).toHaveBeenCalledWith({
        campaign_id: CAMPAIGN_ID,
        label_template: 'Watch the intro video',
        description_template: null,
        criteria_type: 'action',
        tracking_source: 'video_watch',
        tracking_config: {},
        threshold_source: null,
        threshold_default: null,
        required: true,
        display_order: 3,
      })
    })
  })

  describe('PUT', () => {
    it('requires criterion_id before updating', async () => {
      const response = await PUT(
        makeRequest('PUT', { label_template: 'Updated' }),
        params(),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'criterion_id is required' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('updates only allow-listed fields scoped to the campaign', async () => {
      const updated = { id: 'crit-1', label_template: 'Updated label' }
      const chain = updateChain(updated)
      mocks.from.mockReturnValue(chain)

      const response = await PUT(
        makeRequest('PUT', {
          criterion_id: 'crit-1',
          label_template: 'Updated label',
          campaign_id: 'other-campaign',
          secret_field: 'nope',
        }),
        params(),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ data: updated })
      expect(chain.update).toHaveBeenCalledWith({ label_template: 'Updated label' })
      expect(chain.eqId).toHaveBeenCalledWith('id', 'crit-1')
      expect(chain.eqCampaign).toHaveBeenCalledWith('campaign_id', CAMPAIGN_ID)
    })
  })

  describe('DELETE', () => {
    it('requires criterion_id query param before deleting', async () => {
      const response = await DELETE(makeRequest('DELETE'), params())

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'criterion_id query param is required',
      })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('deletes the criterion scoped to the campaign id', async () => {
      const chain = deleteChain()
      mocks.from.mockReturnValue(chain)

      const response = await DELETE(
        makeRequest(
          'DELETE',
          undefined,
          `http://localhost/api/admin/campaigns/${CAMPAIGN_ID}/criteria?criterion_id=crit-9`,
        ),
        params(),
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ success: true })
      expect(chain.eqId).toHaveBeenCalledWith('id', 'crit-9')
      expect(chain.eqCampaign).toHaveBeenCalledWith('campaign_id', CAMPAIGN_ID)
    })
  })
})
