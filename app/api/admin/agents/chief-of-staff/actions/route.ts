import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { recordAgentEvent, startAgentRun } from '@/lib/agent-run'
import {
  actionRequiresApproval,
  getApprovalGate,
  type AgentAction,
} from '@/lib/agent-policy'
import { supabaseAdmin } from '@/lib/supabase'
import type { ChiefOfStaffActionProposal } from '@/lib/chief-of-staff-chat'

export const dynamic = 'force-dynamic'

const ACTIONS: AgentAction[] = [
  'read_files',
  'write_files',
  'external_api_call',
  'client_data_access',
  'known_workflow_db_write',
  'unknown_db_write',
  'publish_public_content',
  'send_email',
  'production_config_change',
  'public_content_from_private_material',
]

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
      },
      idempotencyKey: `${run.id}:chief-of-staff-approval-created`,
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
