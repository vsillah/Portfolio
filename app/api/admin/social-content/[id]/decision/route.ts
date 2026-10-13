import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getSocialContentDecisionReadiness,
  isSocialContentDecision,
  socialContentDecisionIdempotencyKey,
} from '@/lib/social-content-decision-receipts'
import type { SocialContentItem } from '@/lib/social-content'

export const dynamic = 'force-dynamic'

function statusForRpcError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('not found')) return 404
  if (
    normalized.includes('stale')
    || normalized.includes('receipt')
    || normalized.includes('packet')
    || normalized.includes('pending')
    || normalized.includes('bound')
  ) return 409
  return 500
}

/**
 * POST /api/admin/social-content/:id/decision
 *
 * Records one version-bound internal decision through the central Agent Ops
 * approval packet. It never publishes, schedules, uploads, renders, or calls a
 * provider. Candidate projection data is read-only and is copied only into the
 * immutable decision receipt snapshot.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (!isSocialContentDecision(body.decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  }

  const { data: rawItem, error: itemError } = await supabaseAdmin
    .from('social_content_queue')
    .select('id, status, updated_at, rag_context')
    .eq('id', params.id)
    .single()

  if (itemError || !rawItem) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  const item = rawItem as Pick<SocialContentItem, 'id' | 'status' | 'updated_at' | 'rag_context'>
  const readiness = getSocialContentDecisionReadiness(item)
  if (!readiness.packet || (!readiness.ready && !readiness.stale)) {
    return NextResponse.json({
      error: readiness.stale
        ? 'Review packet is stale for the current content version'
        : 'Review packet is not receipt-complete',
      code: readiness.stale ? 'SOCIAL_DECISION_PACKET_STALE' : 'SOCIAL_DECISION_RECEIPTS_REQUIRED',
      blockers: readiness.blockers,
    }, { status: 409 })
  }

  // A structurally complete stale packet still reaches the transactional
  // command. That command returns an existing receipt before checking current
  // row freshness, which makes a retry safe after the first decision changed
  // the Social Content row version. A stale first attempt still fails closed.
  const packet = readiness.packet
  const idempotencyKey = socialContentDecisionIdempotencyKey({
    approvalId: packet.approval_id,
    contentUpdatedAt: packet.content_updated_at,
    decision: body.decision,
  })

  const { data: receipt, error: decisionError } = await supabaseAdmin.rpc(
    'record_social_content_decision',
    {
      p_social_content_id: params.id,
      p_approval_id: packet.approval_id,
      p_content_updated_at: packet.content_updated_at,
      p_decision: body.decision,
      p_decided_by_user_id: auth.user.id,
      p_idempotency_key: idempotencyKey,
    },
  )

  if (decisionError) {
    const message = decisionError.message || 'Failed to record Social Content decision'
    console.error('[social-content-decision] failed:', decisionError)
    return NextResponse.json({ error: message }, { status: statusForRpcError(message) })
  }

  const { data: updatedItem, error: refreshError } = await supabaseAdmin
    .from('social_content_queue')
    .select('*')
    .eq('id', params.id)
    .single()

  if (refreshError || !updatedItem) {
    return NextResponse.json({ error: 'Decision recorded but content refresh failed', receipt }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    decision: body.decision,
    receipt,
    item: updatedItem,
    next_internal_gate: body.decision === 'approve' ? packet.next_gate : 'copy_revision',
    external_execution: false,
  })
}
