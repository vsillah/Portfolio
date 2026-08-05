import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildYouTubeOAuthUrl,
  getGoogleOAuthClientId,
  setYouTubeOAuthStateCookie,
} from '@/lib/youtube-oauth'

export const dynamic = 'force-dynamic'

function redirectToQueue(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/admin/social-content', request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url)
}

/**
 * GET /admin/social-content/youtube/reconnect
 * Browser-friendly YouTube OAuth entrypoint for operators. The API endpoint
 * still returns JSON for programmatic callers; this route performs the visible
 * redirect needed by manual reconnect flows.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('redirect', '/admin/social-content/youtube/reconnect')
      return NextResponse.redirect(loginUrl)
    }

    const clientId = getGoogleOAuthClientId()
    if (!clientId) {
      return redirectToQueue(request, { youtube_error: 'missing_client_id' })
    }

    const origin = new URL(request.url).origin
    const state = crypto.randomUUID()
    const authUrl = buildYouTubeOAuthUrl({ clientId, origin, state })
    const response = NextResponse.redirect(authUrl)
    setYouTubeOAuthStateCookie(response, { origin, state })
    return response
  } catch (error) {
    console.error('Error in GET /admin/social-content/youtube/reconnect:', error)
    return redirectToQueue(request, { youtube_error: 'internal_error' })
  }
}
