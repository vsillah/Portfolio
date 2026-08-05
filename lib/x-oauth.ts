import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'

export const X_TWEET_READ_SCOPE = 'tweet.read'
export const X_TWEET_WRITE_SCOPE = 'tweet.write'
export const X_USER_READ_SCOPE = 'users.read'
export const X_OFFLINE_ACCESS_SCOPE = 'offline.access'

export const X_OAUTH_SCOPES = [
  X_TWEET_READ_SCOPE,
  X_TWEET_WRITE_SCOPE,
  X_USER_READ_SCOPE,
  X_OFFLINE_ACCESS_SCOPE,
]

export function getXOAuthClientId() {
  return process.env.X_CLIENT_ID
    || process.env.TWITTER_CLIENT_ID
}

export function getXOAuthClientSecret() {
  return process.env.X_CLIENT_SECRET
    || process.env.TWITTER_CLIENT_SECRET
}

export function buildXRedirectUri(origin: string) {
  return `${origin}/api/auth/x/callback`
}

export function createXCodeVerifier() {
  return randomBytes(48).toString('base64url')
}

export function createXCodeChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function buildXOAuthUrl(input: {
  clientId: string
  origin: string
  state: string
  codeChallenge: string
}) {
  const authUrl = new URL('https://x.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', input.clientId)
  authUrl.searchParams.set('redirect_uri', buildXRedirectUri(input.origin))
  authUrl.searchParams.set('scope', X_OAUTH_SCOPES.join(' '))
  authUrl.searchParams.set('state', input.state)
  authUrl.searchParams.set('code_challenge', input.codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  return authUrl
}

export function setXOAuthCookies(response: NextResponse, input: {
  origin: string
  state: string
  codeVerifier: string
}) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: input.origin.startsWith('https://'),
    maxAge: 10 * 60,
    path: '/',
  }

  response.cookies.set('x_oauth_state', input.state, cookieOptions)
  response.cookies.set('x_oauth_code_verifier', input.codeVerifier, cookieOptions)
}

export function clearXOAuthCookies(response: NextResponse) {
  response.cookies.delete('x_oauth_state')
  response.cookies.delete('x_oauth_code_verifier')
}
