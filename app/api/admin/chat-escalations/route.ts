import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/chat-escalations
 * List chat escalations with optional filters. Admin only.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit
    const source = searchParams.get('source') // 'text' | 'voice' | omit = all
    const linked = searchParams.get('linked') // 'true' | 'false' | omit = all
    const contactId = searchParams.get('contact') // filter by contact_submission_id

    let query = supabaseAdmin
      .from('chat_escalations')
      .select(
        `
        id,
        session_id,
        escalated_at,
        source,
        reason,
        visitor_name,
        visitor_email,
        transcript,
        contact_submission_id,
        slack_sent_at,
        created_at,
        updated_at,
        contact_submissions(name, email)
      `,
        { count: 'exact' }
      )
      .order('escalated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (source === 'text' || source === 'voice') {
      query = query.eq('source', source)
    }
    if (linked === 'true') {
      query = query.not('contact_submission_id', 'is', null)
    }
    if (linked === 'false') {
      query = query.is('contact_submission_id', null)
    }
    if (contactId) {
      const id = parseInt(contactId, 10)
      if (!Number.isNaN(id)) query = query.eq('contact_submission_id', id)
    }

    const { data: rows, error, count } = await query

    if (error) {
      console.error('[chat-escalations] List error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      escalations: rows ?? [],
      total: count ?? 0,
      page,
      limit,
    })
  } catch (err) {
    console.error('[chat-escalations] GET error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
