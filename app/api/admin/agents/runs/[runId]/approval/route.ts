import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { AGENT_APPROVAL_STATUSES, type AgentApprovalStatus } from '@/lib/agent-run'

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

  if (approvalId) {
    const { data, error } = await supabaseAdmin
      .from('agent_approvals')
      .update({
        status,
        decided_by_user_id: decided ? auth.user.id : null,
        decided_at: decided ? new Date().toISOString() : null,
        decision_notes: body.decision_notes ?? null,
        metadata: body.metadata ?? {},
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
    message: `${body.approval_type ?? body.approval_id}: ${status}`,
    metadata: { approval_id: approvalId, status },
  })

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
