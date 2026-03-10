import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/linkedin
 * Initiate LinkedIn OAuth 2.0 authorization flow
 * Admin-only — redirects to LinkedIn authorization URL
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { error: 'LINKEDIN_CLIENT_ID not configured' },
        { status: 500 }
      )
    }

    const origin = new URL(request.url).origin
    const redirectUri = `${origin}/api/auth/linkedin/callback`
    const state = crypto.randomUUID()
    const scope = 'openid profile w_member_social'

    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('scope', scope)

    return NextResponse.json({
      authorization_url: authUrl.toString(),
      state,
      redirect_uri: redirectUri,
    })
  } catch (error) {
    console.error('Error in GET /api/auth/linkedin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
