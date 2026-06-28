import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  isGmailUserOAuthClientConfigured: vi.fn(),
  isGmailUserOauthSecretConfigured: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/gmail-user-api', () => ({
  isGmailUserOAuthClientConfigured: mocks.isGmailUserOAuthClientConfigured,
}))

vi.mock('@/lib/gmail-user-oauth-secret', () => ({
  isGmailUserOauthSecretConfigured: mocks.isGmailUserOauthSecretConfigured,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

const BASE_ENV = { ...process.env }

function request() {
  return new NextRequest('http://localhost/api/admin/oauth/google-gmail/status', {
    headers: { authorization: 'Bearer token' },
  })
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

describe('GET /api/admin/oauth/google-gmail/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.BUSINESS_FROM_EMAIL = '"AmaduTown" <vambah@amadutown.com>'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(true)
    mocks.isGmailUserOauthSecretConfigured.mockReturnValue(true)
  })

  it('reports connection status and the required customer-facing sender', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { google_email: 'vambah@amadutown.com' },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      connected: true,
      googleEmail: 'vambah@amadutown.com',
      configured: true,
      requiredSender: 'vambah@amadutown.com',
    })
    expect(mocks.from).toHaveBeenCalledWith('admin_gmail_user_credentials')
    expect(eq).toHaveBeenCalledWith('user_id', 'admin-user')
  })
})
