import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function makeRequest(email?: string) {
  const url = email
    ? `http://localhost/api/admin/campaigns/enrollments-by-email?email=${encodeURIComponent(email)}`
    : 'http://localhost/api/admin/campaigns/enrollments-by-email'
  return new NextRequest(url, { method: 'GET' })
}

function mockEnrollmentQuery({
  data,
  error = null as { code?: string; message?: string } | null,
}: {
  data: unknown[] | null
  error?: { code?: string; message?: string } | null
}) {
  const order = vi.fn().mockResolvedValue({ data, error })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'campaign_enrollments') throw new Error(`Unexpected table: ${table}`)
    return { select }
  })
  return { select, eq, order }
}

describe('GET /api/admin/campaigns/enrollments-by-email', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests before querying enrollments', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('client@example.com'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires an email query param', async () => {
    const response = await GET(makeRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'email query param required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns an empty list when the enrollments table is missing', async () => {
    mockEnrollmentQuery({ data: null, error: { code: '42P01', message: 'undefined_table' } })

    const response = await GET(makeRequest('client@example.com'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ enrollments: [] })
  })

  it('filters by client email and computes progress summary percentage', async () => {
    const { eq } = mockEnrollmentQuery({
      data: [
        {
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
          enrollment_criteria: [{ id: 'c1', required: true }, { id: 'c2', required: true }],
          campaign_progress: [
            { id: 'p1', status: 'met' },
            { id: 'p2', status: 'waived' },
          ],
        },
        {
          id: 'enr-2',
          status: 'active',
          enrolled_at: '2026-02-01T00:00:00.000Z',
          deadline_at: null,
          attraction_campaigns: null,
          enrollment_criteria: [],
          campaign_progress: [],
        },
      ],
    })

    const response = await GET(makeRequest('client@example.com'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      enrollments: [
        {
          id: 'enr-1',
          status: 'active',
          enrolled_at: '2026-01-01T00:00:00.000Z',
          deadline: '2026-04-01T00:00:00.000Z',
          payout_type: null,
          campaign: {
            id: 'camp-1',
            name: 'Spring',
            slug: 'spring',
            campaign_type: 'win_money_back',
            status: 'active',
          },
          progress_summary: { total: 2, met: 2, percentage: 100 },
        },
        {
          id: 'enr-2',
          status: 'active',
          enrolled_at: '2026-02-01T00:00:00.000Z',
          deadline: null,
          payout_type: null,
          campaign: null,
          progress_summary: { total: 0, met: 0, percentage: 0 },
        },
      ],
    })
    expect(eq).toHaveBeenCalledWith('client_email', 'client@example.com')
  })
})
