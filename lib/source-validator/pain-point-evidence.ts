/**
 * VEP Source Validator — pain_point_evidence (Phase 2a)
 *
 * Validates pain_point_evidence rows along two independent dimensions:
 *   1. source_validation_status — INHERITED from the parent row (e.g. a
 *      market_intelligence post, a diagnostic_audit submission, etc.).
 *   2. excerpt_faithfulness_status — decided by an LLM (Claude Haiku) that
 *      tests whether `source_excerpt` actually supports (`pain_category`,
 *      `monetary_indicator`).
 *
 * Phase 2a: all parent tables return null status; source_validation_status
 * will remain 'pending' until Phase 3 adds validation_status to
 * market_intelligence. The inheritance code path is wired up as a no-op so
 * that enabling Phase 3 requires no change here.
 *
 * Short-circuit: if parent status is 'rejected', skip the LLM call (excerpt
 * from a rejected source is not worth paying to faithfulness-check).
 */

// supabaseAdmin is lazy-imported inside runPainPointEvidenceValidation so tests
// that inject rows + dryRun don't require Supabase env vars.
import { recordAnthropicCost, type Usage } from '@/lib/cost-calculator'
import {
  judgeBatch,
  JUDGE_VERSION,
  PROMPT_VERSION,
  type ExcerptFaithfulnessClaim,
  type ExcerptFaithfulnessResult,
  type JudgeBatchOptions,
} from './llm-judge'

// -----------------------------------------------------------------------------
// Row types
// -----------------------------------------------------------------------------

export type PpeSourceType =
  | 'market_intelligence'
  | 'diagnostic_audit'
  | 'lead_enrichment'
  | 'outreach_reply'
  | 'manual'

export interface PainPointEvidenceRow {
  id: string
  pain_point_category_id: string
  source_type: PpeSourceType
  source_id: string | null
  source_excerpt: string | null
  monetary_indicator: number | string | null
  monetary_context: string | null
  source_validation_status: string | null
  excerpt_faithfulness_status: string | null
  prompt_version: string | null
  validator_version: string | null
  last_validated_at: string | null
}

export interface ResolvedPainPointEvidence extends PainPointEvidenceRow {
  pain_point_display_name: string
}

// -----------------------------------------------------------------------------
// Parent-status lookup (Phase 2a: always returns null, wiring for Phase 3)
// -----------------------------------------------------------------------------

/**
 * Reads the parent row's validation_status. Today only `industry_benchmarks`
 * has this column, but pain_point_evidence never references industry_benchmarks
 * as a parent, so this returns null for every valid Phase 2a source_type.
 *
 * Phase 3 will add validation_status to market_intelligence and this function
 * starts returning real values with zero change to callers.
 */
export async function lookupParentValidationStatus(
  row: Pick<PainPointEvidenceRow, 'source_type' | 'source_id'>
): Promise<string | null> {
  if (!row.source_id) return null
  // Phase 2a: no parent table has validation_status yet.
  // Intentionally returns null. Phase 3 will branch on source_type and
  // select validation_status from market_intelligence / diagnostic_audit.
  return null
}

// -----------------------------------------------------------------------------
// Per-row validation result
// -----------------------------------------------------------------------------

export interface PpeValidationResult {
  id: string
  source_validation_status: 'pending' | 'validated' | 'quarantined' | 'rejected'
  excerpt_faithfulness_status: 'pending' | 'faithful' | 'unfaithful' | 'insufficient'
  excerpt_faithfulness_reason: string | null
  excerpt_faithfulness_confidence: number | null
  excerpt_supported: 'yes' | 'no' | null
  excerpt_quantified: 'yes' | 'no' | 'approximate' | 'not_applicable' | null
  prompt_version: string
  validator_version: string
  validation_error: string | null
  short_circuited: boolean
  changed: boolean
}

function coerceParentStatus(
  raw: string | null
): 'pending' | 'validated' | 'quarantined' | 'rejected' {
  if (raw === 'validated' || raw === 'quarantined' || raw === 'rejected') return raw
  return 'pending'
}

function verdictToStatus(
  v: ExcerptFaithfulnessResult['verdict']
): 'faithful' | 'unfaithful' | 'insufficient' {
  return v
}

// -----------------------------------------------------------------------------
// Batch runner
// -----------------------------------------------------------------------------

export interface PpeBatchRunOptions {
  mode: 'stale' | 'pending' | 'forced' | 'sample-audit'
  limit?: number
  staleDays?: number
  maxBatchSize?: number
  judge?: JudgeBatchOptions
  /** Resolver for pain point display_name → category label (test injection). */
  loadPainPointNames?: (ids: string[]) => Promise<Map<string, string>>
  /**
   * Resolver for parent-source validation_status. Defaults to
   * `lookupParentValidationStatus` (which returns null in Phase 2a and starts
   * returning real statuses in Phase 3). Overridable in tests.
   */
  lookupParentStatus?: (
    row: Pick<PainPointEvidenceRow, 'source_type' | 'source_id'>
  ) => Promise<string | null>
  /** Optional row injection for tests (bypasses DB load). */
  rows?: PainPointEvidenceRow[]
  /** Triggered_by string for source_validation_runs. */
  triggeredBy?: string
  /**
   * If true, do NOT write results to the DB and do NOT insert a run row.
   * Used by the sample-audit endpoint. Combine with mode='sample-audit' for
   * clarity but not required (tests may use dryRun on other modes).
   */
  dryRun?: boolean
}

export interface PpeBatchRunSummary {
  table: 'pain_point_evidence'
  mode: string
  attempted: number
  validated: number
  rejected: number
  quarantined: number
  errors: number
  faithful: number
  unfaithful: number
  insufficient: number
  short_circuited: number
  llm_batches: number
  llm_tokens_in: number
  llm_tokens_out: number
  llm_cost_usd: number
  duration_ms: number
  validator_version: string
  prompt_version: string
  dry_run: boolean
}

export interface PpeBatchRunItem {
  id: string
  result: PpeValidationResult
  /** Present only in sample-audit mode — the excerpt + claim shown in UI. */
  sample?: {
    excerpt: string
    pain_category: string
    monetary_indicator: number | null
    monetary_context: string | null
  }
  error?: string
}

const DEFAULT_LIMIT = 100
const DEFAULT_STALE_DAYS = 30
const DEFAULT_BATCH_SIZE = 10
export const MAX_INVOCATION_ROWS = 500

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function defaultLoadPainPointNames(ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>()
  if (ids.length === 0) return m
  const { supabaseAdmin } = await import('@/lib/supabase')
  if (!supabaseAdmin) return m
  const { data, error } = await supabaseAdmin
    .from('pain_point_categories')
    .select('id, display_name, name')
    .in('id', ids)
  if (error) {
    console.warn('pain_point_categories lookup failed:', error.message)
    return m
  }
  for (const row of data ?? []) {
    m.set(row.id as string, (row.display_name as string) || (row.name as string) || 'Unknown pain')
  }
  return m
}

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return Number.isFinite(n) ? n : null
}

// -----------------------------------------------------------------------------
// runPainPointEvidenceValidation
// -----------------------------------------------------------------------------

export async function runPainPointEvidenceValidation(
  options: PpeBatchRunOptions
): Promise<{ summary: PpeBatchRunSummary; items: PpeBatchRunItem[] }> {
  const started = Date.now()
  const requestedLimit = options.limit ?? DEFAULT_LIMIT
  const limit = Math.min(requestedLimit, MAX_INVOCATION_ROWS)
  const batchSize = Math.min(options.maxBatchSize ?? DEFAULT_BATCH_SIZE, 20)
  const dryRun = options.dryRun === true || options.mode === 'sample-audit'

  // Only load the real Supabase client on code paths that need DB access
  // (row loading, writes, cost logging). Tests that inject rows + dryRun
  // never trigger this.
  const needsDb = !options.rows || !dryRun
  const supabaseAdmin = needsDb
    ? (await import('@/lib/supabase')).supabaseAdmin
    : null
  if (needsDb && !supabaseAdmin) {
    throw new Error('supabaseAdmin unavailable — runPainPointEvidenceValidation requires server-side execution.')
  }

  // ---- Load rows ------------------------------------------------------------

  let rows: PainPointEvidenceRow[]
  if (options.rows) {
    rows = options.rows.slice(0, limit)
  } else {
    let q = supabaseAdmin!
      .from('pain_point_evidence')
      .select(
        'id, pain_point_category_id, source_type, source_id, source_excerpt, monetary_indicator, monetary_context, source_validation_status, excerpt_faithfulness_status, prompt_version, validator_version, last_validated_at'
      )
      .order('last_validated_at', { ascending: true, nullsFirst: true })
      .limit(limit)

    if (options.mode === 'pending' || options.mode === 'sample-audit') {
      q = q.eq('excerpt_faithfulness_status', 'pending')
    } else if (options.mode === 'stale') {
      const cutoff = new Date(
        Date.now() - (options.staleDays ?? DEFAULT_STALE_DAYS) * 24 * 60 * 60 * 1000
      ).toISOString()
      q = q.or(`last_validated_at.is.null,last_validated_at.lt.${cutoff}`)
    }
    const { data, error } = await q
    if (error) throw new Error(`Failed to load pain_point_evidence: ${error.message}`)
    rows = (data ?? []) as PainPointEvidenceRow[]
  }

  // Load pain point names in one query.
  const loader = options.loadPainPointNames ?? defaultLoadPainPointNames
  const uniqCategoryIds = Array.from(new Set(rows.map((r) => r.pain_point_category_id)))
  const nameMap = await loader(uniqCategoryIds)
  const parentLookup = options.lookupParentStatus ?? lookupParentValidationStatus

  // ---- Skip rows that are idempotent and already up to date -----------------

  const toJudge: PainPointEvidenceRow[] = []
  const shortCircuited: PpeBatchRunItem[] = []

  for (const row of rows) {
    // Phase 2a: parent lookup always returns null, so source_validation_status
    // will remain 'pending' for the vast majority of rows. Still go through the
    // call so Phase 3 inherits naturally.
    const parentStatusRaw = await parentLookup(row)
    const sourceStatus = coerceParentStatus(parentStatusRaw)

    // Short-circuit: skip LLM if parent rejected.
    if (sourceStatus === 'rejected') {
      shortCircuited.push({
        id: row.id,
        result: {
          id: row.id,
          source_validation_status: 'rejected',
          excerpt_faithfulness_status: 'pending',
          excerpt_faithfulness_reason: null,
          excerpt_faithfulness_confidence: null,
          excerpt_supported: null,
          excerpt_quantified: null,
          prompt_version: PROMPT_VERSION,
          validator_version: JUDGE_VERSION,
          validation_error: null,
          short_circuited: true,
          changed: row.source_validation_status !== 'rejected',
        },
      })
      continue
    }

    // Idempotence: if same prompt_version + validator_version and
    // excerpt_faithfulness_status already set, skip unless mode='forced'.
    if (
      options.mode !== 'forced' &&
      options.mode !== 'sample-audit' &&
      row.prompt_version === PROMPT_VERSION &&
      row.validator_version === JUDGE_VERSION &&
      row.excerpt_faithfulness_status &&
      row.excerpt_faithfulness_status !== 'pending'
    ) {
      continue
    }

    toJudge.push(row)
  }

  // ---- Build batches and call judge -----------------------------------------

  const items: PpeBatchRunItem[] = [...shortCircuited]
  let llm_batches = 0
  let llm_tokens_in = 0
  let llm_tokens_out = 0
  let llm_cost_usd = 0
  let errors = 0
  let faithful = 0
  let unfaithful = 0
  let insufficient = 0

  for (let i = 0; i < toJudge.length; i += batchSize) {
    const batch = toJudge.slice(i, i + batchSize)
    const claims: ExcerptFaithfulnessClaim[] = batch.map((row) => ({
      id: row.id,
      excerpt: row.source_excerpt ?? '',
      painCategory: nameMap.get(row.pain_point_category_id) ?? 'Unknown pain point',
      monetaryIndicator: toNumberOrNull(row.monetary_indicator),
      monetaryContext: row.monetary_context,
    }))

    let batchOutput: Awaited<ReturnType<typeof judgeBatch>>
    try {
      batchOutput = await judgeBatch(claims, options.judge)
      llm_batches += 1
      llm_tokens_in += (batchOutput.usage.input_tokens ?? batchOutput.usage.prompt_tokens ?? 0) as number
      llm_tokens_out += (batchOutput.usage.output_tokens ?? batchOutput.usage.completion_tokens ?? 0) as number
      llm_cost_usd += batchOutput.cost_usd
    } catch (e) {
      const msg = (e as Error).message?.slice(0, 300) ?? 'unknown judge error'
      for (const row of batch) {
        errors += 1
        items.push({
          id: row.id,
          result: {
            id: row.id,
            source_validation_status: coerceParentStatus(null),
            excerpt_faithfulness_status: 'pending',
            excerpt_faithfulness_reason: null,
            excerpt_faithfulness_confidence: null,
            excerpt_supported: null,
            excerpt_quantified: null,
            prompt_version: PROMPT_VERSION,
            validator_version: JUDGE_VERSION,
            validation_error: msg,
            short_circuited: false,
            changed: false,
          },
          error: msg,
        })
      }
      continue
    }

    const verdictById = new Map(batchOutput.verdicts.map((v) => [v.id, v]))

    for (const row of batch) {
      const v = verdictById.get(row.id)
      if (!v) {
        errors += 1
        items.push({
          id: row.id,
          result: {
            id: row.id,
            source_validation_status: coerceParentStatus(null),
            excerpt_faithfulness_status: 'pending',
            excerpt_faithfulness_reason: null,
            excerpt_faithfulness_confidence: null,
            excerpt_supported: null,
            excerpt_quantified: null,
            prompt_version: PROMPT_VERSION,
            validator_version: JUDGE_VERSION,
            validation_error: 'Judge omitted this row from its response.',
            short_circuited: false,
            changed: false,
          },
          error: 'Judge omitted this row.',
        })
        continue
      }
      const status = verdictToStatus(v.verdict)
      if (status === 'faithful') faithful += 1
      else if (status === 'unfaithful') unfaithful += 1
      else insufficient += 1

      const sample =
        options.mode === 'sample-audit'
          ? {
              excerpt: row.source_excerpt ?? '',
              pain_category: nameMap.get(row.pain_point_category_id) ?? 'Unknown pain point',
              monetary_indicator: toNumberOrNull(row.monetary_indicator),
              monetary_context: row.monetary_context,
            }
          : undefined

      items.push({
        id: row.id,
        result: {
          id: row.id,
          source_validation_status: coerceParentStatus(null),
          excerpt_faithfulness_status: status,
          excerpt_faithfulness_reason: v.reason,
          excerpt_faithfulness_confidence: v.confidence,
          excerpt_supported: v.supported,
          excerpt_quantified: v.quantified,
          prompt_version: PROMPT_VERSION,
          validator_version: JUDGE_VERSION,
          validation_error: null,
          short_circuited: false,
          changed: row.excerpt_faithfulness_status !== status,
        },
        sample,
      })
    }
  }

  // ---- Persist results (unless dryRun) --------------------------------------

  if (!dryRun && supabaseAdmin) {
    const nowIso = new Date().toISOString()
    for (const it of items) {
      const r = it.result
      const { error: upErr } = await supabaseAdmin
        .from('pain_point_evidence')
        .update({
          source_validation_status: r.source_validation_status,
          excerpt_faithfulness_status: r.excerpt_faithfulness_status,
          excerpt_faithfulness_reason: r.excerpt_faithfulness_reason,
          excerpt_faithfulness_confidence: r.excerpt_faithfulness_confidence,
          excerpt_supported: r.excerpt_supported,
          excerpt_quantified: r.excerpt_quantified,
          prompt_version: r.prompt_version,
          validator_version: r.validator_version,
          validation_error: r.validation_error,
          last_validated_at: nowIso,
        })
        .eq('id', it.id)
      if (upErr) {
        it.error = (it.error ? it.error + ' | ' : '') + `update failed: ${upErr.message}`
        errors += 1
      }
    }

    // Cost accounting (out-of-band).
    if (llm_cost_usd > 0) {
      await recordAnthropicCost(
        { input_tokens: llm_tokens_in, output_tokens: llm_tokens_out } satisfies Usage,
        options.judge?.model ?? 'claude-3-5-haiku-20241022',
        { type: 'source_validator_ppe', id: options.triggeredBy ?? 'adhoc' },
        { operation: 'ppe_faithfulness', mode: options.mode, batches: llm_batches }
      ).catch((err) => {
        console.warn('recordAnthropicCost failed:', err instanceof Error ? err.message : err)
      })
    }
  }

  const summary: PpeBatchRunSummary = {
    table: 'pain_point_evidence',
    mode: options.mode,
    attempted: items.length,
    validated: 0, // ppe's source side is Phase 3
    rejected: shortCircuited.length, // rows where parent short-circuited
    quarantined: 0,
    errors,
    faithful,
    unfaithful,
    insufficient,
    short_circuited: shortCircuited.length,
    llm_batches,
    llm_tokens_in,
    llm_tokens_out,
    llm_cost_usd,
    duration_ms: Date.now() - started,
    validator_version: JUDGE_VERSION,
    prompt_version: PROMPT_VERSION,
    dry_run: dryRun,
  }

  return { summary, items }
}
