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

function request(url = 'https://amadutown.com/api/auth/meta') {
  return new NextRequest(url)
}

describe('GET /api/auth/meta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...BASE_ENV }
    process.env.META_CLIENT_ID = 'meta-client-id'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('returns a Meta OAuth URL with Page and Instagram scopes plus state cookie', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    const body = await response.json()
    const authUrl = new URL(body.auth_url)
    expect(authUrl.origin).toBe('https://www.facebook.com')
    expect(authUrl.pathname).toBe('/v20.0/dialog/oauth')
    expect(authUrl.searchParams.get('client_id')).toBe('meta-client-id')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/meta/callback')
    expect(authUrl.searchParams.get('scope')).toContain('pages_manage_posts')
    expect(authUrl.searchParams.get('scope')).toContain('instagram_manage_comments')
    expect(authUrl.searchParams.get('scope')).toContain('instagram_content_publish')
    expect(response.headers.get('set-cookie')).toContain('meta_oauth_state=')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })

  it('includes the Facebook Login for Business configuration id when configured', async () => {
    process.env.META_CONFIG_ID = 'meta-config-id'

    const response = await GET(request())

    expect(response.status).toBe(200)
    const body = await response.json()
    const authUrl = new URL(body.auth_url)
    expect(authUrl.searchParams.get('config_id')).toBe('meta-config-id')
  })

  it('requires admin authorization before creating the oauth state cookie', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('fails closed when no Meta OAuth client id is configured', async () => {
    delete process.env.META_CLIENT_ID
    delete process.env.FACEBOOK_CLIENT_ID

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'META_CLIENT_ID or FACEBOOK_CLIENT_ID is not configured',
    })
  })
})
