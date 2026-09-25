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

type QueryResult = { data: unknown; error: unknown }

function terminal(result: QueryResult) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => query
  for (const method of ['select', 'eq', 'order', 'limit', 'insert', 'update']) {
    query[method] = vi.fn(chain)
  }
  query.single = vi.fn(() => Promise.resolve(result))
  query.then = vi.fn((onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected))
  return query
}

const params = { params: Promise.resolve({ id: 'review-1' }) }

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/chat-eval/axial-codes/reviews/review-1/promote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function approvedReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    status: 'approved',
    category_id: null,
    generation_id: 'gen-1',
    final_code: 'Slow invoicing',
    original_code: 'Invoice delay',
    final_description: 'Invoices take weeks',
    original_description: 'Original delay',
    ...overrides,
  }
}

describe('POST /api/admin/chat-eval/axial-codes/reviews/[id]/promote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({}), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing review and a generic error for other reads', async () => {
    mocks.from.mockReturnValueOnce(terminal({ data: null, error: { code: 'PGRST116', message: '0 rows' } }))
    const missing = await POST(request({}), params)
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({ error: 'Review not found' })

    mocks.from.mockReturnValueOnce(terminal({ data: null, error: { code: 'XX000', message: 'timeout' } }))
    const failed = await POST(request({}), params)
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({ error: 'Failed to fetch review' })
  })

  it('promotes only approved or modified reviews that are not already categories', async () => {
    for (const status of ['pending', 'rejected']) {
      mocks.from.mockReturnValueOnce(terminal({ data: approvedReview({ status }), error: null }))
      const response = await POST(request({}), params)
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({
        error: 'Only approved or modified reviews can be promoted to categories',
      })
    }

    mocks.from.mockReturnValueOnce(terminal({
      data: approvedReview({ category_id: 'cat-existing' }),
      error: null,
    }))
    const already = await POST(request({}), params)
    expect(already.status).toBe(400)
    await expect(already.json()).resolves.toEqual({
      error: 'This axial code has already been promoted to a category',
    })
    expect(mocks.from).not.toHaveBeenCalledWith('evaluation_categories')
  })

  it('keeps an explicit sort order of 0 and falls back when the stored max is 0', async () => {
    const explicitCategory = terminal({ data: { id: 'cat-0' }, error: null })
    const explicitReviews = [
      terminal({ data: approvedReview(), error: null }),
      terminal({ data: null, error: null }),
      terminal({ data: [{ status: 'approved', category_id: null }], error: null }),
    ]
    const explicitCategories = [
      terminal({ data: { sort_order: 9 }, error: null }),
      explicitCategory,
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return explicitReviews.shift()
      if (table === 'evaluation_categories') return explicitCategories.shift()
      return terminal({ data: null, error: null })
    })

    const explicit = await POST(request({ sort_order: 0, color: '' }), params)
    expect(explicit.status).toBe(200)
    expect(explicitCategory.insert).toHaveBeenCalledWith({
      name: 'Slow invoicing',
      description: 'Invoices take weeks',
      color: '#6B7280',
      sort_order: 0,
      is_active: true,
      source: 'axial_code',
      axial_review_id: 'review-1',
    })

    const fallbackCategory = terminal({ data: { id: 'cat-1' }, error: null })
    const fallbackReviews = [
      terminal({ data: approvedReview({ final_code: '', final_description: '' }), error: null }),
      terminal({ data: null, error: { message: 'link failed' } }),
      terminal({ data: null, error: null }),
    ]
    const fallbackCategories = [
      terminal({ data: { sort_order: 0 }, error: null }),
      fallbackCategory,
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return fallbackReviews.shift()
      if (table === 'evaluation_categories') return fallbackCategories.shift()
      throw new Error(`Unexpected table ${table}`)
    })

    const fallback = await POST(request({ color: '#111111' }), params)
    expect(fallback.status).toBe(200)
    await expect(fallback.json()).resolves.toEqual({
      category: { id: 'cat-1' },
      message: 'Axial code successfully promoted to category',
    })
    expect(fallbackCategory.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Invoice delay',
      description: 'Original delay',
      color: '#111111',
      sort_order: 1,
    }))
    expect(mocks.from).not.toHaveBeenCalledWith('axial_code_generations')
  })

  it('completes the generation only after every approved or modified sibling is promoted', async () => {
    const category = terminal({ data: { id: 'cat-2' }, error: null })
    const generation = terminal({ data: null, error: null })
    const reviews = [
      terminal({ data: approvedReview({ status: 'modified' }), error: null }),
      terminal({ data: null, error: null }),
      terminal({
        data: [
          { status: 'rejected', category_id: null },
          { status: 'modified', category_id: 'cat-2' },
          { status: 'approved', category_id: 'cat-older' },
        ],
        error: null,
      }),
    ]
    const maxSort = terminal({ data: { sort_order: 3 }, error: null })
    const categories = [maxSort, category]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return reviews.shift()
      if (table === 'evaluation_categories') return categories.shift()
      if (table === 'axial_code_generations') return generation
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await POST(request({}), params)

    expect(response.status).toBe(200)
    expect(generation.update).toHaveBeenCalledWith({ status: 'completed' })
    expect(generation.eq).toHaveBeenCalledWith('id', 'gen-1')
  })

  it('does not complete a generation that still has an unpromoted approval or only rejections', async () => {
    const blockedGeneration = terminal({ data: null, error: null })
    const blockedReviews = [
      terminal({ data: approvedReview(), error: null }),
      terminal({ data: null, error: null }),
      terminal({
        data: [
          { status: 'approved', category_id: null },
          { status: 'rejected', category_id: null },
        ],
        error: null,
      }),
    ]
    const blockedCategories = [
      terminal({ data: null, error: null }),
      terminal({ data: { id: 'cat-3' }, error: null }),
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return blockedReviews.shift()
      if (table === 'evaluation_categories') return blockedCategories.shift()
      if (table === 'axial_code_generations') return blockedGeneration
      throw new Error(table)
    })

    await POST(request({}), params)
    expect(blockedGeneration.update).not.toHaveBeenCalled()

    const rejectionOnly = [
      terminal({ data: approvedReview(), error: null }),
      terminal({ data: null, error: null }),
      terminal({ data: [{ status: 'rejected', category_id: null }], error: null }),
    ]
    const rejectionCategories = [
      terminal({ data: null, error: null }),
      terminal({ data: { id: 'cat-4' }, error: null }),
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return rejectionOnly.shift()
      if (table === 'evaluation_categories') return rejectionCategories.shift()
      return blockedGeneration
    })

    await POST(request({}), params)
    expect(blockedGeneration.update).not.toHaveBeenCalled()
  })

  it('returns 409 for a duplicate category name and hides other insert errors', async () => {
    const duplicate = terminal({ data: null, error: { code: '23505', message: 'duplicate' } })
    const categories = [
      terminal({ data: { sort_order: 1 }, error: null }),
      duplicate,
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return terminal({ data: approvedReview(), error: null })
      if (table === 'evaluation_categories') return categories.shift()
      throw new Error(table)
    })

    const conflict = await POST(request({}), params)
    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toEqual({ error: 'A category with this name already exists' })

    const failedInsert = terminal({ data: null, error: { code: 'XX000', message: 'insert failed' } })
    const failedCategories = [terminal({ data: null, error: null }), failedInsert]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return terminal({ data: approvedReview(), error: null })
      return failedCategories.shift()
    })
    const failed = await POST(request({}), params)
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({ error: 'Failed to create category' })
  })

  it('returns a generic error for invalid JSON', async () => {
    const response = await POST(request('{'), params)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Internal server error' })
  })
})
