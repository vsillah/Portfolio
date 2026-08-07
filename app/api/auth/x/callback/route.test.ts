import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

const BASE_ENV = { ...process.env }

function request(url: string, cookies?: { state?: string; verifier?: string }) {
  const parts: string[] = []
  if (cookies?.state) parts.push(`x_oauth_state=${cookies.state}`)
  if (cookies?.verifier) parts.push(`x_oauth_code_verifier=${cookies.verifier}`)
  return new NextRequest(url, {
    headers: parts.length ? { cookie: parts.join('; ') } : undefined,
  })
}

function mockExistingConfig(data: Record<string, unknown> | null = null, error: { message: string } | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, maybeSingle }
}

describe('GET /api/auth/x/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...BASE_ENV }
    process.env.X_CLIENT_ID = 'x-client-id'
    process.env.X_CLIENT_SECRET = 'x-client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...BASE_ENV }
  })

  it('rejects oauth provider errors before token exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?error=access_denied', {
        state: 'state-1',
        verifier: 'verifier-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=access_denied',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing authorization code before token exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?state=state-1', {
        state: 'state-1',
        verifier: 'verifier-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=no_code',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects invalid oauth state or missing PKCE verifier before token exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=wrong-state', {
        state: 'state-1',
        verifier: 'verifier-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=invalid_state',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects missing client credentials before token exchange', async () => {
    delete process.env.X_CLIENT_ID
    delete process.env.X_CLIENT_SECRET
    delete process.env.TWITTER_CLIENT_ID
    delete process.env.TWITTER_CLIENT_SECRET
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1', {
        state: 'state-1',
        verifier: 'verifier-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=missing_config',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('exchanges the code, stores credentials, and activates the x config row', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const existingConfig = mockExistingConfig()
    mocks.from
      .mockReturnValueOnce(existingConfig)
      .mockReturnValueOnce({ upsert })

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 7200,
        token_type: 'bearer',
        scope: 'tweet.read tweet.write users.read offline.access',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: 'x-user-1',
          name: 'AmaduTown',
          username: 'amadutown',
        },
      }), { status: 200 }))

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1', {
        state: 'state-1',
        verifier: 'verifier-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_connected=true&x_handle=amadutown',
    )
    expect(fetchSpy).toHaveBeenCalledWith('https://api.x.com/2/oauth2/token', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: `Basic ${Buffer.from('x-client-id:x-client-secret').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
      body: expect.any(URLSearchParams),
    }))
    const tokenBody = fetchSpy.mock.calls[0][1]?.body as URLSearchParams
    expect(tokenBody.get('grant_type')).toBe('authorization_code')
    expect(tokenBody.get('code')).toBe('code-1')
    expect(tokenBody.get('redirect_uri')).toBe('https://amadutown.com/api/auth/x/callback')
    expect(tokenBody.get('code_verifier')).toBe('verifier-1')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.x.com/2/users/me?user.fields=username,name',
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token' },
      }),
    )
    expect(mocks.from).toHaveBeenCalledWith('social_content_config')
    expect(existingConfig.select).toHaveBeenCalledWith('credentials, settings')
    expect(existingConfig.eq).toHaveBeenCalledWith('platform', 'x')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'x',
      is_active: true,
      credentials: expect.objectContaining({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 7200,
        user_id: 'x-user-1',
      }),
      settings: expect.objectContaining({
        profile_handle: 'amadutown',
        connected_account: '@amadutown',
        display_name: 'AmaduTown',
        max_post_length: 280,
        thread_reply_enabled: true,
      }),
    }), { onConflict: 'platform' })
  })

  it('preserves existing refresh token and settings when X omits a new refresh token', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from
      .mockReturnValueOnce(mockExistingConfig({
        credentials: {
          refresh_token: 'existing-refresh-token',
          user_id: 'old-user',
          stale_field: 'keep-me',
        },
        settings: {
          profile_handle: 'legacy_handle',
          max_post_length: 240,
          thread_reply_enabled: false,
          display_name: 'Legacy Name',
        },
      }))
      .mockReturnValueOnce({ upsert })

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'bearer',
        scope: 'tweet.write',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        errors: [{ message: 'rate limited' }],
      }), { status: 429 }))

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1', {
        state: 'state-1',
        verifier: 'verifier-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_connected=true&x_handle=legacy_handle',
    )
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      credentials: expect.objectContaining({
        access_token: 'new-access-token',
        refresh_token: 'existing-refresh-token',
        user_id: 'old-user',
        stale_field: 'keep-me',
      }),
      settings: expect.objectContaining({
        profile_handle: 'legacy_handle',
        connected_account: '@legacy_handle',
        display_name: 'Legacy Name',
        max_post_length: 240,
        thread_reply_enabled: false,
      }),
    }), { onConflict: 'platform' })
  })

  it('redirects with token_exchange_failed when X rejects the authorization code', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Code expired',
    }), { status: 400 }))

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=bad-code&state=state-1', {
        state: 'state-1',
        verifier: 'verifier-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=token_exchange_failed',
    )
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('redirects with config_update_failed when upsert fails after token exchange', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'upsert failed' } })
    mocks.from
      .mockReturnValueOnce(mockExistingConfig())
      .mockReturnValueOnce({ upsert })

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { id: 'x-user-1', name: 'AmaduTown', username: 'amadutown' },
      }), { status: 200 }))

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1', {
        state: 'state-1',
        verifier: 'verifier-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=config_update_failed',
    )
  })
})
