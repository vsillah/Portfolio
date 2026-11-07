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

const params = { params: { id: 'queue-1' } }

function request() {
  return new NextRequest('http://localhost/api/admin/video-generation/queue/queue-1/dismiss', {
    method: 'POST',
  })
}

function thenableQuery(result: { data?: unknown; error?: { message?: string } | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.single.mockResolvedValue(result)
  return query
}

describe('POST /api/admin/video-generation/queue/[id]/dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(), params)

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the queue item is missing', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: null, error: { message: 'not found' } }))

    const response = await POST(request(), params)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Queue item not found' })
  })

  it('rejects items that are not pending', async () => {
    mocks.from.mockReturnValue(thenableQuery({ data: { id: 'queue-1', status: 'generated' }, error: null }))

    const response = await POST(request(), params)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Queue item already generated' })
  })

  it('marks a pending item dismissed', async () => {
    const fetchQuery = thenableQuery({ data: { id: 'queue-1', status: 'pending' }, error: null })
    const updateQuery = thenableQuery({ data: null, error: null })
    mocks.from
      .mockReturnValueOnce(fetchQuery)
      .mockReturnValueOnce(updateQuery)

    const response = await POST(request(), params)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'dismissed' })
    expect(updateQuery.update).toHaveBeenCalledWith({ status: 'dismissed' })
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 'queue-1')
  })
})
