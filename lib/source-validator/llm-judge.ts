/**
 * VEP Source Validator — LLM Judge (Phase 2a)
 *
 * Structured LLM adjudication for claim-to-excerpt faithfulness. Phase 2a uses
 * this only for `pain_point_evidence`; Phase 2b will wire the same module into
 * `industry_benchmarks` for a "source-value plausibility" check.
 *
 * Design decisions (from CTO Phase 2a review):
 *   - Claude 3.5 Haiku for cost/latency.
 *   - Prompt splits the test into two independent dimensions (supported,
 *     quantified) so sample-audit can diagnose *which* dimension failed.
 *   - Batched: 10-20 rows per call to amortize system prompt tokens.
 *   - Deterministic `dryRun` mode for tests/CI (no network call).
 *   - Retries with exponential backoff, 20s per-call timeout.
 *   - Fails fast if ANTHROPIC_API_KEY is missing (no silent degradation).
 *   - Returns usage + cost so the API route can log it per run.
 */

import { computeAnthropicCost, type Usage } from '@/lib/cost-calculator'

// -----------------------------------------------------------------------------
// Version constants
// -----------------------------------------------------------------------------

/**
 * Bump when the prompt/rubric changes. Stored on each row so we know which rows
 * need re-judging after a prompt tweak.
 */
export const PROMPT_VERSION = 'ppe-faithfulness-v1'

/** Bump when the judge module's output schema or decision logic changes. */
export const JUDGE_VERSION = '2a.0.0'

/** Default model. Override via DI in tests or if CTO picks a cheaper one later. */
export const DEFAULT_JUDGE_MODEL = 'claude-3-5-haiku-20241022'

// -----------------------------------------------------------------------------
// I/O types
// -----------------------------------------------------------------------------

export interface ExcerptFaithfulnessClaim {
  /** Unique row id (passed through unchanged so callers can map back). */
  id: string
  /** Verbatim text from the original source. */
  excerpt: string
  /** Human-readable pain category (e.g. "Payroll inefficiency"). */
  painCategory: string
  /** Dollar value the evidence is alleged to justify (null if not a $ claim). */
  monetaryIndicator: number | null
  /** Optional context around the monetary figure. */
  monetaryContext: string | null
}

export type FaithfulnessVerdict = 'faithful' | 'unfaithful' | 'insufficient'
export type SupportedDim = 'yes' | 'no'
export type QuantifiedDim = 'yes' | 'no' | 'approximate' | 'not_applicable'

export interface ExcerptFaithfulnessResult {
  id: string
  verdict: FaithfulnessVerdict
  supported: SupportedDim
  quantified: QuantifiedDim
  reason: string
  confidence: number
}

export interface JudgeBatchOptions {
  /** Skip network call and return deterministic verdicts. */
  dryRun?: boolean
  /** Override model (default: Haiku). */
  model?: string
  /** Max attempts (default 3). */
  maxAttempts?: number
  /** Hard timeout per HTTP call in ms (default 20_000). */
  timeoutMs?: number
  /** Inject a fetch for tests. */
  fetchImpl?: typeof fetch
}

export interface JudgeBatchResult {
  verdicts: ExcerptFaithfulnessResult[]
  usage: Usage
  cost_usd: number
  model: string
  prompt_version: string
  judge_version: string
  dry_run: boolean
  /** Raw model response — useful for the sample-audit drawer. */
  raw?: string
}

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a strict evidence auditor for a consulting firm. For each numbered item you receive, judge whether the supplied excerpt provides faithful evidence for the claim it was extracted to support.

Preflight rules (apply before the dimensional test):
- If the excerpt is empty, null, or shorter than 20 characters, return verdict="insufficient", supported="no", confidence=0.0, reason="Excerpt too short to evaluate."
- If the excerpt is in a language other than English, return verdict="insufficient", supported="no", reason="Non-English excerpt; judge does not support this locale yet."

For each remaining item, answer TWO independent questions:

(a) supported: Does the excerpt contain language that directly supports the named pain_category? Answer "yes" or "no".

(b) quantified: Does the excerpt contain a number, range, or time-cost figure that plausibly implies the monetary_indicator? Answer:
    - "yes" if the excerpt contains a number matching or directly implying the $ figure;
    - "approximate" if the excerpt mentions cost/time in a way that could reasonably support the $ figure without stating it exactly;
    - "no" if the excerpt contains no such quantitative support;
    - "not_applicable" if no monetary_indicator was supplied.

Derive verdict from (a) and (b):
    - "faithful" iff supported="yes" AND quantified in {"yes","approximate","not_applicable"};
    - "unfaithful" iff supported="no" OR (monetary_indicator supplied AND quantified="no" with the excerpt content actively contradicting the figure);
    - "insufficient" iff the excerpt is too short/generic to decide either dimension.

Respond with a JSON array (no markdown fences, no prose). Each element: {"id": string, "supported": "yes"|"no", "quantified": "yes"|"no"|"approximate"|"not_applicable", "verdict": "faithful"|"unfaithful"|"insufficient", "reason": string (<=25 words), "confidence": number between 0 and 1}

Preserve input order. Keep reasons factual and concise. Never invent numbers.`

function buildUserPrompt(items: ExcerptFaithfulnessClaim[]): string {
  const lines: string[] = []
  lines.push(`Judge ${items.length} evidence ${items.length === 1 ? 'row' : 'rows'}:\n`)
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    lines.push(`### Item ${i + 1}`)
    lines.push(`id: ${it.id}`)
    lines.push(`pain_category: ${it.painCategory}`)
    if (it.monetaryIndicator != null) {
      lines.push(`monetary_indicator: $${it.monetaryIndicator.toLocaleString()}`)
      if (it.monetaryContext) lines.push(`monetary_context: ${it.monetaryContext}`)
    } else {
      lines.push('monetary_indicator: (none supplied — set quantified="not_applicable")')
    }
    lines.push(`excerpt: """${truncate(it.excerpt, 1200)}"""`)
    lines.push('')
  }
  lines.push('Return a single JSON array. Preserve input ids.')
  return lines.join('\n')
}

function truncate(s: string, max: number): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}…[truncated ${s.length - max} chars]` : s
}

// -----------------------------------------------------------------------------
// Deterministic dry-run fixtures
// -----------------------------------------------------------------------------

/**
 * Returns a reproducible verdict based on simple heuristics over the input.
 * Used for tests and for the CI fixture path — NEVER hits the network.
 */
function dryRunVerdict(item: ExcerptFaithfulnessClaim): ExcerptFaithfulnessResult {
  const excerpt = (item.excerpt ?? '').toLowerCase()
  const pain = (item.painCategory ?? '').toLowerCase()
  const shortExcerpt = excerpt.length < 40

  const hasCategoryTerms = pain
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .some((w) => excerpt.includes(w))

  const hasNumber = /\$?\d[\d,.]*/.test(excerpt)

  let supported: SupportedDim = hasCategoryTerms ? 'yes' : 'no'
  let quantified: QuantifiedDim
  if (item.monetaryIndicator == null) quantified = 'not_applicable'
  else if (hasNumber) quantified = 'yes'
  else if (excerpt.includes('hour') || excerpt.includes('week') || excerpt.includes('month')) quantified = 'approximate'
  else quantified = 'no'

  let verdict: FaithfulnessVerdict
  if (shortExcerpt) verdict = 'insufficient'
  else if (supported === 'yes' && (quantified === 'yes' || quantified === 'approximate' || quantified === 'not_applicable'))
    verdict = 'faithful'
  else verdict = 'unfaithful'

  return {
    id: item.id,
    verdict,
    supported,
    quantified,
    reason: shortExcerpt
      ? 'Excerpt too short to decide (dryRun).'
      : verdict === 'faithful'
        ? 'Excerpt mentions category terms and a quantitative anchor (dryRun).'
        : 'Excerpt lacks category or quantitative support (dryRun).',
    confidence: shortExcerpt ? 0.4 : verdict === 'faithful' ? 0.85 : 0.65,
  }
}

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------

function parseBatchResponse(raw: string, items: ExcerptFaithfulnessClaim[]): ExcerptFaithfulnessResult[] {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract the first JSON array embedded in text.
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) throw new Error(`Judge returned non-JSON output: ${cleaned.slice(0, 200)}`)
    parsed = JSON.parse(match[0])
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Judge output was not a JSON array.')
  }

  const byId = new Map<string, ExcerptFaithfulnessResult>()
  for (const raw of parsed) {
    const row = raw as Partial<ExcerptFaithfulnessResult>
    if (!row || typeof row.id !== 'string') continue
    const supported: SupportedDim = row.supported === 'yes' ? 'yes' : 'no'
    const quantified: QuantifiedDim =
      row.quantified === 'yes' || row.quantified === 'no' || row.quantified === 'approximate' || row.quantified === 'not_applicable'
        ? row.quantified
        : 'no'
    const verdict: FaithfulnessVerdict =
      row.verdict === 'faithful' || row.verdict === 'unfaithful' || row.verdict === 'insufficient' ? row.verdict : 'insufficient'
    const reason = typeof row.reason === 'string' ? row.reason.slice(0, 200) : ''
    const confRaw = typeof row.confidence === 'number' ? row.confidence : 0.5
    const confidence = Math.max(0, Math.min(1, confRaw))
    byId.set(row.id, { id: row.id, verdict, supported, quantified, reason, confidence })
  }

  // Fill missing ids with an "insufficient / judge did not return" placeholder.
  const ordered: ExcerptFaithfulnessResult[] = []
  for (const item of items) {
    const got = byId.get(item.id)
    if (got) ordered.push(got)
    else
      ordered.push({
        id: item.id,
        verdict: 'insufficient',
        supported: 'no',
        quantified: item.monetaryIndicator == null ? 'not_applicable' : 'no',
        reason: 'Judge omitted this item from its response.',
        confidence: 0.0,
      })
  }
  return ordered
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Judge a batch of up to 20 claim/excerpt pairs. Returns one verdict per input
 * item in the same order. Throws on auth or transport failure after retries.
 */
export async function judgeBatch(
  items: ExcerptFaithfulnessClaim[],
  options: JudgeBatchOptions = {}
): Promise<JudgeBatchResult> {
  const model = options.model ?? DEFAULT_JUDGE_MODEL
  const dryRun = options.dryRun === true
  const timeoutMs = options.timeoutMs ?? 20_000
  const maxAttempts = options.maxAttempts ?? 3

  if (items.length === 0) {
    return {
      verdicts: [],
      usage: { input_tokens: 0, output_tokens: 0 },
      cost_usd: 0,
      model,
      prompt_version: PROMPT_VERSION,
      judge_version: JUDGE_VERSION,
      dry_run: dryRun,
    }
  }
  if (items.length > 20) {
    throw new Error(`judgeBatch received ${items.length} items; max batch size is 20.`)
  }

  if (dryRun) {
    const verdicts = items.map(dryRunVerdict)
    return {
      verdicts,
      usage: { input_tokens: 0, output_tokens: 0 },
      cost_usd: 0,
      model,
      prompt_version: PROMPT_VERSION,
      judge_version: JUDGE_VERSION,
      dry_run: true,
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — source-validator llm-judge cannot run (pass dryRun:true for tests/CI).')
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const userPrompt = buildUserPrompt(items)

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
          temperature: 0.0,
        }),
        signal: controller.signal,
      })
      clearTimeout(t)

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Anthropic API ${response.status}: ${body.slice(0, 200)}`)
      }
      const data = (await response.json()) as {
        content?: Array<{ text?: string }>
        usage?: Usage
      }
      const raw = data.content?.[0]?.text ?? ''
      const verdicts = parseBatchResponse(raw, items)
      const usage: Usage = data.usage ?? { input_tokens: 0, output_tokens: 0 }
      const cost_usd = computeAnthropicCost(usage, model)

      return {
        verdicts,
        usage,
        cost_usd,
        model,
        prompt_version: PROMPT_VERSION,
        judge_version: JUDGE_VERSION,
        dry_run: false,
        raw,
      }
    } catch (e) {
      clearTimeout(t)
      lastError = e as Error
      if (attempt < maxAttempts) {
        const backoffMs = 500 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250)
        await new Promise((res) => setTimeout(res, backoffMs))
        continue
      }
    }
  }

  throw new Error(
    `Judge failed after ${maxAttempts} attempts: ${lastError?.message ?? 'unknown error'}`
  )
}

// Exports for tests
export const __internal = {
  buildUserPrompt,
  parseBatchResponse,
  dryRunVerdict,
  SYSTEM_PROMPT,
}
