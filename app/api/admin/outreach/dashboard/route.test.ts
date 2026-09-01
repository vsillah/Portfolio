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
import { computeFunnel, computeFunnelBySource } from './funnel-helpers'

const contacts = [
  { lead_score: 80, outreach_status: 'new', lead_source: 'cold_linkedin' },
  { lead_score: null, outreach_status: 'sequence_active', lead_source: 'cold_linkedin' },
  { lead_score: 40, outreach_status: 'replied', lead_source: 'warm_facebook_friends' },
  { lead_score: 90, outreach_status: 'booked', lead_source: 'warm_facebook_friends' },
  { lead_score: 10, outreach_status: 'no_response', lead_source: null },
  { lead_score: 5, outreach_status: 'opted_out', lead_source: 'warm_google_maps' },
]

describe('computeFunnel', () => {
  it('returns zeros for an empty contact list', () => {
    expect(computeFunnel([])).toEqual({
      total: 0,
      enriched: 0,
      contacted: 0,
      replied: 0,
      booked: 0,
      reply_rate: 0,
      booking_rate: 0,
    })
  })

  it('counts contacted as sequence_active, replied, booked, or no_response', () => {
    const funnel = computeFunnel(contacts)

    expect(funnel.total).toBe(6)
    expect(funnel.enriched).toBe(5)
    expect(funnel.contacted).toBe(4)
    expect(funnel.replied).toBe(1)
    expect(funnel.booked).toBe(1)
    expect(funnel.reply_rate).toBe(25)
    expect(funnel.booking_rate).toBe(25)
  })
})

describe('computeFunnelBySource', () => {
  it('groups null lead_source as unknown and counts contacted as sequence_active only', () => {
    const bySource = computeFunnelBySource(contacts)

    expect(bySource.cold_linkedin).toEqual({
      total: 2,
      enriched: 1,
      contacted: 1,
      replied: 0,
      booked: 0,
      opted_out: 0,
      no_response: 0,
    })
    expect(bySource.warm_facebook_friends).toEqual({
      total: 2,
      enriched: 2,
      contacted: 0,
      replied: 1,
      booked: 1,
      opted_out: 0,
      no_response: 0,
    })
    expect(bySource.unknown).toEqual({
      total: 1,
      enriched: 1,
      contacted: 0,
      replied: 0,
      booked: 0,
      opted_out: 0,
      no_response: 1,
    })
    expect(bySource.warm_google_maps.opted_out).toBe(1)
  })
})

describe('GET /api/admin/outreach/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns auth error when admin verification fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/admin/outreach/dashboard'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
