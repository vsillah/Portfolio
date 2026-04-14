import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { isGmailUserOAuthClientConfigured } from '@/lib/gmail-user-api'
import { isGmailUserOauthSecretConfigured } from '@/lib/gmail-user-oauth-secret'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/oauth/google-gmail/status
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const configured =
      isGmailUserOAuthClientConfigured() && isGmailUserOauthSecretConfigured()

    if (!supabaseAdmin) {
      return NextResponse.json({
        connected: false,
        googleEmail: null,
        configured,
      })
    }

    const { data, error } = await supabaseAdmin
      .from('admin_gmail_user_credentials')
      .select('google_email')
      .eq('user_id', authResult.user.id)
      .maybeSingle()

    if (error) {
      console.error('[Gmail user OAuth] status select:', error.message)
      return NextResponse.json({
        connected: false,
        googleEmail: null,
        configured,
      })
    }

    return NextResponse.json({
      connected: Boolean(data?.google_email),
      googleEmail: data?.google_email ?? null,
      configured,
    })
  } catch (error) {
    console.error('GET /api/admin/oauth/google-gmail/status:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
