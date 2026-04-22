import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildGammaReportInput, type GammaReportParams } from '@/lib/gamma-report-builder'
import { insertGammaReportRow, runGammaGeneration } from '@/lib/gamma-generation'
import { CALENDLY_EVENT_KEYS, isCalendlyEventKey } from '@/lib/calendly-events'

export const dynamic = 'force-dynamic'

type VideoJobRow = {
  id: string
  gamma_report_id: string | null
  heygen_status: string | null
  video_share_url: string | null
  video_url: string | null
  created_at: string
}

/** Newest completed job with a playable/share URL wins; else most recent job for status / admin link. */
function attachCompanionVideoSummaries(
  reports: Record<string, unknown>[],
  jobs: VideoJobRow[]
): Record<string, unknown>[] {
  const byReport = new Map<string, VideoJobRow[]>()
  for (const j of jobs) {
    if (!j.gamma_report_id) continue
    const arr = byReport.get(j.gamma_report_id) ?? []
    arr.push(j)
    byReport.set(j.gamma_report_id, arr)
  }

  return reports.map((r) => {
    const id = r.id as string
    const list = (byReport.get(id) ?? []).slice().sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    if (list.length === 0) {
      return { ...r, companion_video: null }
    }
    const withUrl = list.find(
      (j) =>
        j.heygen_status === 'completed' &&
        (Boolean(j.video_share_url?.trim()) || Boolean(j.video_url?.trim()))
    )
    const primary = withUrl ?? list[0]
    const watchUrl =
      primary.heygen_status === 'completed'
        ? (primary.video_share_url?.trim() || primary.video_url?.trim() || null)
        : null
    return {
      ...r,
      companion_video: {
        job_id: primary.id,
        heygen_status: primary.heygen_status,
        watch_url: watchUrl,
      },
    }
  })
}

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

  const reports = (data || []) as Record<string, unknown>[]
  const reportIds = reports.map((row) => row.id as string).filter(Boolean)

  let merged = reports
  if (reportIds.length > 0) {
    const { data: jobRows, error: jobsError } = await supabaseAdmin
      .from('video_generation_jobs')
      .select('id, gamma_report_id, heygen_status, video_share_url, video_url, created_at')
      .in('gamma_report_id', reportIds)
      .is('deleted_at', null)

    if (jobsError) {
      console.error('Failed to fetch companion video jobs for gamma reports:', jobsError)
    } else {
      merged = attachCompanionVideoSummaries(reports, (jobRows || []) as VideoJobRow[])
    }
  }

  return NextResponse.json({ reports: merged })
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

  const validTypes = ['value_quantification', 'implementation_strategy', 'audit_summary', 'prospect_overview', 'offer_presentation']
  if (!validTypes.includes(body.reportType)) {
    return NextResponse.json(
      { error: `Invalid reportType. Must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    )
  }

  if (body.reportType === 'offer_presentation' && !body.bundleId && !body.pricingTierId) {
    return NextResponse.json(
      { error: 'offer_presentation requires either bundleId or pricingTierId' },
      { status: 400 }
    )
  }

  if (body.calendlyEventKey !== undefined && !isCalendlyEventKey(body.calendlyEventKey)) {
    return NextResponse.json(
      {
        error: `Invalid calendlyEventKey. Must be one of: ${CALENDLY_EVENT_KEYS.join(', ')}`,
      },
      { status: 400 }
    )
  }

  try {
    const { inputText, options, title, citationsMeta, feasibilityAssessment } =
      await buildGammaReportInput(body)

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
      citationsMeta,
      feasibilityAssessment: feasibilityAssessment ? (feasibilityAssessment as unknown as Record<string, unknown>) : null,
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
    const errMsg = err instanceof Error
      ? err.message
      : (typeof err === 'object' && err !== null
        ? JSON.stringify(err)
        : String(err ?? 'Unknown error'))
    const errStack = err instanceof Error ? err.stack : undefined
    console.error('Gamma report generation error:', errMsg, errStack ?? '')
    return NextResponse.json({ error: 'Failed to generate report', details: errMsg }, { status: 500 })
  }
}
