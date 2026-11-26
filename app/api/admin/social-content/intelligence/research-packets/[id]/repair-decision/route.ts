import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  decideEvidenceRepairHumanQa, evidenceRepairReviewPath, getEvidenceRepairReview, getEvidenceRepairDecisionReceipt,
  RepairDecisionError, type RepairDecision,
} from '@/lib/evidence-repair-human-qa'
import { evidenceRepairSlackEnabled } from '@/lib/evidence-repair-slack'

export const dynamic = 'force-dynamic'

function failure(error: unknown) {
  const status = error instanceof RepairDecisionError ? error.status : 503
  const message = error instanceof Error ? error.message : 'Evidence repair review unavailable.'
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params
  try {
    const review = await getEvidenceRepairReview(id)
    return NextResponse.json({
      binding: review.binding, title: review.title, source_url: review.sourceUrl,
      source_use_boundary: review.sourceUseBoundary, supported_claims: review.supportedClaims,
      removed_claims: review.removedClaims, status: review.status,
      review_path: evidenceRepairReviewPath(id), external_execution_enabled: false,
      slack_review_enabled: evidenceRepairSlackEnabled()
        && process.env.SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED === 'true'
        && process.env.SLACK_ACTION_RECEIPTS_ENABLED === 'true',
      approved_actions: ['approve', 'reject', 'revise'],
      approval_scope: 'Only this exact evidence repair candidate; no source linking, copy approval, preparation rerun, media, upload, scheduling, publishing, or external send.',
    })
  } catch (error) {
    try {
      const receipt = await getEvidenceRepairDecisionReceipt(id)
      if (receipt) return NextResponse.json({ terminal_receipt: receipt,
        review_path: evidenceRepairReviewPath(id), external_execution_enabled: false })
    } catch (receiptError) { return failure(receiptError) }
    return failure(error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await context.params
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || !['approve', 'reject', 'revise'].includes(body.decision)
    || typeof body.packet_version !== 'string' || typeof body.binding_hash !== 'string'
    || typeof body.reason !== 'string') {
    return NextResponse.json({ error: 'Provide a decision, reason, and exact review binding.' }, { status: 400 })
  }
  try {
    const receipt = await decideEvidenceRepairHumanQa({
      packetId: id, packetVersion: body.packet_version, bindingHash: body.binding_hash,
      decision: body.decision as RepairDecision, reason: body.reason,
      reviewerId: auth.user.id, surface: 'portfolio',
    })
    return NextResponse.json({ receipt, review_path: evidenceRepairReviewPath(id), external_execution_enabled: false })
  } catch (error) { return failure(error) }
}
