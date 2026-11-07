import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { PUT } from './route'

const params = { params: Promise.resolve({ id: 'diag-1' }) }

function request(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/admin/chat-eval/diagnoses/diag-1/approve', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.single.mockResolvedValue(result)
  return query
}

describe('PUT /api/admin/chat-eval/diagnoses/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T10:00:00.000Z'))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PUT(request(), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the diagnosis is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'not found' } }))

    const response = await PUT(request(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Diagnosis not found' })
  })

  it('approves every recommendation when recommendation_ids is omitted', async () => {
    const fetchQuery = thenableQuery({
      data: {
        status: 'pending',
        recommendations: [
          { id: 'rec-1', text: 'Tighten the prompt' },
          { id: 'rec-2', text: 'Add a guardrail' },
        ],
      },
      error: null,
    })
    const updateQuery = thenableQuery({
      data: { id: 'diag-1', status: 'approved' },
      error: null,
    })
    mocks.from
      .mockReturnValueOnce(fetchQuery)
      .mockReturnValueOnce(updateQuery)

    const response = await PUT(request({}), params)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe('Diagnosis approved successfully')
    expect(updateQuery.update).toHaveBeenCalledWith({
      status: 'approved',
      recommendations: [
        { id: 'rec-1', text: 'Tighten the prompt', approved: true },
        { id: 'rec-2', text: 'Add a guardrail', approved: true },
      ],
      reviewed_by: 'admin-1',
      reviewed_at: '2026-09-21T10:00:00.000Z',
    })
  })

  it('approves only the listed recommendation ids', async () => {
    const fetchQuery = thenableQuery({
      data: {
        status: 'pending',
        recommendations: [
          { id: 'rec-1', text: 'Tighten the prompt' },
          { id: 'rec-2', text: 'Add a guardrail' },
        ],
      },
      error: null,
    })
    const updateQuery = thenableQuery({
      data: { id: 'diag-1', status: 'approved' },
      error: null,
    })
    mocks.from
      .mockReturnValueOnce(fetchQuery)
      .mockReturnValueOnce(updateQuery)

    await PUT(request({ recommendation_ids: ['rec-2'] }), params)

    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      recommendations: [
        { id: 'rec-1', text: 'Tighten the prompt' },
        { id: 'rec-2', text: 'Add a guardrail', approved: true },
      ],
    }))
  })
})
