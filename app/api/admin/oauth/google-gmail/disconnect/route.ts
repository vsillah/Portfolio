import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/admin/oauth/google-gmail/disconnect
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      )
    }

    const { error } = await supabaseAdmin
      .from('admin_gmail_user_credentials')
      .delete()
      .eq('user_id', authResult.user.id)

    if (error) {
      console.error('[Gmail user OAuth] disconnect:', error.message)
      return NextResponse.json(
        { error: 'Something went wrong. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Gmail connection removed.' })
  } catch (error) {
    console.error('DELETE /api/admin/oauth/google-gmail/disconnect:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
