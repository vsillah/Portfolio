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

import { GET, PUT } from './route'

function makeRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/store-settings', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.upsert = vi.fn(self)
  api.then = (
    resolve: (value: { data?: unknown; error?: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('/api/admin/store-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth for GET and PUT', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getRes = await GET(makeRequest('GET'))
    const putRes = await PUT(makeRequest('PUT', { social_share_discount: { type: 'fixed', value: 5 } }))

    expect(getRes.status).toBe(401)
    expect(putRes.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps settings rows by key', async () => {
    mocks.from.mockReturnValue(
      chain({
        data: [
          { key: 'social_share_discount', value: { type: 'fixed', value: 5 }, updated_at: '2026-01-01' },
        ],
        error: null,
      }),
    )

    const response = await GET(makeRequest('GET'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      settings: {
        social_share_discount: { type: 'fixed', value: 5 },
      },
    })
  })

  it('upserts a sanitized social share discount and reloads settings', async () => {
    const upsertQuery = chain({ data: null, error: null })
    const reloadQuery = chain({
      data: [{ key: 'social_share_discount', value: { type: 'fixed', value: 5 }, updated_at: 'now' }],
      error: null,
    })
    let calls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'store_settings') throw new Error(`Unexpected table: ${table}`)
      calls += 1
      return calls === 1 ? upsertQuery : reloadQuery
    })

    const response = await PUT(
      makeRequest('PUT', {
        social_share_discount: { type: 'unknown', value: -4 },
      }),
    )

    expect(response.status).toBe(200)
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'social_share_discount',
        value: { type: 'fixed', value: 5 },
      }),
      { onConflict: 'key' },
    )
    await expect(response.json()).resolves.toEqual({
      settings: {
        social_share_discount: { type: 'fixed', value: 5 },
      },
    })
  })

  it('persists a valid percentage discount', async () => {
    const upsertQuery = chain({ data: null, error: null })
    const reloadQuery = chain({
      data: [{ key: 'social_share_discount', value: { type: 'percentage', value: 12 }, updated_at: 'now' }],
      error: null,
    })
    let calls = 0
    mocks.from.mockImplementation(() => {
      calls += 1
      return calls === 1 ? upsertQuery : reloadQuery
    })

    const response = await PUT(
      makeRequest('PUT', {
        social_share_discount: { type: 'percentage', value: 12 },
      }),
    )

    expect(response.status).toBe(200)
    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        value: { type: 'percentage', value: 12 },
      }),
      { onConflict: 'key' },
    )
  })
})
