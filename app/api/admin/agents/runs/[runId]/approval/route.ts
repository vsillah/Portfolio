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
    approval_type?: string
    status?: string
    requested_by_agent_key?: string | null
    decision_notes?: string | null
    metadata?: Record<string, unknown>
  }

  if (!body.approval_type) {
    return NextResponse.json({ error: 'approval_type is required' }, { status: 400 })
  }
  const status = body.status ?? 'pending'
  if (!isApprovalStatus(status)) {
    return NextResponse.json({ error: 'Invalid approval status' }, { status: 400 })
  }

  const decided = status !== 'pending'
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

  await supabaseAdmin.from('agent_run_events').insert({
    run_id: params.runId,
    event_type: 'approval_recorded',
    severity: status === 'rejected' ? 'warning' : 'info',
    message: `${body.approval_type}: ${status}`,
    metadata: { approval_id: data.id, status },
  })

  return NextResponse.json({ ok: true, approval_id: data.id })
}
