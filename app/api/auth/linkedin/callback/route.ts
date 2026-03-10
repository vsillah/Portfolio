import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/linkedin/callback
 * Handle LinkedIn OAuth callback — exchange code for access token and store it
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/admin/social-content?linkedin_error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/admin/social-content?linkedin_error=no_code', request.url)
      )
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL('/admin/social-content?linkedin_error=missing_config', request.url)
      )
    }

    const origin = new URL(request.url).origin
    const redirectUri = `${origin}/api/auth/linkedin/callback`

    // Exchange authorization code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('LinkedIn token exchange failed:', errBody)
      return NextResponse.redirect(
        new URL('/admin/social-content?linkedin_error=token_exchange_failed', request.url)
      )
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token
    const expiresIn = tokenData.expires_in

    // Fetch the user's LinkedIn profile to get the person URN
    const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    let personUrn = ''
    if (profileRes.ok) {
      const profile = await profileRes.json()
      personUrn = profile.sub ? `urn:li:person:${profile.sub}` : ''
    }

    // Store credentials in social_content_config
    const credentials = {
      access_token: accessToken,
      expires_in: expiresIn,
      token_obtained_at: new Date().toISOString(),
      person_urn: personUrn,
    }

    await supabaseAdmin
      .from('social_content_config')
      .update({
        credentials,
        settings: {
          author_urn: personUrn,
          post_visibility: 'PUBLIC',
        },
        is_active: true,
      })
      .eq('platform', 'linkedin')

    return NextResponse.redirect(
      new URL('/admin/social-content?linkedin_connected=true', request.url)
    )
  } catch (error) {
    console.error('Error in LinkedIn callback:', error)
    return NextResponse.redirect(
      new URL('/admin/social-content?linkedin_error=internal_error', request.url)
    )
  }
}
