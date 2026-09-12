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

function request(url = 'https://amadutown.com/api/auth/x') {
  return new NextRequest(url)
}

describe('GET /api/auth/x', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...BASE_ENV }
    process.env.X_CLIENT_ID = 'x-client-id'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('returns an X OAuth URL with PKCE cookies and posting scopes', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    const body = await response.json()
    const authUrl = new URL(body.auth_url)
    expect(authUrl.origin).toBe('https://x.com')
    expect(authUrl.pathname).toBe('/i/oauth2/authorize')
    expect(authUrl.searchParams.get('client_id')).toBe('x-client-id')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/x/callback')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authUrl.searchParams.get('code_challenge')).toBeTruthy()
    expect(authUrl.searchParams.get('scope')).toContain('tweet.write')
    expect(authUrl.searchParams.get('scope')).toContain('offline.access')
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(JSON.stringify(body)).not.toContain('verifier')

    const cookie = response.headers.get('set-cookie') || ''
    expect(cookie).toContain('x_oauth_state=')
    expect(cookie).toContain('x_oauth_code_verifier=')
    expect(cookie).toContain('HttpOnly')
  })

  it('requires admin authorization before creating oauth cookies', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('fails closed when no X client id is configured', async () => {
    delete process.env.X_CLIENT_ID
    delete process.env.TWITTER_CLIENT_ID

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'X_CLIENT_ID or TWITTER_CLIENT_ID is not configured',
    })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('can reuse the Twitter client id alias when X_CLIENT_ID is unset', async () => {
    delete process.env.X_CLIENT_ID
    process.env.TWITTER_CLIENT_ID = 'twitter-client-id'

    const response = await GET(request())
    const body = await response.json()
    const authUrl = new URL(body.auth_url)

    expect(response.status).toBe(200)
    expect(authUrl.searchParams.get('client_id')).toBe('twitter-client-id')
  })
})
