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

function thenableQuery(result: { data: unknown; error: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  return query
}

describe('GET /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('defaults to active services only', async () => {
    const query = thenableQuery({ data: [{ id: 'svc-1', title: 'Workshop' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(jsonRequest('http://localhost/api/services'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([{ id: 'svc-1', title: 'Workshop' }])
    expect(mocks.from).toHaveBeenCalledWith('services')
    expect(query.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('skips the active filter when active=false', async () => {
    // active=false → no restriction on is_active
    const query = thenableQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    await GET(jsonRequest('http://localhost/api/services?active=false&type=consulting&delivery=virtual&featured=true'))

    expect(query.eq).toHaveBeenCalledWith('service_type', 'consulting')
    expect(query.eq).toHaveBeenCalledWith('delivery_method', 'virtual')
    expect(query.eq).toHaveBeenCalledWith('is_featured', true)
    expect(query.eq).not.toHaveBeenCalledWith('is_active', true)
  })

  it('returns an empty list when the services table is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    }))

    const response = await GET(jsonRequest('http://localhost/api/services'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })
})

describe('POST /api/services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(jsonRequest('http://localhost/api/services', {
      title: 'Workshop',
      service_type: 'workshop',
    }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires title and service type', async () => {
    const response = await POST(jsonRequest('http://localhost/api/services', { title: 'Workshop' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Title and service type are required',
    })
  })

  it('rejects an unknown service type', async () => {
    const response = await POST(jsonRequest('http://localhost/api/services', {
      title: 'Workshop',
      service_type: 'not-a-type',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Invalid service type'),
    })
  })

  it('rejects an unknown delivery method', async () => {
    const response = await POST(jsonRequest('http://localhost/api/services', {
      title: 'Workshop',
      service_type: 'workshop',
      delivery_method: 'telepathy',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Invalid delivery method'),
    })
  })

  it('inserts an admin-created service with virtual delivery by default', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'svc-9', title: 'Coaching', service_type: 'coaching' },
      error: null,
    })
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(jsonRequest('http://localhost/api/services', {
      title: 'Coaching',
      service_type: 'coaching',
      price: '1500',
    }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: 'svc-9', title: 'Coaching', service_type: 'coaching' },
    })
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({
      title: 'Coaching',
      service_type: 'coaching',
      delivery_method: 'virtual',
      price: 1500,
      created_by: 'admin-user',
      is_active: true,
      display_order: 0,
    })])
  })
})
