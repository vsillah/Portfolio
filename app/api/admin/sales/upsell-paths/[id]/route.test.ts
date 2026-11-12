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

import { DELETE, GET, PUT } from './route'

type QueryResult = { data: unknown; error: unknown }

function thenableQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  return query
}

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/sales/upsell-paths/path-1', {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const ctx = { params: { id: 'path-1' } }

describe('/api/admin/sales/upsell-paths/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication on GET, PUT, and DELETE', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    for (const handler of [GET, PUT, DELETE]) {
      const response = await handler(makeRequest('GET'), ctx)
      expect(response.status).toBe(401)
    }
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the path is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { code: 'PGRST116' } }))

    const response = await GET(makeRequest('GET'), ctx)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Upsell path not found' })
  })

  it('rejects an empty PUT and drops unknown fields from the update allowlist', async () => {
    const empty = await PUT(makeRequest('PUT', { unexpected: true }), ctx)
    expect(empty.status).toBe(400)
    await expect(empty.json()).resolves.toEqual({ error: 'No fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()

    const query = thenableQuery({ data: { id: 'path-1', notes: 'ok' }, error: null })
    mocks.from.mockReturnValue(query)

    const response = await PUT(
      makeRequest('PUT', { notes: 'ok', id: 'forged', created_at: 'nope', unexpected: true }),
      ctx,
    )

    expect(response.status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({ notes: 'ok' })
    expect(query.eq).toHaveBeenCalledWith('id', 'path-1')
  })

  it('soft-deletes by deactivating rather than removing the row', async () => {
    const query = thenableQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)

    const response = await DELETE(makeRequest('DELETE'), ctx)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Upsell path deactivated.',
    })
    expect(query.update).toHaveBeenCalledWith({ is_active: false })
    expect(query.eq).toHaveBeenCalledWith('id', 'path-1')
  })
})
