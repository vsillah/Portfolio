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

function jsonRequest(url: string, body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function thenableQuery(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.update.mockReturnValue(query)
  return query
}

describe('/api/admin/time-entries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth for GET and POST', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getResponse = await GET(jsonRequest('http://localhost/api/admin/time-entries?project_id=proj-1'))
    const postResponse = await POST(jsonRequest('http://localhost/api/admin/time-entries', {
      client_project_id: 'proj-1',
      target_type: 'task',
      target_id: 'task-1',
    }))

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires project_id on GET', async () => {
    const response = await GET(jsonRequest('http://localhost/api/admin/time-entries'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'project_id is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists entries for a project and optional target filters', async () => {
    const query = thenableQuery({ data: [{ id: 'entry-1' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(jsonRequest('http://localhost/api/admin/time-entries?project_id=proj-1&target_type=task&target_id=task-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ entries: [{ id: 'entry-1' }] })
    expect(query.eq).toHaveBeenCalledWith('client_project_id', 'proj-1')
    expect(query.eq).toHaveBeenCalledWith('target_type', 'task')
    expect(query.eq).toHaveBeenCalledWith('target_id', 'task-1')
  })

  it('requires client_project_id, target_type, and target_id on POST', async () => {
    const response = await POST(jsonRequest('http://localhost/api/admin/time-entries', {
      client_project_id: 'proj-1',
      target_type: 'task',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'client_project_id, target_type, and target_id are required',
    })
  })

  it('rejects an invalid target_type', async () => {
    const response = await POST(jsonRequest('http://localhost/api/admin/time-entries', {
      client_project_id: 'proj-1',
      target_type: 'meeting',
      target_id: 'm-1',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'target_type must be milestone or task' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a completed manual entry without stopping running timers', async () => {
    const query = thenableQuery({ data: { id: 'entry-2', is_running: false }, error: null })
    mocks.from.mockReturnValue(query)

    const response = await POST(jsonRequest('http://localhost/api/admin/time-entries', {
      client_project_id: 'proj-1',
      target_type: 'milestone',
      target_id: 'ms-1',
      description: 'Kickoff',
      duration_seconds: 120,
    }))

    expect(response.status).toBe(201)
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({
      client_project_id: 'proj-1',
      target_type: 'milestone',
      target_id: 'ms-1',
      description: 'Kickoff',
      created_by: 'admin-1',
      duration_seconds: 120,
      is_running: false,
    }))
    expect(query.update).not.toHaveBeenCalled()
  })

  it('stops running timers for the same user and project before starting a new one', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T10:00:10.000Z'))
    const runningQuery = thenableQuery({
      data: [{ id: 'running-1', started_at: '2026-09-19T10:00:00.000Z' }],
      error: null,
    })
    const insertQuery = thenableQuery({ data: { id: 'entry-3', is_running: true }, error: null })
    mocks.from
      .mockReturnValueOnce(runningQuery)
      .mockReturnValueOnce(runningQuery)
      .mockReturnValueOnce(insertQuery)

    const response = await POST(jsonRequest('http://localhost/api/admin/time-entries', {
      client_project_id: 'proj-1',
      target_type: 'task',
      target_id: 'task-1',
    }))

    expect(response.status).toBe(201)
    expect(runningQuery.eq).toHaveBeenCalledWith('created_by', 'admin-1')
    expect(runningQuery.eq).toHaveBeenCalledWith('is_running', true)
    expect(runningQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      is_running: false,
      duration_seconds: 10,
    }))
    expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      is_running: true,
      started_at: '2026-09-19T10:00:10.000Z',
    }))
    vi.useRealTimers()
  })
})
