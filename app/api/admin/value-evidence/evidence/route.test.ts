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

import { DELETE, GET } from './route'

function request(search: string, method = 'GET') {
  return new NextRequest(`http://localhost/api/admin/value-evidence/evidence${search}`, { method })
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null; count?: number | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  query.update.mockReturnValue(query)
  return query
}

function queueByTable(tableResults: Record<string, Array<{ data?: unknown; error?: { message?: string } | null; count?: number | null }>>) {
  const indexes: Record<string, number> = {}
  mocks.from.mockImplementation((table: string) => {
    const i = indexes[table] ?? 0
    indexes[table] = i + 1
    return thenableQuery(tableResults[table]?.[i] ?? { data: [], error: null, count: 0 })
  })
}

describe('GET /api/admin/value-evidence/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request('?contact_id=12'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a positive integer contact_id', async () => {
    const missing = await GET(request(''))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'contact_id query parameter is required' })

    const zero = await GET(request('?contact_id=0'))
    expect(zero.status).toBe(400)
    await expect(zero.json()).resolves.toEqual({ error: 'contact_id must be a positive integer' })

    const nan = await GET(request('?contact_id=abc'))
    expect(nan.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('dedupes stacked evidence by category, keeping the highest-confidence row', async () => {
    queueByTable({
      pain_point_evidence: [
        {
          data: [
            {
              id: 'ev-old',
              pain_point_category_id: 'cat-ops',
              source_type: 'website',
              source_id: 'src-1',
              source_excerpt: 'older',
              confidence_score: 0.8,
              monetary_indicator: 100,
              monetary_context: 'hours',
              created_at: '2026-01-01T00:00:00.000Z',
              pain_point_categories: { display_name: 'Ops drag' },
            },
            {
              id: 'ev-best',
              pain_point_category_id: 'cat-ops',
              source_type: 'website',
              source_id: 'src-2',
              source_excerpt: 'newer higher confidence',
              confidence_score: 0.9,
              monetary_indicator: 50,
              monetary_context: 'hours',
              created_at: '2026-02-01T00:00:00.000Z',
              pain_point_categories: { display_name: 'Ops drag' },
            },
            {
              id: 'ev-lead',
              pain_point_category_id: 'cat-leads',
              source_type: 'linkedin',
              source_id: 'src-3',
              source_excerpt: 'leads',
              confidence_score: 0.4,
              monetary_indicator: null,
              monetary_context: null,
              created_at: '2026-03-01T00:00:00.000Z',
              pain_point_categories: { display_name: 'Lead leakage' },
            },
          ],
          error: null,
        },
        { data: null, error: null, count: 5 },
      ],
      value_reports: [{ data: [{ id: 'rep-1', title: 'Value' }], error: null }],
    })

    const response = await GET(request('?contact_id=12'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalEvidenceCount).toBe(5)
    expect(body.reports).toEqual([{ id: 'rep-1', title: 'Value' }])
    expect(body.evidence).toEqual([
      expect.objectContaining({
        id: 'ev-best',
        occurrence_count: 2,
        monetary_min: 50,
        monetary_max: 100,
        display_name: 'Ops drag',
      }),
      expect.objectContaining({
        id: 'ev-lead',
        occurrence_count: 1,
        monetary_min: null,
        monetary_max: null,
      }),
    ])
  })
})

describe('DELETE /api/admin/value-evidence/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(request('?contact_id=12', 'DELETE'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes evidence and resets VEP status for the contact', async () => {
    const evidenceQuery = thenableQuery({ data: null, error: null, count: 4 })
    const contactQuery = thenableQuery({ data: null, error: null })
    mocks.from
      .mockReturnValueOnce(evidenceQuery)
      .mockReturnValueOnce(contactQuery)

    const response = await DELETE(request('?contact_id=12', 'DELETE'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: 4 })
    expect(mocks.from).toHaveBeenNthCalledWith(1, 'pain_point_evidence')
    expect(mocks.from).toHaveBeenNthCalledWith(2, 'contact_submissions')
    expect(evidenceQuery.delete).toHaveBeenCalled()
    expect(evidenceQuery.eq).toHaveBeenCalledWith('contact_submission_id', 12)
    expect(contactQuery.update).toHaveBeenCalledWith({
      last_vep_status: null,
      last_vep_triggered_at: null,
    })
    expect(contactQuery.eq).toHaveBeenCalledWith('id', 12)
  })
})
