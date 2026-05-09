import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { claimAgentWorkItem } from '@/lib/agent-work-items'
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

  const body = (await request.json().catch(() => ({}))) as {
    owner_agent_key?: unknown
    owner_runtime?: unknown
    actor_label?: unknown
  }
  const ownerAgentKey = typeof body.owner_agent_key === 'string' ? body.owner_agent_key.trim() : ''
  if (!ownerAgentKey) {
    return NextResponse.json({ error: 'owner_agent_key is required' }, { status: 400 })
  }
  const ownerRuntime: AgentRuntime | undefined = typeof body.owner_runtime === 'string' ? body.owner_runtime as AgentRuntime : undefined
  if (ownerRuntime && !isRuntime(ownerRuntime)) {
    return NextResponse.json({ error: 'Invalid owner_runtime' }, { status: 400 })
  }

  try {
    const work_item = await claimAgentWorkItem({
      id: params.id,
      ownerAgentKey,
      ownerRuntime,
      actorLabel: typeof body.actor_label === 'string' ? body.actor_label : 'Admin user',
    })
    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to claim work item'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-claim] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
