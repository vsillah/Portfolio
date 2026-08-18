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

function request(url: string, stateCookie = 'state-1') {
  return new NextRequest(url, {
    headers: stateCookie ? { cookie: `tiktok_oauth_state=${stateCookie}` } : undefined,
  })
}

function mockExistingConfig(data: Record<string, unknown> | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, maybeSingle }
}

describe('GET /api/auth/tiktok/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...BASE_ENV }
    process.env.TIKTOK_CLIENT_KEY = 'tiktok-client-key'
    process.env.TIKTOK_CLIENT_SECRET = 'tiktok-client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...BASE_ENV }
  })

  it('rejects callbacks with an invalid oauth state before token exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/tiktok/callback?code=code-1&state=wrong-state'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?tiktok_error=invalid_state')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('exchanges the code, stores credentials, and keeps a new TikTok config inactive', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const existingConfig = mockExistingConfig()
    mocks.from
      .mockReturnValueOnce(existingConfig)
      .mockReturnValueOnce({ upsert })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 86400,
        refresh_expires_in: 31536000,
        token_type: 'Bearer',
        scope: 'user.info.basic,video.publish',
        open_id: 'open-id-1',
      }), { status: 200 }))

    const response = await GET(request('https://amadutown.com/api/auth/tiktok/callback?code=code-1&state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?tiktok_connected=true&tiktok_active=false')
    expect(fetchSpy).toHaveBeenCalledWith('https://open.tiktokapis.com/v2/oauth/token/', expect.objectContaining({
      method: 'POST',
      body: expect.any(URLSearchParams),
    }))
    const tokenRequest = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = tokenRequest.body as URLSearchParams
    expect(body.get('client_key')).toBe('tiktok-client-key')
    expect(body.get('client_secret')).toBe('tiktok-client-secret')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('redirect_uri')).toBe('https://amadutown.com/api/auth/tiktok/callback')
    expect(mocks.from).toHaveBeenCalledWith('social_content_config')
    expect(existingConfig.select).toHaveBeenCalledWith('credentials, settings, is_active')
    expect(existingConfig.eq).toHaveBeenCalledWith('platform', 'tiktok')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'tiktok',
      is_active: false,
      credentials: expect.objectContaining({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        scope: 'user.info.basic,video.publish',
        open_id: 'open-id-1',
      }),
      settings: expect.objectContaining({
        direct_post_scope_authorized: true,
        creator_info_confirmed: false,
        source_url_approved: false,
        privacy_level: 'SELF_ONLY',
        profile_handle: 'amadutown',
        connected_account: '@amadutown',
      }),
    }), { onConflict: 'platform' })
  })

  it('preserves an already active human-gated config and existing prerequisite settings', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from
      .mockReturnValueOnce(mockExistingConfig({
        is_active: true,
        credentials: {
          refresh_token: 'existing-refresh-token',
          source: 'keep-me',
        },
        settings: {
          creator_info_confirmed: true,
          source_url_approved: true,
          approved_media_domains: ['assets.amadutown.com'],
          privacy_level: 'PUBLIC_TO_EVERYONE',
          profile_handle: 'custom-amadutown',
        },
      }))
      .mockReturnValueOnce({ upsert })
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'new-access-token',
        expires_in: 86400,
        token_type: 'Bearer',
        scope: 'user.info.basic',
      }), { status: 200 }))

    const response = await GET(request('https://amadutown.com/api/auth/tiktok/callback?code=code-1&state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?tiktok_connected=true&tiktok_active=true')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      is_active: true,
      credentials: expect.objectContaining({
        access_token: 'new-access-token',
        refresh_token: 'existing-refresh-token',
        source: 'keep-me',
      }),
      settings: expect.objectContaining({
        direct_post_scope_authorized: false,
        creator_info_confirmed: true,
        source_url_approved: true,
        approved_media_domains: ['assets.amadutown.com'],
        privacy_level: 'PUBLIC_TO_EVERYONE',
        profile_handle: 'custom-amadutown',
        connected_account: '@custom-amadutown',
      }),
    }), { onConflict: 'platform' })
  })
})
