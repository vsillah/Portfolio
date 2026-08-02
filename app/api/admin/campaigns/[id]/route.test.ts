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

function makeGetRequest(id = 'camp-1') {
  return new NextRequest(`http://localhost/api/admin/campaigns/${id}`)
}

function makePutRequest(body: Record<string, unknown>, id = 'camp-1') {
  return new NextRequest(`http://localhost/api/admin/campaigns/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(id = 'camp-1') {
  return new NextRequest(`http://localhost/api/admin/campaigns/${id}`, {
    method: 'DELETE',
  })
}

function params(id = 'camp-1') {
  return { params: { id } }
}

describe('GET /api/admin/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated reads before fetching campaigns', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the campaign is missing', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Campaign not found' })
  })

  it('includes calendar items and the next incomplete calendar item', async () => {
    const campaign = {
      id: 'camp-1',
      name: 'Spring',
      campaign_eligible_bundles: [],
      campaign_criteria_templates: [],
    }
    const calendar = [
      {
        id: 'cal-1',
        title: 'Done',
        due_status: 'completed',
        scheduled_for: '2026-07-01T00:00:00.000Z',
      },
      {
        id: 'cal-2',
        title: 'Next up',
        due_status: 'scheduled',
        scheduled_for: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'cal-3',
        title: 'Cancelled',
        due_status: 'cancelled',
        scheduled_for: '2026-08-02T00:00:00.000Z',
      },
    ]

    const campaignSingle = vi.fn().mockResolvedValue({ data: campaign, error: null })
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle })
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq })

    const calendarOrder = vi.fn().mockResolvedValue({ data: calendar, error: null })
    const calendarEq = vi.fn().mockReturnValue({ order: calendarOrder })
    const calendarSelect = vi.fn().mockReturnValue({ eq: calendarEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') return { select: campaignSelect }
      if (table === 'social_content_calendar_items') return { select: calendarSelect }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeGetRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: {
        ...campaign,
        social_content_calendar_items: calendar,
        calendar_item_count: 3,
        next_calendar_item: calendar[1],
      },
    })
    expect(campaignEq).toHaveBeenCalledWith('id', 'camp-1')
    expect(calendarEq).toHaveBeenCalledWith('campaign_id', 'camp-1')
  })
})

describe('PUT /api/admin/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects invalid slug formats before updating', async () => {
    const response = await PUT(makePutRequest({ slug: 'Bad Slug' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid slug format' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid campaign types before updating', async () => {
    const response = await PUT(
      makePutRequest({ campaign_type: 'sweepstakes' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid campaign type' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid statuses before updating', async () => {
    const response = await PUT(makePutRequest({ status: 'live' }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid status' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires at least one allowed field', async () => {
    const response = await PUT(makePutRequest({ unknown_field: true }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('updates only allowlisted fields', async () => {
    const updated = { id: 'camp-1', name: 'Renamed', status: 'active' }
    const single = vi.fn().mockResolvedValue({ data: updated, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(
      makePutRequest({
        name: 'Renamed',
        status: 'active',
        created_by: 'attacker',
      }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: updated })
    expect(update).toHaveBeenCalledWith({
      name: 'Renamed',
      status: 'active',
    })
    expect(eq).toHaveBeenCalledWith('id', 'camp-1')
  })

  it('returns 409 when the updated slug conflicts', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    })
    const select = vi.fn().mockReturnValue({ single })
    const eq = vi.fn().mockReturnValue({ select })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })

    const response = await PUT(
      makePutRequest({ slug: 'already-taken' }),
      params(),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'A campaign with this slug already exists',
    })
  })
})

describe('DELETE /api/admin/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated deletes before mutating campaigns', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes the campaign by id', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const del = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ delete: del })

    const response = await DELETE(makeDeleteRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(eq).toHaveBeenCalledWith('id', 'camp-1')
  })
})
