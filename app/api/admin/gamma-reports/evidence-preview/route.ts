import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { fetchReportContext, buildEvidenceForReport, type GammaReportParams } from '@/lib/gamma-report-builder'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/gamma-reports/evidence-preview
 *
 * Returns the EvidenceItem[] that would be cited in a Gamma report for the
 * given contact / audit / value report. Used by the admin UI to surface what
 * source material (meeting verbatims, audit responses, tech stack, value
 * formulas, benchmarks, pain point excerpts) will back the generated deck.
 *
 * Query params:
 *   - contactSubmissionId (optional)
 *   - auditId (optional)
 *   - valueReportId (optional)
 *
 * At least one identifier should be provided; otherwise the response will be
 * an empty index.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const contactRaw = searchParams.get('contactSubmissionId')
  const auditId = searchParams.get('auditId') || undefined
  const valueReportId = searchParams.get('valueReportId') || undefined

  let contactSubmissionId: number | undefined
  if (contactRaw) {
    const parsed = parseInt(contactRaw, 10)
    if (Number.isNaN(parsed)) {
      return NextResponse.json({ error: 'contactSubmissionId must be a number' }, { status: 400 })
    }
    contactSubmissionId = parsed
  }

  if (!contactSubmissionId && !auditId && !valueReportId) {
    return NextResponse.json({
      items: [],
      counts: { audit_response: 0, meeting_quote: 0, tech_stack: 0, value_formula: 0, benchmark: 0, pain_point_excerpt: 0 },
      meetingsAvailable: 0,
    })
  }

  try {
    const params: GammaReportParams = {
      reportType: 'audit_summary',
      contactSubmissionId,
      diagnosticAuditId: auditId,
      valueReportId,
    }

    const ctx = await fetchReportContext(params)
    const items = buildEvidenceForReport(ctx)

    const counts: Record<string, number> = {
      audit_response: 0,
      meeting_quote: 0,
      tech_stack: 0,
      value_formula: 0,
      benchmark: 0,
      pain_point_excerpt: 0,
    }
    for (const it of items) {
      counts[it.kind] = (counts[it.kind] ?? 0) + 1
    }

    return NextResponse.json({
      items,
      counts,
      meetingsAvailable: ctx.meetings.length,
    })
  } catch (err) {
    console.error('Evidence preview error:', err)
    return NextResponse.json({ error: 'Failed to build evidence preview' }, { status: 500 })
  }
}
