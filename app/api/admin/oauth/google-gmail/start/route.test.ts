import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  isGmailUserOAuthClientConfigured: vi.fn(),
  isGmailUserOauthSecretConfigured: vi.fn(),
  buildGmailUserAuthorizeUrl: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/gmail-user-api', () => ({
  buildGmailUserAuthorizeUrl: mocks.buildGmailUserAuthorizeUrl,
  isGmailUserOAuthClientConfigured: mocks.isGmailUserOAuthClientConfigured,
}))

vi.mock('@/lib/gmail-user-oauth-secret', () => ({
  isGmailUserOauthSecretConfigured: mocks.isGmailUserOauthSecretConfigured,
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/oauth/google-gmail/start', {
    headers: { authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/oauth/google-gmail/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(true)
    mocks.isGmailUserOauthSecretConfigured.mockReturnValue(true)
    mocks.buildGmailUserAuthorizeUrl.mockReturnValue(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed',
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('requires admin auth before issuing an authorize URL', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.buildGmailUserAuthorizeUrl).not.toHaveBeenCalled()
  })

  it('returns 503 when the Gmail OAuth client or signing secret is missing', async () => {
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(false)

    const missingClient = await GET(request())
    expect(missingClient.status).toBe(503)
    expect(await missingClient.json()).toEqual({
      error: 'Gmail account connection is not configured for this site.',
    })

    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(true)
    mocks.isGmailUserOauthSecretConfigured.mockReturnValue(false)

    const missingSecret = await GET(request())
    expect(missingSecret.status).toBe(503)
    expect(mocks.buildGmailUserAuthorizeUrl).not.toHaveBeenCalled()
  })

  it('returns an authorize URL bound to the authenticated admin user', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?state=signed',
    })
    expect(mocks.buildGmailUserAuthorizeUrl).toHaveBeenCalledWith('admin-user')
  })

  it('returns a generic 500 when authorize URL construction throws', async () => {
    mocks.buildGmailUserAuthorizeUrl.mockImplementation(() => {
      throw new Error('state hmac failed')
    })

    const response = await GET(request())

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Something went wrong. Please try again.',
    })
  })
})
