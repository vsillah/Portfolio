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

function jsonRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outcome-groups', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function thenableQuery(result: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.single.mockResolvedValue(result)
  return query
}

describe('GET /api/admin/outcome-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('lists groups without admin auth and orders by display_order then slug', async () => {
    const rows = [{ id: 'og-1', slug: 'capture_convert', label: 'Capture & Convert Leads', display_order: 0 }]
    const query = thenableQuery({ data: rows, error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(rows)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.from).toHaveBeenCalledWith('outcome_groups')
    expect(query.order).toHaveBeenNthCalledWith(1, 'display_order', { ascending: true })
    expect(query.order).toHaveBeenNthCalledWith(2, 'slug', { ascending: true })
  })

  it('returns an empty list when the table is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: '42P01', message: 'relation "outcome_groups" does not exist' },
    }))

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })

  it('returns 500 for other query errors', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: 'XX000', message: 'db down' },
    }))

    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to fetch outcome groups' })
  })
})

describe('POST /api/admin/outcome-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(jsonRequest({ slug: 'ops', label: 'Ops' }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires a non-empty slug and label', async () => {
    const missingSlug = await POST(jsonRequest({ slug: '   ', label: 'Ops' }))
    expect(missingSlug.status).toBe(400)
    await expect(missingSlug.json()).resolves.toEqual({ error: 'slug is required' })

    const missingLabel = await POST(jsonRequest({ slug: 'ops', label: '' }))
    expect(missingLabel.status).toBe(400)
    await expect(missingLabel.json()).resolves.toEqual({ error: 'label is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('trims fields, defaults non-integer display_order to 0, and returns 201', async () => {
    const created = { id: 'og-2', slug: 'ops', label: 'Ops', display_order: 0 }
    const query = thenableQuery({ data: created, error: null })
    mocks.from.mockReturnValue(query)

    const response = await POST(jsonRequest({
      slug: '  ops  ',
      label: '  Ops  ',
      display_order: 1.5,
    }))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual(created)
    expect(query.insert).toHaveBeenCalledWith([{ slug: 'ops', label: 'Ops', display_order: 0 }])
  })

  it('returns 400 when the slug already exists', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    }))

    const response = await POST(jsonRequest({ slug: 'ops', label: 'Ops', display_order: 2 }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'An outcome group with this slug already exists' })
  })
})
