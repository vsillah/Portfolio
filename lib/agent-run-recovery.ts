import {
  attachAgentArtifact,
  endAgentRun,
  recordAgentEvent,
  startAgentRun,
} from '@/lib/agent-run'
import { getAgentByKey } from '@/lib/agent-organization'

export type RecoverableAgentRunStatus = 'failed' | 'stale' | 'cancelled'

export type AgentRunRecoverySource = {
  id: string
  agent_key: string | null
  runtime: string
  kind: string
  title: string
  status: string
  subject_type: string | null
  subject_id: string | null
  subject_label: string | null
  current_step: string | null
  error_message: string | null
  metadata: Record<string, unknown> | null
}

export type AgentRunRecoveryPlan = {
  source_run_id: string
  source_status: RecoverableAgentRunStatus
  target_agent_key: string
  target_agent_name: string
  retry_attempt: number
  backoff_minutes: number
  earliest_retry_at: string
  execution_mode: 'read_only_recovery_request'
  next_action: string
  summary_markdown: string
}

export type AgentRunRecoveryBackoffCandidate = {
  id: string
  status?: string | null
  metadata: Record<string, unknown> | null
}

export type ActiveAgentRunRecoveryBackoff = {
  recovery_run_id: string
  retry_attempt: number | null
  earliest_retry_at: string
}

export type CreateAgentRunRecoveryRequestInput = {
  sourceRun: AgentRunRecoverySource
  previousRecoveryCount?: number
  actor: {
    userId?: string | null
    subjectType: string
    subjectId: string
    subjectLabel: string
  }
  note?: string | null
  now?: Date
}

export function isRecoverableAgentRunStatus(status: string): status is RecoverableAgentRunStatus {
  return status === 'failed' || status === 'stale' || status === 'cancelled'
}

function boundedRetryAttempt(previousRecoveryCount: number) {
  const normalized = Number.isFinite(previousRecoveryCount) ? Math.max(0, Math.floor(previousRecoveryCount)) : 0
  return normalized + 1
}

function backoffMinutesForAttempt(attempt: number) {
  if (attempt <= 1) return 5
  if (attempt === 2) return 15
  if (attempt === 3) return 60
  return 240
}

function requestedAgentKey(sourceRun: AgentRunRecoverySource) {
  const requested = sourceRun.metadata?.requested_agent
  if (typeof requested === 'string' && requested.trim()) return requested.trim()
  return sourceRun.agent_key || 'chief-of-staff'
}

function readRecoveryRetryAttempt(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.retry_attempt
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readRecoveryEarliestRetryAt(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.earliest_retry_at
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function findActiveAgentRunRecoveryBackoff(
  recoveries: AgentRunRecoveryBackoffCandidate[],
  now = new Date(),
): ActiveAgentRunRecoveryBackoff | null {
  const nowMs = now.getTime()
  const active = recoveries
    .filter((recovery) => recovery.status !== 'failed' && recovery.status !== 'cancelled' && recovery.status !== 'stale')
    .map((recovery) => {
      const earliestRetryAt = readRecoveryEarliestRetryAt(recovery.metadata)
      const retryAtMs = earliestRetryAt ? new Date(earliestRetryAt).getTime() : Number.NaN
      return {
        recovery,
        earliestRetryAt,
        retryAtMs,
      }
    })
    .filter((item) => item.earliestRetryAt && Number.isFinite(item.retryAtMs) && item.retryAtMs > nowMs)
    .sort((a, b) => a.retryAtMs - b.retryAtMs)

  const next = active[0]
  if (!next?.earliestRetryAt) return null

  return {
    recovery_run_id: next.recovery.id,
    retry_attempt: readRecoveryRetryAttempt(next.recovery.metadata),
    earliest_retry_at: next.earliestRetryAt,
  }
}

export function buildAgentRunRecoveryPlan(input: {
  sourceRun: AgentRunRecoverySource
  previousRecoveryCount?: number
  note?: string | null
  now?: Date
}): AgentRunRecoveryPlan {
  const { sourceRun } = input
  if (!isRecoverableAgentRunStatus(sourceRun.status)) {
    throw new Error('Only failed, stale, or cancelled runs can be queued for recovery')
  }

  const agentKey = requestedAgentKey(sourceRun)
  const agent = getAgentByKey(agentKey) ?? getAgentByKey('chief-of-staff')
  const attempt = boundedRetryAttempt(input.previousRecoveryCount ?? 0)
  const backoffMinutes = backoffMinutesForAttempt(attempt)
  const now = input.now ?? new Date()
  const earliestRetryAt = new Date(now.getTime() + backoffMinutes * 60 * 1000).toISOString()
  const reason = sourceRun.error_message ?? sourceRun.current_step ?? `${sourceRun.runtime} run is ${sourceRun.status}.`
  const note = input.note?.trim()
  const nextAction =
    sourceRun.status === 'stale'
      ? 'Inspect the stale trace, confirm whether the original runtime is still active, then retry through the safest existing workflow path.'
      : 'Inspect the failure trace, confirm inputs and approval boundary, then retry through the safest existing workflow path.'

  const summaryMarkdown = [
    `## Recovery Request for ${sourceRun.title}`,
    '',
    `**Source run:** ${sourceRun.id}`,
    `**Source status:** ${sourceRun.status}`,
    `**Runtime:** ${sourceRun.runtime}`,
    `**Kind:** ${sourceRun.kind}`,
    `**Target agent:** ${agent?.name ?? 'Chief of Staff Agent'}`,
    `**Retry attempt:** ${attempt}`,
    `**Backoff:** ${backoffMinutes} minute(s)`,
    `**Earliest retry:** ${earliestRetryAt}`,
    '',
    '### Reason',
    reason,
    '',
    '### Next action',
    nextAction,
    '',
    '### Safety boundary',
    'This request does not re-run production automation. It creates a traced recovery packet for review and keeps execution behind the existing workflow and approval gates.',
    note ? ['', '### Operator note', note].join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    source_run_id: sourceRun.id,
    source_status: sourceRun.status,
    target_agent_key: agent?.key ?? 'chief-of-staff',
    target_agent_name: agent?.name ?? 'Chief of Staff Agent',
    retry_attempt: attempt,
    backoff_minutes: backoffMinutes,
    earliest_retry_at: earliestRetryAt,
    execution_mode: 'read_only_recovery_request',
    next_action: nextAction,
    summary_markdown: summaryMarkdown,
  }
}

export async function createAgentRunRecoveryRequest(input: CreateAgentRunRecoveryRequestInput) {
  const note = input.note?.trim().slice(0, 500) || null
  const plan = buildAgentRunRecoveryPlan({
    sourceRun: input.sourceRun,
    previousRecoveryCount: input.previousRecoveryCount,
    note,
    now: input.now,
  })

  const run = await startAgentRun({
    agentKey: plan.target_agent_key,
    runtime: 'manual',
    kind: 'agent_recovery_request',
    title: `Recovery request: ${input.sourceRun.title}`,
    status: 'queued',
    subject: {
      type: input.actor.subjectType,
      id: input.actor.subjectId,
      label: input.actor.subjectLabel,
    },
    triggerSource: 'admin_agent_run_recovery',
    triggeredByUserId: input.actor.userId ?? null,
    currentStep: 'Recovery request prepared',
    metadata: {
      route_action: 'agent_recovery_retry',
      requested_agent: plan.target_agent_key,
      requested_agent_name: plan.target_agent_name,
      source_run_id: input.sourceRun.id,
      source_status: input.sourceRun.status,
      source_runtime: input.sourceRun.runtime,
      source_kind: input.sourceRun.kind,
      retry_attempt: plan.retry_attempt,
      backoff_minutes: plan.backoff_minutes,
      earliest_retry_at: plan.earliest_retry_at,
      note,
      executes_action: false,
    },
    idempotencyKey: `agent-recovery:${input.sourceRun.id}:${plan.retry_attempt}`,
  })

  await recordAgentEvent({
    runId: run.id,
    eventType: 'agent_recovery_requested',
    severity: 'warning',
    message: `Recovery requested for ${input.sourceRun.title}`,
    metadata: {
      source_run_id: input.sourceRun.id,
      retry_attempt: plan.retry_attempt,
      earliest_retry_at: plan.earliest_retry_at,
      note,
    },
    idempotencyKey: `${run.id}:agent-recovery-requested`,
  }).catch(() => {})

  await recordAgentEvent({
    runId: input.sourceRun.id,
    eventType: 'agent_recovery_linked',
    severity: 'warning',
    message: `Recovery request created: ${run.id}`,
    metadata: {
      recovery_run_id: run.id,
      retry_attempt: plan.retry_attempt,
      earliest_retry_at: plan.earliest_retry_at,
      target_agent_key: plan.target_agent_key,
    },
    idempotencyKey: `${input.sourceRun.id}:agent-recovery:${run.id}`,
  }).catch(() => {})

  const artifact = await attachAgentArtifact({
    runId: run.id,
    artifactType: 'agent_recovery_packet',
    title: `${input.sourceRun.title} recovery packet`,
    refType: 'agent_run',
    refId: input.sourceRun.id,
    metadata: {
      ...plan,
      note,
      executes_action: false,
    },
    idempotencyKey: `${run.id}:agent-recovery-packet`,
  })

  await endAgentRun({
    runId: run.id,
    status: 'completed',
    currentStep: 'Recovery request ready',
    outcome: {
      ...plan,
      recovery_packet_attached: Boolean(artifact),
      executes_action: false,
    },
  })

  return {
    runId: run.id,
    plan,
    recoveryPacketAttached: Boolean(artifact),
  }
}
