import { NextResponse } from 'next/server'

export const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload'
export const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'
export const YOUTUBE_FORCE_SSL_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'

export const YOUTUBE_OAUTH_SCOPES = [
  YOUTUBE_UPLOAD_SCOPE,
  YOUTUBE_READONLY_SCOPE,
  YOUTUBE_FORCE_SSL_SCOPE,
]

export function getGoogleOAuthClientId() {
  return process.env.YOUTUBE_CLIENT_ID
    || process.env.GOOGLE_CLIENT_ID
    || process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID
}

export function buildYouTubeOAuthUrl(input: {
  clientId: string
  origin: string
  state: string
}) {
  const redirectUri = `${input.origin}/api/auth/youtube/callback`
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', input.clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', input.state)
  authUrl.searchParams.set('scope', YOUTUBE_OAUTH_SCOPES.join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('include_granted_scopes', 'true')
  return authUrl
}

export function setYouTubeOAuthStateCookie(response: NextResponse, input: {
  origin: string
  state: string
}) {
  response.cookies.set('youtube_oauth_state', input.state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: input.origin.startsWith('https://'),
    maxAge: 10 * 60,
    path: '/',
  })
}
