import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { resolveLatestAudit } from '@/lib/latest-audit'
import { rerunAuditSummaryGamma } from '@/lib/rerun-audit-summary-gamma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/audits/rerun
 * Body: { auditId?: string, email?: string, contactSubmissionId?: number | string }
 *
 * Admin rerun. Accepts any of auditId / email / contactSubmissionId. Resolves
 * the latest audit when auditId is not supplied directly, then regenerates
 * the audit_summary Gamma deck from the existing diagnostic_audits data.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { auditId?: string | number; email?: string; contactSubmissionId?: number | string } =
    {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { auditId, email, contactSubmissionId } = body

  if (!auditId && !email && !contactSubmissionId) {
    return NextResponse.json(
      { error: 'Provide auditId, email, or contactSubmissionId' },
      { status: 400 }
    )
  }

  let resolvedAuditId = auditId ? String(auditId) : null

  if (!resolvedAuditId) {
    const info = await resolveLatestAudit({ email, contactSubmissionId })
    if (!info) {
      return NextResponse.json(
        { error: 'No prior audit found for the given contact' },
        { status: 404 }
      )
    }
    resolvedAuditId = info.auditId
  }

  const createdBy = auth.user?.id ?? null
  const result = await rerunAuditSummaryGamma(resolvedAuditId, createdBy)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    auditId: result.auditId,
    gammaReportId: result.gammaReportId,
    supersededCount: result.supersededCount,
    adminReportUrl: `/admin/reports/gamma?auditId=${encodeURIComponent(result.auditId)}`,
  })
}
