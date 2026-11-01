import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { socialContentDecisionHref } from '@/lib/social-content-decision-routing'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const expectedVersion = typeof body.expected_content_updated_at === 'string' ? body.expected_content_updated_at : ''
  const handoffReceiptId = typeof body.handoff_decision_receipt_id === 'string' ? body.handoff_decision_receipt_id : ''
  if (!UUID.test(params.id) || !UUID.test(handoffReceiptId) || !Number.isFinite(Date.parse(expectedVersion))) {
    return NextResponse.json({ error: 'Exact content version and immutable handoff decision receipt are required.' }, { status: 400 })
  }

  const idempotencyKey = `social-platform-submission-review:${params.id}:${handoffReceiptId}:${expectedVersion}`
  const { data, error } = await supabaseAdmin.rpc('prepare_linkedin_platform_submission_review', {
    p_social_content_id: params.id,
    p_expected_content_updated_at: expectedVersion,
    p_handoff_decision_receipt_id: handoffReceiptId,
    p_triggered_by_user_id: auth.user.id,
    p_idempotency_key: idempotencyKey,
  })
  if (error || !data) {
    const message = error?.message || 'Failed to prepare final platform-submission review packet.'
    const conflict = /stale|required|mismatch|missing|pending|duplicate|existing|provider|publication|handoff|evidence|gate/i.test(message)
    return NextResponse.json({ error: message }, { status: conflict ? 409 : 500 })
  }

  const packet = data as Record<string, unknown>
  const workItemId = typeof packet.work_item_id === 'string' ? packet.work_item_id : ''
  return NextResponse.json({
    ok: true,
    packet,
    canonical_href: socialContentDecisionHref({ contentId: params.id, workItemId, gate: 'platform_submission' }),
    external_execution: false,
  })
}
