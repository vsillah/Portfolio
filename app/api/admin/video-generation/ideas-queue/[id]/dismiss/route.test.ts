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

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/video-generation/ideas-queue/idea-1/dismiss', {
    method: 'POST',
  })
}

function queueFetch(row: Record<string, unknown> | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error })
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ single })),
    })),
  }
}

describe('POST /api/admin/video-generation/ideas-queue/[id]/dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before reading the queue item', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), { params: { id: 'idea-1' } })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the queue item is missing and does not update', async () => {
    mocks.from.mockReturnValueOnce(queueFetch(null, { code: 'PGRST116' }))

    const response = await POST(makeRequest(), { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Ideas queue item not found' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-pending item and does not write dismissed', async () => {
    mocks.from.mockReturnValueOnce(queueFetch({ id: 'idea-1', status: 'generated' }))

    const response = await POST(makeRequest(), { params: { id: 'idea-1' } })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Ideas queue item already generated' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('marks only a pending item dismissed', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn(() => ({ eq }))
    mocks.from
      .mockReturnValueOnce(queueFetch({ id: 'idea-1', status: 'pending' }))
      .mockReturnValueOnce({ update })

    const response = await POST(makeRequest(), { params: { id: 'idea-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'dismissed' })
    expect(update).toHaveBeenCalledWith({ status: 'dismissed' })
    expect(eq).toHaveBeenCalledWith('id', 'idea-1')
  })

  it('returns a generic failure when the status update errors', async () => {
    mocks.from
      .mockReturnValueOnce(queueFetch({ id: 'idea-1', status: 'pending' }))
      .mockReturnValueOnce({
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: { message: 'constraint failed' } }),
        })),
      })

    const response = await POST(makeRequest(), { params: { id: 'idea-1' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to dismiss' })
  })

  it('returns a thrown string as the error body', async () => {
    mocks.from.mockImplementation(() => {
      throw 'dismiss exploded'
    })

    const response = await POST(makeRequest(), { params: { id: 'idea-1' } })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'dismiss exploded' })
  })
})
