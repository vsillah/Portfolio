import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  fetchFunnelAnalytics: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/funnel-analytics', () => ({
  fetchFunnelAnalytics: mocks.fetchFunnelAnalytics,
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/analytics/funnel${query}`)
}

const funnelPayload = { stages: [], summary: { totalLeads: 0 } }

describe('GET /api/admin/analytics/funnel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.fetchFunnelAnalytics.mockResolvedValue(funnelPayload)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects non-admin callers before fetching funnel data', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.fetchFunnelAnalytics).not.toHaveBeenCalled()
  })

  it('passes channel=all with no lead_source restriction', async () => {
    // filter === 'all' → no restriction on lead_source
    const response = await GET(request('?channel=all&days=30'))

    expect(response.status).toBe(200)
    expect(mocks.fetchFunnelAnalytics).toHaveBeenCalledWith(30, 'all')
    await expect(response.json()).resolves.toEqual(funnelPayload)
  })

  it('defaults omitted channel to all and clamps invalid day windows to 30', async () => {
    await GET(request())
    expect(mocks.fetchFunnelAnalytics).toHaveBeenLastCalledWith(30, 'all')

    await GET(request('?days=0&channel=warm'))
    expect(mocks.fetchFunnelAnalytics).toHaveBeenLastCalledWith(30, 'warm')

    await GET(request('?days=400&channel=not-a-channel'))
    expect(mocks.fetchFunnelAnalytics).toHaveBeenLastCalledWith(30, 'all')

    await GET(request('?days=14&channel=cold'))
    expect(mocks.fetchFunnelAnalytics).toHaveBeenLastCalledWith(14, 'cold')
  })

  it('returns 500 when funnel aggregation throws', async () => {
    mocks.fetchFunnelAnalytics.mockRejectedValue(new Error('db down'))

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Internal server error' })
  })
})
