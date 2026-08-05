import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { GET } from './route'

const BASE_ENV = { ...process.env }

function request(url = 'https://amadutown.com/admin/social-content/youtube/reconnect') {
  return new NextRequest(url)
}

describe('GET /admin/social-content/youtube/reconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...BASE_ENV }
    process.env.YOUTUBE_CLIENT_ID = 'youtube-client-id'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('redirects an authenticated operator to Google OAuth with playlist scope and state cookie', async () => {
    const response = await GET(request())

    expect(response.status).toBe(307)
    const authUrl = new URL(response.headers.get('location') || '')
    expect(authUrl.origin).toBe('https://accounts.google.com')
    expect(authUrl.searchParams.get('client_id')).toBe('youtube-client-id')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/youtube/callback')
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.upload')
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.readonly')
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.force-ssl')
    expect(response.headers.get('set-cookie')).toContain('youtube_oauth_state=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })

  it('sends unauthenticated operators to login with reconnect redirect preserved', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)

    const response = await GET(request())

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/auth/login?redirect=%2Fadmin%2Fsocial-content%2Fyoutube%2Freconnect',
    )
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('redirects back to the queue when no YouTube OAuth client id is configured', async () => {
    delete process.env.YOUTUBE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID

    const response = await GET(request())

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://amadutown.com/admin/social-content?youtube_error=missing_client_id',
    )
  })
})
