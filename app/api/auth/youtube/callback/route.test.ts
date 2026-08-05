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
    headers: stateCookie ? { cookie: `youtube_oauth_state=${stateCookie}` } : undefined,
  })
}

function mockExistingConfig(data: Record<string, unknown> | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null })
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, maybeSingle }
}

describe('GET /api/auth/youtube/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...BASE_ENV }
    process.env.YOUTUBE_CLIENT_ID = 'youtube-client-id'
    process.env.YOUTUBE_CLIENT_SECRET = 'youtube-client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...BASE_ENV }
  })

  it('rejects callbacks with an invalid oauth state before token exchange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/youtube/callback?code=code-1&state=wrong-state'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?youtube_error=invalid_state')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('exchanges the code, stores credentials, and activates the youtube config row', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const existingConfig = mockExistingConfig()
    mocks.from
      .mockReturnValueOnce(existingConfig)
      .mockReturnValueOnce({ upsert })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{
          id: 'UC123',
          snippet: {
            title: 'Vambah Sillah',
            customUrl: '@vambah',
          },
        }],
      }), { status: 200 }))

    const response = await GET(request('https://amadutown.com/api/auth/youtube/callback?code=code-1&state=state-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://amadutown.com/admin/social-content?youtube_connected=true&youtube_channel=Vambah+Sillah')
    expect(fetchSpy).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', expect.objectContaining({
      method: 'POST',
      body: expect.any(URLSearchParams),
    }))
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-token' },
      }),
    )
    expect(mocks.from).toHaveBeenCalledWith('social_content_config')
    expect(existingConfig.select).toHaveBeenCalledWith('credentials, settings')
    expect(existingConfig.eq).toHaveBeenCalledWith('platform', 'youtube')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'youtube',
      is_active: true,
      credentials: expect.objectContaining({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        scope: expect.stringContaining('youtube.force-ssl'),
      }),
      settings: expect.objectContaining({
        default_privacy: 'private',
        channel_id: 'UC123',
        channel_title: 'Vambah Sillah',
      }),
    }), { onConflict: 'platform' })
  })

  it('preserves the existing refresh token and settings when Google omits a new refresh token', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from
      .mockReturnValueOnce(mockExistingConfig({
        credentials: {
          refresh_token: 'existing-refresh-token',
          stale_field: 'keep-me',
        },
        settings: {
          default_privacy: 'unlisted',
          notify_subscribers: true,
          channel_id: 'OLD',
        },
      }))
      .mockReturnValueOnce({ upsert })
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'new-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.force-ssl',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{
          id: 'UC123',
          snippet: {
            title: 'AmaduTown Automation Solutions',
            customUrl: '@amadutownautomation',
          },
        }],
      }), { status: 200 }))

    const response = await GET(request('https://amadutown.com/api/auth/youtube/callback?code=code-1&state=state-1'))

    expect(response.status).toBe(307)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      credentials: expect.objectContaining({
        access_token: 'new-access-token',
        refresh_token: 'existing-refresh-token',
        stale_field: 'keep-me',
      }),
      settings: expect.objectContaining({
        default_privacy: 'unlisted',
        notify_subscribers: true,
        channel_id: 'UC123',
        channel_title: 'AmaduTown Automation Solutions',
      }),
    }), { onConflict: 'platform' })
  })

  it('uses the existing Google Gmail OAuth client secret as a compatibility fallback', async () => {
    delete process.env.YOUTUBE_CLIENT_ID
    delete process.env.YOUTUBE_CLIENT_SECRET
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID = 'gmail-google-client-id'
    process.env.GOOGLE_GMAIL_OAUTH_CLIENT_SECRET = 'gmail-google-client-secret'

    const upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.from
      .mockReturnValueOnce(mockExistingConfig())
      .mockReturnValueOnce({ upsert })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))

    await GET(request('https://amadutown.com/api/auth/youtube/callback?code=code-1&state=state-1'))

    const tokenRequest = fetchSpy.mock.calls[0]?.[1] as RequestInit
    const body = tokenRequest.body as URLSearchParams
    expect(body.get('client_id')).toBe('gmail-google-client-id')
    expect(body.get('client_secret')).toBe('gmail-google-client-secret')
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'youtube',
      is_active: true,
    }), { onConflict: 'platform' })
  })
})
