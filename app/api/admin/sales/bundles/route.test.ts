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
    is: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.in.mockReturnValue(query)
  return query
}

describe('GET /api/admin/sales/bundles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(jsonRequest('http://localhost/api/admin/sales/bundles'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults to active parent bundles only', async () => {
    const main = thenableQuery({ data: [], error: null })
    const rest = thenableQuery({ data: [], error: null })
    let calls = 0
    mocks.from.mockImplementation(() => {
      calls += 1
      return calls === 1 ? main : rest
    })

    const response = await GET(jsonRequest('http://localhost/api/admin/sales/bundles'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ bundles: [] })
    expect(main.eq).toHaveBeenCalledWith('is_active', true)
    expect(main.is).toHaveBeenCalledWith('parent_bundle_id', null)
  })

  it('skips the active and parent filters when requested', async () => {
    // active=false → no restriction on is_active
    const main = thenableQuery({ data: [], error: null })
    const rest = thenableQuery({ data: [], error: null })
    let calls = 0
    mocks.from.mockImplementation(() => {
      calls += 1
      return calls === 1 ? main : rest
    })

    await GET(jsonRequest('http://localhost/api/admin/sales/bundles?active=false&include_children=true'))

    expect(main.eq).not.toHaveBeenCalledWith('is_active', true)
    expect(main.is).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/sales/bundles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(jsonRequest('http://localhost/api/admin/sales/bundles', { name: 'Starter' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a bundle name', async () => {
    const response = await POST(jsonRequest('http://localhost/api/admin/sales/bundles', { bundle_items: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Bundle name is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('creates a standard bundle and stores pricing-page fields', async () => {
    const created = { id: 'bundle-1', name: 'Starter', bundle_type: 'standard' }
    const single = vi.fn().mockResolvedValue({ data: created, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(jsonRequest('http://localhost/api/admin/sales/bundles', {
      name: 'Starter',
      pricing_page_segments: ['smb'],
      pricing_tier_slug: 'starter',
      bundle_items: [{ content_type: 'service', content_id: 'svc-1', override_price: 100, override_perceived_value: 150 }],
    }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ bundle: created })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Starter',
      bundle_type: 'standard',
      created_by: 'admin-1',
      is_active: true,
      total_retail_value: 100,
      total_perceived_value: 150,
      bundle_price: 100,
      pricing_page_segments: ['smb'],
      pricing_tier_slug: 'starter',
    }))
  })

  it('forces custom type for forks and omits pricing-page fields', async () => {
    const created = { id: 'bundle-2', name: 'Custom', bundle_type: 'custom' }
    const single = vi.fn().mockResolvedValue({ data: created, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const insert = vi.fn().mockReturnValue({ select })
    mocks.from.mockReturnValue({ insert })

    const response = await POST(jsonRequest('http://localhost/api/admin/sales/bundles', {
      name: 'Custom',
      parent_bundle_id: 'bundle-1',
      pricing_page_segments: ['smb'],
      pricing_tier_slug: 'should-not-write',
      tagline: 'internal',
    }))

    expect(response.status).toBe(201)
    const inserted = insert.mock.calls[0][0] as Record<string, unknown>
    expect(inserted.bundle_type).toBe('custom')
    expect(inserted.parent_bundle_id).toBe('bundle-1')
    expect(inserted).not.toHaveProperty('pricing_page_segments')
    expect(inserted).not.toHaveProperty('pricing_tier_slug')
    expect(inserted).not.toHaveProperty('tagline')
  })
})
