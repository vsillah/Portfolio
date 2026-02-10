import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/reports/[id]
 * Get full report with evidence chain
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await supabaseAdmin
    .from('value_reports')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  // If linked to a contact, get contact info
  let contact = null
  if (data.contact_submission_id) {
    const { data: contactData } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email, company, industry, employee_count, lead_score')
      .eq('id', data.contact_submission_id)
      .single()
    contact = contactData
  }

  return NextResponse.json({ report: data, contact })
}
