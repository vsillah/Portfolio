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

import { GET, PUT } from './route'

type QueryResult = { data: unknown; error: unknown }

function terminal(result: QueryResult) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {}
  const chain = () => query
  for (const method of ['select', 'eq', 'update']) {
    query[method] = vi.fn(chain)
  }
  query.single = vi.fn(() => Promise.resolve(result))
  query.then = vi.fn((onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected))
  return query
}

const params = { params: Promise.resolve({ id: 'review-1' }) }

function putRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/chat-eval/axial-codes/reviews/review-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('axial code review detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-25T10:00:00.000Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(new NextRequest('http://localhost/api/admin/chat-eval/axial-codes/reviews/review-1'), params)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing review and a generic error otherwise', async () => {
    mocks.from.mockReturnValueOnce(terminal({ data: null, error: { code: 'PGRST116', message: '0 rows' } }))
    const missing = await GET(new NextRequest('http://localhost/reviews/review-1'), params)
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({ error: 'Review not found' })

    mocks.from.mockReturnValueOnce(terminal({ data: null, error: { code: 'XX000', message: 'db down' } }))
    const failed = await GET(new NextRequest('http://localhost/reviews/review-1'), params)
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({ error: 'Failed to fetch review' })
  })

  it('returns the review row', async () => {
    mocks.from.mockReturnValue(terminal({ data: { id: 'review-1', status: 'pending' }, error: null }))

    const response = await GET(new NextRequest('http://localhost/reviews/review-1'), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ review: { id: 'review-1', status: 'pending' } })
    expect(mocks.from).toHaveBeenCalledWith('axial_code_reviews')
  })

  it('rejects an unknown status and approval without a final code', async () => {
    const unknown = await PUT(putRequest({ status: 'complete', final_code: 'Code' }), params)
    expect(unknown.status).toBe(400)
    await expect(unknown.json()).resolves.toEqual({
      error: 'Valid status is required (pending, approved, rejected, modified)',
    })

    const approved = await PUT(putRequest({ status: 'approved' }), params)
    expect(approved.status).toBe(400)
    await expect(approved.json()).resolves.toEqual({ error: 'final_code is required when approving or modifying' })

    const modified = await PUT(putRequest({ status: 'modified', final_code: '' }), params)
    expect(modified.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stamps the reviewer and marks the generation reviewed when no sibling is pending', async () => {
    const updated = terminal({
      data: { id: 'review-1', generation_id: 'gen-1', status: 'rejected' },
      error: null,
    })
    const siblings = terminal({
      data: [{ status: 'rejected' }, { status: 'approved' }],
      error: null,
    })
    const generation = terminal({ data: null, error: null })
    const reviewQueries = [updated, siblings]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return reviewQueries.shift()
      if (table === 'axial_code_generations') return generation
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await PUT(putRequest({
      status: 'rejected',
      final_description: '',
    }), params)

    expect(response.status).toBe(200)
    expect(updated.update).toHaveBeenCalledWith({
      status: 'rejected',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-09-25T10:00:00.000Z',
      final_description: '',
    })
    expect(siblings.eq).toHaveBeenCalledWith('generation_id', 'gen-1')
    expect(generation.update).toHaveBeenCalledWith({ status: 'reviewed' })
    expect(generation.eq).toHaveBeenCalledWith('id', 'gen-1')
  })

  it('keeps a pending generation pending and omits an undefined description', async () => {
    const updated = terminal({
      data: { id: 'review-1', generation_id: 'gen-1', status: 'approved' },
      error: null,
    })
    const siblings = terminal({ data: [{ status: 'pending' }, { status: 'approved' }], error: null })
    const reviewQueries = [updated, siblings]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_reviews') return reviewQueries.shift()
      throw new Error(`Unexpected table ${table}`)
    })

    const response = await PUT(putRequest({ status: 'approved', final_code: 'Billing delay' }), params)

    expect(response.status).toBe(200)
    expect(updated.update).toHaveBeenCalledWith({
      status: 'approved',
      reviewed_by: 'admin-1',
      reviewed_at: '2026-09-25T10:00:00.000Z',
      final_code: 'Billing delay',
    })
    expect(mocks.from).not.toHaveBeenCalledWith('axial_code_generations')
  })

  it('returns 404 when the update matches nothing and hides other update errors', async () => {
    mocks.from.mockReturnValueOnce(terminal({ data: null, error: { code: 'PGRST116', message: '0 rows' } }))
    const missing = await PUT(putRequest({ status: 'pending' }), params)
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({ error: 'Review not found' })

    mocks.from.mockReturnValueOnce(terminal({ data: null, error: { code: 'XX000', message: 'write failed' } }))
    const failed = await PUT(putRequest({ status: 'pending' }), params)
    expect(failed.status).toBe(500)
    await expect(failed.json()).resolves.toEqual({ error: 'Failed to update review' })
  })

  it('returns a generic error for invalid JSON', async () => {
    const response = await PUT(putRequest('{'), params)
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Internal server error' })
  })
})
