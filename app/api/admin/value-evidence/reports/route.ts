import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/reports
 * List value reports
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const reportType = searchParams.get('type')
  const contactId = searchParams.get('contact_id')

  let query = supabaseAdmin
    .from('value_reports')
    .select('id, contact_submission_id, report_type, industry, company_size_range, title, total_annual_value, generated_by, created_at')
    .order('created_at', { ascending: false })

  if (reportType) query = query.eq('report_type', reportType)
  if (contactId) query = query.eq('contact_submission_id', parseInt(contactId))

  const { data, error } = await query.limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reports: data || [] })
}
