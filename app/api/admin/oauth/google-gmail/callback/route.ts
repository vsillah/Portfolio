import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyOAuthState } from '@/lib/gmail-user-oauth-state'
import { encryptRefreshToken } from '@/lib/gmail-user-oauth-crypto'
import {
  exchangeCodeForTokens,
  fetchGoogleAccountEmail,
  isGmailUserOAuthClientConfigured,
} from '@/lib/gmail-user-api'
import { isGmailUserOauthSecretConfigured } from '@/lib/gmail-user-oauth-secret'

export const dynamic = 'force-dynamic'

function outreachRedirect(
  req: NextRequest,
  params: Record<string, string>
): NextResponse {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || req.nextUrl.origin
  const sp = new URLSearchParams(params)
  return NextResponse.redirect(`${base}/admin/outreach?${sp.toString()}`)
}

/**
 * GET /api/admin/oauth/google-gmail/callback
 * OAuth redirect target (no Bearer). Validates signed state, stores encrypted refresh token.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return outreachRedirect(request, { tab: 'leads', gmail_oauth_error: '1' })
  }

  if (!code || !state) {
    return outreachRedirect(request, { tab: 'leads', gmail_oauth_error: '1' })
  }

  const userId = verifyOAuthState(state)
  if (!userId) {
    return outreachRedirect(request, { tab: 'leads', gmail_oauth_error: 'state' })
  }

  if (
    !supabaseAdmin ||
    !isGmailUserOAuthClientConfigured() ||
    !isGmailUserOauthSecretConfigured()
  ) {
    return outreachRedirect(request, { tab: 'leads', gmail_oauth_error: 'config' })
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      return outreachRedirect(request, {
        tab: 'leads',
        gmail_oauth_error: 'refresh',
      })
    }

    const googleEmail = await fetchGoogleAccountEmail(tokens.refresh_token)
    if (!googleEmail?.includes('@')) {
      return outreachRedirect(request, {
        tab: 'leads',
        gmail_oauth_error: 'email',
      })
    }

    const enc = encryptRefreshToken(tokens.refresh_token)
    const now = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('admin_gmail_user_credentials')
      .upsert(
        {
          user_id: userId,
          google_email: googleEmail,
          refresh_token_cipher: enc.cipher,
          refresh_token_iv: enc.iv,
          refresh_token_tag: enc.tag,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[Gmail user OAuth] upsert failed:', error.message)
      return outreachRedirect(request, { tab: 'leads', gmail_oauth_error: 'save' })
    }

    return outreachRedirect(request, { tab: 'leads', gmail_connected: '1' })
  } catch (error) {
    console.error('GET /api/admin/oauth/google-gmail/callback:', error)
    return outreachRedirect(request, { tab: 'leads', gmail_oauth_error: '1' })
  }
}
