import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getSocialContentDecisionReadiness,
  isSocialContentDecision,
  socialContentDecisionIdempotencyKey,
} from '@/lib/social-content-decision-receipts'
import type { SocialContentItem } from '@/lib/social-content'
import { socialContentCanonicalCommand } from '@/lib/social-content-decision-routing'

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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function shadowEnvironment(mode: unknown): boolean {
  if (process.env.VERCEL_ENV === 'production' || process.env.APP_ENV === 'production') return false
  if (mode === 'synthetic_local') return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  return mode === 'staging_shadow' && process.env.VERCEL_ENV === 'preview' && process.env.APP_ENV === 'staging'
}

function syntheticBytes(value: unknown): (path: string) => Buffer {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw new Error('invalid synthetic byte set')
  const bytes = new Map<string, Buffer>()
  for (const entry of value) {
    const row = record(entry)
    if (typeof row?.path !== 'string' || !row.path.startsWith('artifacts/synthetic/') || row.path.split('/').includes('..') || typeof row.base64 !== 'string' || row.base64.length > 1_400_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(row.base64) || bytes.has(row.path)) throw new Error('invalid synthetic source')
    bytes.set(row.path, Buffer.from(row.base64, 'base64'))
  }
  return (path) => {
    const source = bytes.get(path)
    if (!source) throw new Error('synthetic source unavailable')
    return source
  }
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
  if (body.work_item_id !== packet.work_item_id) {
    return NextResponse.json({
      error: 'Decision Queue entry binding is missing or stale.',
      code: 'SOCIAL_DECISION_WORK_ITEM_MISMATCH',
      canonical_href: `/admin/agents/coordination?proposal=${encodeURIComponent(packet.work_item_id)}`,
    }, { status: 409 })
  }
  const commandName = socialContentCanonicalCommand(packet.current_gate, body.decision)
  if (!commandName) {
    return NextResponse.json({
      error: 'The review packet does not name a supported canonical Social Content stage.',
      code: 'SOCIAL_DECISION_STAGE_UNSUPPORTED',
    }, { status: 409 })
  }
  const idempotencyKey = socialContentDecisionIdempotencyKey({
    approvalId: packet.approval_id,
    contentUpdatedAt: packet.content_updated_at,
    currentGate: packet.current_gate,
    decision: body.decision,
  })

  const { data: receipt, error: decisionError } = await supabaseAdmin.rpc(
    'record_social_content_stage_decision',
    {
      p_social_content_id: params.id,
      p_approval_id: packet.approval_id,
      p_content_updated_at: packet.content_updated_at,
      p_decision: body.decision,
      p_decided_by_user_id: auth.user.id,
      p_idempotency_key: idempotencyKey,
      p_command_name: commandName,
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

  // The existing decision has already succeeded. This optional read-only
  // projection is available solely for explicit synthetic local/staging QA.
  // It never alters the canonical decision response in production.
  let shadowReview: Record<string, unknown> | null = null
  const shadow = record(body.evidence_repair_shadow)
  const humanQa = record(shadow?.human_qa)
  const fixture = record(shadow?.fixture)
  const shadowInput = record(fixture?.input)
  const candidate = record(shadowInput?.candidate)
  const binding = record(shadow?.binding)
  const artifact = record(binding?.artifact)
  const authority = record(binding?.authority)
  const approvalSource = record(authority?.source)
  const qaFixture = record(record(item.rag_context)?.qa_fixture)
  const decisionReceipt = record(receipt)
  if (
    shadow && shadowEnvironment(shadow.mode)
    && qaFixture?.kind === 'evidence_repair_shadow' && qaFixture.synthetic === true
    && shadow.data_class === 'synthetic' && fixture?.synthetic === true
    && typeof fixture.case_id === 'string' && fixture.case_id.startsWith('synthetic:')
    && candidate?.id === params.id && fixture.candidate_version === packet.content_updated_at
    && artifact?.version === packet.content_updated_at
    && body.decision === 'approve' && decisionReceipt?.external_execution === false
    && humanQa?.decision === 'passed' && humanQa.reviewer_id === auth.user.id
    && humanQa.case_id === fixture.case_id && humanQa.candidate_version === fixture.candidate_version
    && humanQa.blocker_version === fixture.blocker_version
    && humanQa.work_item_id === packet.work_item_id && humanQa.stage_receipt_id === decisionReceipt.id
    && humanQa.reviewer_id === authority?.reviewer_id && humanQa.approved_at === authority?.approved_at
    && humanQa.approval_source_path === approvalSource?.path && humanQa.approval_source_sha256 === approvalSource?.sha256
  ) {
    try {
      const { evaluateShadowWorkflowBinding } = await import('@/tools/evidence-repair/shadow-workflow-binding.mjs')
      const readSource = syntheticBytes(shadow.source_bytes)
      shadowReview = evaluateShadowWorkflowBinding({
        mode: shadow.mode,
        data_class: shadow.data_class,
        fixture: shadow.fixture,
        human_qa: shadow.human_qa,
        binding: shadow.binding,
        workflow: { packet, result: { ok: true, decision: body.decision, receipt, item: updatedItem, external_execution: false } },
      }, [], readSource)
    } catch {
      shadowReview = { schema_version: 'evidence-repair-shadow-workflow-review/v1', status: 'blocked', reason: 'synthetic_shadow_input_invalid', receipt_sha256: null, receipt_candidate: null, reconciliation: 'ineligible', label_promoted: false, workflow_mutated: false, external_actions_enabled: false }
    }
  }

  return NextResponse.json({
    ok: true,
    decision: body.decision,
    receipt,
    item: updatedItem,
    next_internal_gate: body.decision === 'approve' ? packet.next_gate : 'copy_revision',
    external_execution: false,
    canonical_command: commandName,
    ...(shadowReview ? { evidence_repair_shadow_review: shadowReview } : {}),
  })
}
