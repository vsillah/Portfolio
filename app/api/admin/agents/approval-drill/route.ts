import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { recordAgentEvent, startAgentRun } from '@/lib/agent-run'
import { APPROVAL_GATES } from '@/lib/agent-policy'

export const dynamic = 'force-dynamic'

function isKnownApprovalType(value: string) {
  return APPROVAL_GATES.some((gate) => gate.approvalType === value)
}

/**
 * POST /api/admin/agents/approval-drill
 *
 * Creates a disposable run with a pending approval so the approval gate flow can
 * be verified without touching a production workflow.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    approval_type?: string
    note?: string
  }

  const approvalType = body.approval_type || 'production_config_change'
  if (!isKnownApprovalType(approvalType)) {
    return NextResponse.json({ error: 'Invalid approval_type' }, { status: 400 })
  }

  try {
    const run = await startAgentRun({
      agentKey: 'manual-admin',
      runtime: 'manual',
      kind: 'approval_gate_drill',
      title: 'Approval gate drill',
      status: 'waiting_for_approval',
      subject: { type: 'system', id: 'agent-approval-drill', label: 'Agent approval drill' },
      triggerSource: 'admin_agent_approval_drill',
      triggeredByUserId: auth.user.id,
      currentStep: `Approval required: ${approvalType}`,
      metadata: {
        drill: true,
        approval_type: approvalType,
        note: body.note ?? null,
      },
      idempotencyKey: `approval-drill:${auth.user.id}:${Date.now()}`,
    })

    const { data, error } = await supabaseAdmin
      .from('agent_approvals')
      .insert({
        run_id: run.id,
        approval_type: approvalType,
        status: 'pending',
        requested_by_agent_key: 'manual-admin',
        metadata: {
          drill: true,
          note: body.note ?? 'Approval drill created from Agent Operations.',
        },
      })
      .select('id')
      .single()

    if (error || !data?.id) {
      throw new Error(error?.message ?? 'Failed to create drill approval')
    }

    await recordAgentEvent({
      runId: run.id,
      eventType: 'approval_drill_created',
      severity: 'info',
      message: `${approvalType}: pending`,
      metadata: { approval_id: data.id, approval_type: approvalType },
      idempotencyKey: `${run.id}:approval-drill-created`,
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      run_id: run.id,
      approval_id: data.id,
      approval_type: approvalType,
    })
  } catch (error) {
    console.error('[approval-drill] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create approval drill' },
      { status: 500 },
    )
  }
}
