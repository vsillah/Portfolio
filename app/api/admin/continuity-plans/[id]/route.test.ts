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

function makeRequest(
  method: string,
  body?: Record<string, unknown>,
  id = 'plan-1',
) {
  return new NextRequest(`http://localhost/api/admin/continuity-plans/${id}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function params(id = 'plan-1') {
  return { params: { id } }
}

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.update = vi.fn(self)
  api.eq = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: { data?: unknown; error?: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('/api/admin/continuity-plans/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth for GET, PUT, and DELETE', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getRes = await GET(makeRequest('GET'), params())
    const putRes = await PUT(makeRequest('PUT', { name: 'Updated' }), params())
    const delRes = await DELETE(makeRequest('DELETE'), params())

    expect(getRes.status).toBe(401)
    expect(putRes.status).toBe(401)
    expect(delRes.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the plan is missing', async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { code: 'PGRST116' } }))

    const response = await GET(makeRequest('GET'), params('missing'))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Plan not found' })
  })

  it('trims name and description on update', async () => {
    const updated = { id: 'plan-1', name: 'Trimmed', description: 'Notes' }
    const query = chain({ data: updated, error: null })
    mocks.from.mockReturnValue(query)

    const response = await PUT(
      makeRequest('PUT', { name: '  Trimmed  ', description: '  Notes  ' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(updated)
    expect(query.update).toHaveBeenCalledWith({
      name: 'Trimmed',
      description: 'Notes',
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'plan-1')
  })

  it('soft-deletes by deactivating instead of removing the row', async () => {
    const deactivated = { id: 'plan-1', is_active: false }
    const query = chain({ data: deactivated, error: null })
    mocks.from.mockReturnValue(query)

    const response = await DELETE(makeRequest('DELETE'), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: deactivated })
    expect(query.update).toHaveBeenCalledWith({ is_active: false })
    expect(query.eq).toHaveBeenCalledWith('id', 'plan-1')
  })
})
