import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  createN8nWorkflowProposal,
  isN8nWorkflowProposalAction,
} from '@/lib/agent-n8n-workflow-proposals'

export const dynamic = 'force-dynamic'

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = nullableString(body.action)
  if (!action || !isN8nWorkflowProposalAction(action)) {
    return NextResponse.json({ error: 'Invalid n8n workflow proposal action' }, { status: 400 })
  }

  if ((action === 'stage_workflow' || action === 'request_activation') && body.confirmation !== 'create_n8n_workflow_proposal') {
    return NextResponse.json({ error: 'confirmation is required before staging or activation requests' }, { status: 400 })
  }

  const title = nullableString(body.title)
  const objective = nullableString(body.objective)
  if (!title || !objective) {
    return NextResponse.json({ error: 'title and objective are required' }, { status: 400 })
  }

  try {
    const workItem = await createN8nWorkflowProposal({
      action,
      title,
      objective,
      workflowFamily: nullableString(body.workflow_family),
      automationGoalSeedId: nullableString(body.automation_goal_seed_id),
      goalId: nullableString(body.goal_id),
      goalTitle: nullableString(body.goal_title),
      goalSessionHref: nullableString(body.goal_session_href),
      existingWorkflowId: nullableString(body.existing_workflow_id),
      proposedWorkflowName: nullableString(body.proposed_workflow_name),
      trigger: nullableString(body.trigger),
      requiredEnvVars: stringArray(body.required_env_vars),
      credentialNeeds: stringArray(body.credential_needs),
      nodePlan: stringArray(body.node_plan),
      ingestCallbacks: stringArray(body.ingest_callbacks),
      testEvidence: nullableString(body.test_evidence),
      rollbackPath: nullableString(body.rollback_path),
      requestedByUserId: auth.user.id,
    })

    return NextResponse.json({ ok: true, work_item: workItem })
  } catch (error) {
    console.error('[n8n-workflow-proposals] create failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create n8n workflow proposal' },
      { status: 500 },
    )
  }
}
