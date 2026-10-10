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

import { DELETE, PATCH } from './route'

function jsonRequest(method: 'PATCH' | 'DELETE') {
  return new NextRequest('http://localhost/api/admin/time-entries/entry-1', { method })
}

function thenableQuery(result: { data?: unknown; error?: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  return query
}

describe('/api/admin/time-entries/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth for PATCH and DELETE', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const patchResponse = await PATCH(jsonRequest('PATCH'), { params: Promise.resolve({ id: 'entry-1' }) })
    const deleteResponse = await DELETE(jsonRequest('DELETE'), { params: Promise.resolve({ id: 'entry-1' }) })

    expect(patchResponse.status).toBe(401)
    expect(deleteResponse.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the time entry is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: null }))

    const response = await PATCH(jsonRequest('PATCH'), { params: Promise.resolve({ id: 'missing' }) })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Time entry not found' })
  })

  it('rejects stopping a timer that is not running', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: { id: 'entry-1', is_running: false }, error: null }))

    const response = await PATCH(jsonRequest('PATCH'), { params: Promise.resolve({ id: 'entry-1' }) })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Timer is not running' })
  })

  it('stops a running timer and records elapsed seconds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T10:00:10.000Z'))
    const lookup = thenableQuery({
      data: { id: 'entry-1', is_running: true, started_at: '2026-09-19T10:00:00.000Z' },
      error: null,
    })
    const update = thenableQuery({
      data: { id: 'entry-1', is_running: false, duration_seconds: 10 },
      error: null,
    })
    mocks.from.mockReturnValueOnce(lookup).mockReturnValueOnce(update)

    const response = await PATCH(jsonRequest('PATCH'), { params: Promise.resolve({ id: 'entry-1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      entry: { id: 'entry-1', is_running: false, duration_seconds: 10 },
    })
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({
      is_running: false,
      duration_seconds: 10,
      stopped_at: '2026-09-19T10:00:10.000Z',
    }))
    expect(update.eq).toHaveBeenCalledWith('id', 'entry-1')
    vi.useRealTimers()
  })

  it('deletes a time entry by id', async () => {
    const query = thenableQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)

    const response = await DELETE(jsonRequest('DELETE'), { params: Promise.resolve({ id: 'entry-1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'entry-1')
  })
})
