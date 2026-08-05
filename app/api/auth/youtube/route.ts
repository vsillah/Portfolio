import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload'
const YOUTUBE_READONLY_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly'
const YOUTUBE_FORCE_SSL_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'
const YOUTUBE_OAUTH_SCOPES = [
  YOUTUBE_UPLOAD_SCOPE,
  YOUTUBE_READONLY_SCOPE,
  YOUTUBE_FORCE_SSL_SCOPE,
]

function getGoogleOAuthClientId() {
  return process.env.YOUTUBE_CLIENT_ID
    || process.env.GOOGLE_CLIENT_ID
    || process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID
}

/**
 * GET /api/auth/youtube
 * Initiate Google OAuth for YouTube upload and playlist access.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const clientId = getGoogleOAuthClientId()
    if (!clientId) {
      return NextResponse.json(
        { error: 'YOUTUBE_CLIENT_ID, GOOGLE_CLIENT_ID, or GOOGLE_GMAIL_OAUTH_CLIENT_ID is not configured' },
        { status: 500 },
      )
    }

    const origin = new URL(request.url).origin
    const redirectUri = `${origin}/api/auth/youtube/callback`
    const state = crypto.randomUUID()

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('scope', YOUTUBE_OAUTH_SCOPES.join(' '))
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')
    authUrl.searchParams.set('include_granted_scopes', 'true')

    const response = NextResponse.json({ auth_url: authUrl.toString() })
    response.cookies.set('youtube_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: origin.startsWith('https://'),
      maxAge: 10 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error in GET /api/auth/youtube:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
