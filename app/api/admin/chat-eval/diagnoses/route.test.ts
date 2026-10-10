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

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/chat-eval/diagnoses${query}`)
}

function listBuilder(result: { data: unknown; error: unknown; count: number | null }) {
  const range = vi.fn().mockResolvedValue(result)
  const order = vi.fn(() => ({ range }))
  const chain = {
    eq: vi.fn(),
    order,
  }
  chain.eq.mockReturnValue(chain)
  const select = vi.fn(() => chain)
  return { select, chain, order, range }
}

describe('GET /api/admin/chat-eval/diagnoses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before listing diagnoses', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('pages with the default window and shapes session, category, and recommendation counts', async () => {
    const list = listBuilder({
      data: [
        {
          id: 'diag-1',
          session_id: 'session-1',
          root_cause: 'Prompt drift',
          error_type: 'hallucination',
          confidence_score: 0.8,
          status: 'pending',
          recommendations: [{ id: 'a' }, { id: 'b' }],
          diagnosed_at: '2026-09-01T00:00:00.000Z',
          reviewed_at: null,
          applied_at: null,
          model_used: 'gpt-test',
          chat_sessions: { session_id: 'session-1', visitor_name: 'Ada', visitor_email: 'ada@example.com' },
          chat_evaluations: {
            id: 'eval-1',
            notes: 'missed the offer',
            evaluation_categories: { name: 'Accuracy', color: '#f00' },
          },
        },
        {
          id: 'diag-2',
          session_id: 'session-2',
          root_cause: 'Empty',
          error_type: 'other',
          confidence_score: 0.1,
          status: 'reviewed',
          recommendations: null,
          diagnosed_at: '2026-09-02T00:00:00.000Z',
          reviewed_at: '2026-09-03T00:00:00.000Z',
          applied_at: null,
          model_used: null,
          chat_sessions: null,
          chat_evaluations: { id: 'eval-2', notes: null, evaluation_categories: null },
        },
      ],
      error: null,
      count: 45,
    })
    mocks.from.mockReturnValue(list)

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(list.select).toHaveBeenCalledWith(expect.stringContaining('error_diagnoses_session_id_fkey'), { count: 'exact' })
    expect(String(list.select.mock.calls[0][0])).toContain('error_diagnoses_evaluation_id_fkey')
    expect(list.chain.eq).not.toHaveBeenCalled()
    expect(list.order).toHaveBeenCalledWith('diagnosed_at', { ascending: false })
    expect(list.range).toHaveBeenCalledWith(0, 19)
    expect(body.diagnoses[0]).toMatchObject({
      id: 'diag-1',
      recommendations_count: 2,
      session: { session_id: 'session-1', visitor_name: 'Ada', visitor_email: 'ada@example.com' },
      evaluation: { id: 'eval-1', notes: 'missed the offer', category: { name: 'Accuracy', color: '#f00' } },
    })
    expect(body.diagnoses[1]).toMatchObject({
      recommendations_count: 0,
      session: null,
      evaluation: { id: 'eval-2', notes: null, category: null },
    })
    expect(body.pagination).toEqual({ page: 1, limit: 20, total: 45, totalPages: 3 })
  })

  it('applies status and error_type filters, including a literal all status', async () => {
    const list = listBuilder({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(list)

    const response = await GET(request('?status=all&error_type=hallucination&page=2&limit=10'))

    expect(response.status).toBe(200)
    expect(list.chain.eq).toHaveBeenCalledWith('status', 'all')
    expect(list.chain.eq).toHaveBeenCalledWith('error_type', 'hallucination')
    expect(list.range).toHaveBeenCalledWith(10, 19)
    expect(await response.json()).toMatchObject({
      diagnoses: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    })
  })

  it('returns a generic error when the list query fails', async () => {
    const list = listBuilder({ data: null, error: { message: 'column missing' }, count: null })
    mocks.from.mockReturnValue(list)

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch diagnoses' })
  })
})
