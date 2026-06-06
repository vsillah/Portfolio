/**
 * Cost calculator for LLM usage and other cost sources.
 * Used to compute and record cost events for portfolio P&L tracking.
 *
 * Pricing (per 1M tokens, USD) — update periodically from provider docs:
 * - OpenAI: https://openai.com/api/pricing/
 * - Anthropic: https://www.anthropic.com/pricing
 */

// supabaseAdmin is lazy-imported inside recordCostEvent so this module can be
// loaded in tests that only need the pure `compute*Cost` helpers without
// tripping lib/supabase's env-var assertion.

// OpenAI pricing (input, output) per 1M tokens — as of 2024
const OPENAI_RATES: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
}

// Anthropic pricing (input, output) per 1M tokens — as of 2024
const ANTHROPIC_RATES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
}

const DEFAULT_OPENAI = { input: 2.5, output: 10 }
const DEFAULT_ANTHROPIC = { input: 3, output: 15 }

export interface Usage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  input_tokens?: number
  output_tokens?: number
}

export interface CostEventInput {
  occurred_at: string
  source: string
  amount: number
  currency?: string
  reference_type?: string
  reference_id?: string
  agent_run_id?: string
  metadata?: Record<string, unknown>
}

function usageMetadata(usage: Usage): Record<string, number> {
  return {
    prompt_tokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
    completion_tokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
    input_tokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
    output_tokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
    total_tokens:
      usage.total_tokens ??
      (usage.prompt_tokens ?? usage.input_tokens ?? 0) +
        (usage.completion_tokens ?? usage.output_tokens ?? 0),
  }
}

/**
 * Compute OpenAI cost from token usage.
 */
export function computeOpenAICost(
  usage: Usage,
  model: string
): number {
  const prompt = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const completion = usage.completion_tokens ?? usage.output_tokens ?? 0
  if (prompt + completion === 0 && usage.total_tokens) {
    // Fallback: assume 50/50 split if only total_tokens
    const half = Math.floor(usage.total_tokens / 2)
    return computeOpenAICost(
      { prompt_tokens: half, completion_tokens: usage.total_tokens - half },
      model
    )
  }
  const rates = OPENAI_RATES[model] ?? DEFAULT_OPENAI
  const inputCost = (prompt / 1_000_000) * rates.input
  const outputCost = (completion / 1_000_000) * rates.output
  return inputCost + outputCost
}

/**
 * Compute Anthropic cost from token usage.
 */
export function computeAnthropicCost(
  usage: Usage,
  model: string
): number {
  const input = usage.input_tokens ?? usage.prompt_tokens ?? 0
  const output = usage.output_tokens ?? usage.completion_tokens ?? 0
  if (input + output === 0 && usage.total_tokens) {
    const half = Math.floor(usage.total_tokens / 2)
    return computeAnthropicCost(
      { input_tokens: half, output_tokens: usage.total_tokens - half },
      model
    )
  }
  const rates = ANTHROPIC_RATES[model] ?? DEFAULT_ANTHROPIC
  const inputCost = (input / 1_000_000) * rates.input
  const outputCost = (output / 1_000_000) * rates.output
  return inputCost + outputCost
}

/**
 * Record a cost event to the database.
 * Uses supabaseAdmin; call from server-side only.
 */
export async function recordCostEvent(event: CostEventInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (!supabaseAdmin) {
      return { ok: false, error: 'supabaseAdmin unavailable (client-side or missing env)' }
    }
    const { error } = await supabaseAdmin.from('cost_events').insert({
      occurred_at: event.occurred_at,
      source: event.source,
      amount: Math.round(event.amount * 10000) / 10000,
      currency: event.currency || 'usd',
      reference_type: event.reference_type ?? null,
      reference_id: event.reference_id ?? null,
      agent_run_id: event.agent_run_id ?? null,
      metadata: event.metadata ?? {},
    })
    if (error) {
      if (error.code === '23505') {
        return { ok: true } // idempotent duplicate, treat as success
      }
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

async function recordModelUsageLedgerEvent(input: {
  usage: Usage
  model: string
  provider: 'openai' | 'anthropic'
  amount: number
  reference?: { type: string; id: string }
  metadata?: Record<string, unknown>
  agentRunId?: string
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (!supabaseAdmin) return
    const usage = usageMetadata(input.usage)
    const metadata = input.metadata ?? {}
    const taskCategory = typeof metadata.task_category === 'string' ? metadata.task_category : 'other'
    const runtime = typeof metadata.runtime === 'string' ? metadata.runtime : 'api'
    const clientProjectId = typeof metadata.client_project_id === 'string' ? metadata.client_project_id : null
    const agentKey = typeof metadata.agent_key === 'string' ? metadata.agent_key : null
    const actionLabel = typeof metadata.operation === 'string'
      ? metadata.operation.replace(/_/g, ' ')
      : input.reference?.type?.replace(/_/g, ' ') ?? 'Model usage transaction'

    await supabaseAdmin.from('model_usage_events').insert({
      occurred_at: new Date().toISOString(),
      provider: input.provider,
      runtime,
      model: input.model,
      task_category: taskCategory,
      agent_key: agentKey,
      client_project_id: clientProjectId,
      client_label: typeof metadata.client_label === 'string' ? metadata.client_label : 'Portfolio',
      action_label: actionLabel,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cached_tokens: typeof metadata.cached_tokens === 'number' ? metadata.cached_tokens : 0,
      reasoning_tokens: typeof metadata.reasoning_tokens === 'number' ? metadata.reasoning_tokens : 0,
      total_tokens: usage.total_tokens,
      accepted_output_count: typeof metadata.accepted_output_count === 'number' ? metadata.accepted_output_count : 1,
      resolved_work_item_count: typeof metadata.resolved_work_item_count === 'number' ? metadata.resolved_work_item_count : 0,
      retry_count: typeof metadata.retry_count === 'number' ? metadata.retry_count : 0,
      cost_usd: Math.round(input.amount * 10000) / 10000,
      cost_basis: 'metered',
      confidence: 'high',
      source_type: input.reference?.type ?? 'llm_call',
      source_id: input.reference?.id ?? input.agentRunId ?? null,
      source_href: input.agentRunId ? `/admin/agents/runs/${input.agentRunId}` : null,
      pricing_snapshot: { provider: input.provider, model: input.model, cost_event_source: `llm_${input.provider}` },
      raw_metadata: metadata,
      scrubbed: false,
    })
  } catch {
    // Ledger writes are best-effort so older environments without the migration
    // do not block the existing P&L cost event path.
  }
}

/**
 * Record LLM cost after an OpenAI call.
 */
export async function recordOpenAICost(
  usage: Usage,
  model: string,
  reference?: { type: string; id: string },
  metadata?: Record<string, unknown>,
  agentRunId?: string,
): Promise<void> {
  const amount = computeOpenAICost(usage, model)
  if (amount <= 0) return
  const usageFields = usageMetadata(usage)
  await recordCostEvent({
    occurred_at: new Date().toISOString(),
    source: 'llm_openai',
    amount,
    reference_type: reference?.type,
    reference_id: reference?.id,
    agent_run_id: agentRunId,
    metadata: { model, ...usageFields, ...metadata },
  })
  await recordModelUsageLedgerEvent({ usage, model, provider: 'openai', amount, reference, metadata, agentRunId })
}

/**
 * Record LLM cost after an Anthropic call.
 */
export async function recordAnthropicCost(
  usage: Usage,
  model: string,
  reference?: { type: string; id: string },
  metadata?: Record<string, unknown>,
  agentRunId?: string,
): Promise<void> {
  const amount = computeAnthropicCost(usage, model)
  if (amount <= 0) return
  const usageFields = usageMetadata(usage)
  await recordCostEvent({
    occurred_at: new Date().toISOString(),
    source: 'llm_anthropic',
    amount,
    reference_type: reference?.type,
    reference_id: reference?.id,
    agent_run_id: agentRunId,
    metadata: { model, ...usageFields, ...metadata },
  })
  await recordModelUsageLedgerEvent({ usage, model, provider: 'anthropic', amount, reference, metadata, agentRunId })
}
