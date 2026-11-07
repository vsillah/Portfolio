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

type QueryResult = { data: unknown; error: unknown }

function thenableQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  return query
}

function makeGet(query = '') {
  return new NextRequest(`http://localhost/api/admin/sales/upsell-paths${query}`)
}

function makePost(body: unknown) {
  return new NextRequest('http://localhost/api/admin/sales/upsell-paths', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validCreate = {
  source_content_type: 'service',
  source_content_id: 'svc-1',
  source_title: 'Strategy Sprint',
  upsell_content_type: 'service',
  upsell_content_id: 'svc-2',
  upsell_title: 'Implementation',
  next_problem: 'They still cannot operate the system',
}

describe('/api/admin/sales/upsell-paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  describe('GET', () => {
    it('requires admin authentication', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
      mocks.isAuthError.mockReturnValue(true)

      const response = await GET(makeGet())

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('defaults to active paths and does not restrict source_tier when omitted', async () => {
      // omitted source_tier → no restriction on source_tier_slug
      const query = thenableQuery({ data: [], error: null })
      mocks.from.mockReturnValue(query)

      const response = await GET(makeGet())

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ paths: [] })
      expect(mocks.from).toHaveBeenCalledWith('offer_upsell_paths')
      expect(query.eq).toHaveBeenCalledWith('is_active', true)
      expect(query.eq).not.toHaveBeenCalledWith('source_tier_slug', expect.anything())
      expect(query.is).not.toHaveBeenCalled()
    })

    it('applies no source_tier filter when source_tier=all', async () => {
      // source_tier === 'all' → no restriction on source_tier_slug
      const query = thenableQuery({
        data: [{ id: 'path-1', source_tier_slug: 'other', source_title: 'A', upsell_title: 'B', next_problem: 'C' }],
        error: null,
      })
      mocks.from.mockReturnValue(query)

      const response = await GET(makeGet('?source_tier=all'))

      expect(response.status).toBe(200)
      expect(query.eq).toHaveBeenCalledWith('is_active', true)
      expect(query.eq).not.toHaveBeenCalledWith('source_tier_slug', 'all')
      expect(query.eq).not.toHaveBeenCalledWith('source_tier_slug', expect.anything())
      expect(query.is).not.toHaveBeenCalled()
    })

    it('filters standalone paths with a null source_tier_slug', async () => {
      const query = thenableQuery({ data: [], error: null })
      mocks.from.mockReturnValue(query)

      await GET(makeGet('?source_tier=standalone'))

      expect(query.is).toHaveBeenCalledWith('source_tier_slug', null)
      expect(query.eq).not.toHaveBeenCalledWith('source_tier_slug', 'standalone')
    })

    it('filters a concrete source tier and includes inactive rows when active=false', async () => {
      const query = thenableQuery({ data: [], error: null })
      mocks.from.mockReturnValue(query)

      await GET(makeGet('?source_tier=growth&active=false'))

      expect(query.eq).toHaveBeenCalledWith('source_tier_slug', 'growth')
      expect(query.eq).not.toHaveBeenCalledWith('is_active', true)
    })

    it('applies search only after the query, matching title and next_problem fields', async () => {
      const query = thenableQuery({
        data: [
          { source_title: 'Sprint', upsell_title: 'Ops', next_problem: 'Handoff stalls' },
          { source_title: 'Audit', upsell_title: 'Retainer', next_problem: 'Unrelated' },
        ],
        error: null,
      })
      mocks.from.mockReturnValue(query)

      const response = await GET(makeGet('?search=HANDOFF'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({
        paths: [{ source_title: 'Sprint', upsell_title: 'Ops', next_problem: 'Handoff stalls' }],
      })
    })
  })

  describe('POST', () => {
    it('requires admin authentication before parsing the body', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
      mocks.isAuthError.mockReturnValue(true)
      const request = makePost(validCreate)
      const jsonSpy = vi.spyOn(request, 'json')

      const response = await POST(request)

      expect(response.status).toBe(403)
      expect(jsonSpy).not.toHaveBeenCalled()
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('requires source, upsell, and next_problem fields', async () => {
      const missingSource = await POST(makePost({ upsell_title: 'Ops', next_problem: 'x' }))
      expect(missingSource.status).toBe(400)
      await expect(missingSource.json()).resolves.toEqual({
        error: 'source_content_type, source_content_id, and source_title are required',
      })

      const missingUpsell = await POST(
        makePost({
          source_content_type: 'service',
          source_content_id: 'svc-1',
          source_title: 'Sprint',
          next_problem: 'x',
        }),
      )
      expect(missingUpsell.status).toBe(400)
      await expect(missingUpsell.json()).resolves.toEqual({
        error: 'upsell_content_type, upsell_content_id, and upsell_title are required',
      })

      const missingProblem = await POST(
        makePost({
          source_content_type: 'service',
          source_content_id: 'svc-1',
          source_title: 'Sprint',
          upsell_content_type: 'service',
          upsell_content_id: 'svc-2',
          upsell_title: 'Ops',
        }),
      )
      expect(missingProblem.status).toBe(400)
      await expect(missingProblem.json()).resolves.toEqual({ error: 'next_problem is required' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('assigns the next sequential display_order and nulls empty tier slugs', async () => {
      const maxQuery = thenableQuery({ data: { display_order: 4 }, error: null })
      const insertQuery = thenableQuery({ data: { id: 'path-new', display_order: 5 }, error: null })
      let calls = 0
      mocks.from.mockImplementation((table: string) => {
        expect(table).toBe('offer_upsell_paths')
        calls += 1
        return calls === 1 ? maxQuery : insertQuery
      })

      const response = await POST(makePost({ ...validCreate, source_tier_slug: '' }))

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual({ path: { id: 'path-new', display_order: 5 } })
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          display_order: 5,
          source_tier_slug: null,
          upsell_tier_slug: null,
          next_problem_timing: '2-4 weeks',
          next_problem_signals: [],
          credit_previous_investment: true,
          is_active: true,
        }),
      )
    })
  })
})
