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
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

const params = { params: { id: 'pp-1' } }

function request() {
  return new NextRequest('http://localhost/api/admin/value-evidence/pain-points/pp-1/evidence')
}

describe('GET /api/admin/value-evidence/pain-points/[id]/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockImplementation(
      (result: { error?: string } | null) => Boolean(result) && typeof result === 'object' && 'error' in result
    )
  })

  it('rejects non-admins before reading evidence', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

    const response = await GET(request(), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns the newest 50 rows for the pain point', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 'ev-1' }], error: null })
    const order = vi.fn(() => ({ limit }))
    const eq = vi.fn(() => ({ order }))
    mocks.from.mockReturnValue({ select: vi.fn(() => ({ eq })) })

    const response = await GET(request(), params)

    expect(mocks.from).toHaveBeenCalledWith('pain_point_evidence')
    expect(eq).toHaveBeenCalledWith('pain_point_category_id', 'pp-1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limit).toHaveBeenCalledWith(50)
    expect(await response.json()).toEqual({ evidence: [{ id: 'ev-1' }] })
  })

  it('returns an empty list for null data and the database message on failure', async () => {
    const limit = vi.fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'column missing' } })
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ limit })) })) })),
    })

    const empty = await GET(request(), params)
    expect(await empty.json()).toEqual({ evidence: [] })

    const failed = await GET(request(), params)
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'column missing' })
  })
})
