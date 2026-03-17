import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/diagnostic-audits/latest-by-contact?contact_submission_id=123
 * Returns the latest diagnostic audit for the given contact (any audit_type).
 * Used so the sales conversation page can show an audit built from meetings when
 * the session has no diagnostic_audit_id linked yet.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
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
    .select('id')
    .eq('contact_submission_id', Number(contactId))
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[latest-by-contact] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch audit' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ auditId: null })
  }

  return NextResponse.json({ auditId: data.id })
}
