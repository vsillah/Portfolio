import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import {
  X_OAUTH_SCOPES,
  buildXOAuthUrl,
  buildXRedirectUri,
  clearXOAuthCookies,
  createXCodeChallenge,
  createXCodeVerifier,
  getXOAuthClientId,
  getXOAuthClientSecret,
  setXOAuthCookies,
} from './x-oauth'

const BASE_ENV = { ...process.env }

describe('x-oauth helpers', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV }
    delete process.env.X_CLIENT_ID
    delete process.env.TWITTER_CLIENT_ID
    delete process.env.X_CLIENT_SECRET
    delete process.env.TWITTER_CLIENT_SECRET
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('prefers X_* credentials and falls back to TWITTER_* aliases', () => {
    process.env.TWITTER_CLIENT_ID = 'twitter-id'
    process.env.TWITTER_CLIENT_SECRET = 'twitter-secret'
    expect(getXOAuthClientId()).toBe('twitter-id')
    expect(getXOAuthClientSecret()).toBe('twitter-secret')

    process.env.X_CLIENT_ID = 'x-id'
    process.env.X_CLIENT_SECRET = 'x-secret'
    expect(getXOAuthClientId()).toBe('x-id')
    expect(getXOAuthClientSecret()).toBe('x-secret')
  })

  it('builds the callback URI and PKCE authorize URL with posting scopes', () => {
    const origin = 'https://amadutown.com'
    expect(buildXRedirectUri(origin)).toBe('https://amadutown.com/api/auth/x/callback')

    const verifier = 'pkce-verifier'
    const authUrl = buildXOAuthUrl({
      clientId: 'x-client-id',
      origin,
      state: 'state-1',
      codeChallenge: createXCodeChallenge(verifier),
    })

    expect(authUrl.origin).toBe('https://x.com')
    expect(authUrl.pathname).toBe('/i/oauth2/authorize')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('client_id')).toBe('x-client-id')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/x/callback')
    expect(authUrl.searchParams.get('scope')).toBe(X_OAUTH_SCOPES.join(' '))
    expect(authUrl.searchParams.get('scope')).toContain('tweet.write')
    expect(authUrl.searchParams.get('scope')).toContain('offline.access')
    expect(authUrl.searchParams.get('state')).toBe('state-1')
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
    expect(authUrl.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier).digest('base64url'),
    )
  })

  it('creates unique base64url PKCE verifiers', () => {
    const first = createXCodeVerifier()
    const second = createXCodeVerifier()
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(second).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(first).not.toBe(second)
    expect(first.length).toBeGreaterThan(32)
  })

  it('sets httpOnly PKCE cookies and marks them secure only on https origins', () => {
    const httpsResponse = NextResponse.json({ ok: true })
    setXOAuthCookies(httpsResponse, {
      origin: 'https://amadutown.com',
      state: 'state-https',
      codeVerifier: 'verifier-https',
    })
    const httpsCookie = httpsResponse.headers.get('set-cookie') || ''
    expect(httpsCookie).toContain('x_oauth_state=state-https')
    expect(httpsCookie).toContain('x_oauth_code_verifier=verifier-https')
    expect(httpsCookie).toContain('HttpOnly')
    expect(httpsCookie.toLowerCase()).toContain('secure')

    const httpResponse = NextResponse.json({ ok: true })
    setXOAuthCookies(httpResponse, {
      origin: 'http://localhost:3000',
      state: 'state-http',
      codeVerifier: 'verifier-http',
    })
    const httpCookie = httpResponse.headers.get('set-cookie') || ''
    expect(httpCookie).toContain('x_oauth_state=state-http')
    expect(httpCookie.toLowerCase()).not.toContain('secure')
  })

  it('clears both PKCE cookies after the callback finishes', () => {
    const response = NextResponse.json({ ok: true })
    setXOAuthCookies(response, {
      origin: 'https://amadutown.com',
      state: 'state-1',
      codeVerifier: 'verifier-1',
    })
    clearXOAuthCookies(response)
    const cookie = response.headers.get('set-cookie') || ''
    expect(cookie).toMatch(/x_oauth_state=;/i)
    expect(cookie).toMatch(/x_oauth_code_verifier=;/i)
  })
})
