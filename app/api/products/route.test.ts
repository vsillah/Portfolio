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

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('defaults to active products only', async () => {
    const query = thenableQuery({ data: [{ id: 1, title: 'Ebook' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(jsonRequest('http://localhost/api/products'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([{ id: 1, title: 'Ebook' }])
    expect(mocks.from).toHaveBeenCalledWith('products')
    expect(query.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('skips the active filter when active=false', async () => {
    const query = thenableQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    await GET(jsonRequest('http://localhost/api/products?active=false&type=ebook'))

    expect(query.eq).toHaveBeenCalledWith('type', 'ebook')
    expect(query.eq).not.toHaveBeenCalledWith('is_active', true)
  })

  it('returns an empty list when the products table is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    }))

    const response = await GET(jsonRequest('http://localhost/api/products'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })
})

describe('POST /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(jsonRequest('http://localhost/api/products', { title: 'X', type: 'ebook' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires title and type', async () => {
    const response = await POST(jsonRequest('http://localhost/api/products', { title: 'X' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Title and type are required' })
  })

  it('rejects an unknown product type', async () => {
    const response = await POST(jsonRequest('http://localhost/api/products', {
      title: 'Widget',
      type: 'not-a-type',
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid product type' })
  })

  it('inserts an admin-created product', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 9, title: 'Curriculum', type: 'training' },
      error: null,
    })
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single }),
    })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(jsonRequest('http://localhost/api/products', {
      title: 'Curriculum',
      type: 'training',
      price: '49.00',
    }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: 9, title: 'Curriculum', type: 'training' },
    })
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({
      title: 'Curriculum',
      type: 'training',
      price: 49,
      created_by: 'admin-user',
      is_active: true,
      display_order: 0,
    })])
  })
})
