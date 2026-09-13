import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mocks.getCurrentUser,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

import { GET, POST } from './route'

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api/prototypes${query}`)
}

function postRequest(body: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return new NextRequest('http://localhost/api/prototypes', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function thenableQuery(result: { data: unknown; error: unknown }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    then: (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.gte.mockReturnValue(query)
  return query
}

function profileQuery(role: string | null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: role ? { role } : null,
          error: role ? null : { message: 'missing' },
        }),
      })),
    })),
  }
}

function insertQuery(row: unknown, error: unknown = null) {
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: row, error }),
      })),
    })),
  }
}

const requiredFields = {
  title: 'Pipeline hero',
  description: 'Sales visual',
  purpose: 'demo',
  production_stage: 'Prototype',
  channel: 'web',
  product_type: 'app',
}

describe('GET /api/prototypes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.getCurrentUser.mockResolvedValue(null)
  })

  it('returns an empty list when the prototypes table is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    }))

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })

  it('skips related queries when no prototypes exist', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: [], error: null }))

    const response = await GET(getRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('app_prototypes')
  })

  it('applies stage, channel, and type filters', async () => {
    const query = thenableQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    await GET(getRequest('?stage=Production&channel=web&type=app'))

    expect(query.eq).toHaveBeenCalledWith('production_stage', 'Production')
    expect(query.eq).toHaveBeenCalledWith('channel', 'web')
    expect(query.eq).toHaveBeenCalledWith('product_type', 'app')
  })

  it('enriches prototypes with sorted demos, enrollments, analytics, and last linked product', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' })
    const prototypes = thenableQuery({
      data: [{
        id: 'proto-1',
        title: 'Hero',
        production_stage: 'Production',
      }],
      error: null,
    })
    const demos = thenableQuery({
      data: [
        { id: 'd2', prototype_id: 'proto-1', display_order: 2 },
        { id: 'd1', prototype_id: 'proto-1', display_order: 1 },
      ],
      error: null,
    })
    const history = thenableQuery({
      data: [
        { id: 'h-old', prototype_id: 'proto-1', changed_at: '2026-01-01T00:00:00.000Z' },
        { id: 'h-new', prototype_id: 'proto-1', changed_at: '2026-09-01T00:00:00.000Z' },
      ],
      error: null,
    })
    const enrollments = thenableQuery({
      data: [{ prototype_id: 'proto-1', enrollment_type: 'waitlist' }],
      error: null,
    })
    const feedback = thenableQuery({
      data: [{ prototype_id: 'proto-1' }, { prototype_id: 'proto-1' }],
      error: null,
    })
    const analytics = thenableQuery({
      data: [
        { prototype_id: 'proto-1', metric_type: 'active-users', metric_value: 3 },
        { prototype_id: 'proto-1', metric_type: 'active-users', metric_value: 8 },
        { prototype_id: 'proto-1', metric_type: 'pageviews', metric_value: 10 },
        { prototype_id: 'proto-1', metric_type: 'pageviews', metric_value: 4 },
        { prototype_id: 'proto-1', metric_type: 'downloads', metric_value: 2 },
      ],
      error: null,
    })
    const products = thenableQuery({
      data: [
        { id: 11, price: 50, prototype_id: 'proto-1' },
        { id: 22, price: 99, prototype_id: 'proto-1' },
      ],
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'app_prototypes') return prototypes
      if (table === 'prototype_demos') return demos
      if (table === 'prototype_stage_history') return history
      if (table === 'prototype_enrollments') return enrollments
      if (table === 'prototype_feedback') return feedback
      if (table === 'prototype_analytics') return analytics
      if (table === 'products') return products
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(getRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: 'proto-1',
      user_enrollment: 'waitlist',
      feedback_count: 2,
      analytics: { active_users: 8, pageviews: 14, downloads: 2 },
      linked_product: { id: 22, price: 99 },
    })
    expect(body[0].demos.map((d: { id: string }) => d.id)).toEqual(['d1', 'd2'])
    expect(body[0].stage_history.map((h: { id: string }) => h.id)).toEqual(['h-new', 'h-old'])
    expect(enrollments.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(products.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('returns 500 with the database error message for non-missing-table failures', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    }))

    const response = await GET(getRequest())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'permission denied' })
  })
})

describe('POST /api/prototypes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon'
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
  })

  it('requires a bearer token before parsing the body', async () => {
    const response = await POST(postRequest(requiredFields))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('validates required fields after a token is present and before verifying it', async () => {
    const response = await POST(postRequest({ title: 'Only title' }, 'maybe-valid'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Missing required fields' })
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('rejects an invalid session token', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad token' } })

    const response = await POST(postRequest(requiredFields, 'bad-token'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('forbids non-admin users', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('member')
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(postRequest(requiredFields, 'member-token'))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Admin access required' })
  })

  it('inserts an admin-created prototype and stamps created_by', async () => {
    const created = { id: 'proto-1', ...requiredFields, created_by: 'admin-1' }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') return profileQuery('admin')
      if (table === 'app_prototypes') return insertQuery(created)
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(postRequest({
      ...requiredFields,
      thumbnail_url: '',
    }, 'admin-token'))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ success: true, data: created })
    const insert = mocks.from.mock.results.find((_, i) => mocks.from.mock.calls[i][0] === 'app_prototypes')
    expect(insert?.value.insert).toHaveBeenCalledWith([expect.objectContaining({
      title: 'Pipeline hero',
      thumbnail_url: null,
      created_by: 'admin-1',
    })])
  })
})
