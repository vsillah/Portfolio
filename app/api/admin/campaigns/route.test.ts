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

import { GET, POST } from './route'

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/campaigns${query}`)
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function validCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    name: '  Spring Attraction  ',
    slug: 'spring-attraction',
    campaign_type: 'win_money_back',
    ...overrides,
  }
}

describe('GET /api/admin/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before listing campaigns', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('applies a valid status filter and returns derived enrollment counts', async () => {
    const campaign = {
      id: 'camp-1',
      name: 'Spring',
      campaign_eligible_bundles: [{ id: 'ceb-1', bundle_id: 'b-1' }],
      campaign_criteria_templates: [{ id: 'cct-1' }],
      campaign_enrollments: [
        { id: 'enr-1', status: 'active' },
        { id: 'enr-2', status: 'expired' },
      ],
    }

    // Chain: select().order().range(), then optionally rangeResult.eq(status)
    const statusEq = vi.fn().mockResolvedValue({
      data: [campaign],
      error: null,
      count: 1,
    })
    const range = vi.fn().mockReturnValue({ eq: statusEq })
    const order = vi.fn().mockReturnValue({ range })
    const select = vi.fn().mockReturnValue({ order })

    const calendarOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'cal-1',
          campaign_id: 'camp-1',
          title: 'Kickoff post',
          scheduled_for: '2026-08-01T00:00:00.000Z',
        },
        {
          id: 'cal-2',
          campaign_id: 'camp-1',
          title: 'Follow-up',
          scheduled_for: '2026-08-02T00:00:00.000Z',
        },
      ],
      error: null,
    })
    const calendarIn = vi.fn().mockReturnValue({ order: calendarOrder })
    const calendarSelect = vi.fn().mockReturnValue({ in: calendarIn })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') return { select }
      if (table === 'social_content_calendar_items') return { select: calendarSelect }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeGetRequest('?status=active'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          ...campaign,
          eligible_bundle_count: 1,
          criteria_count: 1,
          enrollment_count: 2,
          active_enrollment_count: 1,
          calendar_item_count: 2,
          next_calendar_item: {
            id: 'cal-1',
            campaign_id: 'camp-1',
            title: 'Kickoff post',
            scheduled_for: '2026-08-01T00:00:00.000Z',
          },
        },
      ],
      total: 1,
    })
    expect(statusEq).toHaveBeenCalledWith('status', 'active')
  })

  it('returns an empty list when the campaigns table is missing', async () => {
    const range = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'missing table' },
      count: null,
    })
    const order = vi.fn().mockReturnValue({ range })
    const select = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({ select })

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [], total: 0 })
  })
})

describe('POST /api/admin/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated creates before writing campaigns', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makePostRequest(validCreateBody()))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a non-empty name', async () => {
    const response = await POST(makePostRequest(validCreateBody({ name: '   ' })))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Name is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a valid slug format', async () => {
    const response = await POST(
      makePostRequest(validCreateBody({ slug: 'Bad Slug!' })),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Valid slug is required (lowercase, hyphens only)',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects invalid campaign types before insert', async () => {
    const response = await POST(
      makePostRequest(validCreateBody({ campaign_type: 'raffle' })),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid campaign type',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a draft campaign with trimmed fields and admin attribution', async () => {
    const created = {
      id: 'camp-new',
      name: 'Spring Attraction',
      slug: 'spring-attraction',
      status: 'draft',
    }
    const single = vi.fn().mockResolvedValue({ data: created, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'attraction_campaigns') throw new Error(`Unexpected table: ${table}`)
      return { insert }
    })

    const response = await POST(
      makePostRequest(
        validCreateBody({
          description: '  Win your fee back  ',
          completion_window_days: 60,
        }),
      ),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ data: created })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Spring Attraction',
        slug: 'spring-attraction',
        description: 'Win your fee back',
        campaign_type: 'win_money_back',
        status: 'draft',
        completion_window_days: 60,
        created_by: 'admin-user-1',
      }),
    )
  })

  it('returns 409 when the slug already exists', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate' },
    })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(makePostRequest(validCreateBody()))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'A campaign with this slug already exists',
    })
  })
})
