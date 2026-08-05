import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildYouTubeOAuthUrl,
  getGoogleOAuthClientId,
  setYouTubeOAuthStateCookie,
} from '@/lib/youtube-oauth'

export const dynamic = 'force-dynamic'

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
    const state = crypto.randomUUID()
    const authUrl = buildYouTubeOAuthUrl({ clientId, origin, state })

    const response = NextResponse.json({ auth_url: authUrl.toString() })
    setYouTubeOAuthStateCookie(response, { origin, state })

    return response
  } catch (error) {
    console.error('Error in GET /api/auth/youtube:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
