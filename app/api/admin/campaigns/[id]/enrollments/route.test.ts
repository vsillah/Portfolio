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

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/campaigns/camp-1/enrollments${query}`)
}

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/campaigns/camp-1/enrollments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = { params: { id: 'camp-1' } }

function thenable<T extends Record<string, unknown>>(value: T, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    then(onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(value).then(onFulfilled, onRejected)
    },
  }
}

describe('GET /api/admin/campaigns/[id]/enrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not restrict status when the filter is omitted', async () => {
    // omitted status → no restriction on campaign_enrollments.status
    const statusEq = vi.fn()
    const result = { data: [{ id: 'enr-1', status: 'withdrawn' }], error: null, count: 1 }
    const range = vi.fn().mockReturnValue(thenable(result, { eq: statusEq }))
    const order = vi.fn().mockReturnValue({ range })
    const campaignEq = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: campaignEq }),
    })

    const response = await GET(getRequest(), params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(statusEq).not.toHaveBeenCalled()
    expect(body).toEqual({ data: [{ id: 'enr-1', status: 'withdrawn' }], total: 1 })
  })

  it('applies a concrete status filter', async () => {
    const result = { data: [{ id: 'enr-2', status: 'active' }], error: null, count: 1 }
    const statusEq = vi.fn().mockResolvedValue(result)
    const range = vi.fn().mockReturnValue(thenable(result, { eq: statusEq }))
    const order = vi.fn().mockReturnValue({ range })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order }),
      }),
    })

    const response = await GET(getRequest('?status=active'), params)

    expect(response.status).toBe(200)
    expect(statusEq).toHaveBeenCalledWith('status', 'active')
    expect(await response.json()).toEqual({ data: result.data, total: 1 })
  })

  it('returns an empty list when the enrollments table is missing', async () => {
    const result = { data: null, error: { code: '42P01', message: 'missing' }, count: null }
    const range = vi.fn().mockReturnValue(thenable(result, { eq: vi.fn() }))
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({ range }),
        }),
      }),
    })

    const response = await GET(getRequest(), params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [], total: 0 })
  })
})

describe('POST /api/admin/campaigns/[id]/enrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects a blank client email before touching the database', async () => {
    const response = await POST(postRequest({ client_email: '   ' }), params)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Client email is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unknown enrollment source', async () => {
    const response = await POST(
      postRequest({ client_email: 'client@example.com', enrollment_source: 'import' }),
      params,
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid enrollment source' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the campaign does not exist', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })

    const response = await POST(postRequest({ client_email: 'client@example.com' }), params)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Campaign not found' })
  })

  it('requires a completed diagnostic audit for the email', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'camp-1', completion_window_days: 90 },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'diagnostic_audits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await POST(postRequest({ client_email: 'client@example.com' }), params)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Client must have completed the AI Audit Calculator before enrollment. No audit data found for this email.',
    })
  })

  it('returns 409 when the client already has an open enrollment', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'camp-1', completion_window_days: 90 },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'diagnostic_audits') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: 'audit-1', email: 'client@example.com' }],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'campaign_enrollments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [{ id: 'enr-open' }], error: null }),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await POST(postRequest({ client_email: 'client@example.com' }), params)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Client already has an active enrollment in this campaign',
    })
  })
})
