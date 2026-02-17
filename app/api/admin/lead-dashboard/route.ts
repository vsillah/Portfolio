import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createLeadDashboardAccess } from '@/lib/client-dashboard'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/lead-dashboard
 * Create or get a lead dashboard link for a completed diagnostic (with contact).
 * Body: { diagnostic_audit_id: string }
 * Returns: { accessToken, url } or existing link for that diagnostic.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { diagnostic_audit_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const diagnosticAuditId =
    typeof body.diagnostic_audit_id === 'string'
      ? parseInt(body.diagnostic_audit_id, 10)
      : typeof body.diagnostic_audit_id === 'number'
        ? body.diagnostic_audit_id
        : NaN

  if (Number.isNaN(diagnosticAuditId)) {
    return NextResponse.json(
      { error: 'diagnostic_audit_id is required' },
      { status: 400 }
    )
  }

  const { data: audit, error: auditError } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id, status, contact_submission_id')
    .eq('id', diagnosticAuditId)
    .single()

  if (auditError || !audit) {
    return NextResponse.json(
      { error: 'Diagnostic not found' },
      { status: 404 }
    )
  }

  if (audit.status !== 'completed') {
    return NextResponse.json(
      { error: 'Diagnostic must be completed' },
      { status: 400 }
    )
  }

  if (audit.contact_submission_id == null) {
    return NextResponse.json(
      { error: 'Lead dashboard requires a contact (contact_submission_id)' },
      { status: 400 }
    )
  }

  const { data: contact } = await supabaseAdmin
    .from('contact_submissions')
    .select('email')
    .eq('id', audit.contact_submission_id)
    .single()

  if (!contact?.email) {
    return NextResponse.json(
      { error: 'Contact email not found' },
      { status: 400 }
    )
  }

  const { access, error } = await createLeadDashboardAccess(
    diagnosticAuditId,
    contact.email
  )

  if (error || !access) {
    return NextResponse.json(
      { error: error || 'Failed to create lead dashboard link' },
      { status: 500 }
    )
  }

  const origin = request.headers.get('origin') || request.nextUrl.origin
  const url = `${origin}/client/dashboard/${access.access_token}`

  return NextResponse.json({
    accessToken: access.access_token,
    url,
  })
}
