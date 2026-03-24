import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/value-evidence/reports/status?contactIds=1,2,3
 *
 * Batch lookup: for each contact ID, return the latest value report
 * and the latest completed gamma report (if any).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rawIds = request.nextUrl.searchParams.get('contactIds')
  if (!rawIds) {
    return NextResponse.json({ error: 'contactIds query parameter is required' }, { status: 400 })
  }

  const contactIds = rawIds
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))

  if (contactIds.length === 0) {
    return NextResponse.json({ statuses: {} })
  }

  const sb = supabaseAdmin
  if (!sb) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const [reportsRes, gammaRes] = await Promise.all([
    sb
      .from('value_reports')
      .select('id, contact_submission_id, total_annual_value, report_type, created_at')
      .in('contact_submission_id', contactIds)
      .order('created_at', { ascending: false }),
    sb
      .from('gamma_reports')
      .select('id, contact_submission_id, gamma_url, status, report_type, created_at')
      .in('contact_submission_id', contactIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
  ])

  const reports = reportsRes.data || []
  const gammaReports = gammaRes.data || []

  // For each contact, pick the most recent report and gamma
  const statuses: Record<
    string,
    {
      reportId: string
      totalAnnualValue: number
      reportType: string
      gammaReportId?: string
      gammaUrl?: string
    } | null
  > = {}

  for (const cid of contactIds) {
    const report = reports.find(
      (r: { contact_submission_id: number }) => r.contact_submission_id === cid
    )
    if (!report) {
      statuses[String(cid)] = null
      continue
    }

    const gamma = gammaReports.find(
      (g: { contact_submission_id: number }) => g.contact_submission_id === cid
    )

    statuses[String(cid)] = {
      reportId: report.id,
      totalAnnualValue: parseFloat(report.total_annual_value),
      reportType: report.report_type,
      ...(gamma ? { gammaReportId: gamma.id, gammaUrl: gamma.gamma_url } : {}),
    }
  }

  return NextResponse.json({ statuses })
}
