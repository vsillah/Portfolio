import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildMetaOAuthUrl,
  getMetaOAuthClientId,
  setMetaOAuthStateCookie,
} from '@/lib/meta-oauth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/meta
 * Initiate Meta OAuth for Facebook Page and Instagram Graph publishing.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const clientId = getMetaOAuthClientId()
    if (!clientId) {
      return NextResponse.json(
        { error: 'META_CLIENT_ID or FACEBOOK_CLIENT_ID is not configured' },
        { status: 500 },
      )
    }

    const origin = new URL(request.url).origin
    const state = crypto.randomUUID()
    const authUrl = buildMetaOAuthUrl({ clientId, origin, state })

    const response = NextResponse.json({ auth_url: authUrl.toString() })
    setMetaOAuthStateCookie(response, { origin, state })
    return response
  } catch (error) {
    console.error('Error in GET /api/auth/meta:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
