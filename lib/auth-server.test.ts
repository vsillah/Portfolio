import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, getUserMock } = vi.hoisted(() => {
  const getUserMock = vi.fn()
  return {
    getUserMock,
    createClientMock: vi.fn(() => ({
      auth: {
        getUser: getUserMock,
      },
    })),
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

const originalEnv = { ...process.env }

function makeRequest(token?: string): NextRequest {
  return new Request('http://localhost/api/admin/example', {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  }) as unknown as NextRequest
}

function mockUser(id = 'user-1'): User {
  return { id } as User
}

function mockProfileResponse(rows: Array<{ role: string }>, ok = true): Response {
  return {
    ok,
    json: vi.fn().mockResolvedValue(rows),
  } as unknown as Response
}

async function importAuthServer() {
  return import('./auth-server')
}

describe('auth-server', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    createClientMock.mockReset()
    getUserMock.mockReset()
    fetchMock.mockReset()
    createClientMock.mockImplementation(() => ({
      auth: {
        getUser: getUserMock,
      },
    }))
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    }
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllGlobals()
  })

  it('identifies auth errors without treating valid auth results as failures', async () => {
    const { isAuthError } = await importAuthServer()

    expect(isAuthError({ error: 'Authentication required', status: 401 })).toBe(true)
    expect(isAuthError({ user: mockUser(), isAdmin: false })).toBe(false)
  })

  it('rejects requests with no bearer token', async () => {
    const { verifyAuth } = await importAuthServer()

    await expect(verifyAuth(makeRequest())).resolves.toEqual({
      error: 'Authentication required',
      status: 401,
    })
    expect(createClientMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects invalid bearer tokens from Supabase auth', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'bad jwt' },
    })
    const { verifyAuth } = await importAuthServer()

    await expect(verifyAuth(makeRequest('bad-token'))).resolves.toEqual({
      error: 'Authentication required',
      status: 401,
    })
    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key')
    expect(getUserMock).toHaveBeenCalledWith('bad-token')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('marks valid users as admin when their profile role is admin', async () => {
    const user = mockUser('admin-user')
    getUserMock.mockResolvedValueOnce({ data: { user }, error: null })
    fetchMock.mockResolvedValueOnce(mockProfileResponse([{ role: 'admin' }]))
    const { verifyAuth } = await importAuthServer()

    await expect(verifyAuth(makeRequest('admin-jwt'))).resolves.toEqual({
      user,
      isAdmin: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/user_profiles?select=role&id=eq.admin-user&limit=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'anon-key',
          Authorization: 'Bearer admin-jwt',
        }),
      })
    )
  })

  it('fails closed when profile lookup is unavailable', async () => {
    const user = mockUser('lookup-failed-user')
    getUserMock.mockResolvedValueOnce({ data: { user }, error: null })
    fetchMock.mockResolvedValueOnce(mockProfileResponse([], false))
    const { verifyAuth } = await importAuthServer()

    await expect(verifyAuth(makeRequest('user-jwt'))).resolves.toEqual({
      user,
      isAdmin: false,
    })
  })

  it('does not grant admin access to non-admin profile roles', async () => {
    const user = mockUser('standard-user')
    getUserMock.mockResolvedValueOnce({ data: { user }, error: null })
    fetchMock.mockResolvedValueOnce(mockProfileResponse([{ role: 'user' }]))
    const { verifyAuth } = await importAuthServer()

    await expect(verifyAuth(makeRequest('user-jwt'))).resolves.toEqual({
      user,
      isAdmin: false,
    })
  })

  it('returns 403 from verifyAdmin for authenticated non-admin users', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: mockUser('standard-user') }, error: null })
    fetchMock.mockResolvedValueOnce(mockProfileResponse([{ role: 'user' }]))
    const { verifyAdmin } = await importAuthServer()

    await expect(verifyAdmin(makeRequest('user-jwt'))).resolves.toEqual({
      error: 'Admin access required',
      status: 403,
    })
  })

  it('treats missing or invalid optional auth as unauthenticated', async () => {
    const { tryVerifyAuth } = await importAuthServer()

    await expect(tryVerifyAuth(makeRequest())).resolves.toBeNull()
    expect(createClientMock).not.toHaveBeenCalled()

    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'bad jwt' },
    })

    await expect(tryVerifyAuth(makeRequest('bad-token'))).resolves.toBeNull()
    expect(getUserMock).toHaveBeenCalledWith('bad-token')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
