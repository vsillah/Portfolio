import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import {
  X_OAUTH_SCOPES,
  X_OFFLINE_ACCESS_SCOPE,
  X_TWEET_READ_SCOPE,
  X_TWEET_WRITE_SCOPE,
  X_USER_READ_SCOPE,
  buildXRedirectUri,
  buildXOAuthUrl,
  clearXOAuthCookies,
  createXCodeChallenge,
  createXCodeVerifier,
  getXOAuthClientId,
  getXOAuthClientSecret,
  setXOAuthCookies,
} from '@/lib/x-oauth'

const BASE_ENV = { ...process.env }

describe('x-oauth helpers', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV }
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('prefers X_* credentials and falls back to TWITTER_*', () => {
    process.env.X_CLIENT_ID = 'x-id'
    process.env.X_CLIENT_SECRET = 'x-secret'
    expect(getXOAuthClientId()).toBe('x-id')
    expect(getXOAuthClientSecret()).toBe('x-secret')

    delete process.env.X_CLIENT_ID
    delete process.env.X_CLIENT_SECRET
    process.env.TWITTER_CLIENT_ID = 'twitter-id'
    process.env.TWITTER_CLIENT_SECRET = 'twitter-secret'
    expect(getXOAuthClientId()).toBe('twitter-id')
    expect(getXOAuthClientSecret()).toBe('twitter-secret')
  })

  it('builds a bare callback redirect URI without query params', () => {
    expect(buildXRedirectUri('https://amadutown.com')).toBe('https://amadutown.com/api/auth/x/callback')
    expect(buildXRedirectUri('http://localhost:3000')).toBe('http://localhost:3000/api/auth/x/callback')
  })

  it('creates a PKCE verifier and matching S256 challenge', () => {
    const verifier = createXCodeVerifier()
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(verifier.length).toBeGreaterThanOrEqual(43)

    const challenge = createXCodeChallenge(verifier)
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'))
  })

  it('builds an authorize URL with write/read scopes and PKCE params', () => {
    const authUrl = buildXOAuthUrl({
      clientId: 'client-1',
      origin: 'https://amadutown.com',
      state: 'state-1',
      codeChallenge: 'challenge-1',
    })

    expect(authUrl.origin).toBe('https://x.com')
    expect(authUrl.pathname).toBe('/i/oauth2/authorize')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('client_id')).toBe('client-1')
    expect(authUrl.searchParams.get('redirect_uri')).toBe('https://amadutown.com/api/auth/x/callback')
    expect(authUrl.searchParams.get('state')).toBe('state-1')
    expect(authUrl.searchParams.get('code_challenge')).toBe('challenge-1')
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')

    const scopes = authUrl.searchParams.get('scope')?.split(' ') ?? []
    expect(scopes).toEqual(expect.arrayContaining([
      X_TWEET_READ_SCOPE,
      X_TWEET_WRITE_SCOPE,
      X_USER_READ_SCOPE,
      X_OFFLINE_ACCESS_SCOPE,
    ]))
    expect(X_OAUTH_SCOPES).toEqual([
      X_TWEET_READ_SCOPE,
      X_TWEET_WRITE_SCOPE,
      X_USER_READ_SCOPE,
      X_OFFLINE_ACCESS_SCOPE,
    ])
  })

  it('sets httpOnly PKCE cookies and clears both on logout of the flow', () => {
    const response = NextResponse.json({ ok: true })
    setXOAuthCookies(response, {
      origin: 'https://amadutown.com',
      state: 'state-abc',
      codeVerifier: 'verifier-abc',
    })

    const setCookie = response.headers.getSetCookie?.() ?? []
    const joined = setCookie.join('\n') || String(response.headers.get('set-cookie') || '')
    expect(joined).toContain('x_oauth_state=state-abc')
    expect(joined).toContain('x_oauth_code_verifier=verifier-abc')
    expect(joined.toLowerCase()).toContain('httponly')
    expect(joined.toLowerCase()).toContain('secure')

    clearXOAuthCookies(response)
    const afterClear = response.headers.getSetCookie?.() ?? []
    const cleared = afterClear.join('\n') || String(response.headers.get('set-cookie') || '')
    expect(cleared).toMatch(/x_oauth_state=/)
    expect(cleared).toMatch(/x_oauth_code_verifier=/)
  })

  it('marks cookies insecure for http origins', () => {
    const response = NextResponse.json({ ok: true })
    setXOAuthCookies(response, {
      origin: 'http://localhost:3000',
      state: 'state-local',
      codeVerifier: 'verifier-local',
    })

    const setCookie = response.headers.getSetCookie?.() ?? []
    const joined = setCookie.join('\n') || String(response.headers.get('set-cookie') || '')
    expect(joined.toLowerCase()).not.toMatch(/;\s*secure/i)
  })
})
