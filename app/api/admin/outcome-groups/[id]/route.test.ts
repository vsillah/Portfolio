import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

import { DELETE, GET, PATCH } from './route'

const params = { params: { id: 'og-1' } }

function jsonRequest(method: string, body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/outcome-groups/og-1', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function thenableQuery(result: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  query.single.mockResolvedValue(result)
  return query
}

describe('GET /api/admin/outcome-groups/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns the group without admin auth', async () => {
    const row = { id: 'og-1', slug: 'ops', label: 'Ops', display_order: 1 }
    const query = thenableQuery({ data: row, error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(jsonRequest('GET'), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(row)
    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'og-1')
  })

  it('returns 404 when the group is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    }))

    const response = await GET(jsonRequest('GET'), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Outcome group not found' })
  })
})

describe('PATCH /api/admin/outcome-groups/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-21T10:00:00.000Z'))
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(jsonRequest('PATCH', { label: 'Ops' }), params)

    expect(response.status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an empty allowlist and ignores blank or non-integer fields', async () => {
    const response = await PATCH(jsonRequest('PATCH', {
      slug: '   ',
      label: '',
      display_order: 1.5,
      extra: 'ignored',
    }), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'No valid fields to update' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('trims allowlisted fields and stamps updated_at', async () => {
    const updated = { id: 'og-1', slug: 'ops', label: 'Operations', display_order: 3 }
    const query = thenableQuery({ data: updated, error: null })
    mocks.from.mockReturnValue(query)

    const response = await PATCH(jsonRequest('PATCH', {
      slug: ' ops ',
      label: ' Operations ',
      display_order: 3,
    }), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(updated)
    expect(query.update).toHaveBeenCalledWith({
      slug: 'ops',
      label: 'Operations',
      display_order: 3,
      updated_at: '2026-09-21T10:00:00.000Z',
    })
    expect(query.eq).toHaveBeenCalledWith('id', 'og-1')
  })

  it('returns 400 on a slug collision', async () => {
    mocks.from.mockReturnValue(thenableQuery({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    }))

    const response = await PATCH(jsonRequest('PATCH', { slug: 'ops' }), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'An outcome group with this slug already exists' })
  })
})

describe('DELETE /api/admin/outcome-groups/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await DELETE(jsonRequest('DELETE'), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes by id and returns success', async () => {
    const query = thenableQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)

    const response = await DELETE(jsonRequest('DELETE'), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'og-1')
  })
})
