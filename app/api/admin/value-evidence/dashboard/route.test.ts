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

type QueryResult = { data?: unknown; error?: unknown; count?: number | null }

function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {}
  const self = () => query
  for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle']) {
    query[method] = vi.fn(self)
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return query
}

function request() {
  return new NextRequest('http://localhost/api/admin/value-evidence/dashboard')
}

describe('GET /api/admin/value-evidence/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before aggregating stats', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('ranks pain points by evidence count, totals industries, and seeds platform stats', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'pain_point_categories') {
        return makeQuery({
          data: [
            { id: 'pp-low', name: 'low', display_name: 'Low', frequency_count: 99 },
            { id: 'pp-high', name: 'high', display_name: 'High', frequency_count: 1 },
          ],
          error: null,
        })
      }
      if (table === 'pain_point_evidence') {
        return makeQuery({
          data: [
            { pain_point_category_id: 'pp-high', source_type: 'reddit' },
            { pain_point_category_id: 'pp-high', source_type: 'reddit' },
            { pain_point_category_id: 'pp-low', source_type: 'g2' },
          ],
          error: null,
        })
      }
      if (table === 'value_calculations') {
        return makeQuery({
          data: [
            { industry: 'healthcare', annual_value: '100.5' },
            { industry: 'healthcare', annual_value: 'not-a-number' },
            { industry: 'retail', annual_value: 40 },
          ],
          error: null,
        })
      }
      if (table === 'market_intelligence') {
        return makeQuery({
          data: [
            { source_platform: 'reddit', scraped_at: '2026-01-02T00:00:00Z' },
            { source_platform: 'reddit', scraped_at: '2026-01-01T00:00:00Z' },
            { source_platform: 'obscure', scraped_at: '2026-02-01T00:00:00Z' },
          ],
          count: 3,
          error: null,
        })
      }
      if (table === 'value_reports' || table === 'industry_benchmarks' || table === 'content_pain_point_map') {
        return makeQuery({ data: null, count: 0, error: null })
      }
      if (table === 'value_evidence_workflow_runs') {
        return makeQuery({ data: null, error: null })
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.topPainPoints.map((row: { id: string; evidence_count: number }) => [row.id, row.evidence_count])).toEqual([
      ['pp-high', 2],
      ['pp-low', 1],
    ])
    expect(body.overview.totalEvidence).toBe(3)
    expect(body.evidenceBySource).toEqual({ reddit: 2, g2: 1 })
    expect(body.industryBreakdown).toEqual({
      healthcare: { count: 2, totalValue: 100.5 },
      retail: { count: 1, totalValue: 40 },
    })
    expect(body.marketIntelByPlatform.reddit).toEqual({
      count: 2,
      lastScraped: '2026-01-02T00:00:00Z',
    })
    expect(body.marketIntelByPlatform.obscure).toEqual({
      count: 1,
      lastScraped: '2026-02-01T00:00:00Z',
    })
    expect(body.marketIntelByPlatform.youtube).toEqual({ count: 0, lastScraped: null })
    expect(body.workflowRuns).toEqual({ vep001: null, vep002: null })
  })
})
