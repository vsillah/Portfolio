import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { handoffAgentWorkItem } from '@/lib/agent-work-items'
import { AGENT_RUNTIMES, type AgentRuntime } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

function isRuntime(value: string): value is AgentRuntime {
  return AGENT_RUNTIMES.includes(value as AgentRuntime)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const toAgentKey = typeof body.to_agent_key === 'string' ? body.to_agent_key.trim() : ''
  const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
  if (!toAgentKey || !summary) {
    return NextResponse.json({ error: 'to_agent_key and summary are required' }, { status: 400 })
  }
  const toRuntime: AgentRuntime | undefined = typeof body.to_runtime === 'string' ? body.to_runtime as AgentRuntime : undefined
  if (toRuntime && !isRuntime(toRuntime)) {
    return NextResponse.json({ error: 'Invalid to_runtime' }, { status: 400 })
  }

  try {
    const result = await handoffAgentWorkItem({
      id: params.id,
      toAgentKey,
      toRuntime,
      fromAgentKey: typeof body.from_agent_key === 'string' ? body.from_agent_key : null,
      handoffType: typeof body.handoff_type === 'string' ? body.handoff_type : null,
      summary,
      acceptanceCriteria: typeof body.acceptance_criteria === 'string' ? body.acceptance_criteria : null,
      idempotencyKey: typeof body.idempotency_key === 'string' ? body.idempotency_key : null,
    })
    return NextResponse.json({ ok: true, work_item: result.workItem, handoff_id: result.handoffId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to hand off work item'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-handoff] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
