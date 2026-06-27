import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {},
}))

vi.mock('@/lib/gmail-user-oauth-state', () => ({
  verifyOAuthState: vi.fn(),
}))

vi.mock('@/lib/gmail-user-oauth-crypto', () => ({
  encryptRefreshToken: vi.fn(),
}))

vi.mock('@/lib/gmail-user-api', () => ({
  exchangeCodeForTokens: vi.fn(),
  fetchGoogleAccountEmail: vi.fn(),
  isGmailUserOAuthClientConfigured: vi.fn(),
}))

vi.mock('@/lib/gmail-user-oauth-secret', () => ({
  isGmailUserOauthSecretConfigured: vi.fn(),
}))

import { GET } from './route'

describe('GET /api/admin/oauth/google-gmail/callback', () => {
  it('redirects OAuth failures back to the Credentials Gmail panel', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/oauth/google-gmail/callback?error=access_denied')
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost/admin/credentials?gmail_oauth_error=1#gmail-profile'
    )
  })
})
