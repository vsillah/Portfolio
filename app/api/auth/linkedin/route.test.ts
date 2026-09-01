import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from './route'

const BASE_ENV = { ...process.env }

function request(url = 'https://amadutown.com/api/auth/linkedin') {
  return new NextRequest(url)
}

describe('GET /api/auth/linkedin', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV }
    process.env.LINKEDIN_CLIENT_ID = 'linkedin-client-id'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
    vi.restoreAllMocks()
  })

  it('fails closed when LINKEDIN_CLIENT_ID is missing', async () => {
    delete process.env.LINKEDIN_CLIENT_ID

    const response = await GET(request())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'LINKEDIN_CLIENT_ID not configured in .env.local',
    })
  })

  it('redirects to LinkedIn authorize with the callback URI and member scopes', async () => {
    const response = await GET(request())

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location') || '')
    expect(location.origin).toBe('https://www.linkedin.com')
    expect(location.pathname).toBe('/oauth/v2/authorization')
    expect(location.searchParams.get('response_type')).toBe('code')
    expect(location.searchParams.get('client_id')).toBe('linkedin-client-id')
    expect(location.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/linkedin/callback')
    expect(location.searchParams.get('scope')).toBe('openid profile w_member_social')
    expect(location.searchParams.get('state')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })
})
