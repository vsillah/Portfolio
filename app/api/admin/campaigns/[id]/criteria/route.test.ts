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

import { DELETE, GET, POST, PUT } from './route'

function makeGetRequest(id = 'camp-1') {
  return new NextRequest(`http://localhost/api/admin/campaigns/${id}/criteria`)
}

function makePostRequest(body: Record<string, unknown>, id = 'camp-1') {
  return new NextRequest(`http://localhost/api/admin/campaigns/${id}/criteria`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makePutRequest(body: Record<string, unknown>, id = 'camp-1') {
  return new NextRequest(`http://localhost/api/admin/campaigns/${id}/criteria`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(query = '', id = 'camp-1') {
  return new NextRequest(
    `http://localhost/api/admin/campaigns/${id}/criteria${query}`,
    { method: 'DELETE' },
  )
}

function params(id = 'camp-1') {
  return { params: { id } }
}

describe('GET /api/admin/campaigns/[id]/criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated reads before listing criteria templates', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists criteria templates ordered by display_order for the campaign', async () => {
    const rows = [{ id: 'crit-1', display_order: 0 }]
    const order = vi.fn().mockResolvedValue({ data: rows, error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: rows })
    expect(eq).toHaveBeenCalledWith('campaign_id', 'camp-1')
    expect(order).toHaveBeenCalledWith('display_order', { ascending: true })
  })
})

describe('POST /api/admin/campaigns/[id]/criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires a non-empty label template', async () => {
    const response = await POST(makePostRequest({ label_template: '   ' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Label template is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid tracking sources before insert', async () => {
    const response = await POST(
      makePostRequest({
        label_template: 'Complete onboarding',
        tracking_source: 'spreadsheet',
      }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid tracking source',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid criteria types before insert', async () => {
    const response = await POST(
      makePostRequest({
        label_template: 'Complete onboarding',
        criteria_type: 'bonus',
      }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid criteria type',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('auto-assigns the next display_order and trims the label', async () => {
    const maxSingle = vi.fn().mockResolvedValue({
      data: { display_order: 2 },
      error: null,
    })
    const maxLimit = vi.fn().mockReturnValue({ single: maxSingle })
    const maxOrder = vi.fn().mockReturnValue({ limit: maxLimit })
    const maxEq = vi.fn().mockReturnValue({ order: maxOrder })
    const maxSelect = vi.fn().mockReturnValue({ eq: maxEq })

    const created = {
      id: 'crit-new',
      label_template: 'Complete onboarding',
      display_order: 3,
    }
    const insertSingle = vi.fn().mockResolvedValue({ data: created, error: null })
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })

    mocks.from.mockImplementation((table: string) => {
      if (table !== 'campaign_criteria_templates') {
        throw new Error(`Unexpected table: ${table}`)
      }
      return { select: maxSelect, insert }
    })

    const response = await POST(
      makePostRequest({
        label_template: '  Complete onboarding  ',
        description_template: '  Finish kickoff  ',
        tracking_source: 'onboarding_milestone',
        criteria_type: 'action',
      }),
      params(),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ data: created })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign_id: 'camp-1',
        label_template: 'Complete onboarding',
        description_template: 'Finish kickoff',
        tracking_source: 'onboarding_milestone',
        criteria_type: 'action',
        required: true,
        display_order: 3,
      }),
    )
  })
})

describe('PUT /api/admin/campaigns/[id]/criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires criterion_id', async () => {
    const response = await PUT(makePutRequest({ label_template: 'Updated' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'criterion_id is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates only allowlisted fields scoped to the campaign', async () => {
    const updated = { id: 'crit-1', label_template: 'Updated label' }
    const single = vi.fn().mockResolvedValue({ data: updated, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eqCampaign = vi.fn().mockReturnValue({ select })
    const eqId = vi.fn().mockReturnValue({ eq: eqCampaign })
    const update = vi.fn().mockReturnValue({ eq: eqId })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(
      makePutRequest({
        criterion_id: 'crit-1',
        label_template: 'Updated label',
        campaign_id: 'other-camp',
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: updated })
    expect(update).toHaveBeenCalledWith({ label_template: 'Updated label' })
    expect(eqId).toHaveBeenCalledWith('id', 'crit-1')
    expect(eqCampaign).toHaveBeenCalledWith('campaign_id', 'camp-1')
  })
})

describe('DELETE /api/admin/campaigns/[id]/criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires criterion_id as a query param', async () => {
    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'criterion_id query param is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes the criterion scoped to the campaign', async () => {
    const eqCampaign = vi.fn().mockResolvedValue({ error: null })
    const eqId = vi.fn().mockReturnValue({ eq: eqCampaign })
    const del = vi.fn().mockReturnValue({ eq: eqId })
    mocks.from.mockReturnValue({ delete: del })

    const response = await DELETE(
      makeDeleteRequest('?criterion_id=crit-1'),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(eqId).toHaveBeenCalledWith('id', 'crit-1')
    expect(eqCampaign).toHaveBeenCalledWith('campaign_id', 'camp-1')
  })
})
