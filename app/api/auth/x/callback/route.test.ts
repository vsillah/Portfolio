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

function request(
  url: string,
  cookies: { state?: string; verifier?: string } = { state: 'state-1', verifier: 'verifier-1' },
) {
  const parts: string[] = []
  if (cookies.state) parts.push(`x_oauth_state=${cookies.state}`)
  if (cookies.verifier) parts.push(`x_oauth_code_verifier=${cookies.verifier}`)
  return new NextRequest(url, {
    headers: parts.length ? { cookie: parts.join('; ') } : undefined,
  })
}

function mockExistingConfig(data: Record<string, unknown> | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
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

  it('redirects provider errors without exchanging a code', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/x/callback?error=access_denied'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=access_denied',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects callbacks with no authorization code', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/x/callback'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=no_code',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects callbacks with an invalid oauth state before token exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=wrong-state'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=invalid_state',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects callbacks missing the PKCE verifier cookie', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1', {
        state: 'state-1',
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=invalid_state',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fails closed when client secret is missing', async () => {
    delete process.env.X_CLIENT_SECRET
    delete process.env.TWITTER_CLIENT_SECRET
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=missing_config',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('redirects when X token exchange fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'bad code' }), {
        status: 400,
      }),
    )

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_error=token_exchange_failed',
    )
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('exchanges the code, stores credentials, and activates the X config row', async () => {
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
        data: { id: 'user-99', name: 'AmaduTown', username: 'amadutown' },
      }), { status: 200 }))

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_connected=true&x_handle=amadutown',
    )
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.x.com/2/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    )
    const tokenRequest = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = tokenRequest.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('code-1')
    expect(body.get('redirect_uri')).toBe('https://amadutown.com/api/auth/x/callback')
    expect(body.get('code_verifier')).toBe('verifier-1')
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.x.com/2/users/me?user.fields=username,name',
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token' },
      }),
    )
    expect(existingConfig.select).toHaveBeenCalledWith('credentials, settings')
    expect(existingConfig.eq).toHaveBeenCalledWith('platform', 'x')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'x',
      is_active: true,
      credentials: expect.objectContaining({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        user_id: 'user-99',
        scope: 'tweet.read tweet.write users.read offline.access',
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

  it('preserves the existing refresh token when X omits a new one', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from
      .mockReturnValueOnce(mockExistingConfig({
        credentials: {
          refresh_token: 'existing-refresh-token',
          source: 'keep-me',
          user_id: 'old-user',
        },
        settings: {
          profile_handle: 'custom-handle',
          display_name: 'Existing Name',
          max_post_length: 400,
        },
      }))
      .mockReturnValueOnce({ upsert })
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'new-access-token',
        expires_in: 7200,
        token_type: 'bearer',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }))

    const response = await GET(
      request('https://amadutown.com/api/auth/x/callback?code=code-1&state=state-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?x_connected=true&x_handle=custom-handle',
    )
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      credentials: expect.objectContaining({
        access_token: 'new-access-token',
        refresh_token: 'existing-refresh-token',
        source: 'keep-me',
        user_id: 'old-user',
      }),
      settings: expect.objectContaining({
        profile_handle: 'custom-handle',
        connected_account: '@custom-handle',
        display_name: 'Existing Name',
        max_post_length: 400,
      }),
    }), { onConflict: 'platform' })
  })
})
