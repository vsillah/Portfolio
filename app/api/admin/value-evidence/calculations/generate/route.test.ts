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

import { POST } from './route'

type QueryResult = { data?: unknown; error?: unknown }

function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {}
  const self = () => query
  for (const method of ['select', 'eq', 'neq', 'or', 'not', 'insert', 'single']) {
    query[method] = vi.fn(self)
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return query
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/value-evidence/calculations/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/admin/value-evidence/calculations/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before reading categories', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ pain_point_category_id: 'pp-1', industry: 'healthcare' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires pain_point_category_id and industry', async () => {
    const response = await POST(request({ industry: 'healthcare' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'pain_point_category_id and industry are required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the pain point category is missing', async () => {
    mocks.from.mockReturnValue(makeQuery({ data: null, error: { message: 'not found' } }))

    const response = await POST(request({ pain_point_category_id: 'missing', industry: 'healthcare' }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Pain point category not found' })
  })

  it('rejects industries that are not tagged on the category', async () => {
    mocks.from.mockReturnValue(
      makeQuery({
        data: {
          id: 'pp-1',
          name: 'scheduling',
          display_name: 'Scheduling waste',
          industry_tags: ['healthcare', 'dental'],
        },
        error: null,
      }),
    )

    const response = await POST(request({ pain_point_category_id: 'pp-1', industry: 'retail' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Industry "retail" is not relevant to "Scheduling waste". Allowed: healthcare, dental',
    })
  })

  it('allows _default even when the category has industry tags', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'pain_point_categories') {
        return makeQuery({
          data: {
            id: 'pp-1',
            name: 'unknown_pain',
            display_name: 'Unknown',
            industry_tags: ['healthcare'],
          },
          error: null,
        })
      }
      return makeQuery({ data: [], count: 0, error: null })
    })

    const response = await POST(
      request({ pain_point_category_id: 'pp-1', industry: '_default' }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({
      error: 'No calculation method configured for pain point: unknown_pain',
    })
  })
})
