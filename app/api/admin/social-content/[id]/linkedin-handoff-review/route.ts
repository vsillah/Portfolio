import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAdmin } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!supabaseAdmin) return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const decision = body.decision
  const workItemId = body.work_item_id
  const privacyReceiptId = body.privacy_receipt_id
  const createdAt = body.handoff_created_at
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!UUID.test(params.id) || typeof workItemId !== 'string' || !UUID.test(workItemId)
    || typeof privacyReceiptId !== 'string' || !UUID.test(privacyReceiptId)
    || typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))
    || (decision !== 'approve' && decision !== 'request_revision')
    || (decision === 'request_revision' && !note)) {
    return NextResponse.json({ error: 'Exact handoff binding, decision, and revision reason when applicable are required.' }, { status: 400 })
  }

  const key = `linkedin-handoff-review:${workItemId}:${privacyReceiptId}:${decision}`
  const { data, error } = await supabaseAdmin.rpc('record_social_linkedin_handoff_decision', {
    p_social_content_id: params.id,
    p_work_item_id: workItemId,
    p_privacy_receipt_id: privacyReceiptId,
    p_expected_handoff_created_at: createdAt,
    p_decision: decision,
    p_decided_by_user_id: auth.user.id,
    p_note: note || null,
    p_idempotency_key: key,
  })
  if (error) {
    return NextResponse.json({ error: error.message || 'LinkedIn handoff review failed.' }, { status: 409 })
  }
  return NextResponse.json({ receipt: data, external_execution: false })
}
