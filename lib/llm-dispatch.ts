/**
 * Provider-aware LLM dispatcher used by the outreach generator (and any other
 * caller that needs to honor `system_prompts.config.model`).
 *
 * The model id determines the provider:
 *  - `gpt-*` / `o*`  → OpenAI Chat Completions (JSON mode supported)
 *  - `claude-*`      → Anthropic Messages API (asks for JSON in the system message)
 *
 * Cost is recorded automatically via `recordOpenAICost` / `recordAnthropicCost`
 * when a `costContext` is supplied.
 */

import {
  inferProvider,
  type LlmProvider,
} from '@/lib/constants/llm-models'
import {
  recordAnthropicCost,
  recordOpenAICost,
  type Usage,
} from '@/lib/cost-calculator'

export interface LlmCostContext {
  reference?: { type: string; id: string }
  metadata?: Record<string, unknown>
}

export interface LlmJsonRequest {
  model: string
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  /** When provided, the dispatcher will fire-and-forget a `cost_events` row. */
  costContext?: LlmCostContext
}

export interface LlmJsonResponse {
  content: string
  provider: LlmProvider
  model: string
  usage?: Usage
}

const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 800

/**
 * Call the provider implied by `model` and return the raw JSON-string response.
 * Throws on API errors or empty content; the caller is responsible for parsing.
 */
export async function generateJsonCompletion(
  req: LlmJsonRequest,
): Promise<LlmJsonResponse> {
  const provider = inferProvider(req.model)
  if (provider === 'anthropic') {
    return callAnthropic(req)
  }
  return callOpenAI(req)
}

async function callOpenAI(req: LlmJsonRequest): Promise<LlmJsonResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const body = {
    model: req.model,
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ],
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    response_format: { type: 'json_object' as const },
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    console.error('[llm-dispatch] OpenAI error:', response.status, errText.slice(0, 400))
    throw new Error(`OpenAI request failed: ${response.status}`)
  }

  const result = await response.json()
  const content = result.choices?.[0]?.message?.content as string | undefined
  if (!content) {
    throw new Error('OpenAI returned empty response')
  }

  const usage = result.usage as Usage | undefined
  if (usage && req.costContext) {
    recordOpenAICost(
      usage,
      req.model,
      req.costContext.reference,
      req.costContext.metadata,
    ).catch(() => {})
  }

  return { content, provider: 'openai', model: req.model, usage }
}

async function callAnthropic(req: LlmJsonRequest): Promise<LlmJsonResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const body = {
    model: req.model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: req.temperature ?? DEFAULT_TEMPERATURE,
    system: req.systemPrompt,
    messages: [
      {
        role: 'user' as const,
        content:
          req.userPrompt +
          '\n\nRespond with JSON only — no prose, no code fences.',
      },
    ],
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    console.error(
      '[llm-dispatch] Anthropic error:',
      response.status,
      errText.slice(0, 400),
    )
    throw new Error(`Anthropic request failed: ${response.status}`)
  }

  const result = await response.json()
  const rawContent = result.content?.[0]?.text as string | undefined
  if (!rawContent) {
    throw new Error('Anthropic returned empty response')
  }

  const content = stripJsonFences(rawContent)
  const usage = result.usage as Usage | undefined

  if (usage && req.costContext) {
    recordAnthropicCost(
      usage,
      req.model,
      req.costContext.reference,
      req.costContext.metadata,
    ).catch(() => {})
  }

  return { content, provider: 'anthropic', model: req.model, usage }
}

/**
 * Anthropic occasionally wraps JSON in ```json fences despite the instruction.
 * Strip them so callers can `JSON.parse` directly.
 */
function stripJsonFences(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
  }
  return trimmed
}
