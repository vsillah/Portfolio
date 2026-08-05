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

function request(url = 'https://amadutown.com/api/auth/youtube') {
  return new NextRequest(url)
}

describe('GET /api/auth/youtube', () => {
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

  it('returns a Google OAuth URL with upload, playlist, offline access, and state cookie', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    const body = await response.json()
    const authUrl = new URL(body.auth_url)
    expect(authUrl.origin).toBe('https://accounts.google.com')
    expect(authUrl.searchParams.get('client_id')).toBe('youtube-client-id')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/youtube/callback')
    expect(authUrl.searchParams.get('access_type')).toBe('offline')
    expect(authUrl.searchParams.get('prompt')).toBe('consent')
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.upload')
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.readonly')
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.force-ssl')
    expect(response.headers.get('set-cookie')).toContain('youtube_oauth_state=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })

  it('requires admin authorization before creating the oauth state cookie', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('fails closed when no Google OAuth client id is configured', async () => {
    delete process.env.YOUTUBE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'YOUTUBE_CLIENT_ID, GOOGLE_CLIENT_ID, or GOOGLE_GMAIL_OAUTH_CLIENT_ID is not configured',
    })
  })

  it('can reuse the existing Google Gmail OAuth client id as a compatibility fallback', async () => {
    delete process.env.YOUTUBE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_ID
    process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID = 'gmail-google-client-id'

    const response = await GET(request())
    const body = await response.json()
    const authUrl = new URL(body.auth_url)

    expect(response.status).toBe(200)
    expect(authUrl.searchParams.get('client_id')).toBe('gmail-google-client-id')
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.upload')
    expect(authUrl.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/youtube.force-ssl')
  })
})
