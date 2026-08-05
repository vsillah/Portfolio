import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildXOAuthUrl,
  createXCodeChallenge,
  createXCodeVerifier,
  getXOAuthClientId,
  setXOAuthCookies,
} from '@/lib/x-oauth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/x
 * Initiate X OAuth 2.0 PKCE for user-context posting.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const clientId = getXOAuthClientId()
    if (!clientId) {
      return NextResponse.json(
        { error: 'X_CLIENT_ID or TWITTER_CLIENT_ID is not configured' },
        { status: 500 },
      )
    }

    const origin = new URL(request.url).origin
    const state = crypto.randomUUID()
    const codeVerifier = createXCodeVerifier()
    const authUrl = buildXOAuthUrl({
      clientId,
      origin,
      state,
      codeChallenge: createXCodeChallenge(codeVerifier),
    })

    const response = NextResponse.json({ auth_url: authUrl.toString() })
    setXOAuthCookies(response, { origin, state, codeVerifier })
    return response
  } catch (error) {
    console.error('Error in GET /api/auth/x:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
