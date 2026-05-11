import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { AGENT_APPROVAL_STATUSES, type AgentApprovalStatus } from '@/lib/agent-run'
import { VERCEL_RESEARCH_APPROVAL_TYPE } from '@/lib/vercel-deployment-research'

export const dynamic = 'force-dynamic'

function isApprovalStatus(value: string): value is AgentApprovalStatus {
  return AGENT_APPROVAL_STATUSES.includes(value as AgentApprovalStatus)
}

/**
 * POST /api/admin/agents/runs/:runId/approval
 * Creates or records an approval checkpoint for a run.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    approval_id?: string
    approval_type?: string
    status?: string
    requested_by_agent_key?: string | null
    decision_notes?: string | null
    metadata?: Record<string, unknown>
  }

  if (!body.approval_type) {
    if (!body.approval_id) {
      return NextResponse.json({ error: 'approval_type is required' }, { status: 400 })
    }
  }
  const status = body.status ?? 'pending'
  if (!isApprovalStatus(status)) {
    return NextResponse.json({ error: 'Invalid approval status' }, { status: 400 })
  }

  const decided = status !== 'pending'
  let approvalId = body.approval_id ?? null
  let approvalType = body.approval_type ?? null
  let approvalMetadata: Record<string, unknown> = body.metadata ?? {}

  if (approvalId) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('agent_approvals')
      .select('id, approval_type, metadata')
      .eq('id', approvalId)
      .eq('run_id', params.runId)
      .single()

    if (existingError || !existing?.id) {
      console.error('[agent-approval] read failed:', existingError)
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    const existingMetadata =
      existing.metadata && typeof existing.metadata === 'object'
        ? existing.metadata as Record<string, unknown>
        : {}
    approvalType = existing.approval_type as string
    const decisionMetadata = decided
      ? {
          status,
          decision_notes: body.decision_notes ?? null,
          decided_by_user_id: auth.user.id,
          decided_at: new Date().toISOString(),
        }
      : null
    const mergedMetadata = {
      ...existingMetadata,
      ...(body.metadata ?? {}),
      ...(existingMetadata.action_payload ? { action_payload: existingMetadata.action_payload } : {}),
      ...(decisionMetadata ? { decision: decisionMetadata } : {}),
    }
    approvalMetadata = mergedMetadata

    const { data, error } = await supabaseAdmin
      .from('agent_approvals')
      .update({
        status,
        decided_by_user_id: decided ? auth.user.id : null,
        decided_at: decided ? new Date().toISOString() : null,
        decision_notes: body.decision_notes ?? null,
        metadata: mergedMetadata,
      })
      .eq('id', approvalId)
      .eq('run_id', params.runId)
      .select('id')
      .single()

    if (error || !data?.id) {
      console.error('[agent-approval] update failed:', error)
      return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 })
    }
    approvalId = data.id as string
  } else {
    approvalType = body.approval_type as string
    approvalMetadata = body.metadata ?? {}
    const { data, error } = await supabaseAdmin
      .from('agent_approvals')
      .insert({
        run_id: params.runId,
        approval_type: body.approval_type,
        status,
        requested_by_agent_key: body.requested_by_agent_key ?? null,
        decided_by_user_id: decided ? auth.user.id : null,
        decided_at: decided ? new Date().toISOString() : null,
        decision_notes: body.decision_notes ?? null,
        metadata: body.metadata ?? {},
      })
      .select('id')
      .single()

    if (error || !data?.id) {
      console.error('[agent-approval] insert failed:', error)
      return NextResponse.json({ error: 'Failed to record approval' }, { status: 500 })
    }
    approvalId = data.id as string
  }

  await supabaseAdmin.from('agent_run_events').insert({
    run_id: params.runId,
    event_type: approvalId === body.approval_id ? 'approval_decided' : 'approval_recorded',
    severity: status === 'rejected' ? 'warning' : 'info',
    message: `${approvalType ?? body.approval_id}: ${status}`,
    metadata: {
      approval_id: approvalId,
      status,
      decision_notes: body.decision_notes ?? null,
      ...(body.metadata ?? {}),
    },
  })

  const workItemId =
    approvalType === VERCEL_RESEARCH_APPROVAL_TYPE && typeof approvalMetadata.work_item_id === 'string'
      ? approvalMetadata.work_item_id
      : null
  if (workItemId && (status === 'approved' || status === 'rejected' || status === 'cancelled')) {
    await supabaseAdmin
      .from('agent_work_items')
      .update({
        status: status === 'approved' ? 'assigned' : 'blocked',
        blocker_summary: status === 'approved' ? null : body.decision_notes ?? `Vercel AutoResearch proposal ${status}`,
        validation_summary:
          status === 'approved'
            ? 'Vercel AutoResearch proposal approved for the next scoped research action. Merge and production deployment remain gated.'
            : body.decision_notes ?? `Vercel AutoResearch proposal ${status}.`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workItemId)
  }

  if (status === 'pending') {
    await supabaseAdmin
      .from('agent_runs')
      .update({
        status: 'waiting_for_approval',
        current_step: body.approval_type ? `Approval required: ${body.approval_type}` : 'Approval required',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.runId)
      .in('status', ['queued', 'running'])
  }

  if (status === 'rejected' || status === 'cancelled') {
    await supabaseAdmin
      .from('agent_runs')
      .update({
        status: status === 'rejected' ? 'failed' : 'cancelled',
        current_step: status === 'rejected' ? 'Approval rejected' : 'Approval cancelled',
        error_message: body.decision_notes ?? `Approval ${status}`,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.runId)
  }

  if (status === 'approved') {
    const { data: pending } = await supabaseAdmin
      .from('agent_approvals')
      .select('id')
      .eq('run_id', params.runId)
      .eq('status', 'pending')
      .limit(1)

    if (!pending || pending.length === 0) {
      await supabaseAdmin
        .from('agent_runs')
        .update({
          status: 'running',
          current_step: 'Approval granted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.runId)
        .eq('status', 'waiting_for_approval')
    }
  }

  return NextResponse.json({ ok: true, approval_id: approvalId })
}
