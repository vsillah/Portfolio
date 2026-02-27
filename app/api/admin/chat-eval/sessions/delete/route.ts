import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/chat-eval/sessions/delete
 * Bulk delete chat sessions by session_id. Cascades to messages, evaluations, etc.
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const body = await request.json()
    const sessionIds = body?.session_ids
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json(
        { error: 'session_ids array is required and must not be empty' },
        { status: 400 }
      )
    }

    const validIds = sessionIds.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid session IDs provided' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .delete()
      .in('session_id', validIds)

    if (error) {
      console.error('Error bulk deleting sessions:', error)
      return NextResponse.json(
        { error: 'Failed to delete sessions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted: validIds.length,
    })
  } catch (err) {
    console.error('Bulk delete sessions error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
