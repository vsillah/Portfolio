import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createAgentEngagementRun } from '@/lib/agent-engagement'
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
    const result = await createAgentEngagementRun({
      agent,
      actor: {
        subjectType: 'admin_agent_engagement',
        subjectId: auth.user.id,
        subjectLabel: 'Admin engagement request',
        userId: auth.user.id,
      },
      triggerSource: 'admin_agent_engagement',
      note,
      requestedEventMessage: `Admin requested ${agent.name}`,
      idempotencyKey: `admin-agent-engage:${agent.key}:${auth.user.id}:${Date.now()}`,
      eventMetadata: {
        requested_by_user_id: auth.user.id,
      },
    })

    return NextResponse.json({
      ok: true,
      run_id: result.runId,
      agent_key: agent.key,
      agent_name: agent.name,
      status: result.status,
      work_packet_attached: result.workPacketAttached,
      dispatch_artifact_attached: result.dispatchArtifactAttached,
      execution_mode: result.executionMode,
    })
  } catch (error) {
    console.error('[admin-agent-engage] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue agent engagement' },
      { status: 500 },
    )
  }
}
