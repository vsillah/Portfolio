import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { generateValueReport, saveValueReport } from '@/lib/value-report-generator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/reports/generate
 * Generate a value report for a specific lead or industry/size
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const {
    contact_submission_id,
    industry,
    company_size,
    company_name,
    contact_name,
    report_type = 'client_facing',
  } = body

  if (!contact_submission_id && !industry) {
    return NextResponse.json(
      { error: 'Either contact_submission_id or industry is required' },
      { status: 400 }
    )
  }

  try {
    const report = await generateValueReport(
      {
        contactSubmissionId: contact_submission_id,
        industry,
        companySize: company_size,
        companyName: company_name,
        contactName: contact_name,
      },
      report_type
    )

    if (!report) {
      return NextResponse.json(
        { error: 'Could not generate report - no pain points or benchmarks available' },
        { status: 422 }
      )
    }

    // Save to database
    const reportId = await saveValueReport(report)

    return NextResponse.json({
      report: {
        ...report,
        id: reportId,
      },
    })
  } catch (error: any) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error.message },
      { status: 500 }
    )
  }
}
