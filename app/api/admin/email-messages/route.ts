import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

/**
 * GET /api/admin/email-messages
 * Unified index for Admin Email Center (filters optional).
 * Query: contact (contact_submission_id), status, kind (email_kind), transport, limit, offset
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const contactRaw = searchParams.get('contact')
  const status = searchParams.get('status')
  const kind = searchParams.get('kind')
  const transport = searchParams.get('transport')
  const limitRaw = searchParams.get('limit')
  const offsetRaw = searchParams.get('offset')

  // contact omitted or 'all' → no restriction on contact_submission_id
  const contactId =
    contactRaw && contactRaw !== 'all' && !Number.isNaN(Number(contactRaw))
      ? Number(contactRaw)
      : null

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(limitRaw) || DEFAULT_LIMIT),
  )
  const offset = Math.max(0, Number(offsetRaw) || 0)

  let q = supabaseAdmin
    .from('email_messages')
    .select(
      `
      id,
      email_kind,
      channel,
      contact_submission_id,
      recipient_email,
      subject,
      body_preview,
      direction,
      status,
      transport,
      source_system,
      source_id,
      sent_at,
      created_at,
      metadata
    `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (contactId !== null) {
    q = q.eq('contact_submission_id', contactId)
  }
  if (status && status !== 'all') {
    q = q.eq('status', status)
  }
  if (kind && kind !== 'all') {
    q = q.eq('email_kind', kind)
  }
  if (transport && transport !== 'all') {
    q = q.eq('transport', transport)
  }

  const { data, error, count } = await q

  if (error) {
    console.error('[email-messages] list error:', error.message)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  })
}
