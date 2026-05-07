import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  createAgentRunRecoveryRequest,
  isRecoverableAgentRunStatus,
  type AgentRunRecoverySource,
} from '@/lib/agent-run-recovery'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/agents/runs/:runId/retry
 *
 * Creates a traced, read-only recovery request for a failed/stale/cancelled
 * Agent Ops run. This does not re-run production automation directly.
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

  const body = (await request.json().catch(() => ({}))) as { note?: unknown }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null

  const { data: run, error } = await supabaseAdmin
    .from('agent_runs')
    .select('id, agent_key, runtime, kind, title, status, subject_type, subject_id, subject_label, current_step, error_message, metadata')
    .eq('id', params.runId)
    .single()

  if (error || !run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  }

  const sourceRun = run as AgentRunRecoverySource
  if (!isRecoverableAgentRunStatus(sourceRun.status)) {
    return NextResponse.json(
      { error: 'Only failed, stale, or cancelled runs can be queued for recovery' },
      { status: 400 },
    )
  }

  const previousRecoveries = await supabaseAdmin
    .from('agent_runs')
    .select('id')
    .eq('kind', 'agent_recovery_request')
    .contains('metadata', { source_run_id: params.runId })

  if (previousRecoveries.error) {
    return NextResponse.json({ error: 'Failed to inspect prior recovery requests' }, { status: 500 })
  }

  try {
    const result = await createAgentRunRecoveryRequest({
      sourceRun,
      previousRecoveryCount: previousRecoveries.data?.length ?? 0,
      actor: {
        subjectType: 'agent_run',
        subjectId: params.runId,
        subjectLabel: `Recovery for ${sourceRun.title}`,
        userId: auth.user.id,
      },
      note,
    })

    return NextResponse.json({
      ok: true,
      run_id: result.runId,
      source_run_id: params.runId,
      retry_attempt: result.plan.retry_attempt,
      earliest_retry_at: result.plan.earliest_retry_at,
      target_agent_key: result.plan.target_agent_key,
      target_agent_name: result.plan.target_agent_name,
      recovery_packet_attached: result.recoveryPacketAttached,
      execution_mode: result.plan.execution_mode,
    })
  } catch (err) {
    console.error('[agent-run-retry] failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to queue recovery request' },
      { status: 500 },
    )
  }
}
