import { supabaseAdmin } from '@/lib/supabase'

export const AGENT_RUNTIMES = ['codex', 'n8n', 'hermes', 'opencode', 'manual'] as const
export const AGENT_RUN_STATUSES = [
  'queued',
  'running',
  'waiting_for_approval',
  'completed',
  'failed',
  'cancelled',
  'stale',
] as const
export const AGENT_EVENT_SEVERITIES = ['debug', 'info', 'warning', 'error'] as const
export const AGENT_APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const

export type AgentRuntime = (typeof AGENT_RUNTIMES)[number]
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number]
export type AgentEventSeverity = (typeof AGENT_EVENT_SEVERITIES)[number]
export type AgentApprovalStatus = (typeof AGENT_APPROVAL_STATUSES)[number]

export interface AgentSubjectRef {
  type?: string | null
  id?: string | number | null
  label?: string | null
}

export interface StartAgentRunInput {
  agentKey?: string | null
  runtime: AgentRuntime
  kind: string
  title: string
  status?: AgentRunStatus
  subject?: AgentSubjectRef
  triggerSource?: string | null
  triggeredByUserId?: string | null
  staleAfter?: string | null
  currentStep?: string | null
  metadata?: Record<string, unknown>
  idempotencyKey?: string | null
}

export interface RecordAgentStepInput {
  runId: string
  stepKey?: string | null
  name: string
  status?: AgentRunStatus
  startedAt?: string
  completedAt?: string | null
  latencyMs?: number | null
  tokensIn?: number | null
  tokensOut?: number | null
  costUsd?: number | null
  inputSummary?: string | null
  outputSummary?: string | null
  reasoning?: string | null
  metadata?: Record<string, unknown>
  idempotencyKey?: string | null
}

export interface RecordAgentEventInput {
  runId: string
  eventType: string
  severity?: AgentEventSeverity
  message?: string | null
  metadata?: Record<string, unknown>
  occurredAt?: string
  idempotencyKey?: string | null
}

export interface EndAgentRunInput {
  runId: string
  status?: Extract<AgentRunStatus, 'completed' | 'failed' | 'cancelled' | 'stale'>
  outcome?: Record<string, unknown>
  errorMessage?: string | null
  currentStep?: string | null
}

export interface AttachAgentArtifactInput {
  runId: string
  artifactType: string
  title?: string | null
  refType?: string | null
  refId?: string | number | null
  url?: string | null
  metadata?: Record<string, unknown>
  idempotencyKey?: string | null
}

function assertRuntime(runtime: string): asserts runtime is AgentRuntime {
  if (!AGENT_RUNTIMES.includes(runtime as AgentRuntime)) {
    throw new Error(`Invalid agent runtime: ${runtime}`)
  }
}

function assertStatus(status: string): asserts status is AgentRunStatus {
  if (!AGENT_RUN_STATUSES.includes(status as AgentRunStatus)) {
    throw new Error(`Invalid agent run status: ${status}`)
  }
}

function db() {
  if (!supabaseAdmin) {
    throw new Error('Database not available')
  }
  return supabaseAdmin
}

async function findRunByIdempotencyKey(idempotencyKey?: string | null): Promise<{ id: string } | null> {
  if (!idempotencyKey) return null

  const { data, error } = await db()
    .from('agent_runs')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to read agent run: ${error.message}`)
  }
  return data as { id: string } | null
}

export async function startAgentRun(input: StartAgentRunInput): Promise<{ id: string }> {
  assertRuntime(input.runtime)
  const status = input.status ?? 'running'
  assertStatus(status)

  const existing = await findRunByIdempotencyKey(input.idempotencyKey)
  if (existing) return existing

  const { data: registry } = input.agentKey
    ? await db()
        .from('agent_registry')
        .select('id')
        .eq('key', input.agentKey)
        .maybeSingle()
    : { data: null }

  const { data, error } = await db()
    .from('agent_runs')
    .insert({
      agent_registry_id: (registry as { id?: string } | null)?.id ?? null,
      agent_key: input.agentKey ?? null,
      runtime: input.runtime,
      kind: input.kind,
      title: input.title,
      status,
      subject_type: input.subject?.type ?? null,
      subject_id: input.subject?.id == null ? null : String(input.subject.id),
      subject_label: input.subject?.label ?? null,
      trigger_source: input.triggerSource ?? null,
      triggered_by_user_id: input.triggeredByUserId ?? null,
      stale_after: input.staleAfter ?? null,
      current_step: input.currentStep ?? null,
      metadata: input.metadata ?? {},
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    if (error?.code === '23505') {
      const retry = await findRunByIdempotencyKey(input.idempotencyKey)
      if (retry) return retry
    }
    throw new Error(`Failed to start agent run: ${error?.message ?? 'missing id'}`)
  }

  await recordAgentEvent({
    runId: data.id as string,
    eventType: 'run_started',
    severity: 'info',
    message: input.title,
    idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:started` : null,
    metadata: { runtime: input.runtime, kind: input.kind },
  }).catch(() => {})

  return { id: data.id as string }
}

export async function recordAgentStep(input: RecordAgentStepInput): Promise<{ id: string } | null> {
  const status = input.status ?? 'completed'
  assertStatus(status)

  const { data, error } = await db()
    .from('agent_run_steps')
    .insert({
      run_id: input.runId,
      step_key: input.stepKey ?? null,
      name: input.name,
      status,
      started_at: input.startedAt ?? new Date().toISOString(),
      completed_at: input.completedAt ?? (status === 'completed' || status === 'failed' ? new Date().toISOString() : null),
      latency_ms: input.latencyMs ?? null,
      tokens_in: input.tokensIn ?? null,
      tokens_out: input.tokensOut ?? null,
      cost_usd: input.costUsd ?? null,
      input_summary: input.inputSummary ?? null,
      output_summary: input.outputSummary ?? null,
      reasoning: input.reasoning ?? null,
      metadata: input.metadata ?? {},
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return null
    throw new Error(`Failed to record agent step: ${error.message}`)
  }

  const runStatus: AgentRunStatus =
    status === 'failed' || status === 'cancelled' || status === 'stale' || status === 'waiting_for_approval'
      ? status
      : 'running'

  await db()
    .from('agent_runs')
    .update({
      current_step: input.name,
      status: runStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.runId)

  return data?.id ? { id: data.id as string } : null
}

export async function recordAgentEvent(input: RecordAgentEventInput): Promise<{ id: string } | null> {
  const severity = input.severity ?? 'info'
  if (!AGENT_EVENT_SEVERITIES.includes(severity)) {
    throw new Error(`Invalid event severity: ${severity}`)
  }

  const { data, error } = await db()
    .from('agent_run_events')
    .insert({
      run_id: input.runId,
      event_type: input.eventType,
      severity,
      message: input.message ?? null,
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return null
    throw new Error(`Failed to record agent event: ${error.message}`)
  }
  return data?.id ? { id: data.id as string } : null
}

export async function endAgentRun(input: EndAgentRunInput): Promise<void> {
  const status = input.status ?? 'completed'
  assertStatus(status)

  const { error } = await db()
    .from('agent_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
      outcome: input.outcome ?? {},
      error_message: input.errorMessage ?? null,
      current_step: input.currentStep ?? status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.runId)

  if (error) {
    throw new Error(`Failed to end agent run: ${error.message}`)
  }

  await recordAgentEvent({
    runId: input.runId,
    eventType: status === 'completed' ? 'run_completed' : 'run_finished',
    severity: status === 'failed' ? 'error' : 'info',
    message: input.errorMessage ?? status,
    metadata: input.outcome ?? {},
    idempotencyKey: `${input.runId}:${status}`,
  }).catch(() => {})
}

export async function markAgentRunFailed(
  runId: string,
  errorMessage: string,
  outcome?: Record<string, unknown>,
): Promise<void> {
  await endAgentRun({
    runId,
    status: 'failed',
    errorMessage,
    outcome: outcome ?? {},
    currentStep: 'failed',
  })
}

export async function attachAgentArtifact(input: AttachAgentArtifactInput): Promise<{ id: string } | null> {
  const { data, error } = await db()
    .from('agent_run_artifacts')
    .insert({
      run_id: input.runId,
      artifact_type: input.artifactType,
      title: input.title ?? null,
      ref_type: input.refType ?? null,
      ref_id: input.refId == null ? null : String(input.refId),
      url: input.url ?? null,
      metadata: input.metadata ?? {},
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return null
    throw new Error(`Failed to attach agent artifact: ${error.message}`)
  }
  return data?.id ? { id: data.id as string } : null
}
