import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  AGENT_WORK_ITEM_PRIORITIES,
  prioritizeAgentWorkItem,
  type AgentWorkItemPriority,
} from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

function isPriority(value: string): value is AgentWorkItemPriority {
  return AGENT_WORK_ITEM_PRIORITIES.includes(value as AgentWorkItemPriority)
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
    priority?: unknown
    note?: unknown
  }
  const priority = typeof body.priority === 'string' ? body.priority : ''
  if (!isPriority(priority)) {
    return NextResponse.json({ error: 'Valid priority is required' }, { status: 400 })
  }

  try {
    const work_item = await prioritizeAgentWorkItem({
      id: params.id,
      priority,
      note: typeof body.note === 'string' ? body.note : null,
    })
    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prioritize work item'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item-priority] failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
