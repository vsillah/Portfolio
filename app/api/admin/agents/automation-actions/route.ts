import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  listAutomationActionTracker,
  updateAutomationActionState,
  type AutomationActionStatus,
} from '@/lib/codex-automation-action-tracker'
import { createAgentWorkItem } from '@/lib/agent-work-items'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ACTION_STATUSES: AutomationActionStatus[] = ['open', 'in_progress', 'blocked', 'done', 'dismissed']

function isActionStatus(value: unknown): value is AutomationActionStatus {
  return typeof value === 'string' && ACTION_STATUSES.includes(value as AutomationActionStatus)
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const tracker = await listAutomationActionTracker()
  return NextResponse.json(tracker)
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const actionId = typeof body.action_id === 'string' ? body.action_id.trim() : ''
  if (!actionId) {
    return NextResponse.json({ error: 'action_id is required' }, { status: 400 })
  }

  const status = body.status === undefined ? undefined : body.status
  if (status !== undefined && !isActionStatus(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const update = await updateAutomationActionState(actionId, {
    status,
    owner: typeof body.owner === 'string' ? body.owner : body.owner === null ? null : undefined,
    note: typeof body.note === 'string' ? body.note : body.note === null ? null : undefined,
  })

  return NextResponse.json({ ok: true, action_state: update })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const actionId = typeof body.action_id === 'string' ? body.action_id.trim() : ''
  if (!actionId) {
    return NextResponse.json({ error: 'action_id is required' }, { status: 400 })
  }

  const tracker = await listAutomationActionTracker()
  const action = tracker.actions.find((item) => item.id === actionId)
  if (!action) {
    return NextResponse.json({ error: 'Automation action not found' }, { status: 404 })
  }

  try {
    const workItem = await createAgentWorkItem({
      title: `${action.automationName}: ${action.text}`,
      objective: [
        action.text,
        action.summary ? `Context: ${action.summary}` : null,
        action.codexThreadHint ? `Thread hint: ${action.codexThreadHint}` : null,
      ].filter(Boolean).join('\n'),
      priority: action.priority === 'urgent' ? 'urgent' : action.priority === 'high' ? 'high' : 'medium',
      status: 'queued',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'codex',
      source: {
        type: 'codex_automation_action',
        id: action.id,
        label: action.automationName,
      },
      expectedFiles: action.sourceFiles,
      metadata: {
        automation_id: action.automationId,
        automation_name: action.automationName,
        action_kind: action.kind,
        source_files: action.sourceFiles,
        latest_source_file: action.latestSourceFile,
        first_seen_at: action.firstSeenAt,
        last_seen_at: action.lastSeenAt,
        occurrence_count: action.occurrenceCount,
      },
      idempotencyKey: action.id,
    })

    await updateAutomationActionState(action.id, {
      status: 'in_progress',
      linkedWorkItemId: workItem.id,
      note: action.note ?? 'Promoted into Agent Ops work item.',
    })

    return NextResponse.json({ ok: true, work_item: workItem })
  } catch (error) {
    console.error('[automation-actions] create work item failed:', error)
    return NextResponse.json(
      { error: 'Failed to create work item' },
      { status: 500 },
    )
  }
}
