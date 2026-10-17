import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  generationSingle: vi.fn(),
  reviewsOrder: vi.fn(),
  updateSingle: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, PATCH } from './route'

const params = { params: Promise.resolve({ id: 'gen-1' }) }

function request(method: string, body?: string) {
  return new NextRequest('http://localhost/api/admin/chat-eval/axial-codes/generations/gen-1', {
    method,
    headers: { 'content-type': 'application/json' },
    body,
  })
}

describe('axial code generation detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.generationSingle.mockResolvedValue({
      data: {
        id: 'gen-1',
        generated_axial_codes: [{ code: 'pricing' }],
        source_session_ids: ['s1'],
        source_open_codes: ['price'],
        model_used: 'claude-sonnet-4-20250514',
        prompt_version: 'v1',
        status: 'pending',
        created_at: '2026-09-01T00:00:00.000Z',
        created_by: 'admin-user',
      },
      error: null,
    })
    mocks.reviewsOrder.mockResolvedValue({
      data: [
        {
          id: 'rev-pending',
          original_code: 'pricing',
          original_description: 'Price missing',
          final_code: null,
          final_description: null,
          status: 'pending',
          mapped_open_codes: ['price'],
          mapped_session_ids: ['s1'],
          category_id: null,
          evaluation_categories: null,
          reviewed_at: null,
        },
        {
          id: 'rev-modified',
          original_code: 'tone',
          original_description: 'Tone',
          final_code: 'tone_v2',
          final_description: 'Sharper tone',
          status: 'modified',
          mapped_open_codes: [],
          mapped_session_ids: [],
          category_id: 'cat-1',
          evaluation_categories: { id: 'cat-1', name: 'Tone', color: '#111111' },
          reviewed_at: '2026-09-02T00:00:00.000Z',
        },
        {
          id: 'rev-approved',
          original_code: 'cta',
          original_description: 'CTA',
          final_code: 'cta',
          final_description: 'CTA',
          status: 'approved',
          mapped_open_codes: [],
          mapped_session_ids: [],
          category_id: null,
          evaluation_categories: null,
          reviewed_at: null,
        },
        {
          id: 'rev-rejected',
          original_code: 'noise',
          original_description: 'Noise',
          final_code: null,
          final_description: null,
          status: 'rejected',
          mapped_open_codes: [],
          mapped_session_ids: [],
          category_id: null,
          evaluation_categories: null,
          reviewed_at: null,
        },
      ],
      error: null,
    })
    mocks.updateSingle.mockResolvedValue({
      data: { id: 'gen-1', status: 'completed' },
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'axial_code_generations') {
        return {
          select: () => ({
            eq: () => ({ single: mocks.generationSingle }),
          }),
          update: (payload: unknown) => ({
            eq: () => ({
              select: () => ({ single: () => mocks.updateSingle(payload) }),
            }),
          }),
        }
      }
      if (table === 'axial_code_reviews') {
        return {
          select: () => ({
            eq: () => ({
              order: mocks.reviewsOrder,
            }),
          }),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
  })

  it('rejects non-admins before reading a generation', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request('GET'), params)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('counts modified reviews as approved and nests a category only when present', async () => {
    const response = await GET(request('GET'), params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.reviewsOrder).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(body.generation).toEqual({
      id: 'gen-1',
      generated_axial_codes: [{ code: 'pricing' }],
      source_session_ids: ['s1'],
      source_open_codes: ['price'],
      model_used: 'claude-sonnet-4-20250514',
      prompt_version: 'v1',
      status: 'pending',
      created_at: '2026-09-01T00:00:00.000Z',
    })
    expect(body.generation.created_by).toBeUndefined()
    expect(body.reviews[0].category).toBeNull()
    expect(body.reviews[1].category).toEqual({ id: 'cat-1', name: 'Tone', color: '#111111' })
    expect(body.review_stats).toEqual({
      total: 4,
      pending: 1,
      approved: 2,
      rejected: 1,
    })
  })

  it('returns an empty review list when the review query has no rows', async () => {
    mocks.reviewsOrder.mockResolvedValue({ data: null, error: null })

    const response = await GET(request('GET'), params)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(
      expect.objectContaining({
        reviews: [],
        review_stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
      })
    )
  })

  it('maps a missing generation to 404 and other read failures to a generic 500', async () => {
    mocks.generationSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'row missing' },
    })
    const missing = await GET(request('GET'), params)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Generation not found' })

    mocks.generationSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX000', message: 'db down' },
    })
    const failed = await GET(request('GET'), params)
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to fetch generation' })
  })

  it('returns a generic error when reviews cannot be loaded', async () => {
    mocks.reviewsOrder.mockResolvedValue({ data: null, error: { message: 'reviews down' } })

    const response = await GET(request('GET'), params)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch reviews' })
  })

  it('accepts only pending, reviewed, and completed generation statuses', async () => {
    const invalid = await PATCH(request('PATCH', JSON.stringify({ status: 'approved' })), params)
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({
      error: 'Valid status is required (pending, reviewed, completed)',
    })
    expect(mocks.updateSingle).not.toHaveBeenCalled()

    const updated = await PATCH(request('PATCH', JSON.stringify({ status: 'completed', created_by: 'other' })), params)
    expect(updated.status).toBe(200)
    expect(await updated.json()).toEqual({ generation: { id: 'gen-1', status: 'completed' } })
    expect(mocks.updateSingle).toHaveBeenCalledWith({ status: 'completed' })
  })

  it('maps a missing update to 404 and other update failures to a generic 500', async () => {
    mocks.updateSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'gone' },
    })
    const missing = await PATCH(request('PATCH', JSON.stringify({ status: 'reviewed' })), params)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Generation not found' })

    mocks.updateSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX000', message: 'write failed' },
    })
    const failed = await PATCH(request('PATCH', JSON.stringify({ status: 'pending' })), params)
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to update generation' })
  })

  it('turns invalid JSON into an internal error after admin auth succeeds', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)
    const unauthorized = await PATCH(request('PATCH', 'not-json'), params)
    expect(unauthorized.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.isAuthError.mockReturnValue(false)
    const invalid = await PATCH(request('PATCH', 'not-json'), params)
    expect(invalid.status).toBe(500)
    expect(await invalid.json()).toEqual({ error: 'Internal server error' })
  })
})
