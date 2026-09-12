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

function request(method: 'GET' | 'PUT', body?: unknown) {
  return new NextRequest('http://localhost/api/admin/site-settings', {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/site-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated GET and PUT before touching site_settings', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getResponse = await GET(request('GET'))
    expect(getResponse.status).toBe(401)
    const putResponse = await PUT(request('PUT', { key: 'business_owner_email', value: 'x@y.com' }))
    expect(putResponse.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists settings ordered by key', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ key: 'business_owner_email', value: 'ops@example.com' }],
      error: null,
    })
    const select = vi.fn().mockReturnValue({ order })
    mocks.from.mockReturnValue({ select })

    const response = await GET(request('GET'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      settings: [{ key: 'business_owner_email', value: 'ops@example.com' }],
    })
    expect(mocks.from).toHaveBeenCalledWith('site_settings')
    expect(order).toHaveBeenCalledWith('key')
  })

  it('requires key and value on PUT', async () => {
    const missingValue = await PUT(request('PUT', { key: 'business_owner_email' }))
    expect(missingValue.status).toBe(400)
    expect(await missingValue.json()).toEqual({ error: 'key and value are required' })

    const missingKey = await PUT(request('PUT', { value: 'x' }))
    expect(missingKey.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('upserts a setting on the key conflict target', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { key: 'business_owner_email', value: 'ops@example.com' },
      error: null,
    })
    const select = vi.fn().mockReturnValue({ single })
    const upsert = vi.fn().mockReturnValue({ select })
    mocks.from.mockReturnValue({ upsert })

    const response = await PUT(
      request('PUT', { key: 'business_owner_email', value: 'ops@example.com' }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      setting: { key: 'business_owner_email', value: 'ops@example.com' },
    })
    expect(upsert).toHaveBeenCalledWith(
      { key: 'business_owner_email', value: 'ops@example.com' },
      { onConflict: 'key' },
    )
  })
})
