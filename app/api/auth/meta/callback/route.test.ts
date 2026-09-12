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
    headers: stateCookie ? { cookie: `meta_oauth_state=${stateCookie}` } : undefined,
  })
}

function mockExistingConfigs(data: Array<Record<string, unknown>> = []) {
  const inFilter = vi.fn().mockResolvedValue({ data, error: null })
  const select = vi.fn().mockReturnValue({ in: inFilter })
  return { select, inFilter }
}

describe('GET /api/auth/meta/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...BASE_ENV }
    process.env.META_CLIENT_ID = 'meta-client-id'
    process.env.META_CLIENT_SECRET = 'meta-client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...BASE_ENV }
  })

  it('rejects callbacks with an invalid oauth state before token exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/meta/callback?code=code-1&state=wrong-state'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?meta_error=invalid_state')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stores Facebook Page and Instagram business config from the selected AmaduTown Page', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const existingConfig = mockExistingConfigs()
    mocks.from
      .mockReturnValueOnce(existingConfig)
      .mockReturnValueOnce({ upsert })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'user-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [
          { permission: 'pages_read_engagement', status: 'granted' },
          { permission: 'pages_read_user_content', status: 'granted' },
          { permission: 'instagram_basic', status: 'granted' },
          { permission: 'instagram_manage_comments', status: 'granted' },
          { permission: 'instagram_content_publish', status: 'granted' },
        ],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          id: 'page-1',
          name: 'AmaduTown',
          access_token: 'page-token',
          instagram_business_account: {
            id: 'ig-1',
            username: 'amadutown',
          },
        }],
      }), { status: 200 }))

    const response = await GET(request('https://amadutown.com/api/auth/meta/callback?code=code-1&state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?meta_connected=true&facebook_page=AmaduTown&instagram_handle=amadutown&instagram_connected=true')
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({
      href: expect.stringContaining('/oauth/access_token'),
    }))
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({
      href: expect.stringContaining('/me/permissions'),
    }))
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({
      href: expect.stringContaining('/me/accounts'),
    }))
    expect(existingConfig.select).toHaveBeenCalledWith('platform, credentials, settings')
    expect(existingConfig.inFilter).toHaveBeenCalledWith('platform', ['facebook', 'instagram'])
    expect(upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        platform: 'facebook',
        is_active: true,
        credentials: expect.objectContaining({
          access_token: 'user-token',
          page_access_token: 'page-token',
          page_id: 'page-1',
          scope: expect.stringContaining('pages_read_engagement'),
        }),
        settings: expect.objectContaining({
          page_name: 'AmaduTown',
          connected_page_id: 'page-1',
          pages_read_engagement_permission: true,
          pages_read_user_content_permission: true,
          facebook_comment_read_permissions_confirmed: true,
          meta_granted_permissions: expect.arrayContaining([
            'instagram_manage_comments',
            'pages_read_engagement',
            'pages_read_user_content',
          ]),
        }),
      }),
      expect.objectContaining({
        platform: 'instagram',
        is_active: true,
        credentials: expect.objectContaining({
          access_token: 'page-token',
          user_access_token: 'user-token',
          ig_user_id: 'ig-1',
          business_account_id: 'ig-1',
          scope: expect.stringContaining('instagram_manage_comments'),
        }),
        settings: expect.objectContaining({
          instagram_account_type: 'business',
          professional_account_confirmed: true,
          meta_page_linked: true,
          instagram_username: 'amadutown',
          instagram_manage_comments_permission: true,
          app_review_permissions_confirmed: true,
        }),
      }),
    ], { onConflict: 'platform' })
    const [facebookRow, instagramRow] = upsert.mock.calls[0][0]
    expect(facebookRow.credentials.scope).toContain('instagram_manage_comments')
    expect(instagramRow.credentials.scope).toContain('instagram_manage_comments')
    expect(instagramRow.settings.meta_granted_permissions).toEqual(expect.arrayContaining([
      'instagram_manage_comments',
      'pages_read_engagement',
      'pages_read_user_content',
    ]))
  })

  it('redirects provider errors without exchanging a token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/meta/callback?error=access_denied&state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?meta_error=access_denied')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('fails closed when the authorization code is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/meta/callback?state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?meta_error=no_code')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fails closed when Meta client credentials are missing', async () => {
    delete process.env.META_CLIENT_ID
    delete process.env.FACEBOOK_CLIENT_ID
    delete process.env.META_CLIENT_SECRET
    delete process.env.FACEBOOK_CLIENT_SECRET
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/meta/callback?code=code-1&state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?meta_error=missing_config')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fails closed when token exchange does not return an access token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'Invalid code' } }), { status: 400 }),
    )

    const response = await GET(request('https://amadutown.com/api/auth/meta/callback?code=code-1&state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?meta_error=token_exchange_failed')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('fails closed when no Page access token is available', async () => {
    mocks.from.mockReturnValueOnce(mockExistingConfigs())
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'user-token',
        token_type: 'Bearer',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))

    const response = await GET(request('https://amadutown.com/api/auth/meta/callback?code=code-1&state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?meta_error=no_page_token')
  })
})
