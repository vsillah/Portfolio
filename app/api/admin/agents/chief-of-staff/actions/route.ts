import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { attachAgentArtifact, recordAgentEvent, startAgentRun } from '@/lib/agent-run'
import {
  AGENT_ACTIONS,
  actionRequiresApproval,
  getApprovalGate,
  type AgentAction,
} from '@/lib/agent-policy'
import { supabaseAdmin } from '@/lib/supabase'
import type { ChiefOfStaffActionProposal } from '@/lib/chief-of-staff-chat'

export const dynamic = 'force-dynamic'

const ACTIONS: readonly AgentAction[] = AGENT_ACTIONS

function isAgentAction(value: unknown): value is AgentAction {
  return typeof value === 'string' && ACTIONS.includes(value as AgentAction)
}

function normalizeProposal(value: unknown): ChiefOfStaffActionProposal | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as Record<string, unknown>
  if (!isAgentAction(raw.action)) return null

  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  const description = typeof raw.description === 'string' ? raw.description.trim() : ''
  if (!label || !description) return null

  const gate = getApprovalGate(raw.action)
  const requiresApproval = gate ? true : actionRequiresApproval('codex', raw.action)
  const riskLevel = raw.riskLevel === 'low' || raw.riskLevel === 'medium' || raw.riskLevel === 'high'
    ? raw.riskLevel
    : requiresApproval
      ? 'high'
      : 'medium'

  return {
    label: label.slice(0, 120),
    description: description.slice(0, 400),
    action: raw.action,
    approvalType: gate?.approvalType ?? null,
    requiresApproval,
    riskLevel,
  }
}

function sideEffectBoundary(action: AgentAction) {
  switch (action) {
    case 'send_email':
      return 'No email is sent until this approval checkpoint is approved and executed by an approved workflow.'
    case 'publish_public_content':
      return 'No public content is published until this approval checkpoint is approved and executed by an approved workflow.'
    case 'production_config_change':
      return 'No production configuration is changed until this approval checkpoint is approved and executed by an approved workflow.'
    case 'unknown_db_write':
      return 'No database write outside known workflows is performed until this approval checkpoint is approved.'
    case 'public_content_from_private_material':
      return 'No private-derived material is moved to a public channel until this approval checkpoint is approved.'
    case 'create_checkout_session':
      return 'No checkout session is created until this payment authority checkpoint is approved and linked to a trace.'
    case 'create_subscription':
      return 'No subscription is created until this payment authority checkpoint is approved and linked to a trace.'
    case 'create_refund':
      return 'No refund is issued until this payment authority checkpoint is approved and linked to a trace.'
    case 'make_vendor_payment':
      return 'No vendor payment is sent until this payment authority checkpoint is approved and linked to a trace.'
    case 'increase_paid_api_budget':
      return 'No paid API budget is increased until this payment authority checkpoint is approved and linked to a trace.'
    case 'start_paid_external_job':
      return 'No paid external job is started until this payment authority checkpoint is approved and linked to a trace.'
    default:
      return 'The proposed action is recorded for review; no side effect is executed by this checkpoint.'
  }
}

function buildActionPayload(input: {
  proposal: ChiefOfStaffActionProposal
  sourceRunId: string
  userId: string
}) {
  return {
    version: 1,
    action: input.proposal.action,
    approval_type: input.proposal.approvalType,
    label: input.proposal.label,
    description: input.proposal.description,
    risk_level: input.proposal.riskLevel,
    source_run_id: input.sourceRunId,
    requested_by_user_id: input.userId,
    execution_mode: 'approval_required',
    executes_action: false,
    side_effect_boundary: sideEffectBoundary(input.proposal.action),
    created_at: new Date().toISOString(),
  }
}

function formatActionPayloadSummary(payload: ReturnType<typeof buildActionPayload>) {
  return [
    `# Approval Action Payload: ${payload.label}`,
    '',
    `- Action: ${String(payload.action).replace(/_/g, ' ')}`,
    `- Approval type: ${String(payload.approval_type).replace(/_/g, ' ')}`,
    `- Risk: ${payload.risk_level}`,
    `- Source run: ${payload.source_run_id}`,
    `- Executes action now: ${payload.executes_action ? 'yes' : 'no'}`,
    '',
    payload.description,
    '',
    `Boundary: ${payload.side_effect_boundary}`,
  ].join('\n')
}

/**
 * POST /api/admin/agents/chief-of-staff/actions
 *
 * Converts a Chief of Staff recommendation into an observable approval
 * checkpoint. This route does not execute the proposed action.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    source_run_id?: unknown
    proposal?: unknown
  }

  const sourceRunId = typeof body.source_run_id === 'string' ? body.source_run_id.trim() : ''
  if (!sourceRunId) {
    return NextResponse.json({ error: 'source_run_id is required' }, { status: 400 })
  }

  const proposal = normalizeProposal(body.proposal)
  if (!proposal) {
    return NextResponse.json({ error: 'Valid proposal is required' }, { status: 400 })
  }

  const approvalType = proposal.approvalType
  if (!approvalType || !proposal.requiresApproval) {
    return NextResponse.json({ error: 'Proposal does not require an approval checkpoint' }, { status: 400 })
  }

  try {
    const actionPayload = buildActionPayload({
      proposal,
      sourceRunId,
      userId: auth.user.id,
    })

    const run = await startAgentRun({
      agentKey: 'chief-of-staff',
      runtime: 'manual',
      kind: 'chief_of_staff_action_approval',
      title: proposal.label,
      status: 'waiting_for_approval',
      subject: {
        type: 'agent_run',
        id: sourceRunId,
        label: 'Chief of Staff recommendation',
      },
      triggerSource: 'admin_chief_of_staff_action',
      triggeredByUserId: auth.user.id,
      currentStep: `Approval required: ${approvalType}`,
      metadata: {
        source_run_id: sourceRunId,
        proposal,
        action_payload: actionPayload,
        executes_action: false,
      },
      idempotencyKey: `chief-of-staff-action:${sourceRunId}:${proposal.action}:${auth.user.id}:${Date.now()}`,
    })

    const { data, error } = await supabaseAdmin
      .from('agent_approvals')
      .insert({
        run_id: run.id,
        approval_type: approvalType,
        status: 'pending',
        requested_by_agent_key: 'chief-of-staff',
        metadata: {
          source_run_id: sourceRunId,
          proposal,
          action_payload: actionPayload,
          executes_action: false,
        },
      })
      .select('id')
      .single()

    if (error || !data?.id) {
      throw new Error(error?.message ?? 'Failed to create approval checkpoint')
    }

    await recordAgentEvent({
      runId: run.id,
      eventType: 'chief_of_staff_approval_created',
      severity: 'info',
      message: `${approvalType}: ${proposal.label}`,
      metadata: {
        approval_id: data.id,
        source_run_id: sourceRunId,
        proposal,
        action_payload: actionPayload,
      },
      idempotencyKey: `${run.id}:chief-of-staff-approval-created`,
    }).catch(() => {})

    await attachAgentArtifact({
      runId: run.id,
      artifactType: 'approval_action_payload',
      title: `Approval payload: ${proposal.label}`,
      refType: 'agent_approval',
      refId: data.id,
      metadata: {
        summary_markdown: formatActionPayloadSummary(actionPayload),
        approval_id: data.id,
        approval_type: approvalType,
        source_run_id: sourceRunId,
        action_payload: actionPayload,
      },
      idempotencyKey: `${run.id}:approval-action-payload`,
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      run_id: run.id,
      approval_id: data.id,
      approval_type: approvalType,
      approval_required: true,
    })
  } catch (error) {
    console.error('[chief-of-staff-action] failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create approval checkpoint' },
      { status: 500 },
    )
  }
}
