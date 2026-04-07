import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildGammaReportInput, type GammaReportParams } from '@/lib/gamma-report-builder'
import { insertGammaReportRow, runGammaGeneration } from '@/lib/gamma-generation'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET /api/admin/gamma-reports — list generated reports
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const contactId = searchParams.get('contactId')
  const reportType = searchParams.get('reportType')
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  let query = supabaseAdmin
    .from('gamma_reports')
    .select(`
      *,
      contact_submissions!gamma_reports_contact_submission_id_fkey (
        id, name, company, email
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (contactId) query = query.eq('contact_submission_id', parseInt(contactId, 10))
  if (reportType) query = query.eq('report_type', reportType)
  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch gamma reports:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }

  return NextResponse.json({ reports: data || [] })
}

// ---------------------------------------------------------------------------
// POST /api/admin/gamma-reports — generate a new report
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  let body: GammaReportParams
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.reportType) {
    return NextResponse.json({ error: 'reportType is required' }, { status: 400 })
  }

  const validTypes = ['value_quantification', 'implementation_strategy', 'audit_summary', 'prospect_overview']
  if (!validTypes.includes(body.reportType)) {
    return NextResponse.json(
      { error: `Invalid reportType. Must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    const { inputText, options, title } = await buildGammaReportInput(body)

    const row = await insertGammaReportRow({
      reportType: body.reportType,
      title,
      contactSubmissionId: body.contactSubmissionId || null,
      diagnosticAuditId: body.diagnosticAuditId || null,
      valueReportId: body.valueReportId || null,
      proposalId: body.proposalId || null,
      inputText,
      externalInputs: {
        ...(body.externalInputs || {}),
        ...(body.externalInputSources ? { _sources: body.externalInputSources } : {}),
      },
      gammaOptions: options,
      createdBy: auth.user.id,
    })

    if (!row) {
      return NextResponse.json({ error: 'A report is already being generated for this input' }, { status: 409 })
    }

    const reportId = row.id
    const result = await runGammaGeneration(reportId, inputText, options)

    if (result.status === 'failed') {
      console.error('[gamma-reports] Generation failed', { reportId, errorMessage: result.errorMessage })
      return NextResponse.json(
        { error: 'Gamma generation failed', details: result.errorMessage, reportId },
        { status: 502 }
      )
    }

    return NextResponse.json({
      reportId,
      title,
      gammaUrl: result.gammaUrl,
      generationId: result.generationId,
      status: 'completed',
      credits: result.credits,
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Gamma report generation error:', errMsg)
    return NextResponse.json({ error: 'Failed to generate report', details: errMsg }, { status: 500 })
  }
}
