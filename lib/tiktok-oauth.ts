import { NextResponse } from 'next/server'

export const TIKTOK_USER_INFO_SCOPE = 'user.info.basic'
export const TIKTOK_DIRECT_POST_SCOPE = 'video.publish'

export const TIKTOK_OAUTH_SCOPES = [
  TIKTOK_USER_INFO_SCOPE,
  TIKTOK_DIRECT_POST_SCOPE,
]

export function getTikTokOAuthClientKey() {
  return process.env.TIKTOK_CLIENT_KEY
    || process.env.TIKTOK_CLIENT_ID
}

export function getTikTokOAuthClientSecret() {
  return process.env.TIKTOK_CLIENT_SECRET
}

export function buildTikTokRedirectUri(origin: string) {
  return `${origin}/api/auth/tiktok/callback`
}

export function buildTikTokOAuthUrl(input: {
  clientKey: string
  origin: string
  state: string
}) {
  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/')
  authUrl.searchParams.set('client_key', input.clientKey)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', TIKTOK_OAUTH_SCOPES.join(','))
  authUrl.searchParams.set('redirect_uri', buildTikTokRedirectUri(input.origin))
  authUrl.searchParams.set('state', input.state)
  return authUrl
}

export function setTikTokOAuthStateCookie(response: NextResponse, input: {
  origin: string
  state: string
}) {
  response.cookies.set('tiktok_oauth_state', input.state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: input.origin.startsWith('https://'),
    maxAge: 10 * 60,
    path: '/',
  })
}

export function clearTikTokOAuthCookies(response: NextResponse) {
  response.cookies.delete('tiktok_oauth_state')
}
