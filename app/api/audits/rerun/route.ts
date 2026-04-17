import { NextRequest, NextResponse } from 'next/server'
import { resolveLatestAudit } from '@/lib/latest-audit'
import { rerunAuditSummaryGamma } from '@/lib/rerun-audit-summary-gamma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/audits/rerun
 * Body: { email: string }
 *
 * Public rerun endpoint. Trust boundary: the caller must prove ownership by
 * supplying the email associated with the audit. We resolve the latest audit
 * for that email and regenerate its audit_summary Gamma deck using the
 * existing diagnostic_audits data on file (no re-entry required).
 *
 * For admin-driven reruns that don't have an email (e.g. an audit created
 * in-person), use POST /api/admin/audits/rerun with { auditId }.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const info = await resolveLatestAudit({ email })
  if (!info) {
    return NextResponse.json(
      { error: 'No prior audit found for that email' },
      { status: 404 }
    )
  }

  if (!info.contactSubmissionId) {
    return NextResponse.json(
      { error: 'Cannot rerun — audit is not linked to a contact yet' },
      { status: 400 }
    )
  }

  const result = await rerunAuditSummaryGamma(info.auditId, null)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    auditId: result.auditId,
    gammaReportId: result.gammaReportId,
    supersededCount: result.supersededCount,
  })
}
