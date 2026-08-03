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

import { GET } from './route'

function request(url = 'http://localhost/api/admin/campaigns') {
  return new NextRequest(url)
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
})
