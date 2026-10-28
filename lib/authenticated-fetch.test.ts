import type { Session } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { fetchWithSessionRecovery } from './authenticated-fetch'

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(),
  refreshCurrentSession: vi.fn(),
}))

function session(accessToken: string): Session {
  return { access_token: accessToken } as Session
}

describe('fetchWithSessionRecovery', () => {
  it('uses the current session without refreshing a successful request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const refreshSession = vi.fn()

    const response = await fetchWithSessionRecovery('/detail', undefined, {
      fetchImpl,
      getSession: vi.fn().mockResolvedValue(session('current-token')),
      refreshSession,
    })

    expect(response?.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer current-token')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('refreshes once after a 401 and retries with the replacement token', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const refreshSession = vi.fn().mockResolvedValue(session('replacement-token'))

    const response = await fetchWithSessionRecovery('/detail', { cache: 'no-store' }, {
      fetchImpl,
      getSession: vi.fn().mockResolvedValue(session('stale-token')),
      refreshSession,
    })

    expect(response?.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer stale-token')
    expect(new Headers(fetchImpl.mock.calls[1][1]?.headers).get('Authorization')).toBe('Bearer replacement-token')
  })

  it('fails closed after the single retry is also rejected', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    const refreshSession = vi.fn().mockResolvedValue(session('replacement-token'))

    const response = await fetchWithSessionRecovery('/detail', undefined, {
      fetchImpl,
      getSession: vi.fn().mockResolvedValue(session('stale-token')),
      refreshSession,
    })

    expect(response?.status).toBe(401)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('does not issue a request without an authenticated session', async () => {
    const fetchImpl = vi.fn()

    const response = await fetchWithSessionRecovery('/detail', undefined, {
      fetchImpl,
      getSession: vi.fn().mockResolvedValue(null),
      refreshSession: vi.fn(),
    })

    expect(response).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
