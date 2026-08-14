import { describe, expect, it, vi } from 'vitest'
import {
  isXAccessTokenStale,
  refreshXOAuthCredentials,
  type XOAuthCredentials,
} from './x-oauth-refresh'

const staleCredentials: XOAuthCredentials = {
  access_token: 'old-access-token',
  refresh_token: 'old-refresh-token',
  expires_in: 60,
  token_obtained_at: '2026-08-12T10:00:00.000Z',
  token_type: 'bearer',
  scope: 'tweet.read tweet.write users.read offline.access',
  user_id: '999999',
}

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch
}

function xEnv(values: Record<string, string>) {
  return values as unknown as NodeJS.ProcessEnv
}

function createFetchMock(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return vi.fn(impl)
}

function createDb(options: { updatedRow?: Record<string, unknown> | null; updateError?: Record<string, unknown> | null } = {}) {
  const calls = {
    updates: [] as unknown[],
    eq: [] as Array<[string, unknown]>,
    is: [] as Array<[string, unknown]>,
  }

  const maybeSingle = vi.fn(async () => ({
    data: options.updatedRow === undefined ? { credentials: calls.updates.at(-1) } : options.updatedRow,
    error: options.updateError ?? null,
  }))
  const select = vi.fn(() => ({ maybeSingle }))
  const eq = vi.fn((column: string, value: unknown) => {
    calls.eq.push([column, value])
    return { eq, is: isFilter, select }
  })
  const isFilter = vi.fn((column: string, value: unknown) => {
    calls.is.push([column, value])
    return { eq, is: isFilter, select }
  })
  const update = vi.fn((payload: unknown) => {
    calls.updates.push((payload as { credentials?: unknown }).credentials)
    return { eq, is: isFilter }
  })

  return {
    db: {
      from: vi.fn(() => ({ update })),
    },
    calls,
  }
}

describe('x oauth refresh', () => {
  it('detects stale and unverifiable token metadata according to caller policy', () => {
    expect(isXAccessTokenStale({
      credentials: staleCredentials,
      now: new Date('2026-08-12T12:00:00.000Z'),
    })).toBe(true)
    expect(isXAccessTokenStale({
      credentials: { access_token: 'token' },
      now: new Date('2026-08-12T12:00:00.000Z'),
    })).toBe(false)
    expect(isXAccessTokenStale({
      credentials: { access_token: 'token' },
      now: new Date('2026-08-12T12:00:00.000Z'),
      missingMetadataIsStale: true,
    })).toBe(true)
  })

  it('refreshes stale X tokens and persists rotated refresh-token metadata conditionally', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 7200,
      token_type: 'bearer',
      scope: 'tweet.read users.read offline.access',
    }))

    const result = await refreshXOAuthCredentials({
      db,
      credentials: staleCredentials,
      fetchImpl: asFetch(fetchImpl),
      now: new Date('2026-08-12T12:00:00.000Z'),
      env: xEnv({
        X_CLIENT_ID: 'client-id',
        X_CLIENT_SECRET: 'client-secret',
      }),
    })

    expect(result).toEqual({
      refreshed: true,
      credentials: {
        ...staleCredentials,
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
        token_type: 'bearer',
        scope: 'tweet.read users.read offline.access',
        token_obtained_at: '2026-08-12T12:00:00.000Z',
      },
    })
    expect(fetchImpl).toHaveBeenCalledWith('https://api.x.com/2/oauth2/token', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: expect.stringMatching(/^Basic /),
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
      body: expect.any(URLSearchParams),
    }))
    expect((fetchImpl.mock.calls[0][1]?.body as URLSearchParams).get('refresh_token')).toBe('old-refresh-token')
    expect(calls.updates[0]).toEqual(expect.objectContaining({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_obtained_at: '2026-08-12T12:00:00.000Z',
    }))
    expect(calls.eq).toEqual([
      ['platform', 'x'],
      ['credentials->>refresh_token', 'old-refresh-token'],
      ['credentials->>token_obtained_at', '2026-08-12T10:00:00.000Z'],
    ])
  })

  it('keeps the previous refresh token when X does not rotate it', async () => {
    const { db } = createDb()
    const fetchImpl = createFetchMock(() => response({
      access_token: 'new-access-token',
      expires_in: 7200,
    }))

    const result = await refreshXOAuthCredentials({
      db,
      credentials: staleCredentials,
      fetchImpl: asFetch(fetchImpl),
      now: new Date('2026-08-12T12:00:00.000Z'),
      env: xEnv({
        X_CLIENT_ID: 'client-id',
        X_CLIENT_SECRET: 'client-secret',
      }),
    })

    expect(result.refreshed).toBe(true)
    expect(result.credentials.refresh_token).toBe('old-refresh-token')
  })

  it('fails closed with sanitized provider errors without persisting credentials', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({
      error: 'invalid_grant',
      error_description: 'secret-bearing provider detail',
    }, 400))

    const result = await refreshXOAuthCredentials({
      db,
      credentials: staleCredentials,
      fetchImpl: asFetch(fetchImpl),
      now: new Date('2026-08-12T12:00:00.000Z'),
      env: xEnv({
        X_CLIENT_ID: 'client-id',
        X_CLIENT_SECRET: 'client-secret',
      }),
    })

    expect(result).toEqual({
      refreshed: false,
      credentials: staleCredentials,
      error: {
        code: 'x_token_refresh_failed',
        message: 'X token refresh failed (400); reconnect X before retrying.',
        status: 400,
      },
    })
    expect(calls.updates).toEqual([])
  })

  it('fails closed when X OAuth client configuration is missing', async () => {
    const { db, calls } = createDb()
    const fetchImpl = createFetchMock(() => response({ access_token: 'new-access-token' }))

    const result = await refreshXOAuthCredentials({
      db,
      credentials: staleCredentials,
      fetchImpl: asFetch(fetchImpl),
      now: new Date('2026-08-12T12:00:00.000Z'),
      env: xEnv({}),
    })

    expect(result).toMatchObject({
      refreshed: false,
      credentials: staleCredentials,
      error: { code: 'x_oauth_client_config_missing' },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(calls.updates).toEqual([])
  })

  it('does not clobber a newer credential update when the conditional persistence claim loses', async () => {
    const { db } = createDb({ updatedRow: null })
    const fetchImpl = createFetchMock(() => response({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 7200,
    }))

    const result = await refreshXOAuthCredentials({
      db,
      credentials: staleCredentials,
      fetchImpl: asFetch(fetchImpl),
      now: new Date('2026-08-12T12:00:00.000Z'),
      env: xEnv({
        X_CLIENT_ID: 'client-id',
        X_CLIENT_SECRET: 'client-secret',
      }),
    })

    expect(result).toMatchObject({
      refreshed: false,
      credentials: staleCredentials,
      error: { code: 'x_token_refresh_concurrent_update' },
    })
  })
})
