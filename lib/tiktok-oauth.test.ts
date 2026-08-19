import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import {
  TIKTOK_OAUTH_SCOPES,
  buildTikTokOAuthUrl,
  buildTikTokRedirectUri,
  clearTikTokOAuthCookies,
  getTikTokOAuthClientKey,
  getTikTokOAuthClientSecret,
  setTikTokOAuthStateCookie,
} from './tiktok-oauth'

const BASE_ENV = { ...process.env }

describe('tiktok oauth helpers', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV }
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('prefers TIKTOK_CLIENT_KEY and falls back to TIKTOK_CLIENT_ID', () => {
    process.env.TIKTOK_CLIENT_KEY = 'client-key'
    process.env.TIKTOK_CLIENT_ID = 'legacy-client-id'

    expect(getTikTokOAuthClientKey()).toBe('client-key')

    delete process.env.TIKTOK_CLIENT_KEY
    expect(getTikTokOAuthClientKey()).toBe('legacy-client-id')
  })

  it('returns undefined when neither TikTok client key alias is set', () => {
    delete process.env.TIKTOK_CLIENT_KEY
    delete process.env.TIKTOK_CLIENT_ID

    expect(getTikTokOAuthClientKey()).toBeUndefined()
    expect(getTikTokOAuthClientSecret()).toBeUndefined()
  })

  it('builds a Login Kit URL with Direct Post scopes and a bare callback URI', () => {
    const authUrl = buildTikTokOAuthUrl({
      clientKey: 'client-key',
      origin: 'https://amadutown.com',
      state: 'state-1',
    })

    expect(authUrl.origin).toBe('https://www.tiktok.com')
    expect(authUrl.pathname).toBe('/v2/auth/authorize/')
    expect(authUrl.searchParams.get('client_key')).toBe('client-key')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('scope')).toBe(TIKTOK_OAUTH_SCOPES.join(','))
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/tiktok/callback')
    expect(authUrl.searchParams.get('state')).toBe('state-1')
    expect(authUrl.search).not.toContain('next=')
    expect(buildTikTokRedirectUri('https://amadutown.com')).toBe('https://amadutown.com/api/auth/tiktok/callback')
  })

  it('marks the oauth state cookie Secure only on https origins and can clear it', () => {
    const httpsResponse = NextResponse.json({})
    setTikTokOAuthStateCookie(httpsResponse, {
      origin: 'https://amadutown.com',
      state: 'state-https',
    })
    const httpsCookie = httpsResponse.headers.get('set-cookie') ?? ''
    expect(httpsCookie).toContain('tiktok_oauth_state=state-https')
    expect(httpsCookie).toContain('HttpOnly')
    expect(httpsCookie).toContain('Secure')
    expect(httpsCookie).toMatch(/Max-Age=600/i)

    const httpResponse = NextResponse.json({})
    setTikTokOAuthStateCookie(httpResponse, {
      origin: 'http://localhost:3000',
      state: 'state-http',
    })
    const httpCookie = httpResponse.headers.get('set-cookie') ?? ''
    expect(httpCookie).toContain('tiktok_oauth_state=state-http')
    expect(httpCookie).toContain('HttpOnly')
    expect(httpCookie).not.toContain('Secure')

    clearTikTokOAuthCookies(httpsResponse)
    const clearedCookie = httpsResponse.headers.get('set-cookie') ?? ''
    expect(clearedCookie).toMatch(/tiktok_oauth_state=;/i)
  })
})
