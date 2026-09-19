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

function jsonRequest(url: string) {
  return new NextRequest(url)
}

function thenableQuery(result: { data?: unknown; error?: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}

describe('GET /api/admin/time-entries/active', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(jsonRequest('http://localhost/api/admin/time-entries/active'))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns the current user running timers and optionally filters by project', async () => {
    const query = thenableQuery({ data: [{ id: 'running-1' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(jsonRequest('http://localhost/api/admin/time-entries/active?project_id=proj-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ entries: [{ id: 'running-1' }] })
    expect(query.eq).toHaveBeenCalledWith('is_running', true)
    expect(query.eq).toHaveBeenCalledWith('created_by', 'admin-1')
    expect(query.eq).toHaveBeenCalledWith('client_project_id', 'proj-1')
  })

  it('does not apply a project filter when project_id is omitted', async () => {
    const query = thenableQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(jsonRequest('http://localhost/api/admin/time-entries/active'))

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('is_running', true)
    expect(query.eq).toHaveBeenCalledWith('created_by', 'admin-1')
    expect(query.eq).not.toHaveBeenCalledWith('client_project_id', expect.anything())
  })
})
