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

function request(url: string) {
  return new NextRequest(url)
}

describe('GET /api/auth/linkedin/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...BASE_ENV }
    process.env.LINKEDIN_CLIENT_ID = 'linkedin-client-id'
    process.env.LINKEDIN_CLIENT_SECRET = 'linkedin-client-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...BASE_ENV }
  })

  it('redirects LinkedIn error params without exchanging a token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/linkedin/callback?error=access_denied'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?linkedin_error=access_denied',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('redirects when the authorization code is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(request('https://amadutown.com/api/auth/linkedin/callback'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?linkedin_error=no_code',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fails closed when client credentials are missing', async () => {
    delete process.env.LINKEDIN_CLIENT_SECRET
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const response = await GET(
      request('https://amadutown.com/api/auth/linkedin/callback?code=code-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?linkedin_error=missing_config',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('redirects token exchange failures without writing credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('invalid_grant', { status: 400 }),
    )

    const response = await GET(
      request('https://amadutown.com/api/auth/linkedin/callback?code=code-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?linkedin_error=token_exchange_failed',
    )
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('stores the access token and person URN then marks LinkedIn active', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ update })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          access_token: 'access-token',
          expires_in: 3600,
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sub: 'person-sub' }), { status: 200 }),
      )

    const response = await GET(
      request('https://amadutown.com/api/auth/linkedin/callback?code=code-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?linkedin_connected=true',
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'https://www.linkedin.com/oauth/v2/accessToken',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(mocks.from).toHaveBeenCalledWith('social_content_config')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      is_active: true,
      credentials: expect.objectContaining({
        access_token: 'access-token',
        expires_in: 3600,
        person_urn: 'urn:li:person:person-sub',
      }),
      settings: {
        author_urn: 'urn:li:person:person-sub',
        post_visibility: 'PUBLIC',
      },
    }))
    expect(eq).toHaveBeenCalledWith('platform', 'linkedin')
  })

  it('still stores credentials when the profile lookup fails', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) })
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token', expires_in: 60 }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))

    const response = await GET(
      request('https://amadutown.com/api/auth/linkedin/callback?code=code-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('linkedin_connected=true')
    expect(eq).toHaveBeenCalledWith('platform', 'linkedin')
  })
})
