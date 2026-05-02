import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { recordAgentEvent, startAgentRun } from '@/lib/agent-run'
import { getAgentByKey } from '@/lib/agent-organization'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/agents/engage
 *
 * Creates a traceable engagement request for one target agent. This queues
 * work for review; it does not execute the agent or mutate production data.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as {
    agent_key?: unknown
    note?: unknown
  }

  const agentKey = typeof body.agent_key === 'string' ? body.agent_key.trim() : ''
  if (!agentKey) {
    return NextResponse.json({ error: 'agent_key is required' }, { status: 400 })
  }

  const agent = getAgentByKey(agentKey)
  if (!agent) {
    return NextResponse.json({ error: 'Unknown agent_key' }, { status: 400 })
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null

  try {
    const run = await startAgentRun({
      agentKey: agent.key,
      runtime: 'manual',
      kind: 'agent_engagement_request',
      title: `Engage ${agent.name}`,
      status: 'queued',
      subject: { type: 'admin_agent_engagement', id: auth.user.id, label: 'Admin engagement request' },
      triggerSource: 'admin_agent_engagement',
      triggeredByUserId: auth.user.id,
      currentStep: 'Engagement request queued',
      metadata: {
        requested_agent: agent.key,
        requested_agent_name: agent.name,
        pod: agent.podKey,
        status: agent.status,
        primary_runtime: agent.primaryRuntime,
        approval_gate: agent.approvalGate,
        engagement_path: agent.engagementPath,
        note,
        executes_action: false,
      },
      idempotencyKey: `admin-agent-engage:${agent.key}:${auth.user.id}:${Date.now()}`,
    })

    await recordAgentEvent({
      runId: run.id,
      eventType: 'agent_engagement_requested',
      severity: 'info',
      message: `Admin requested ${agent.name}`,
      metadata: {
        agent_key: agent.key,
        requested_by_user_id: auth.user.id,
        note,
      },
      idempotencyKey: `${run.id}:admin-agent-engagement-requested`,
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      run_id: run.id,
      agent_key: agent.key,
      agent_name: agent.name,
      status: 'queued',
    })
  } catch (error) {
    console.error('[admin-agent-engage] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue agent engagement' },
      { status: 500 },
    )
  }
}
