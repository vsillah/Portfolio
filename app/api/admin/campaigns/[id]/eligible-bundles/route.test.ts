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

import { DELETE, GET, POST } from './route'

function makeRequest(
  method: string,
  {
    body,
    query = '',
    id = 'camp-1',
  }: { body?: Record<string, unknown>; query?: string; id?: string } = {},
) {
  return new NextRequest(
    `http://localhost/api/admin/campaigns/${id}/eligible-bundles${query}`,
    {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  )
}

function params(id = 'camp-1') {
  return { params: { id } }
}

function chain(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.insert = vi.fn(self)
  api.delete = vi.fn(self)
  api.eq = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: { data?: unknown; error?: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('/api/admin/campaigns/[id]/eligible-bundles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth for GET, POST, and DELETE', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getRes = await GET(makeRequest('GET'), params())
    const postRes = await POST(makeRequest('POST', { body: { bundle_id: 'b1' } }), params())
    const delRes = await DELETE(
      makeRequest('DELETE', { query: '?bundle_id=b1' }),
      params(),
    )

    expect(getRes.status).toBe(401)
    expect(postRes.status).toBe(401)
    expect(delRes.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists eligible bundles for the campaign', async () => {
    const rows = [{ id: 'eb-1', bundle_id: 'bundle-1' }]
    const query = chain({ data: rows, error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest('GET'), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: rows })
    expect(mocks.from).toHaveBeenCalledWith('campaign_eligible_bundles')
    expect(query.eq).toHaveBeenCalledWith('campaign_id', 'camp-1')
  })

  it('requires bundle_id when adding eligibility', async () => {
    const response = await POST(makeRequest('POST', { body: {} }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'bundle_id is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 409 when the bundle is already eligible', async () => {
    const query = chain({ data: null, error: { code: '23505', message: 'duplicate' } })
    mocks.from.mockReturnValue(query)

    const response = await POST(
      makeRequest('POST', { body: { bundle_id: 'bundle-1', override_min_amount: 0 } }),
      params(),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'This bundle is already eligible for this campaign',
    })
    expect(query.insert).toHaveBeenCalledWith({
      campaign_id: 'camp-1',
      bundle_id: 'bundle-1',
      override_min_amount: null,
    })
  })

  it('adds an eligible bundle', async () => {
    const created = { id: 'eb-1', campaign_id: 'camp-1', bundle_id: 'bundle-1' }
    const query = chain({ data: created, error: null })
    mocks.from.mockReturnValue(query)

    const response = await POST(
      makeRequest('POST', { body: { bundle_id: 'bundle-1', override_min_amount: 250 } }),
      params(),
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ data: created })
    expect(query.insert).toHaveBeenCalledWith({
      campaign_id: 'camp-1',
      bundle_id: 'bundle-1',
      override_min_amount: 250,
    })
  })

  it('requires bundle_id on DELETE and scopes removal to the campaign', async () => {
    const missing = await DELETE(makeRequest('DELETE'), params())
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({
      error: 'bundle_id query param is required',
    })

    const query = chain({ data: null, error: null })
    mocks.from.mockReturnValue(query)
    const response = await DELETE(
      makeRequest('DELETE', { query: '?bundle_id=bundle-1' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(query.eq).toHaveBeenNthCalledWith(1, 'campaign_id', 'camp-1')
    expect(query.eq).toHaveBeenNthCalledWith(2, 'bundle_id', 'bundle-1')
  })
})
