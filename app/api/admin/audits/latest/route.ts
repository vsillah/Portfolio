import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { resolveLatestAudit } from '@/lib/latest-audit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/audits/latest?email=...&contactSubmissionId=...&auditId=...
 *
 * Admin lookup. At least one of the query params must be provided.
 * Returns the richer audit info (including contact id) admin surfaces need
 * to deep-link into /admin/reports/gamma and related pages.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const contactSubmissionId = searchParams.get('contactSubmissionId')
  const auditId = searchParams.get('auditId')

  if (!email && !contactSubmissionId && !auditId) {
    return NextResponse.json(
      { error: 'Provide at least one of email, contactSubmissionId, auditId' },
      { status: 400 }
    )
  }

  const info = await resolveLatestAudit({
    email,
    contactSubmissionId,
    auditId,
  })

  if (!info) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    auditId: info.auditId,
    auditStatus: info.auditStatus,
    completedAt: info.completedAt,
    updatedAt: info.updatedAt,
    businessName: info.businessName,
    contactEmail: info.contactEmail,
    contactSubmissionId: info.contactSubmissionId,
    auditType: info.auditType,
    gammaReportId: info.gammaReport?.id ?? null,
    gammaUrl: info.gammaReport?.gammaUrl ?? null,
    gammaStatus: info.gammaReport?.status ?? null,
    gammaCreatedAt: info.gammaReport?.createdAt ?? null,
    adminReportUrl: `/admin/reports/gamma?auditId=${encodeURIComponent(info.auditId)}`,
  })
}
