import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildTikTokOAuthUrl,
  buildTikTokRedirectUri,
  getTikTokOAuthClientKey,
  setTikTokOAuthStateCookie,
  TIKTOK_OAUTH_SCOPES,
} from '@/lib/tiktok-oauth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/tiktok
 * Initiate TikTok Login Kit OAuth for Content Posting API Direct Post setup.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const clientKey = getTikTokOAuthClientKey()
    if (!clientKey) {
      return NextResponse.json(
        { error: 'TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_ID is not configured' },
        { status: 500 },
      )
    }

    const origin = new URL(request.url).origin
    const state = crypto.randomUUID()
    const authUrl = buildTikTokOAuthUrl({ clientKey, origin, state })

    const response = NextResponse.json({
      auth_url: authUrl.toString(),
      redirect_uri: buildTikTokRedirectUri(origin),
      required_scopes: TIKTOK_OAUTH_SCOPES,
    })
    setTikTokOAuthStateCookie(response, { origin, state })
    return response
  } catch (error) {
    console.error('Error in GET /api/auth/tiktok:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
