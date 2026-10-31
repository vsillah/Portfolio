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

import { PATCH } from './route'

const params = { params: Promise.resolve({ id: 'task-1' }) }

function jsonRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/dashboard-tasks/task-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function updateQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  query.update.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.select.mockReturnValue(query)
  return query
}

describe('PATCH /api/admin/dashboard-tasks/[id]', () => {
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

    const response = await PATCH(jsonRequest({ status: 'complete' }), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects unknown or missing status values', async () => {
    const missing = await PATCH(jsonRequest({}), params)
    expect(missing.status).toBe(400)

    const invalid = await PATCH(jsonRequest({ status: 'done' }), params)
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({
      error: 'status must be pending, in_progress, or complete',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stamps completed_at when marking a task complete', async () => {
    const row = { id: 'task-1', status: 'complete', completed_at: '2026-09-21T10:00:00.000Z' }
    const query = updateQuery({ data: row, error: null })
    mocks.from.mockReturnValue(query)

    const response = await PATCH(jsonRequest({ status: 'complete' }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ task: row })
    expect(query.update).toHaveBeenCalledWith({
      status: 'complete',
      completed_at: '2026-09-21T10:00:00.000Z',
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'task-1')
  })

  it('clears completed_at when moving a task back to in_progress', async () => {
    const row = { id: 'task-1', status: 'in_progress', completed_at: null }
    const query = updateQuery({ data: row, error: null })
    mocks.from.mockReturnValue(query)

    const response = await PATCH(jsonRequest({ status: 'in_progress' }), params)

    expect(response.status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({
      status: 'in_progress',
      completed_at: null,
    })
  })

  it('returns 404 when the update matches no row', async () => {
    mocks.from.mockReturnValue(updateQuery({ data: null, error: null }))

    const response = await PATCH(jsonRequest({ status: 'pending' }), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Task not found' })
  })

  it('returns a generic 500 when the update fails', async () => {
    mocks.from.mockReturnValue(updateQuery({ data: null, error: { message: 'db down' } }))

    const response = await PATCH(jsonRequest({ status: 'pending' }), params)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to update task' })
  })
})
