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

import { POST } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/outcome-groups/seed', { method: 'POST' })
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null; count?: number | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    insert: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  return query
}

describe('POST /api/admin/outcome-groups/seed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('does not insert when outcome groups already exist', async () => {
    const countQuery = thenableQuery({ count: 3, error: null })
    mocks.from.mockReturnValue(countQuery)

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Outcome groups already exist; no seed applied.',
      count: 3,
    })
    expect(countQuery.insert).not.toHaveBeenCalled()
  })

  it('inserts the four default pricing-chart groups when the table is empty', async () => {
    const countQuery = thenableQuery({ count: 0, error: null })
    const insertQuery = thenableQuery({
      data: [{ slug: 'capture_convert' }],
      error: null,
    })
    mocks.from
      .mockReturnValueOnce(countQuery)
      .mockReturnValueOnce(insertQuery)

    const response = await POST(request())

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      message: 'Default outcome groups created.',
      data: [{ slug: 'capture_convert' }],
    })
    expect(insertQuery.insert).toHaveBeenCalledWith([
      { slug: 'capture_convert', label: 'Capture & Convert Leads', display_order: 0 },
      { slug: 'save_time_scale', label: 'Save Time & Scale Ops', display_order: 1 },
      { slug: 'strategy_support', label: 'Strategy & Support', display_order: 2 },
      { slug: 'grow_presence', label: 'Grow Your Presence', display_order: 3 },
    ])
  })
})
