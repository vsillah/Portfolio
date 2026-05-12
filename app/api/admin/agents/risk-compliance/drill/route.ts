import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import {
  MOREMI_OPERATIONAL_DRILL_SIGNAL,
  buildMoremiOperationalDrillWorkItemRequest,
  getAiRiskSignalMonitorSummary,
} from '@/lib/ai-risk-signal-monitor'

export const dynamic = 'force-dynamic'

function toCreateWorkItemInput(
  request: ReturnType<typeof buildMoremiOperationalDrillWorkItemRequest>['workItemRequest'],
) {
  const { sourceAssessment: _sourceAssessment, ...input } = request
  return input
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { assessment, workItemRequest } = buildMoremiOperationalDrillWorkItemRequest()

  return NextResponse.json({
    ok: true,
    monitor: getAiRiskSignalMonitorSummary(),
    signal: MOREMI_OPERATIONAL_DRILL_SIGNAL,
    assessment,
    work_item_request: toCreateWorkItemInput(workItemRequest),
    side_effects: {
      work_items_created: false,
      production_mutation_allowed: false,
      note: 'Preview only. POST with confirmation run_moremi_operational_drill to create the proposed synthetic work item.',
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (body.confirmation !== 'run_moremi_operational_drill') {
    return NextResponse.json(
      { error: 'confirmation must be run_moremi_operational_drill to create the synthetic drill work item' },
      { status: 400 },
    )
  }

  const { assessment, workItemRequest } = buildMoremiOperationalDrillWorkItemRequest()
  const workItem = await createAgentWorkItem(toCreateWorkItemInput(workItemRequest))

  return NextResponse.json({
    ok: true,
    monitor: getAiRiskSignalMonitorSummary(),
    signal: MOREMI_OPERATIONAL_DRILL_SIGNAL,
    assessment,
    work_item_request: toCreateWorkItemInput(workItemRequest),
    work_item: workItem,
    verification: {
      admin_path: '/admin/agents/coordination',
      slack_command: '/agent work',
      expected_status: 'proposed',
    },
    side_effects: {
      work_items_created: true,
      work_item_count: 1,
      production_mutation_allowed: false,
      note: 'Created or reused an idempotent proposed Agent Ops work item. Production remediation remains approval-gated.',
    },
  })
}
