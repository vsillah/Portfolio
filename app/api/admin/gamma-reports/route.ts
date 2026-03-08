import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildGammaReportInput, type GammaReportParams } from '@/lib/gamma-report-builder'
import { generateGamma, waitForGeneration } from '@/lib/gamma-client'

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

    const { data: row, error: insertError } = await supabaseAdmin
      .from('gamma_reports')
      .insert({
        report_type: body.reportType,
        title,
        contact_submission_id: body.contactSubmissionId || null,
        diagnostic_audit_id: body.diagnosticAuditId || null,
        value_report_id: body.valueReportId || null,
        proposal_id: body.proposalId || null,
        input_text: inputText,
        external_inputs: body.externalInputs || {},
        gamma_options: options,
        status: 'generating',
        created_by: auth.user.id,
      })
      .select('id')
      .single()

    if (insertError || !row) {
      console.error('Failed to insert gamma report row:', insertError)
      return NextResponse.json({ error: 'Failed to create report record' }, { status: 500 })
    }

    const reportId = row.id

    let gammaResult
    try {
      const { generationId } = await generateGamma(inputText, options)

      await supabaseAdmin
        .from('gamma_reports')
        .update({ gamma_generation_id: generationId })
        .eq('id', reportId)

      gammaResult = await waitForGeneration(generationId)
    } catch (gammaError: unknown) {
      const errMsg = gammaError instanceof Error ? gammaError.message : 'Unknown Gamma API error'
      await supabaseAdmin
        .from('gamma_reports')
        .update({ status: 'failed', error_message: errMsg })
        .eq('id', reportId)

      return NextResponse.json(
        { error: 'Gamma generation failed', details: errMsg, reportId },
        { status: 502 }
      )
    }

    if (gammaResult.status === 'failed') {
      await supabaseAdmin
        .from('gamma_reports')
        .update({
          status: 'failed',
          error_message: gammaResult.error?.message || 'Generation failed',
        })
        .eq('id', reportId)

      return NextResponse.json(
        { error: 'Gamma generation failed', details: gammaResult.error?.message, reportId },
        { status: 502 }
      )
    }

    await supabaseAdmin
      .from('gamma_reports')
      .update({
        status: 'completed',
        gamma_url: gammaResult.gammaUrl,
        gamma_generation_id: gammaResult.generationId,
      })
      .eq('id', reportId)

    return NextResponse.json({
      reportId,
      title,
      gammaUrl: gammaResult.gammaUrl,
      generationId: gammaResult.generationId,
      status: 'completed',
      credits: gammaResult.credits,
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Gamma report generation error:', errMsg)
    return NextResponse.json({ error: 'Failed to generate report', details: errMsg }, { status: 500 })
  }
}
