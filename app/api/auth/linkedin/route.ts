import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/linkedin
 * Initiate LinkedIn OAuth 2.0 authorization flow.
 * Redirects the browser directly to LinkedIn's consent screen.
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { error: 'LINKEDIN_CLIENT_ID not configured in .env.local' },
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

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    console.error('Error in GET /api/auth/linkedin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
