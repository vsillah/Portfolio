import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/diagnostic-audits/by-contact?contact_submission_id=123
 * Lists diagnostic audits linked to a contact (for Admin → Gamma report context picker).
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
  const contactId = searchParams.get('contact_submission_id')
  if (!contactId || !/^\d+$/.test(contactId)) {
    return NextResponse.json(
      { error: 'contact_submission_id is required and must be a number' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id, status, created_at, completed_at, audit_type')
    .eq('contact_submission_id', Number(contactId))
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[diagnostic-audits/by-contact]', error)
    return NextResponse.json({ error: 'Failed to fetch audits' }, { status: 500 })
  }

  return NextResponse.json({ audits: data ?? [] })
}
