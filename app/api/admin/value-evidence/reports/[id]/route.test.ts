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

const params = { params: Promise.resolve({ id: 'rep-1' }) }

function request() {
  return new NextRequest('http://localhost/api/admin/value-evidence/reports/rep-1')
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.single.mockResolvedValue(result)
  return query
}

describe('GET /api/admin/value-evidence/reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request(), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the report is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'not found' } }))

    const response = await GET(request(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Report not found' })
  })

  it('collects unique benchmarks from evidence_chain and calculation_ids', async () => {
    const report = {
      id: 'rep-1',
      contact_submission_id: 12,
      calculation_ids: ['calc-1'],
      evidence_chain: {
        calculations: [
          { benchmarksUsed: ['bench-a', 'bench-b'] },
          { benchmarks_used: ['bench-b', ''] },
        ],
      },
    }
    const reportQuery = thenableQuery({ data: report, error: null })
    const contactQuery = thenableQuery({
      data: { id: 12, name: 'Ada', email: 'ada@example.com', company: 'Ada Co', industry: 'tech', employee_count: '10', lead_score: 80 },
      error: null,
    })
    const calcQuery = thenableQuery({
      data: [{ benchmark_ids: ['bench-c', 'bench-a'] }],
      error: null,
    })
    const benchQuery = thenableQuery({
      data: [
        { id: 'bench-a', industry: 'tech', company_size_range: '1-10', benchmark_type: 'hourly', value: '45', source: 'BLS', source_url: null, year: 2024, notes: null },
        { id: 'bench-b', industry: 'tech', company_size_range: '1-10', benchmark_type: 'close_rate', value: 0.2, source: 'Internal', source_url: 'https://example.com', year: 2025, notes: 'n' },
        { id: 'bench-c', industry: 'retail', company_size_range: '1-10', benchmark_type: 'hourly', value: 30, source: 'BLS', source_url: null, year: 2024, notes: null },
      ],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'value_reports') return reportQuery
      if (table === 'contact_submissions') return contactQuery
      if (table === 'value_calculations') return calcQuery
      if (table === 'industry_benchmarks') return benchQuery
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request(), params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.report).toEqual(report)
    expect(body.contact).toMatchObject({ id: 12, name: 'Ada' })
    expect(body.benchmarks.map((b: { id: string }) => b.id)).toEqual(['bench-c', 'bench-b', 'bench-a'])
    expect(body.benchmarks.find((b: { id: string }) => b.id === 'bench-a')?.value).toBe(45)
    expect(calcQuery.in).toHaveBeenCalledWith('id', ['calc-1'])
    expect(benchQuery.in).toHaveBeenCalledWith('id', expect.arrayContaining(['bench-a', 'bench-b', 'bench-c']))
  })

  it('skips contact and benchmark lookups when the report has neither', async () => {
    const report = { id: 'rep-2', contact_submission_id: null, calculation_ids: [], evidence_chain: null }
    mocks.from.mockReturnValue(thenableQuery({ data: report, error: null }))

    const response = await GET(request(), { params: Promise.resolve({ id: 'rep-2' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.contact).toBeNull()
    expect(body.benchmarks).toEqual([])
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})
