/**
 * Cost calculator for LLM usage and other cost sources.
 * Used to compute and record cost events for portfolio P&L tracking.
 *
 * Pricing (per 1M tokens, USD) — update periodically from provider docs:
 * - OpenAI: https://openai.com/api/pricing/
 * - Anthropic: https://www.anthropic.com/pricing
 */

import { supabaseAdmin } from '@/lib/supabase'

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
  metadata?: Record<string, unknown>
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
    const { error } = await supabaseAdmin.from('cost_events').insert({
      occurred_at: event.occurred_at,
      source: event.source,
      amount: Math.round(event.amount * 10000) / 10000,
      currency: event.currency || 'usd',
      reference_type: event.reference_type ?? null,
      reference_id: event.reference_id ?? null,
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

/**
 * Record LLM cost after an OpenAI call.
 */
export async function recordOpenAICost(
  usage: Usage,
  model: string,
  reference?: { type: string; id: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  const amount = computeOpenAICost(usage, model)
  if (amount <= 0) return
  await recordCostEvent({
    occurred_at: new Date().toISOString(),
    source: 'llm_openai',
    amount,
    reference_type: reference?.type,
    reference_id: reference?.id,
    metadata: { model, ...metadata },
  })
}

/**
 * Record LLM cost after an Anthropic call.
 */
export async function recordAnthropicCost(
  usage: Usage,
  model: string,
  reference?: { type: string; id: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  const amount = computeAnthropicCost(usage, model)
  if (amount <= 0) return
  await recordCostEvent({
    occurred_at: new Date().toISOString(),
    source: 'llm_anthropic',
    amount,
    reference_type: reference?.type,
    reference_id: reference?.id,
    metadata: { model, ...metadata },
  })
}
