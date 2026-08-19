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

function request(url = 'https://amadutown.com/api/auth/tiktok') {
  return new NextRequest(url)
}

describe('GET /api/auth/tiktok', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...BASE_ENV }
    process.env.TIKTOK_CLIENT_KEY = 'tiktok-client-key'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...BASE_ENV }
  })

  it('returns a TikTok OAuth URL with Direct Post scopes and state cookie', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    const body = await response.json()
    const authUrl = new URL(body.auth_url)
    expect(authUrl.origin).toBe('https://www.tiktok.com')
    expect(authUrl.pathname).toBe('/v2/auth/authorize/')
    expect(authUrl.searchParams.get('client_key')).toBe('tiktok-client-key')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/tiktok/callback')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('scope')).toBe('user.info.basic,video.publish')
    expect(body).toMatchObject({
      redirect_uri: 'https://amadutown.com/api/auth/tiktok/callback',
      required_scopes: ['user.info.basic', 'video.publish'],
    })
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(response.headers.get('set-cookie')).toContain('tiktok_oauth_state=')
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

  it('fails closed when no TikTok client key is configured', async () => {
    delete process.env.TIKTOK_CLIENT_KEY
    delete process.env.TIKTOK_CLIENT_ID

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_ID is not configured',
    })
  })

  it('can reuse TIKTOK_CLIENT_ID as a compatibility fallback', async () => {
    delete process.env.TIKTOK_CLIENT_KEY
    process.env.TIKTOK_CLIENT_ID = 'legacy-tiktok-client-id'

    const response = await GET(request())
    const body = await response.json()
    const authUrl = new URL(body.auth_url)

    expect(response.status).toBe(200)
    expect(authUrl.searchParams.get('client_key')).toBe('legacy-tiktok-client-id')
    expect(authUrl.searchParams.get('scope')).toBe('user.info.basic,video.publish')
  })

  it('keeps the oauth state cookie off Secure for http origins', async () => {
    const response = await GET(request('http://localhost:3000/api/auth/tiktok'))
    const cookie = response.headers.get('set-cookie') ?? ''

    expect(response.status).toBe(200)
    expect(cookie).toContain('tiktok_oauth_state=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).not.toContain('Secure')
  })

  it('returns a generic 500 when oauth setup throws', async () => {
    mocks.verifyAdmin.mockRejectedValueOnce(new Error('session lookup failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Internal server error' })
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
