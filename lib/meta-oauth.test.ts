import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextResponse } from 'next/server'
import {
  META_GRAPH_API_VERSION,
  META_OAUTH_SCOPES,
  buildMetaOAuthUrl,
  buildMetaRedirectUri,
  clearMetaOAuthCookies,
  getMetaOAuthClientId,
  getMetaOAuthClientSecret,
  setMetaOAuthStateCookie,
} from '@/lib/meta-oauth'

const BASE_ENV = { ...process.env }

describe('meta-oauth helpers', () => {
  beforeEach(() => {
    process.env = { ...BASE_ENV }
    delete process.env.META_GRAPH_API_VERSION
  })

  afterEach(() => {
    process.env = { ...BASE_ENV }
  })

  it('prefers META_* credentials and falls back to FACEBOOK_*', () => {
    process.env.META_CLIENT_ID = 'meta-id'
    process.env.META_CLIENT_SECRET = 'meta-secret'
    expect(getMetaOAuthClientId()).toBe('meta-id')
    expect(getMetaOAuthClientSecret()).toBe('meta-secret')

    delete process.env.META_CLIENT_ID
    delete process.env.META_CLIENT_SECRET
    process.env.FACEBOOK_CLIENT_ID = 'fb-id'
    process.env.FACEBOOK_CLIENT_SECRET = 'fb-secret'
    expect(getMetaOAuthClientId()).toBe('fb-id')
    expect(getMetaOAuthClientSecret()).toBe('fb-secret')
  })

  it('builds a bare Meta callback redirect URI without query params', () => {
    expect(buildMetaRedirectUri('https://amadutown.com')).toBe(
      'https://amadutown.com/api/auth/meta/callback',
    )
  })

  it('builds a Facebook dialog URL with Page and Instagram publish scopes', () => {
    const authUrl = buildMetaOAuthUrl({
      clientId: 'meta-client',
      origin: 'https://amadutown.com',
      state: 'state-1',
    })

    expect(authUrl.origin).toBe('https://www.facebook.com')
    expect(authUrl.pathname).toBe(`/${META_GRAPH_API_VERSION}/dialog/oauth`)
    expect(authUrl.searchParams.get('client_id')).toBe('meta-client')
    expect(authUrl.searchParams.get('redirect_uri')).toBe(
      'https://amadutown.com/api/auth/meta/callback',
    )
    expect(authUrl.searchParams.get('state')).toBe('state-1')
    expect(authUrl.searchParams.get('response_type')).toBe('code')
    expect(authUrl.searchParams.get('auth_type')).toBe('rerequest')

    const scopes = authUrl.searchParams.get('scope')?.split(',') ?? []
    expect(scopes).toEqual(META_OAUTH_SCOPES)
    expect(scopes).toEqual(expect.arrayContaining([
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
    ]))
  })

  it('sets an httpOnly state cookie and clears it after the flow', () => {
    const response = NextResponse.json({ ok: true })
    setMetaOAuthStateCookie(response, {
      origin: 'https://amadutown.com',
      state: 'meta-state',
    })

    const setCookie = response.headers.getSetCookie?.() ?? []
    const joined = setCookie.join('\n') || String(response.headers.get('set-cookie') || '')
    expect(joined).toContain('meta_oauth_state=meta-state')
    expect(joined.toLowerCase()).toContain('httponly')
    expect(joined.toLowerCase()).toContain('secure')

    clearMetaOAuthCookies(response)
    const afterClear = response.headers.getSetCookie?.() ?? []
    const cleared = afterClear.join('\n') || String(response.headers.get('set-cookie') || '')
    expect(cleared).toMatch(/meta_oauth_state=/)
  })
})
