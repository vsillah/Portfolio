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

function request(query = '?email=client@example.com') {
  return new NextRequest(`http://localhost/api/admin/campaigns/enrollments-by-email${query}`)
}

describe('GET /api/admin/campaigns/enrollments-by-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires an email query param', async () => {
    const response = await GET(request(''))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'email query param required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('summarizes met and waived progress against the criteria count', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: 'enr-1',
        status: 'active',
        enrolled_at: '2026-01-01T00:00:00.000Z',
        deadline_at: '2026-04-01T00:00:00.000Z',
        attraction_campaigns: {
          id: 'camp-1',
          name: 'Spring',
          slug: 'spring',
          campaign_type: 'win_money_back',
          status: 'active',
        },
        enrollment_criteria: [{ id: 'c1', required: true }, { id: 'c2', required: true }, { id: 'c3', required: false }],
        campaign_progress: [
          { id: 'p1', status: 'met' },
          { id: 'p2', status: 'waived' },
          { id: 'p3', status: 'pending' },
        ],
      }],
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq }),
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(eq).toHaveBeenCalledWith('client_email', 'client@example.com')
    expect(body.enrollments[0].progress_summary).toEqual({
      total: 3,
      met: 2,
      percentage: 67,
    })
  })

  it('returns an empty list when the enrollments table is missing', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '42P01', message: 'missing' },
          }),
        }),
      }),
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ enrollments: [] })
  })
})
