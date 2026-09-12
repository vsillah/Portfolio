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

function request(url = 'http://localhost/api/admin/campaigns') {
  return new NextRequest(url)
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function thenable<T extends Record<string, unknown>>(value: T, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(value).then(onFulfilled, onRejected)
    },
  }
}

describe('GET /api/admin/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('uses the first incomplete calendar item as the campaign next item', async () => {
    const campaignsRange = vi.fn().mockResolvedValue({
      data: [{
        id: 'campaign-1',
        name: 'Agentified launch',
        status: 'active',
        campaign_eligible_bundles: [],
        campaign_criteria_templates: [],
        campaign_enrollments: [],
      }],
      error: null,
      count: 1,
    })
    const campaignsOrder = vi.fn(() => ({ range: campaignsRange }))
    const campaignsSelect = vi.fn(() => ({ order: campaignsOrder }))

    const calendarOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'calendar-complete',
          campaign_id: 'campaign-1',
          title: 'Already posted',
          due_status: 'completed',
        },
        {
          id: 'calendar-next',
          campaign_id: 'campaign-1',
          title: 'Next sequence item',
          due_status: 'planned',
        },
      ],
      error: null,
    })
    const calendarIn = vi.fn(() => ({ order: calendarOrder }))
    const calendarSelect = vi.fn(() => ({ in: calendarIn }))

    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') {
        return { select: campaignsSelect }
      }
      if (table === 'social_content_calendar_items') {
        return { select: calendarSelect }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data[0]).toEqual(expect.objectContaining({
      calendar_item_count: 2,
      next_calendar_item: expect.objectContaining({
        id: 'calendar-next',
        title: 'Next sequence item',
      }),
    }))
  })

  it('does not restrict status when filter is omitted, all, or invalid', async () => {
    // filter === 'all' → no restriction on attraction_campaigns.status
    const result = {
      data: [{
        id: 'campaign-archived',
        name: 'Archived campaign',
        status: 'archived',
        campaign_eligible_bundles: [],
        campaign_criteria_templates: [],
        campaign_enrollments: [],
      }],
      error: null,
      count: 1,
    }
    const statusEq = vi.fn()
    const range = vi.fn().mockReturnValue(thenable(result, { eq: statusEq }))
    const order = vi.fn().mockReturnValue({ range })
    const campaignsSelect = vi.fn().mockReturnValue({ order })
    const calendarSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') return { select: campaignsSelect }
      if (table === 'social_content_calendar_items') return { select: calendarSelect }
      throw new Error(`Unexpected table ${table}`)
    })

    for (const url of [
      'http://localhost/api/admin/campaigns',
      'http://localhost/api/admin/campaigns?status=all',
      'http://localhost/api/admin/campaigns?status=not-a-status',
    ]) {
      statusEq.mockClear()
      const response = await GET(request(url))
      expect(response.status).toBe(200)
      expect(statusEq).not.toHaveBeenCalled()
      const body = await response.json()
      expect(body.data[0].status).toBe('archived')
    }
  })

  it('applies a concrete status filter', async () => {
    const result = {
      data: [{
        id: 'campaign-active',
        name: 'Active campaign',
        status: 'active',
        campaign_eligible_bundles: [],
        campaign_criteria_templates: [],
        campaign_enrollments: [],
      }],
      error: null,
      count: 1,
    }
    const statusEq = vi.fn().mockResolvedValue(result)
    const range = vi.fn().mockReturnValue(thenable(result, { eq: statusEq }))
    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ range }),
          }),
        }
      }
      if (table === 'social_content_calendar_items') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await GET(request('http://localhost/api/admin/campaigns?status=active'))

    expect(response.status).toBe(200)
    expect(statusEq).toHaveBeenCalledWith('status', 'active')
  })
})

describe('POST /api/admin/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires a name and a valid kebab slug', async () => {
    const missingName = await POST(postRequest({ slug: 'spring-launch' }))
    expect(missingName.status).toBe(400)
    expect(await missingName.json()).toEqual({ error: 'Name is required' })

    const badSlug = await POST(postRequest({ name: 'Spring', slug: 'Spring Launch' }))
    expect(badSlug.status).toBe(400)
    expect(await badSlug.json()).toEqual({
      error: 'Valid slug is required (lowercase, hyphens only)',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unknown campaign type', async () => {
    const response = await POST(postRequest({
      name: 'Spring',
      slug: 'spring-launch',
      campaign_type: 'cash_back',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid campaign type' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
