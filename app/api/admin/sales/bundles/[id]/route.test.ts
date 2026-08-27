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

import { DELETE, PUT } from './route'

function makeRequest(method: string, body?: Record<string, unknown>, id = 'bundle-1') {
  return new NextRequest(`http://localhost/api/admin/sales/bundles/${id}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

function params(id = 'bundle-1') {
  return { params: { id } }
}

function chain(result: { data?: unknown; error?: unknown; count?: number | null } = { data: null, error: null }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.update = vi.fn(self)
  api.eq = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: { data?: unknown; error?: unknown; count?: number | null }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

describe('/api/admin/sales/bundles/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before mutating a bundle', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const putRes = await PUT(makeRequest('PUT', { name: 'Updated' }), params())
    const delRes = await DELETE(makeRequest('DELETE'), params())

    expect(putRes.status).toBe(401)
    expect(delRes.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not write pricing_page_segments for custom bundles', async () => {
    const existing = chain({ data: { bundle_type: 'custom' }, error: null })
    const updated = { id: 'bundle-1', name: 'Custom Offer', bundle_type: 'custom' }
    const update = chain({ data: updated, error: null })
    let calls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
      calls += 1
      return calls === 1 ? existing : update
    })

    const response = await PUT(
      makeRequest('PUT', {
        name: 'Custom Offer',
        pricing_page_segments: ['smb'],
        tagline: 'Internal only',
      }),
      params(),
    )

    expect(response.status).toBe(200)
    expect(update.update).toHaveBeenCalledWith({
      name: 'Custom Offer',
      tagline: 'Internal only',
    })
    expect(update.update.mock.calls[0][0]).not.toHaveProperty('pricing_page_segments')
  })

  it('soft-deletes bundles and warns when forks still reference them', async () => {
    const forkCount = chain({ data: null, error: null, count: 2 })
    const deactivate = chain({ data: null, error: null })
    let calls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'offer_bundles') throw new Error(`Unexpected table: ${table}`)
      calls += 1
      return calls === 1 ? forkCount : deactivate
    })

    const response = await DELETE(makeRequest('DELETE'), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Bundle deactivated. Note: 2 derived bundles still reference this bundle.',
    })
    expect(forkCount.eq).toHaveBeenCalledWith('parent_bundle_id', 'bundle-1')
    expect(deactivate.update).toHaveBeenCalledWith({ is_active: false })
    expect(deactivate.eq).toHaveBeenCalledWith('id', 'bundle-1')
  })
})
