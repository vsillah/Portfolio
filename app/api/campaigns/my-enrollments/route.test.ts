import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAuth: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAuth: mocks.verifyAuth,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/campaigns/my-enrollments', {
    method: 'GET',
    headers: { authorization: 'Bearer user-token' },
  })
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

describe('GET /api/campaigns/my-enrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAuth.mockResolvedValue({ user: { id: 'user-1' }, isAdmin: false })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated requests before querying enrollments', async () => {
    mocks.verifyAuth.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('scopes results to the authenticated user id', async () => {
    const rows = [
      {
        id: 'enr-1',
        user_id: 'user-1',
        status: 'active',
        attraction_campaigns: { id: 'camp-1', name: 'Spring', slug: 'spring' },
      },
    ]
    const { eq } = mockEnrollmentQuery({ data: rows })

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: rows })
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('returns an empty list when the enrollments table is missing', async () => {
    mockEnrollmentQuery({ data: null, error: { code: '42P01', message: 'undefined_table' } })

    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [] })
  })

  it('returns a generic error when the database query fails', async () => {
    mockEnrollmentQuery({ data: null, error: { code: 'XX000', message: 'db boom' } })

    const response = await GET(makeRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch enrollments' })
  })
})
