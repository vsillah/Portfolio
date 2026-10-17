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

function makeRequest(body: unknown, raw?: string) {
  return new NextRequest('http://localhost/api/admin/meetings/bulk-delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  })
}

describe('POST /api/admin/meetings/bulk-delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before deleting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest({ ids: ['m1'] }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON', async () => {
    const response = await POST(makeRequest({}, '{not-json'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('requires at least one string id', async () => {
    const empty = await POST(makeRequest({ ids: [] }))
    expect(empty.status).toBe(400)
    await expect(empty.json()).resolves.toEqual({
      error: 'ids array is required and must contain at least one UUID',
    })

    const numbersOnly = await POST(makeRequest({ ids: [1, 2] }))
    expect(numbersOnly.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes only string ids and reports that count', async () => {
    const inFn = vi.fn().mockResolvedValue({ error: null })
    const deleteFn = vi.fn().mockReturnValue({ in: inFn })
    mocks.from.mockReturnValue({ delete: deleteFn })

    const response = await POST(makeRequest({ ids: ['m1', 2, 'm3', null] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: 2 })
    expect(mocks.from).toHaveBeenCalledWith('meeting_records')
    expect(inFn).toHaveBeenCalledWith('id', ['m1', 'm3'])
  })

  it('returns a generic 500 when the delete fails', async () => {
    const inFn = vi.fn().mockResolvedValue({ error: { message: 'fk violation' } })
    const deleteFn = vi.fn().mockReturnValue({ in: inFn })
    mocks.from.mockReturnValue({ delete: deleteFn })

    const response = await POST(makeRequest({ ids: ['m1'] }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to delete meetings',
    })
  })
})
