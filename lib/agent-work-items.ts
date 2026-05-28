import { getAgentByKey } from '@/lib/agent-organization'
import {
  AGENT_RUNTIMES,
  recordAgentEvent,
  startAgentRun,
  type AgentRuntime,
} from '@/lib/agent-run'
import { supabaseAdmin } from '@/lib/supabase'

export const AGENT_WORK_ITEM_STATUSES = [
  'proposed',
  'queued',
  'assigned',
  'in_progress',
  'blocked',
  'ready_for_review',
  'ready_for_merge',
  'merged',
  'deployed',
  'cancelled',
] as const

export const AGENT_WORK_ITEM_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export type AgentWorkItemStatus = (typeof AGENT_WORK_ITEM_STATUSES)[number]
export type AgentWorkItemPriority = (typeof AGENT_WORK_ITEM_PRIORITIES)[number]

export type AgentWorkItem = {
  id: string
  title: string
  objective: string
  status: AgentWorkItemStatus
  priority: AgentWorkItemPriority
  owner_agent_key: string | null
  owner_runtime: AgentRuntime
  source_type: string | null
  source_id: string | null
  source_label: string | null
  source_run_id: string | null
  active_run_id: string | null
  parent_work_item_id: string | null
  branch_name: string | null
  worktree_path: string | null
  pr_number: number | null
  pr_url: string | null
  expected_files: string[]
  touched_files: string[]
  overlap_group: string | null
  dependency_ids: string[]
  blocker_summary: string | null
  validation_summary: string | null
  approval_id: string | null
  metadata: Record<string, unknown>
  idempotency_key: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type AgentWorkItemHandoff = {
  id: string
  run_id: string | null
  work_item_id: string | null
  from_agent_key: string | null
  to_agent_key: string | null
  handoff_type: string | null
  summary: string | null
  acceptance_criteria: string | null
  status: string
  created_at: string
  accepted_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown> | null
}

export type AgentWorkItemDetail = AgentWorkItem & {
  latest_handoff: AgentWorkItemHandoff | null
}

type WorkItemSource = {
  type?: string | null
  id?: string | number | null
  label?: string | null
}

export type CreateAgentWorkItemInput = {
  title: string
  objective: string
  priority?: AgentWorkItemPriority
  status?: Extract<AgentWorkItemStatus, 'proposed' | 'queued' | 'assigned' | 'in_progress'>
  ownerAgentKey?: string | null
  ownerRuntime?: AgentRuntime
  source?: WorkItemSource
  sourceRunId?: string | null
  parentWorkItemId?: string | null
  branchName?: string | null
  worktreePath?: string | null
  expectedFiles?: string[]
  overlapGroup?: string | null
  dependencyIds?: string[]
  metadata?: Record<string, unknown>
  idempotencyKey?: string | null
}

type WorkItemUpdate = Partial<{
  status: AgentWorkItemStatus
  priority: AgentWorkItemPriority
  owner_agent_key: string | null
  owner_runtime: AgentRuntime
  source_type: string | null
  source_id: string | null
  source_label: string | null
  source_run_id: string | null
  active_run_id: string | null
  parent_work_item_id: string | null
  branch_name: string | null
  worktree_path: string | null
  pr_number: number | null
  pr_url: string | null
  expected_files: string[]
  touched_files: string[]
  overlap_group: string | null
  dependency_ids: string[]
  blocker_summary: string | null
  validation_summary: string | null
  approval_id: string | null
  metadata: Record<string, unknown>
  completed_at: string | null
}>

const APPROVAL_GATED_STATUSES: ReadonlySet<AgentWorkItemStatus> = new Set([
  'ready_for_merge',
  'merged',
  'deployed',
])

export const N8N_WORKFLOW_ACTIVATION_APPROVAL_TYPE = 'n8n_workflow_activation'

function db() {
  if (!supabaseAdmin) throw new Error('Database not available')
  return supabaseAdmin
}

async function notifyImmediatePendingApprovals(input: {
  actorLabel: string
  triggerSource: string
}) {
  try {
    const { runAgentSlackNotificationSweep } = await import('@/lib/agent-slack-notification-sweep')
    await runAgentSlackNotificationSweep({
      mode: 'immediate',
      kinds: ['pending_approvals'],
      actorLabel: input.actorLabel,
      triggerSource: input.triggerSource,
    })
  } catch (error) {
    console.warn(
      '[agent-work-items] immediate Slack approval notification skipped:',
      error instanceof Error ? error.message : error,
    )
  }
}

function assertRuntime(value: string): asserts value is AgentRuntime {
  if (!AGENT_RUNTIMES.includes(value as AgentRuntime)) {
    throw new Error(`Invalid owner_runtime: ${value}`)
  }
}

function assertStatus(value: string): asserts value is AgentWorkItemStatus {
  if (!AGENT_WORK_ITEM_STATUSES.includes(value as AgentWorkItemStatus)) {
    throw new Error(`Invalid work item status: ${value}`)
  }
}

function assertPriority(value: string): asserts value is AgentWorkItemPriority {
  if (!AGENT_WORK_ITEM_PRIORITIES.includes(value as AgentWorkItemPriority)) {
    throw new Error(`Invalid work item priority: ${value}`)
  }
}

function cleanText(value: string, fallback: string) {
  const trimmed = value.trim()
  return trimmed || fallback
}

function normalizeStringArray(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)))
}

function runtimeForAgent(agentKey: string | null | undefined, fallback: AgentRuntime): AgentRuntime {
  const runtime = getAgentByKey(agentKey ?? '')?.primaryRuntime
  if (runtime === 'codex' || runtime === 'n8n' || runtime === 'hermes' || runtime === 'manual') {
    return runtime
  }
  return fallback
}

async function findWorkItemByIdempotencyKey(idempotencyKey?: string | null): Promise<AgentWorkItem | null> {
  if (!idempotencyKey) return null
  const { data, error } = await db()
    .from('agent_work_items')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (error) throw new Error(`Failed to read work item: ${error.message}`)
  return (data as AgentWorkItem | null) ?? null
}

export async function listAgentWorkItems(input: {
  status?: AgentWorkItemStatus | null
  ownerAgentKey?: string | null
  limit?: number
} = {}): Promise<AgentWorkItem[]> {
  let query = db()
    .from('agent_work_items')
    .select('*')

  if (input.status) {
    assertStatus(input.status)
    query = query.eq('status', input.status)
  }
  if (input.ownerAgentKey) {
    query = query.eq('owner_agent_key', input.ownerAgentKey)
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(input.limit ?? 50)
  if (error) throw new Error(`Failed to list work items: ${error.message}`)
  return (data ?? []) as AgentWorkItem[]
}

export async function getAgentWorkItem(id: string): Promise<AgentWorkItemDetail | null> {
  const { data, error } = await db()
    .from('agent_work_items')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to read work item: ${error.message}`)
  if (!data) return null

  const { data: handoffs } = await db()
    .from('agent_handoffs')
    .select('*')
    .eq('work_item_id', id)
    .order('created_at', { ascending: false })
    .limit(1)

  return {
    ...(data as AgentWorkItem),
    latest_handoff: ((handoffs ?? [])[0] as AgentWorkItemHandoff | undefined) ?? null,
  }
}

async function requireAgentWorkItem(id: string) {
  const item = await getAgentWorkItem(id)
  if (!item) throw new Error('Agent work item not found')
  return item
}

async function createApprovalCheckpoint(item: AgentWorkItem, status: AgentWorkItemStatus) {
  if (!item.active_run_id) return null
  if (item.approval_id) return item.approval_id

  const { data, error } = await db()
    .from('agent_approvals')
    .insert({
      run_id: item.active_run_id,
      approval_type: 'agent_work_item_merge',
      status: 'pending',
      requested_by_agent_key: item.owner_agent_key ?? null,
      metadata: {
        work_item_id: item.id,
        requested_status: status,
        branch_name: item.branch_name,
        pr_number: item.pr_number,
        pr_url: item.pr_url,
      },
    })
    .select('id')
    .single()

  if (error || !data?.id) throw new Error(error?.message ?? 'Failed to create work item approval')

  await db()
    .from('agent_runs')
    .update({
      status: 'waiting_for_approval',
      current_step: `Approval required: ${status}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.active_run_id)
    .in('status', ['queued', 'running'])

  await notifyImmediatePendingApprovals({
    actorLabel: 'Agent Ops approval checkpoint',
    triggerSource: 'agent_work_item_approval_created',
  })

  return data.id as string
}

async function createN8nActivationApprovalCheckpoint(input: {
  item: AgentWorkItem
  reviewSummary: string
  actorLabel: string
  workflowId: string | null
  inspectionResult: string | null
  buildResult: Record<string, unknown>
  approvalBoundary: string[]
  existingApprovalId?: string | null
}) {
  const existingApprovalId = metadataString(input.existingApprovalId)
  if (existingApprovalId) return existingApprovalId
  if (!input.item.active_run_id) {
    throw new Error('Trace-linked run is required before requesting n8n activation approval')
  }

  const { data, error } = await db()
    .from('agent_approvals')
    .insert({
      run_id: input.item.active_run_id,
      approval_type: N8N_WORKFLOW_ACTIVATION_APPROVAL_TYPE,
      status: 'pending',
      requested_by_agent_key: input.item.owner_agent_key ?? null,
      metadata: {
        work_item_id: input.item.id,
        requested_status: 'n8n_activation_review',
        workflow_id: input.workflowId,
        inspection_result: input.inspectionResult,
        review_summary: input.reviewSummary,
        result_summary: metadataString(input.buildResult.result_summary),
        validation_result: metadataString(input.buildResult.validation_result),
        test_evidence: metadataString(input.buildResult.test_evidence),
        rollback_notes: metadataString(input.buildResult.rollback_notes),
        approval_boundary: input.approvalBoundary,
        requested_by: input.actorLabel,
        action_payload: {
          action: 'review_n8n_workflow_activation',
          workflow_id: input.workflowId,
          work_item_id: input.item.id,
          non_mutating: true,
        },
      },
    })
    .select('id')
    .single()

  if (error || !data?.id) throw new Error(error?.message ?? 'Failed to create n8n activation approval')

  await db()
    .from('agent_runs')
    .update({
      status: 'waiting_for_approval',
      current_step: 'Approval required: n8n workflow activation',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.item.active_run_id)
    .in('status', ['queued', 'running'])

  await notifyImmediatePendingApprovals({
    actorLabel: input.actorLabel,
    triggerSource: 'agent_work_item_n8n_activation_approval_created',
  })

  return data.id as string
}

async function updateWorkItem(
  item: AgentWorkItem,
  patch: WorkItemUpdate,
  event: { type: string; message: string; metadata?: Record<string, unknown> },
) {
  const status = patch.status ?? item.status
  assertStatus(status)

  const approvalId = APPROVAL_GATED_STATUSES.has(status)
    ? await createApprovalCheckpoint(item, status)
    : null

  const nextPatch = {
    ...patch,
    ...(approvalId ? { approval_id: approvalId } : {}),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await db()
    .from('agent_work_items')
    .update(nextPatch)
    .eq('id', item.id)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to update work item')

  const runId = (data as AgentWorkItem).active_run_id ?? item.active_run_id
  if (runId) {
    await recordAgentEvent({
      runId,
      eventType: event.type,
      severity: status === 'blocked' ? 'warning' : 'info',
      message: event.message,
      metadata: {
        work_item_id: item.id,
        status,
        approval_id: approvalId,
        ...(event.metadata ?? {}),
      },
      idempotencyKey: `${item.id}:${event.type}:${Date.now()}`,
    }).catch(() => {})
  }

  return data as AgentWorkItem
}

export async function createAgentWorkItem(input: CreateAgentWorkItemInput): Promise<AgentWorkItem> {
  const existing = await findWorkItemByIdempotencyKey(input.idempotencyKey)
  if (existing) return existing

  const ownerRuntime = input.ownerRuntime ?? runtimeForAgent(input.ownerAgentKey, 'manual')
  assertRuntime(ownerRuntime)
  const priority = input.priority ?? 'medium'
  assertPriority(priority)
  const status = input.status ?? (input.ownerAgentKey ? 'assigned' : 'queued')
  assertStatus(status)

  const title = cleanText(input.title, 'Untitled agent work item').slice(0, 240)
  const objective = cleanText(input.objective, title)
  const sourceId = input.source?.id == null ? null : String(input.source.id)
  const run = await startAgentRun({
    agentKey: input.ownerAgentKey ?? 'manual-admin',
    runtime: ownerRuntime,
    kind: 'agent_work_item',
    title,
    status: 'queued',
    subject: {
      type: input.source?.type ?? 'agent_work_item',
      id: sourceId ?? input.idempotencyKey ?? title,
      label: input.source?.label ?? title,
    },
    triggerSource: 'agent_coordination',
    currentStep: `Work item ${status}`,
    metadata: {
      work_item_status: status,
      owner_agent_key: input.ownerAgentKey ?? null,
      ...(input.metadata ?? {}),
    },
    idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:run` : null,
  })

  const { data, error } = await db()
    .from('agent_work_items')
    .insert({
      title,
      objective,
      status,
      priority,
      owner_agent_key: input.ownerAgentKey ?? null,
      owner_runtime: ownerRuntime,
      source_type: input.source?.type ?? null,
      source_id: sourceId,
      source_label: input.source?.label ?? null,
      source_run_id: input.sourceRunId ?? null,
      active_run_id: run.id,
      parent_work_item_id: input.parentWorkItemId ?? null,
      branch_name: input.branchName ?? null,
      worktree_path: input.worktreePath ?? null,
      expected_files: normalizeStringArray(input.expectedFiles),
      overlap_group: input.overlapGroup ?? null,
      dependency_ids: input.dependencyIds ?? [],
      metadata: input.metadata ?? {},
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      const retry = await findWorkItemByIdempotencyKey(input.idempotencyKey)
      if (retry) return retry
    }
    throw new Error(error?.message ?? 'Failed to create work item')
  }

  await recordAgentEvent({
    runId: run.id,
    eventType: 'agent_work_item_created',
    severity: 'info',
    message: title,
    metadata: { work_item_id: data.id, status },
    idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:created` : null,
  }).catch(() => {})

  return data as AgentWorkItem
}

export async function claimAgentWorkItem(input: {
  id: string
  ownerAgentKey: string
  ownerRuntime?: AgentRuntime
  actorLabel?: string | null
}) {
  const item = await requireAgentWorkItem(input.id)
  const runtime = input.ownerRuntime ?? runtimeForAgent(input.ownerAgentKey, item.owner_runtime)
  assertRuntime(runtime)
  return updateWorkItem(
    item,
    {
      status: 'assigned',
      owner_agent_key: input.ownerAgentKey,
      owner_runtime: runtime,
      blocker_summary: null,
    },
    {
      type: 'agent_work_item_claimed',
      message: `${input.actorLabel ?? input.ownerAgentKey} claimed ${item.title}`,
      metadata: { owner_agent_key: input.ownerAgentKey, owner_runtime: runtime },
    },
  )
}

export async function updateAgentWorkItemStatus(input: {
  id: string
  status: AgentWorkItemStatus
  note?: string | null
}) {
  const item = await requireAgentWorkItem(input.id)
  return updateWorkItem(
    item,
    {
      status: input.status,
      completed_at: ['merged', 'deployed', 'cancelled'].includes(input.status)
        ? new Date().toISOString()
        : null,
    },
    {
      type: 'agent_work_item_status_updated',
      message: input.note ?? `${item.title}: ${input.status}`,
    },
  )
}

export async function prioritizeAgentWorkItem(input: {
  id: string
  priority: AgentWorkItemPriority
  note?: string | null
}) {
  assertPriority(input.priority)
  const item = await requireAgentWorkItem(input.id)
  return updateWorkItem(
    item,
    { priority: input.priority },
    {
      type: 'agent_work_item_prioritized',
      message: input.note ?? `${item.title}: priority set to ${input.priority}`,
      metadata: { priority: input.priority },
    },
  )
}

export async function markAgentWorkItemReadyForKanban(input: {
  id: string
  definitionOfReady: string
  actorLabel?: string | null
}) {
  const definitionOfReady = input.definitionOfReady.trim()
  if (!definitionOfReady) throw new Error('Definition of ready is required')
  const item = await requireAgentWorkItem(input.id)
  const now = new Date().toISOString()
  const metadata = {
    ...(item.metadata ?? {}),
    kanban_readiness: {
      ready: true,
      ready_at: now,
      actor_label: input.actorLabel ?? 'Admin user',
      definition_of_ready: definitionOfReady,
    },
  }
  return updateWorkItem(
    item,
    {
      status: 'queued',
      blocker_summary: null,
      validation_summary: definitionOfReady,
      metadata,
    },
    {
      type: 'agent_work_item_ready_for_kanban',
      message: definitionOfReady,
      metadata: { actor_label: input.actorLabel ?? 'Admin user' },
    },
  )
}

export async function recordAgentWorkItemBlocker(input: { id: string; blockerSummary: string }) {
  const item = await requireAgentWorkItem(input.id)
  return updateWorkItem(
    item,
    { status: 'blocked', blocker_summary: input.blockerSummary },
    {
      type: 'agent_work_item_blocked',
      message: input.blockerSummary,
    },
  )
}

export async function attachAgentWorkItemPr(input: {
  id: string
  prNumber?: number | null
  prUrl?: string | null
  branchName?: string | null
  touchedFiles?: string[]
}) {
  const item = await requireAgentWorkItem(input.id)
  return updateWorkItem(
    item,
    {
      status: 'ready_for_review',
      pr_number: input.prNumber ?? item.pr_number,
      pr_url: input.prUrl ?? item.pr_url,
      branch_name: input.branchName ?? item.branch_name,
      touched_files: normalizeStringArray(input.touchedFiles ?? item.touched_files),
    },
    {
      type: 'agent_work_item_pr_attached',
      message: input.prUrl ?? input.branchName ?? `PR attached to ${item.title}`,
      metadata: { pr_number: input.prNumber ?? item.pr_number, pr_url: input.prUrl ?? item.pr_url },
    },
  )
}

export async function recordAgentWorkItemValidation(input: {
  id: string
  validationSummary: string
  readyForMerge?: boolean
}) {
  const item = await requireAgentWorkItem(input.id)
  return updateWorkItem(
    item,
    {
      status: input.readyForMerge ? 'ready_for_merge' : item.status,
      validation_summary: input.validationSummary,
    },
    {
      type: 'agent_work_item_validation_recorded',
      message: input.validationSummary,
    },
  )
}

export async function handoffAgentWorkItem(input: {
  id: string
  toAgentKey: string
  fromAgentKey?: string | null
  handoffType?: string | null
  summary: string
  acceptanceCriteria?: string | null
  toRuntime?: AgentRuntime
  idempotencyKey?: string | null
}) {
  const item = await requireAgentWorkItem(input.id)
  const runtime = input.toRuntime ?? runtimeForAgent(input.toAgentKey, item.owner_runtime)
  assertRuntime(runtime)

  const { data, error } = await db()
    .from('agent_handoffs')
    .insert({
      run_id: item.active_run_id,
      work_item_id: item.id,
      from_agent_key: input.fromAgentKey ?? item.owner_agent_key,
      to_agent_key: input.toAgentKey,
      handoff_type: input.handoffType ?? 'agent_work_item_handoff',
      summary: input.summary,
      acceptance_criteria: input.acceptanceCriteria ?? null,
      status: 'pending',
      metadata: { owner_runtime: runtime },
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code !== '23505') throw new Error(`Failed to record handoff: ${error.message}`)
  }

  const updated = await updateWorkItem(
    item,
    {
      status: 'assigned',
      owner_agent_key: input.toAgentKey,
      owner_runtime: runtime,
      blocker_summary: null,
    },
    {
      type: 'agent_work_item_handed_off',
      message: input.summary,
      metadata: {
        handoff_id: data?.id ?? null,
        from_agent_key: input.fromAgentKey ?? item.owner_agent_key,
        to_agent_key: input.toAgentKey,
      },
    },
  )

  return {
    workItem: updated,
    handoffId: (data?.id as string | undefined) ?? null,
  }
}

export async function completeAgentWorkItem(input: {
  id: string
  status?: Extract<AgentWorkItemStatus, 'merged' | 'deployed'>
  validationSummary?: string | null
}) {
  const item = await requireAgentWorkItem(input.id)
  return updateWorkItem(
    item,
    {
      status: input.status ?? 'deployed',
      validation_summary: input.validationSummary ?? item.validation_summary,
      completed_at: new Date().toISOString(),
    },
    {
      type: 'agent_work_item_completed',
      message: input.validationSummary ?? `${item.title}: complete`,
    },
  )
}

export async function requestAgentWorkItemMcpBuild(input: {
  id: string
  requestSummary: string
  actorLabel?: string | null
}) {
  const requestSummary = input.requestSummary.trim()
  if (!requestSummary) throw new Error('MCP build request summary is required')
  const item = await requireAgentWorkItem(input.id)
  const now = new Date().toISOString()
  const metadata = {
    ...(item.metadata ?? {}),
    mcp_build_request: {
      requested: true,
      requested_at: now,
      actor_label: input.actorLabel ?? 'Admin user',
      summary: requestSummary,
      packet_version: typeof item.metadata?.mcp_handoff_packet === 'object'
        && item.metadata.mcp_handoff_packet
        && !Array.isArray(item.metadata.mcp_handoff_packet)
        ? String((item.metadata.mcp_handoff_packet as Record<string, unknown>).version ?? 'agent-ops-n8n-mcp-handoff/v1')
        : 'agent-ops-n8n-mcp-handoff/v1',
      expected_return: [
        'n8n workflow id or inspection result',
        'validation result and test evidence',
        'credential/env gaps',
        'rollback notes',
      ],
    },
  }
  return updateWorkItem(
    item,
    {
      status: item.status === 'proposed' ? 'queued' : item.status,
      validation_summary: requestSummary,
      metadata,
    },
    {
      type: 'agent_work_item_mcp_build_requested',
      message: requestSummary,
      metadata: {
        actor_label: input.actorLabel ?? 'Admin user',
        expected_return: metadata.mcp_build_request.expected_return,
      },
    },
  )
}

export async function recordAgentWorkItemMcpBuildResult(input: {
  id: string
  resultSummary: string
  workflowId?: string | null
  inspectionResult?: string | null
  validationResult?: string | null
  testEvidence?: string | null
  credentialGaps?: string[]
  envGaps?: string[]
  rollbackNotes?: string | null
  activationRequested?: boolean
  actorLabel?: string | null
}) {
  const resultSummary = input.resultSummary.trim()
  if (!resultSummary) throw new Error('MCP build result summary is required')

  const item = await requireAgentWorkItem(input.id)
  if (['merged', 'deployed', 'cancelled'].includes(item.status)) {
    throw new Error(`Cannot record MCP build result for ${item.status} work item`)
  }

  const credentialGaps = normalizeStringArray(input.credentialGaps)
  const envGaps = normalizeStringArray(input.envGaps)
  const unresolvedGaps = [...credentialGaps, ...envGaps]
  const now = new Date().toISOString()
  const metadata = {
    ...(item.metadata ?? {}),
    mcp_build_result: {
      recorded: true,
      recorded_at: now,
      actor_label: input.actorLabel ?? 'Admin user',
      result_summary: resultSummary,
      workflow_id: input.workflowId?.trim() || null,
      inspection_result: input.inspectionResult?.trim() || null,
      validation_result: input.validationResult?.trim() || null,
      test_evidence: input.testEvidence?.trim() || null,
      credential_gaps: credentialGaps,
      env_gaps: envGaps,
      rollback_notes: input.rollbackNotes?.trim() || null,
      activation_requested: input.activationRequested === true,
      activation_gate: 'Production activation remains approval-gated and is not performed by this result update.',
    },
  }
  const blockerSummary = unresolvedGaps.length
    ? `MCP build returned unresolved gaps: ${unresolvedGaps.slice(0, 4).join(', ')}`
    : null

  return updateWorkItem(
    item,
    {
      status: unresolvedGaps.length ? 'blocked' : 'ready_for_review',
      blocker_summary: blockerSummary,
      validation_summary: resultSummary,
      metadata,
    },
    {
      type: 'agent_work_item_mcp_build_result_recorded',
      message: resultSummary,
      metadata: {
        actor_label: input.actorLabel ?? 'Admin user',
        workflow_id: metadata.mcp_build_result.workflow_id,
        has_unresolved_gaps: unresolvedGaps.length > 0,
        activation_requested: metadata.mcp_build_result.activation_requested,
      },
    },
  )
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function metadataString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function requestAgentWorkItemN8nActivationReview(input: {
  id: string
  reviewSummary: string
  actorLabel?: string | null
}) {
  const reviewSummary = input.reviewSummary.trim()
  if (!reviewSummary) throw new Error('n8n activation review summary is required')
  const item = await requireAgentWorkItem(input.id)
  if (['merged', 'deployed', 'cancelled'].includes(item.status)) {
    throw new Error(`Cannot request n8n activation review for ${item.status} work item`)
  }

  const buildResult = recordValue(item.metadata?.mcp_build_result)
  if (!buildResult) throw new Error('MCP build result is required before requesting activation review')
  const credentialGaps = normalizeStringArray(Array.isArray(buildResult.credential_gaps) ? buildResult.credential_gaps : [])
  const envGaps = normalizeStringArray(Array.isArray(buildResult.env_gaps) ? buildResult.env_gaps : [])
  const unresolvedGaps = [...credentialGaps, ...envGaps]
  if (unresolvedGaps.length) {
    throw new Error(`Resolve MCP build gaps before requesting activation review: ${unresolvedGaps.join(', ')}`)
  }

  const workflowId = metadataString(buildResult.workflow_id)
  const inspectionResult = metadataString(buildResult.inspection_result)
  if (!workflowId && !inspectionResult) {
    throw new Error('MCP build result must include a workflow id or inspection result before activation review')
  }

  const now = new Date().toISOString()
  const existingActivationRequest = recordValue(item.metadata?.n8n_activation_review_request)
  const approvalBoundary = [
    'No n8n workflow is activated by this request.',
    'Production activation, credentials, outbound sends, public publishing, live schedules, and client-visible mutation remain approval-gated.',
    'Controller must inspect workflow id, validation evidence, rollback notes, and data boundary before any activation action.',
  ]
  const approvalId = await createN8nActivationApprovalCheckpoint({
    item,
    reviewSummary,
    actorLabel: input.actorLabel ?? 'Admin user',
    workflowId,
    inspectionResult,
    buildResult,
    approvalBoundary,
    existingApprovalId: metadataString(existingActivationRequest?.approval_id),
  })
  const metadata = {
    ...(item.metadata ?? {}),
    n8n_activation_review_request: {
      requested: true,
      requested_at: now,
      actor_label: input.actorLabel ?? 'Admin user',
      summary: reviewSummary,
      approval_id: approvalId,
      approval_type: N8N_WORKFLOW_ACTIVATION_APPROVAL_TYPE,
      workflow_id: workflowId,
      inspection_result: inspectionResult,
      result_summary: metadataString(buildResult.result_summary),
      validation_result: metadataString(buildResult.validation_result),
      test_evidence: metadataString(buildResult.test_evidence),
      rollback_notes: metadataString(buildResult.rollback_notes),
      approval_boundary: approvalBoundary,
    },
  }

  return updateWorkItem(
    item,
    {
      status: 'ready_for_review',
      blocker_summary: null,
      validation_summary: reviewSummary,
      approval_id: approvalId,
      metadata,
    },
    {
      type: 'agent_work_item_n8n_activation_review_requested',
      message: reviewSummary,
      metadata: {
        actor_label: input.actorLabel ?? 'Admin user',
        workflow_id: workflowId,
        approval_id: approvalId,
        approval_type: N8N_WORKFLOW_ACTIVATION_APPROVAL_TYPE,
      },
    },
  )
}

export async function cancelAgentWorkItem(input: { id: string; reason?: string | null }) {
  const item = await requireAgentWorkItem(input.id)
  return updateWorkItem(
    item,
    {
      status: 'cancelled',
      blocker_summary: input.reason ?? item.blocker_summary,
      completed_at: new Date().toISOString(),
    },
    {
      type: 'agent_work_item_cancelled',
      message: input.reason ?? `${item.title}: cancelled`,
    },
  )
}
