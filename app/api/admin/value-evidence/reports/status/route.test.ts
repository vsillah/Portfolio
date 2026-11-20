import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  supabaseAdmin: { from: vi.fn() } as { from: ReturnType<typeof vi.fn> } | null,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdmin
  },
}))

import { GET } from './route'

function request(search: string) {
  return new NextRequest(`http://localhost/api/admin/value-evidence/reports/status${search}`)
}

function thenableQuery(result: { data?: unknown; error?: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  return query
}

describe('GET /api/admin/value-evidence/reports/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.supabaseAdmin = { from: mocks.from }
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request('?contactIds=1'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires contactIds', async () => {
    const response = await GET(request(''))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'contactIds query parameter is required' })
  })

  it('returns an empty statuses object when every id is unparsable', async () => {
    const response = await GET(request('?contactIds=foo,bar'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ statuses: {} })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('picks the first matching report and completed gamma per contact', async () => {
    const reportsQuery = thenableQuery({
      data: [
        { id: 'rep-new', contact_submission_id: 1, total_annual_value: '12000.5', report_type: 'industry', created_at: '2026-02-01' },
        { id: 'rep-old', contact_submission_id: 1, total_annual_value: '1', report_type: 'industry', created_at: '2026-01-01' },
      ],
      error: null,
    })
    const gammaQuery = thenableQuery({
      data: [
        { id: 'gamma-1', contact_submission_id: 1, gamma_url: 'https://gamma.app/1', status: 'completed', report_type: 'industry', created_at: '2026-02-02' },
      ],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'value_reports') return reportsQuery
      if (table === 'gamma_reports') return gammaQuery
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request('?contactIds=1,abc,2'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(reportsQuery.in).toHaveBeenCalledWith('contact_submission_id', [1, 2])
    expect(gammaQuery.eq).toHaveBeenCalledWith('status', 'completed')
    expect(body.statuses).toEqual({
      '1': {
        reportId: 'rep-new',
        totalAnnualValue: 12000.5,
        reportType: 'industry',
        gammaReportId: 'gamma-1',
        gammaUrl: 'https://gamma.app/1',
      },
      '2': null,
    })
  })
})
