import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  AGENT_WORK_ITEM_PRIORITIES,
  AGENT_WORK_ITEM_STATUSES,
  createAgentWorkItem,
  listAgentWorkItems,
  type AgentWorkItemPriority,
  type AgentWorkItemStatus,
} from '@/lib/agent-work-items'
import { AGENT_RUNTIMES, type AgentRuntime } from '@/lib/agent-run'

export const dynamic = 'force-dynamic'

function isStatus(value: string): value is AgentWorkItemStatus {
  return AGENT_WORK_ITEM_STATUSES.includes(value as AgentWorkItemStatus)
}

function isPriority(value: string): value is AgentWorkItemPriority {
  return AGENT_WORK_ITEM_PRIORITIES.includes(value as AgentWorkItemPriority)
}

function isRuntime(value: string): value is AgentRuntime {
  return AGENT_RUNTIMES.includes(value as AgentRuntime)
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  if (status && !isStatus(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  const statusFilter: AgentWorkItemStatus | null = status ? status as AgentWorkItemStatus : null

  try {
    const work_items = await listAgentWorkItems({
      status: statusFilter,
      ownerAgentKey: searchParams.get('owner_agent_key'),
      limit: Number(searchParams.get('limit') || 50),
    })
    return NextResponse.json({ work_items })
  } catch (error) {
    console.error('[agent-work-items] list failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list work items' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const objective = typeof body.objective === 'string' ? body.objective.trim() : ''
  if (!title || !objective) {
    return NextResponse.json({ error: 'title and objective are required' }, { status: 400 })
  }

  const priority = typeof body.priority === 'string' ? body.priority : 'medium'
  if (!isPriority(priority)) {
    return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
  }

  const status = typeof body.status === 'string' ? body.status : undefined
  if (status && !['proposed', 'queued', 'assigned', 'in_progress'].includes(status)) {
    return NextResponse.json({ error: 'Invalid initial status' }, { status: 400 })
  }

  const ownerRuntime: AgentRuntime | undefined = typeof body.owner_runtime === 'string' ? body.owner_runtime as AgentRuntime : undefined
  if (ownerRuntime && !isRuntime(ownerRuntime)) {
    return NextResponse.json({ error: 'Invalid owner_runtime' }, { status: 400 })
  }

  try {
    const work_item = await createAgentWorkItem({
      title,
      objective,
      priority,
      status: status as 'proposed' | 'queued' | 'assigned' | 'in_progress' | undefined,
      ownerAgentKey: typeof body.owner_agent_key === 'string' ? body.owner_agent_key : null,
      ownerRuntime,
      source: {
        type: typeof body.source_type === 'string' ? body.source_type : 'admin_agent_coordination',
        id: typeof body.source_id === 'string' || typeof body.source_id === 'number' ? body.source_id : auth.user.id,
        label: typeof body.source_label === 'string' ? body.source_label : 'Admin coordination request',
      },
      sourceRunId: typeof body.source_run_id === 'string' ? body.source_run_id : null,
      parentWorkItemId: typeof body.parent_work_item_id === 'string' ? body.parent_work_item_id : null,
      branchName: typeof body.branch_name === 'string' ? body.branch_name : null,
      worktreePath: typeof body.worktree_path === 'string' ? body.worktree_path : null,
      expectedFiles: stringArray(body.expected_files),
      overlapGroup: typeof body.overlap_group === 'string' ? body.overlap_group : null,
      dependencyIds: stringArray(body.dependency_ids),
      metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata as Record<string, unknown> : {},
      idempotencyKey: typeof body.idempotency_key === 'string' ? body.idempotency_key : null,
    })

    return NextResponse.json({ ok: true, work_item })
  } catch (error) {
    console.error('[agent-work-items] create failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create work item' },
      { status: 500 },
    )
  }
}
