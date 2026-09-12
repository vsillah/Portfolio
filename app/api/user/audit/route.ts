import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { type AuditSummary, dedupePickLatest } from './audit-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/audit
 * Returns the user's most recent completed standalone/chat diagnostic audit for My library (/purchases).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const userId = auth.user.id
  const email = (auth.user.email || '').trim().toLowerCase()

  const candidates: AuditSummary[] = []

  const { data: byUser } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id, completed_at, business_name, report_tier, audit_type')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(3)

  if (byUser?.length) {
    for (const r of byUser) {
      candidates.push(r as AuditSummary)
    }
  }

  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('id, completed_at, business_name, report_tier, audit_type')
      .eq('contact_email', email)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(3)

    if (byEmail?.length) {
      for (const r of byEmail) {
        candidates.push(r as AuditSummary)
      }
    }

    const { data: contactRows } = await supabaseAdmin
      .from('contact_submissions')
      .select('id')
      .eq('email', email)

    const contactIds = (contactRows || []).map((c: { id: number }) => c.id)
    if (contactIds.length) {
      const { data: byContact } = await supabaseAdmin
        .from('diagnostic_audits')
        .select('id, completed_at, business_name, report_tier, audit_type')
        .in('contact_submission_id', contactIds)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(3)

      if (byContact?.length) {
        for (const r of byContact) {
          candidates.push(r as AuditSummary)
        }
      }
    }
  }

  const best = dedupePickLatest(candidates)
  if (!best) {
    return NextResponse.json({ audit: null })
  }

  const idStr = String(best.id)
  return NextResponse.json({
    audit: {
      id: idStr,
      completedAt: best.completed_at,
      businessName: best.business_name,
      reportTier: best.report_tier,
      auditType: best.audit_type,
      reportPath: `/tools/audit/report/${idStr}`,
    },
  })
}
