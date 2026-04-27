/**
 * Curated LLM model whitelist used by the outreach generator and the System
 * Prompts admin page. Keep this in lockstep with:
 *  - the model `<select>` in `app/admin/prompts/[key]/page.tsx`
 *  - the dispatcher in `lib/llm-dispatch.ts`
 *  - the cost rates in `lib/cost-calculator.ts`
 *
 * Adding a new model here is the single source of truth — admins can pick it
 * from the dropdown, the dispatcher routes it to the right provider, and the
 * PUT validation accepts it.
 */

export type LlmProvider = 'openai' | 'anthropic'

export interface SupportedModel {
  id: string
  label: string
  provider: LlmProvider
  /** Helps the dropdown order; smaller comes first. */
  order: number
}

export const SUPPORTED_OUTREACH_MODELS: readonly SupportedModel[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', order: 10 },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', order: 20 },
  {
    id: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    order: 30,
  },
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    provider: 'anthropic',
    order: 40,
  },
] as const

const SUPPORTED_OUTREACH_MODEL_IDS = new Set<string>(
  SUPPORTED_OUTREACH_MODELS.map((m) => m.id),
)

export function isSupportedOutreachModel(id: string): boolean {
  return SUPPORTED_OUTREACH_MODEL_IDS.has(id)
}

export function getModelProvider(id: string): LlmProvider | null {
  const m = SUPPORTED_OUTREACH_MODELS.find((row) => row.id === id)
  return m?.provider ?? null
}

/**
 * Heuristic provider lookup that also tolerates ids outside the curated
 * whitelist (useful as a final defensive fallback in the dispatcher when an
 * older config row carries a model id we haven't formally listed).
 */
export function inferProvider(modelId: string): LlmProvider {
  const explicit = getModelProvider(modelId)
  if (explicit) return explicit
  if (modelId.startsWith('claude')) return 'anthropic'
  return 'openai'
}

/** Default model used when a prompt has no explicit `config.model`. */
export const DEFAULT_OUTREACH_MODEL = 'gpt-4o-mini'
