import { NextResponse } from 'next/server'

export const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v20.0'

export const META_OAUTH_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_content_publish',
]

export function getMetaOAuthClientId() {
  return process.env.META_CLIENT_ID
    || process.env.FACEBOOK_CLIENT_ID
}

export function getMetaOAuthClientSecret() {
  return process.env.META_CLIENT_SECRET
    || process.env.FACEBOOK_CLIENT_SECRET
}

export function getMetaOAuthConfigId() {
  return process.env.META_CONFIG_ID
    || process.env.FACEBOOK_CONFIG_ID
}

export function buildMetaRedirectUri(origin: string) {
  return `${origin}/api/auth/meta/callback`
}

export function buildMetaOAuthUrl(input: {
  clientId: string
  origin: string
  state: string
}) {
  const authUrl = new URL(`https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth`)
  authUrl.searchParams.set('client_id', input.clientId)
  authUrl.searchParams.set('redirect_uri', buildMetaRedirectUri(input.origin))
  authUrl.searchParams.set('state', input.state)
  const configId = getMetaOAuthConfigId()
  if (configId) authUrl.searchParams.set('config_id', configId)
  authUrl.searchParams.set('scope', META_OAUTH_SCOPES.join(','))
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('auth_type', 'rerequest')
  return authUrl
}

export function setMetaOAuthStateCookie(response: NextResponse, input: {
  origin: string
  state: string
}) {
  response.cookies.set('meta_oauth_state', input.state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: input.origin.startsWith('https://'),
    maxAge: 10 * 60,
    path: '/',
  })
}

export function clearMetaOAuthCookies(response: NextResponse) {
  response.cookies.delete('meta_oauth_state')
}
