import { recordAgentEvent } from './agent-run'
import { createAgentWorkItem, type AgentWorkItem } from './agent-work-items'
import { supabaseAdmin } from './supabase'
import {
  VERCEL_RESEARCH_APPROVAL_TYPE,
  type VercelResearchProposal,
} from './vercel-deployment-research'
import { notifyVercelResearchApprovalReady } from './vercel-autoresearch-notification'
import { fingerprintOpenBrainRecord, recordOpenBrainEvent, recordOpenBrainSource } from './open-brain'

export type VercelResearchApprovalCard = {
  approvalId: string
  runId: string
  workItemId: string
  status: string
  requestedAt: string
  proposal: VercelResearchProposal
  notification: {
    slackSentAt: string | null
    slackSkippedAt: string | null
  }
  workItem: Pick<AgentWorkItem, 'id' | 'title' | 'status' | 'active_run_id' | 'approval_id' | 'updated_at'> | null
}

type ApprovalRow = {
  id: string
  run_id: string
  status: string
  requested_at: string
  metadata: Record<string, unknown> | null
}

function db() {
  if (!supabaseAdmin) throw new Error('Database not available')
  return supabaseAdmin
}

function proposalFromMetadata(metadata: Record<string, unknown> | null): VercelResearchProposal | null {
  const proposal = metadata?.proposal
  if (!proposal || typeof proposal !== 'object') return null
  return proposal as VercelResearchProposal
}

function stringMetadata(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function notificationMetadata(metadata: Record<string, unknown> | null) {
  const notification = metadata?.notification
  if (!notification || typeof notification !== 'object') {
    return { slackSentAt: null, slackSkippedAt: null }
  }
  const record = notification as Record<string, unknown>
  return {
    slackSentAt: typeof record.slack_agent_ops_sent_at === 'string' ? record.slack_agent_ops_sent_at : null,
    slackSkippedAt: typeof record.slack_agent_ops_skipped_at === 'string' ? record.slack_agent_ops_skipped_at : null,
  }
}

async function getApproval(approvalId: string): Promise<ApprovalRow | null> {
  const { data, error } = await db()
    .from('agent_approvals')
    .select('id, run_id, status, requested_at, metadata')
    .eq('id', approvalId)
    .maybeSingle()

  if (error) throw new Error(`Failed to read AutoResearch approval: ${error.message}`)
  return data as ApprovalRow | null
}

async function notifyApprovalOnce(approval: ApprovalRow, workItemId: string, proposal: VercelResearchProposal) {
  const metadata = approval.metadata ?? {}
  const notification = notificationMetadata(metadata)
  if (notification.slackSentAt || notification.slackSkippedAt) {
    return { sent: Boolean(notification.slackSentAt), skipped: Boolean(notification.slackSkippedAt) }
  }

  const sent = await notifyVercelResearchApprovalReady({
    approvalId: approval.id,
    runId: approval.run_id,
    workItemId,
    proposal,
  })
  const now = new Date().toISOString()
  const nextMetadata = {
    ...metadata,
    notification: {
      ...(typeof metadata.notification === 'object' && metadata.notification ? metadata.notification : {}),
      ...(sent ? { slack_agent_ops_sent_at: now } : { slack_agent_ops_skipped_at: now }),
    },
  }

  await db()
    .from('agent_approvals')
    .update({ metadata: nextMetadata })
    .eq('id', approval.id)

  return { sent, skipped: !sent }
}

export async function createVercelResearchApproval(input: {
  proposal: VercelResearchProposal
  createdByUserId: string
}) {
  const proposal = input.proposal
  const workItem = await createAgentWorkItem({
    title: proposal.title,
    objective: [
      proposal.hypothesis,
      '',
      `Expected impact: ${proposal.expectedImpact}`,
      `Approval question: ${proposal.approvalQuestion}`,
    ].join('\n'),
    priority: proposal.riskLevel === 'high' ? 'high' : 'medium',
    status: 'queued',
    ownerAgentKey: 'integration-captain',
    ownerRuntime: 'codex',
    source: {
      type: 'vercel_deployment_research',
      id: proposal.id,
      label: 'Vercel AutoResearch',
    },
    expectedFiles: proposal.touchedFiles,
    overlapGroup: 'vercel-deployment-research',
    metadata: {
      vercel_research: true,
      proposal,
      approval_type: VERCEL_RESEARCH_APPROVAL_TYPE,
      created_by_user_id: input.createdByUserId,
    },
    idempotencyKey: `vercel-autoresearch:${proposal.id}`,
  })

  if (!workItem.active_run_id) {
    throw new Error('Vercel AutoResearch work item did not create an active run')
  }

  let approval = workItem.approval_id ? await getApproval(workItem.approval_id) : null
  if (!approval) {
    const { data, error } = await db()
      .from('agent_approvals')
      .insert({
        run_id: workItem.active_run_id,
        approval_type: VERCEL_RESEARCH_APPROVAL_TYPE,
        status: 'pending',
        requested_by_agent_key: 'integration-captain',
        metadata: {
          work_item_id: workItem.id,
          proposal_id: proposal.id,
          proposal,
          approval_question: proposal.approvalQuestion,
          action_payload: {
            action: 'authorize_vercel_deployment_research',
            approval_type: VERCEL_RESEARCH_APPROVAL_TYPE,
            proposal_id: proposal.id,
            executes_action: false,
          },
        },
      })
      .select('id, run_id, status, requested_at, metadata')
      .single()

    if (error || !data?.id) {
      throw new Error(error?.message ?? 'Failed to create Vercel AutoResearch approval')
    }
    approval = data as ApprovalRow

    await db()
      .from('agent_work_items')
      .update({
        status: 'ready_for_review',
        approval_id: approval.id,
        validation_summary: 'Vercel AutoResearch proposal packet is ready for approval.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', workItem.id)

    await db()
      .from('agent_runs')
      .update({
        status: 'waiting_for_approval',
        current_step: `Approval required: ${VERCEL_RESEARCH_APPROVAL_TYPE}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workItem.active_run_id)
      .in('status', ['queued', 'running'])

    await recordAgentEvent({
      runId: workItem.active_run_id,
      eventType: 'vercel_autoresearch_approval_created',
      severity: 'info',
      message: proposal.approvalQuestion,
      metadata: {
        approval_id: approval.id,
        work_item_id: workItem.id,
        proposal_id: proposal.id,
      },
      idempotencyKey: `${workItem.id}:vercel-autoresearch-approval-created`,
    }).catch(() => {})

    await recordVercelResearchOpenBrainTrace({
      proposal,
      approvalId: approval.id,
      runId: workItem.active_run_id,
      workItemId: workItem.id,
    }).catch((error) => {
      console.warn('[vercel-autoresearch] Open Brain trace skipped:', error instanceof Error ? error.message : error)
    })
  }

  const notification = await notifyApprovalOnce(approval, workItem.id, proposal)

  return {
    workItem,
    approvalId: approval.id,
    runId: approval.run_id,
    notification,
  }
}

async function recordVercelResearchOpenBrainTrace(input: {
  proposal: VercelResearchProposal
  approvalId: string
  runId: string
  workItemId: string
}) {
  const sourceId = `autoresearch:proposal:${input.proposal.id}`
  const source = await recordOpenBrainSource({
    id: sourceId,
    kind: 'autoresearch_proposal',
    title: input.proposal.title,
    summary: [
      input.proposal.hypothesis,
      `Approval question: ${input.proposal.approvalQuestion}`,
      `Risk level: ${input.proposal.riskLevel}.`,
    ].join(' '),
    path: null,
    privacyTier: 'internal_ops',
    confidence: 0.84,
    fingerprint: fingerprintOpenBrainRecord([
      'autoresearch_proposal',
      input.proposal.id,
      input.proposal.hypothesis,
      input.proposal.approvalQuestion,
    ]),
  })

  await recordOpenBrainEvent({
    id: `event:autoresearch-proposal-created:${input.proposal.id}`,
    kind: 'autoresearch_proposal_created',
    title: `AutoResearch proposal created: ${input.proposal.title}`,
    summary: 'Approval packet created. The proposal does not execute experiments, merge, deploy, mutate production config, or write durable memory directly.',
    privacyTier: 'internal_ops',
    confidence: 0.86,
    sourceIds: [source.id],
    fingerprint: fingerprintOpenBrainRecord([
      'autoresearch_proposal_created',
      input.proposal.id,
      input.approvalId,
      input.runId,
      input.workItemId,
    ]),
    metadata: {
      proposalId: input.proposal.id,
      approvalId: input.approvalId,
      runId: input.runId,
      workItemId: input.workItemId,
      approvalState: input.proposal.approvalState,
      riskLevel: input.proposal.riskLevel,
      executesAction: false,
    },
  })
}

export async function listPendingVercelResearchApprovals(): Promise<VercelResearchApprovalCard[]> {
  const { data, error } = await db()
    .from('agent_approvals')
    .select('id, run_id, status, requested_at, metadata')
    .eq('approval_type', VERCEL_RESEARCH_APPROVAL_TYPE)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(`Failed to list Vercel AutoResearch approvals: ${error.message}`)
  const approvals = (data ?? []) as ApprovalRow[]
  const workItemIds = approvals
    .map((approval) => stringMetadata(approval.metadata, 'work_item_id'))
    .filter((id): id is string => Boolean(id))

  let workItems = new Map<string, AgentWorkItem>()
  if (workItemIds.length > 0) {
    const { data: itemRows, error: itemError } = await db()
      .from('agent_work_items')
      .select('id, title, status, active_run_id, approval_id, updated_at')
      .in('id', workItemIds)

    if (itemError) throw new Error(`Failed to list Vercel AutoResearch work items: ${itemError.message}`)
    workItems = new Map((itemRows ?? []).map((item: unknown) => [(item as AgentWorkItem).id, item as AgentWorkItem]))
  }

  return approvals.flatMap((approval) => {
    const proposal = proposalFromMetadata(approval.metadata)
    const workItemId = stringMetadata(approval.metadata, 'work_item_id')
    if (!proposal || !workItemId) return []
    const notification = notificationMetadata(approval.metadata)
    return [{
      approvalId: approval.id,
      runId: approval.run_id,
      workItemId,
      status: approval.status,
      requestedAt: approval.requested_at,
      proposal,
      notification,
      workItem: workItems.get(workItemId) ?? null,
    }]
  })
}
