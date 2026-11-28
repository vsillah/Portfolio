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

import { DELETE, GET, POST, PUT } from './route'

type QueryResult = { data?: unknown; error?: unknown }

function makeQuery(result: QueryResult = { data: [], error: null }) {
  const query: Record<string, unknown> = {}
  const self = () => query
  for (const method of ['select', 'eq', 'order', 'insert', 'update', 'delete', 'single']) {
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
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

function makeGetRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/sales/scripts${query}`)
}

function makeBodyRequest(method: string, body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/sales/scripts', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/admin/sales/scripts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated GET before listing scripts', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('defaults GET to active-only scripts', async () => {
    const query = makeQuery({ data: [{ id: 'script-1' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeGetRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ scripts: [{ id: 'script-1' }] })
    expect(query.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('omits the active filter when active=false and applies offer_type', async () => {
    const query = makeQuery({ data: [], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeGetRequest('?active=false&offer_type=upsell'))

    expect(response.status).toBe(200)
    expect(query.eq).not.toHaveBeenCalledWith('is_active', true)
    expect(query.eq).toHaveBeenCalledWith('offer_type', 'upsell')
  })

  it('requires name, offer_type, and script_content on POST', async () => {
    const response = await POST(makeBodyRequest('POST', { name: 'Close', offer_type: 'core' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'name, offer_type, and script_content are required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('inserts a script with defaults and created_by from the admin user', async () => {
    const query = makeQuery({ data: { id: 'script-1' }, error: null })
    mocks.from.mockReturnValue(query)

    const response = await POST(
      makeBodyRequest('POST', {
        name: 'Close',
        offer_type: 'core',
        script_content: 'Ask for the sale.',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: 'script-1' } })
    expect(query.insert).toHaveBeenCalledWith({
      name: 'Close',
      description: undefined,
      offer_type: 'core',
      script_content: 'Ask for the sale.',
      target_funnel_stage: [],
      qualifying_criteria: undefined,
      associated_products: [],
      is_active: true,
      created_by: 'admin-user-1',
    })
  })

  it('requires an id on PUT and forwards remaining body fields to update', async () => {
    const missing = await PUT(makeBodyRequest('PUT', { name: 'Renamed' }))
    expect(missing.status).toBe(400)
    await expect(missing.json()).resolves.toEqual({ error: 'Script ID is required' })
    expect(mocks.from).not.toHaveBeenCalled()

    const query = makeQuery({ data: { id: 'script-1', name: 'Renamed' }, error: null })
    mocks.from.mockReturnValue(query)

    const response = await PUT(
      makeBodyRequest('PUT', {
        id: 'script-1',
        name: 'Renamed',
        created_by: 'attacker',
      }),
    )

    expect(response.status).toBe(200)
    expect(query.update).toHaveBeenCalledWith({ name: 'Renamed', created_by: 'attacker' })
    expect(query.eq).toHaveBeenCalledWith('id', 'script-1')
  })

  it('requires an id query param on DELETE', async () => {
    const missing = await DELETE(new NextRequest('http://localhost/api/admin/sales/scripts', { method: 'DELETE' }))
    expect(missing.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()

    const query = makeQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)
    const response = await DELETE(
      new NextRequest('http://localhost/api/admin/sales/scripts?id=script-1', { method: 'DELETE' }),
    )

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('id', 'script-1')
  })
})
