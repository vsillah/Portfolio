import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildGmailUserAuthorizeUrl,
  isGmailUserOAuthClientConfigured,
} from '@/lib/gmail-user-api'
import { isGmailUserOauthSecretConfigured } from '@/lib/gmail-user-oauth-secret'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/oauth/google-gmail/start
 * Returns { url } to open in the browser (Authorization: Bearer required).
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

    if (
      !isGmailUserOAuthClientConfigured() ||
      !isGmailUserOauthSecretConfigured()
    ) {
      return NextResponse.json(
        { error: 'Gmail account connection is not configured for this site.' },
        { status: 503 }
      )
    }

    const url = buildGmailUserAuthorizeUrl(authResult.user.id)
    return NextResponse.json({ url })
  } catch (error) {
    console.error('GET /api/admin/oauth/google-gmail/start:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
