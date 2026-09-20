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

type QueryResult = { data?: unknown; error?: unknown; count?: number | null }

function makeQuery(result: QueryResult = { data: [], error: null }) {
  const query: Record<string, unknown> = {}
  const self = () => query
  for (const method of ['select', 'eq', 'order', 'insert', 'upsert', 'update', 'delete', 'single']) {
    query[method] = vi.fn(self)
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return query as {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    then: typeof Promise.prototype.then
  }
}

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/sales/products${query}`)
}

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/sales/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(query: string) {
  return new NextRequest(`http://localhost/api/admin/sales/products${query}`, { method: 'DELETE' })
}

describe('/api/admin/sales/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated GET before listing content', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('scopes GET to one content type and defaults to active-only rows', async () => {
    const roles = makeQuery({
      data: [
        {
          id: 'role-1',
          content_type: 'product',
          content_id: '12',
          offer_role: 'core_offer',
          retail_price: 199,
          unit_cost: 40,
        },
      ],
      error: null,
    })
    const products = makeQuery({
      data: [
        {
          id: 12,
          title: 'Widget',
          description: 'A widget',
          type: 'digital',
          price: 99,
          image_url: 'https://cdn.example/widget.png',
          is_active: true,
          display_order: 2,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'content_offer_roles') return roles
      if (table === 'products') return products
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeGetRequest('?content_type=product'))

    expect(response.status).toBe(200)
    expect(products.eq).toHaveBeenCalledWith('is_active', true)
    expect(products.order).toHaveBeenCalledWith('display_order', { ascending: true })
    await expect(response.json()).resolves.toMatchObject({
      content: [
        {
          content_type: 'product',
          content_id: '12',
          title: 'Widget',
          offer_role: 'core_offer',
          role_retail_price: 199,
          unit_cost: 40,
        },
      ],
      products: [{ id: 12, title: 'Widget', offer_role: 'core_offer' }],
    })
  })

  it('does not apply an active filter when active=false', async () => {
    const roles = makeQuery({ data: [], error: null })
    const products = makeQuery({ data: [], error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'content_offer_roles') return roles
      if (table === 'products') return products
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeGetRequest('?content_type=product&active=false'))

    expect(response.status).toBe(200)
    expect(products.eq).not.toHaveBeenCalled()
  })

  it('filters merged content by offer role in memory', async () => {
    const roles = makeQuery({
      data: [
        { id: 'role-core', content_type: 'product', content_id: '1', offer_role: 'core_offer' },
        { id: 'role-bonus', content_type: 'product', content_id: '2', offer_role: 'bonus' },
      ],
      error: null,
    })
    const products = makeQuery({
      data: [
        { id: 1, title: 'Core', is_active: true, display_order: 1 },
        { id: 2, title: 'Bonus', is_active: true, display_order: 2 },
      ],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'content_offer_roles') return roles
      if (table === 'products') return products
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeGetRequest('?content_type=product&role=bonus'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.content).toHaveLength(1)
    expect(body.content[0]).toMatchObject({ content_id: '2', offer_role: 'bonus' })
  })

  it('rejects unauthenticated POST before upserting a role', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makePostRequest({ content_id: '1', offer_role: 'core_offer' }))

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires content_id or product_id plus offer_role', async () => {
    const missingId = await POST(makePostRequest({ offer_role: 'core_offer' }))
    const missingRole = await POST(makePostRequest({ product_id: 9 }))

    expect(missingId.status).toBe(400)
    await expect(missingId.json()).resolves.toEqual({
      error: 'content_id (or product_id) and offer_role are required',
    })
    expect(missingRole.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('maps legacy product_id onto content_type=product and upserts the role', async () => {
    const query = makeQuery({ data: { id: 'role-1' }, error: null })
    mocks.from.mockReturnValue(query)

    const response = await POST(
      makePostRequest({
        product_id: 9,
        offer_role: 'upsell',
        retail_price: 49,
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: 'role-1' } })
    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: 'product',
        content_id: '9',
        offer_role: 'upsell',
        retail_price: 49,
        is_active: true,
      }),
      { onConflict: 'content_type,content_id' },
    )
  })

  it('requires content_id or product_id on DELETE', async () => {
    const response = await DELETE(makeDeleteRequest('?content_type=video'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'content_id (or product_id) is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults DELETE content_type to product and accepts product_id', async () => {
    const query = makeQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)

    const response = await DELETE(makeDeleteRequest('?product_id=9'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(mocks.from).toHaveBeenCalledWith('content_offer_roles')
    expect(query.eq).toHaveBeenCalledWith('content_type', 'product')
    expect(query.eq).toHaveBeenCalledWith('content_id', '9')
  })
})
