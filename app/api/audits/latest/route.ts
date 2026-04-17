import { NextRequest, NextResponse } from 'next/server'
import { resolveLatestAudit } from '@/lib/latest-audit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/audits/latest?email=<email>
 *
 * Public lookup: given an email, returns the latest diagnostic audit for that
 * contact and a minimal view of the most recent audit_summary Gamma report.
 * Returns only non-sensitive fields (no contact id, no internal references).
 *
 * Shape:
 *   { found: false }
 *   { found: true, auditId, completedAt, auditStatus, businessName,
 *     gammaUrl, gammaStatus, gammaCreatedAt }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = (searchParams.get('email') || '').trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ found: false })
  }

  const info = await resolveLatestAudit({ email })
  if (!info) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    auditId: info.auditId,
    auditStatus: info.auditStatus,
    completedAt: info.completedAt,
    businessName: info.businessName,
    auditType: info.auditType,
    gammaReportId: info.gammaReport?.id ?? null,
    gammaUrl: info.gammaReport?.gammaUrl ?? null,
    gammaStatus: info.gammaReport?.status ?? null,
    gammaCreatedAt: info.gammaReport?.createdAt ?? null,
  })
}
