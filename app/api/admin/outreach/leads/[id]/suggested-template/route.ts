import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { suggestEmailTemplateForLead } from '@/lib/delivery-email'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/outreach/leads/:id/suggested-template
 *
 * Lightweight journey-stage suggestion for the Outreach lead row template menu.
 * Computes the template via count-only queries against the lead's related tables
 * (gamma_reports, video_generation_jobs, value_reports, contact_deliveries,
 * sales_sessions, meeting_records, client_projects) and returns:
 *
 *   { template: EmailTemplateKey, reason: SuggestedTemplateReason }
 *
 * Reasons map 1:1 to branches in `suggestEmailTemplateWithReason()`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const leadId = parseInt(params.id, 10)
  if (isNaN(leadId)) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  try {
    const result = await suggestEmailTemplateForLead(leadId)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[suggested-template] error:', err)
    return NextResponse.json(
      { template: 'email_cold_outreach', reason: 'cold' },
      { status: 200 },
    )
  }
}
