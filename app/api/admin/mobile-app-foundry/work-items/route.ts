import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import {
  MOBILE_FOUNDRY_WORK_ITEM_SIDE_EFFECTS,
  MOBILE_FOUNDRY_WORK_ITEMS_CONFIRMATION,
  buildMobileFoundryWorkItemRequest,
  parseMobileFoundryBacklogRecord,
} from '@/lib/mobile-app-foundry-work-items'

export const dynamic = 'force-dynamic'

function sideEffects(workItemCount: number) {
  return {
    ...MOBILE_FOUNDRY_WORK_ITEM_SIDE_EFFECTS,
    work_items_created: workItemCount > 0,
    work_item_count: workItemCount,
    note: workItemCount > 0
      ? 'Created or reused proposed Agent Ops work items only. Prototype build, repo creation, tester outreach, store submission, and pricing remain approval-gated.'
      : 'Preview only. No Agent Ops work item or external side effect was created.',
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const record = parseMobileFoundryBacklogRecord(body.backlog_record)
  if (!record) {
    return NextResponse.json(
      { error: 'backlog_record with id, title, audience, job_to_be_done, and vambah_fit_summary is required' },
      { status: 400 },
    )
  }

  const sourceRunId = typeof body.source_run_id === 'string' ? body.source_run_id : null
  const workItemRequest = buildMobileFoundryWorkItemRequest(record, sourceRunId)
  const createWorkItems = body.action === 'create_work_item' || body.create_work_items === true

  if (!createWorkItems) {
    return NextResponse.json({
      ok: true,
      mode: 'preview',
      work_item_request: workItemRequest,
      work_items: [],
      side_effects: sideEffects(0),
    })
  }

  if (body.confirmation !== MOBILE_FOUNDRY_WORK_ITEMS_CONFIRMATION) {
    return NextResponse.json(
      { error: `confirmation must be ${MOBILE_FOUNDRY_WORK_ITEMS_CONFIRMATION} to create Mobile App Foundry work items` },
      { status: 400 },
    )
  }

  try {
    const workItem = await createAgentWorkItem(workItemRequest)

    return NextResponse.json({
      ok: true,
      mode: 'confirmed_create',
      work_item_request: workItemRequest,
      work_items: [workItem],
      side_effects: sideEffects(1),
    })
  } catch (error) {
    console.error('[mobile-app-foundry] work item create failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Mobile App Foundry work item' },
      { status: 500 },
    )
  }
}
