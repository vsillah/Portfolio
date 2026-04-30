import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { AGENT_EVENT_SEVERITIES, recordAgentEvent, type AgentEventSeverity } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

function isSeverity(value: string): value is AgentEventSeverity {
  return AGENT_EVENT_SEVERITIES.includes(value as AgentEventSeverity)
}

/**
 * POST /api/admin/agents/runs/:runId/events
 * Writes an audit event for a run. Used by admin tools and future n8n callbacks.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as {
    event_type?: string
    severity?: string
    message?: string
    metadata?: Record<string, unknown>
    idempotency_key?: string
  }

  if (!body.event_type) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 })
  }
  if (body.severity && !isSeverity(body.severity)) {
    return NextResponse.json({ error: 'Invalid severity' }, { status: 400 })
  }

  try {
    const result = await recordAgentEvent({
      runId: params.runId,
      eventType: body.event_type,
      severity: body.severity as AgentEventSeverity | undefined,
      message: body.message ?? null,
      metadata: body.metadata ?? {},
      idempotencyKey: body.idempotency_key ?? null,
    })

    return NextResponse.json({ ok: true, event_id: result?.id ?? null })
  } catch (err) {
    console.error('[agent-events] write failed:', err)
    return NextResponse.json({ error: 'Failed to write event' }, { status: 500 })
  }
}
