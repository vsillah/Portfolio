import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  deleteIn: vi.fn(),
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

function request(body: unknown) {
  return new NextRequest('http://localhost/api/admin/chat-eval/sessions/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/chat-eval/sessions/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.deleteIn.mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({
      delete: vi.fn(() => ({ in: mocks.deleteIn })),
    })
  })

  it('requires admin auth before deleting sessions', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ session_ids: ['session-1'] }))

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing, empty, or non-string id list', async () => {
    const missing = await POST(request({}))
    const empty = await POST(request({ session_ids: [] }))
    const invalid = await POST(request({ session_ids: [1, '   ', null] }))

    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'session_ids array is required and must not be empty' })
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'session_ids array is required and must not be empty' })
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'No valid session IDs provided' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('deletes only non-blank strings and counts the untrimmed ids', async () => {
    const response = await POST(request({ session_ids: [' session-1 ', '', 'session-2', 4] }))

    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledWith('chat_sessions')
    expect(mocks.deleteIn).toHaveBeenCalledWith('session_id', [' session-1 ', 'session-2'])
    expect(await response.json()).toEqual({ success: true, deleted: 2 })
  })

  it('returns a generic error when the delete fails', async () => {
    mocks.deleteIn.mockResolvedValue({ error: { message: 'fk violation' } })

    const response = await POST(request({ session_ids: ['session-1'] }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to delete sessions' })
  })
})
