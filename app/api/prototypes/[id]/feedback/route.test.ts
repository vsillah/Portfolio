import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { GET, POST } from './route'

const PROTOTYPE_ID = 'proto-1'

function request(method: 'GET' | 'POST', body?: unknown) {
  return new NextRequest(`http://localhost/api/prototypes/${PROTOTYPE_ID}/feedback`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function params(id = PROTOTYPE_ID) {
  return { params: { id } }
}

function chain(result: { data?: unknown; error?: unknown } = {}) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = vi.fn(self)
  query.insert = vi.fn(self)
  query.eq = vi.fn(self)
  query.in = vi.fn(self)
  query.order = vi.fn(self)
  query.single = vi.fn(async () => ({
    data: result.data ?? null,
    error: result.error ?? null,
  }))
  query.then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(
      onFulfilled,
      onRejected,
    )
  return query as typeof query & { insert: ReturnType<typeof vi.fn> }
}

describe('/api/prototypes/[id]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
  })

  it('lists feedback without requiring a session', async () => {
    const rows = [{ id: 'fb-1', feedback_text: 'Useful', rating: 5, user_id: 'user-1', created_at: '2026-09-01' }]
    const feedback = chain({ data: rows })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'prototype_feedback') throw new Error(`Unexpected table: ${table}`)
      return feedback
    })

    const response = await GET(request('GET'), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(rows)
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
    expect(feedback.eq).toHaveBeenCalledWith('prototype_id', PROTOTYPE_ID)
  })

  it('requires authentication and feedback text before writing', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null)
    const unauth = await POST(request('POST', { feedback_text: 'Hello' }), params())
    expect(unauth.status).toBe(401)
    await expect(unauth.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    const missing = await POST(request('POST', { rating: 5 }), params())
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'Feedback text is required' })
  })

  it('returns 404 when the prototype is missing', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'app_prototypes') return chain({ data: null, error: { message: 'missing' } })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request('POST', { feedback_text: 'Hello' }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Prototype not found' })
  })

  it('blocks pilot feedback unless the user is enrolled', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'app_prototypes') return chain({ data: { production_stage: 'Pilot' } })
      if (table === 'prototype_enrollments') return chain({ data: null })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request('POST', { feedback_text: 'Hello' }), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'You must be enrolled in the pilot program to submit feedback',
    })
  })

  it('allows production feedback without enrollment and stores a trimmed note', async () => {
    const inserted = { id: 'fb-2', feedback_text: 'Great build', rating: null }
    const insertChain = chain({ data: inserted })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'app_prototypes') return chain({ data: { production_stage: 'Production' } })
      if (table === 'prototype_feedback') return insertChain
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      request('POST', { feedback_text: '  Great build  ', rating: undefined }),
      params(),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, data: inserted })
    expect(insertChain.insert).toHaveBeenCalledWith([
      {
        prototype_id: PROTOTYPE_ID,
        user_id: 'user-1',
        feedback_text: 'Great build',
        rating: null,
      },
    ])
  })

  it('accepts pilot feedback when the user has a Pilot enrollment', async () => {
    const inserted = { id: 'fb-3' }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'app_prototypes') return chain({ data: { production_stage: 'Pilot' } })
      if (table === 'prototype_enrollments') return chain({ data: { enrollment_type: 'Pilot' } })
      if (table === 'prototype_feedback') return chain({ data: inserted })
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(request('POST', { feedback_text: 'Pilot note', rating: 4 }), params())

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, data: inserted })
  })
})
