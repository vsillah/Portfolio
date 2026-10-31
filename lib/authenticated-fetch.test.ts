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

  it('returns the original 401 when refresh cannot produce a session', async () => {
    const denied = new Response(JSON.stringify({ error: 'expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
    const fetchImpl = vi.fn().mockResolvedValue(denied)
    const refreshSession = vi.fn().mockResolvedValue(null)

    const response = await fetchWithSessionRecovery('/api/admin/social-content/item-1', { cache: 'no-store' }, {
      fetchImpl,
      getSession: vi.fn().mockResolvedValue(session('stale-token')),
      refreshSession,
    })

    expect(response).toBe(denied)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    await expect(response?.json()).resolves.toEqual({ error: 'expired' })
  })

  it('does not treat a refresh outage as a missing session', async () => {
    const denied = new Response(null, { status: 401 })
    const fetchImpl = vi.fn().mockResolvedValue(denied)
    const failure = new Error('refresh unavailable')
    const refreshSession = vi.fn().mockRejectedValue(failure)

    await expect(fetchWithSessionRecovery('/detail', undefined, {
      fetchImpl,
      getSession: vi.fn().mockResolvedValue(session('stale-token')),
      refreshSession,
    })).rejects.toBe(failure)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('does not refresh forbidden or server failures', async () => {
    for (const status of [403, 500]) {
      const denied = new Response(null, { status })
      const fetchImpl = vi.fn().mockResolvedValue(denied)
      const refreshSession = vi.fn()

      const response = await fetchWithSessionRecovery('/detail', undefined, {
        fetchImpl,
        getSession: vi.fn().mockResolvedValue(session('current-token')),
        refreshSession,
      })

      expect(response).toBe(denied)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(refreshSession).not.toHaveBeenCalled()
    }
  })

  it('retries a rejected mutation with the replacement token and the original request', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const refreshSession = vi.fn().mockResolvedValue(session('replacement-token'))
    const detailUrl = new URL('https://portfolio.test/api/admin/social-content/item-1')
    const body = JSON.stringify({ action: 'load' })

    const response = await fetchWithSessionRecovery(detailUrl, {
      method: 'POST',
      body,
      cache: 'no-store',
      headers: {
        Authorization: 'Bearer caller-supplied',
        'Content-Type': 'application/json',
        'X-Request-Id': 'detail-retry',
      },
    }, {
      fetchImpl,
      getSession: vi.fn().mockResolvedValue(session('stale-token')),
      refreshSession,
    })

    expect(response?.status).toBe(204)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    const expectedTokens = ['Bearer stale-token', 'Bearer replacement-token']
    fetchImpl.mock.calls.forEach((call, index) => {
      const [input, init] = call as [URL, RequestInit]
      expect(input).toBe(detailUrl)
      expect(init.method).toBe('POST')
      expect(init.body).toBe(body)
      expect(init.cache).toBe('no-store')
      const headers = new Headers(init.headers)
      expect(authorizationValues(headers)).toEqual([expectedTokens[index]])
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(headers.get('X-Request-Id')).toBe('detail-retry')
    })
  })
})

function authorizationValues(headers: Headers): string[] {
  return [...headers.entries()]
    .filter(([name]) => name.toLowerCase() === 'authorization')
    .map(([, value]) => value)
}
