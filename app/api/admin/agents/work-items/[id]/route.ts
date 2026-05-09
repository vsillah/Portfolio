import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  AGENT_WORK_ITEM_STATUSES,
  cancelAgentWorkItem,
  completeAgentWorkItem,
  getAgentWorkItem,
  updateAgentWorkItemStatus,
  type AgentWorkItemStatus,
} from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'

function isStatus(value: string): value is AgentWorkItemStatus {
  return AGENT_WORK_ITEM_STATUSES.includes(value as AgentWorkItemStatus)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const work_item = await getAgentWorkItem(params.id)
    if (!work_item) return NextResponse.json({ error: 'Work item not found' }, { status: 404 })
    return NextResponse.json({ work_item })
  } catch (error) {
    console.error('[agent-work-item] fetch failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch work item' },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as {
    status?: string
    note?: string | null
  }

  if (!body.status || !isStatus(body.status)) {
    return NextResponse.json({ error: 'Valid status is required' }, { status: 400 })
  }

  try {
    const work_item = body.status === 'cancelled'
      ? await cancelAgentWorkItem({ id: params.id, reason: body.note ?? null })
      : body.status === 'merged' || body.status === 'deployed'
        ? await completeAgentWorkItem({
            id: params.id,
            status: body.status,
            validationSummary: body.note ?? null,
          })
        : await updateAgentWorkItemStatus({
            id: params.id,
            status: body.status,
            note: body.note ?? null,
          })

    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update work item'
    const status = message === 'Agent work item not found' ? 404 : 500
    console.error('[agent-work-item] update failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}
