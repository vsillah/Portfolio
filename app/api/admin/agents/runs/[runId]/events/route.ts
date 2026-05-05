import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  AGENT_EVENT_SEVERITIES,
  AGENT_RUN_STATUSES,
  recordAgentEvent,
  recordAgentStep,
  type AgentEventSeverity,
  type AgentRunStatus,
} from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

function isSeverity(value: string): value is AgentEventSeverity {
  return AGENT_EVENT_SEVERITIES.includes(value as AgentEventSeverity)
}

function normalizeCallbackStatus(status?: string | null): AgentRunStatus {
  if (!status) return 'completed'

  const normalized = status.toLowerCase()
  if (normalized === 'complete' || normalized === 'completed' || normalized === 'success') {
    return 'completed'
  }
  if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') {
    return 'failed'
  }
  if (normalized === 'in_progress' || normalized === 'started') {
    return 'running'
  }
  if (AGENT_RUN_STATUSES.includes(normalized as AgentRunStatus)) {
    return normalized as AgentRunStatus
  }

  throw new Error(`Invalid callback status: ${status}`)
}

function stepKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function authorizeAdminOrN8n(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.N8N_INGEST_SECRET && token === process.env.N8N_INGEST_SECRET) {
    return null
  }

  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  return null
}

/**
 * POST /api/admin/agents/runs/:runId/events
 * Writes an audit event for a run. Used by admin tools and future n8n callbacks.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } },
) {
  const authError = await authorizeAdminOrN8n(request)
  if (authError) return authError

  const body = (await request.json().catch(() => ({}))) as {
    event_type?: string
    severity?: string
    message?: string
    metadata?: Record<string, unknown>
    idempotency_key?: string
    workflow_id?: string
    stage?: string
    status?: string
    items_count?: number
    error_message?: string
    record_step?: boolean
    step_key?: string
    step_name?: string
  }

  if (!body.event_type && !body.stage && !body.record_step) {
    return NextResponse.json({ error: 'event_type, stage, or record_step is required' }, { status: 400 })
  }
  if (body.severity && !isSeverity(body.severity)) {
    return NextResponse.json({ error: 'Invalid severity' }, { status: 400 })
  }

  try {
    const callbackStatus = normalizeCallbackStatus(body.status)
    const severity =
      (body.severity as AgentEventSeverity | undefined) ??
      (callbackStatus === 'failed' ? 'error' : 'info')
    const eventType = body.event_type ?? (callbackStatus === 'failed' ? 'n8n_failure' : 'n8n_progress')
    const metadata = {
      ...(body.metadata ?? {}),
      workflow_id: body.workflow_id ?? null,
      stage: body.stage ?? null,
      n8n_status: body.status ?? null,
      items_count: body.items_count ?? null,
      error_message: body.error_message ?? null,
    }

    const result = await recordAgentEvent({
      runId: params.runId,
      eventType,
      severity,
      message: body.message ?? body.error_message ?? body.stage ?? null,
      metadata,
      idempotencyKey: body.idempotency_key ?? null,
    })

    let stepId: string | null = null
    if (body.stage || body.record_step) {
      const name = body.step_name ?? body.stage ?? body.event_type ?? 'n8n callback'
      const step = await recordAgentStep({
        runId: params.runId,
        stepKey: body.step_key ?? stepKey(`n8n_${body.workflow_id ?? 'workflow'}_${name}`),
        name,
        status: callbackStatus,
        outputSummary: body.error_message ?? (body.items_count != null ? `${body.items_count} item(s)` : body.status ?? null),
        metadata,
        idempotencyKey: body.idempotency_key ? `${body.idempotency_key}:step` : null,
      })
      stepId = step?.id ?? null
    }

    return NextResponse.json({ ok: true, event_id: result?.id ?? null, step_id: stepId })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Invalid callback status')) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[agent-events] write failed:', err)
    return NextResponse.json({ error: 'Failed to write event' }, { status: 500 })
  }
}
