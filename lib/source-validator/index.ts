/**
 * VEP Source Validator - orchestrator (Phase 1)
 *
 * Phase 1 scope: validate rows in `industry_benchmarks` using deterministic
 * checks only (tier classification, live URL fetch if present, freshness,
 * methodology note). No LLM calls, no triangulation (those land in Phase 2/3).
 *
 * Decision logic (Phase 1):
 *   - Tier 1-3 source, URL present and live, fresh              -> validated
 *   - Tier 1-3 source, no URL or URL dead, fresh                -> validated
 *     (tier 1-3 free-text sources like "BLS" are trusted without a URL)
 *   - Tier 4 source, URL live, fresh                            -> validated
 *   - Tier 4 source, no URL                                     -> quarantined (needs review)
 *   - Tier 5 source (general web / "industry estimate")         -> quarantined
 *   - URL present but dead (4xx/5xx / fetch error), tier 4-5    -> rejected
 *   - Stale source (outside freshness window)                   -> quarantined
 *   - Anything with status >= 500 consistently                  -> rejected
 *
 * Writes are idempotent: the batch runner skips rows whose
 * `content_hash` + `validator_version` already match.
 */

import { createHash } from 'crypto'
import { classifyTier, extractHostname, isFetchDenylisted, inferDomainType } from './tiers'
import { checkFreshness } from './freshness'
import { composeFromTier } from './methodology'
import {
  VALIDATOR_VERSION,
  type BatchItemOutcome,
  type BatchRunSummary,
  type CachedFetchResult,
  type ValidationReason,
  type ValidationResult,
  type ValidationStatus,
  type ValidatorContext,
} from './types'

export { VALIDATOR_VERSION } from './types'
export type { ValidationResult, BatchRunSummary } from './types'

// Phase 2a re-exports
export { runPainPointEvidenceValidation, MAX_INVOCATION_ROWS as PPE_MAX_ROWS } from './pain-point-evidence'
export type {
  PpeBatchRunSummary,
  PpeBatchRunItem,
  PpeValidationResult,
  PpeBatchRunOptions,
} from './pain-point-evidence'
export { PROMPT_VERSION, JUDGE_VERSION } from './llm-judge'

// -----------------------------------------------------------------------------
// Shared downstream filter helper (rule: filter lives in one place)
// -----------------------------------------------------------------------------

/**
 * Faithfulness enforcement modes for pain_point_evidence consumers.
 *
 *   off         — no filtering (Phase 1 behavior preserved). Default in 2a.
 *   permissive  — exclude excerpt_faithfulness_status='unfaithful' and
 *                 source_validation_status='rejected'. Pending + insufficient
 *                 rows still count.
 *   strict      — only include rows with excerpt_faithfulness_status='faithful'.
 *                 Use after Phase 3 gives us judged coverage + calibration.
 *
 * Controlled by VEP_FAITHFULNESS_MODE env var.
 */
export type FaithfulnessMode = 'off' | 'permissive' | 'strict'

export function getFaithfulnessMode(): FaithfulnessMode {
  const raw = (process.env.VEP_FAITHFULNESS_MODE ?? '').toLowerCase().trim()
  if (raw === 'permissive' || raw === 'strict') return raw
  return 'off'
}

/**
 * Applies the project-wide downstream filter contract to a pain_point_evidence
 * Supabase query builder. Every calculation / reporting / pricing path that
 * reads pain_point_evidence should chain this helper instead of hardcoding
 * `.neq(...).neq(...)` so the rule can evolve in one place.
 *
 * Usage:
 *   const { data } = await applyValidatedEvidenceFilter(
 *     supabaseAdmin.from('pain_point_evidence').select('*')
 *   )
 *
 * Admin/display endpoints that need to see ALL rows (including rejected) must
 * NOT call this helper — they should show validation status in the UI instead.
 */
export function applyValidatedEvidenceFilter<Q extends { eq: (col: string, v: unknown) => Q; neq: (col: string, v: unknown) => Q }>(
  query: Q,
  mode: FaithfulnessMode = getFaithfulnessMode()
): Q {
  if (mode === 'off') return query
  // Always drop explicit 'rejected' source validation regardless of mode.
  let q = query.neq('source_validation_status', 'rejected')
  if (mode === 'strict') {
    q = q.eq('excerpt_faithfulness_status', 'faithful')
  } else {
    // permissive
    q = q.neq('excerpt_faithfulness_status', 'unfaithful')
  }
  return q
}

export interface BenchmarkRow {
  id: string
  industry: string
  company_size_range: string
  benchmark_type: string
  value: number
  source: string | null
  source_url: string | null
  year: number | null
  notes: string | null
  validation_status: ValidationStatus | null
  content_hash: string | null
  validator_version: string | null
}

function computeContentHash(row: BenchmarkRow): string {
  const payload = JSON.stringify({
    industry: row.industry,
    company_size_range: row.company_size_range,
    benchmark_type: row.benchmark_type,
    value: row.value,
    source: row.source,
    source_url: row.source_url,
    year: row.year,
  })
  return createHash('sha256').update(payload).digest('hex')
}

/**
 * Core pure function: takes a row + context, returns a result. No DB writes.
 */
export async function validateBenchmark(
  row: BenchmarkRow,
  ctx: ValidatorContext = {}
): Promise<ValidationResult> {
  const reasons: ValidationReason[] = []
  const fetchedUrls: string[] = []
  const now = ctx.now ?? new Date()

  const tier = classifyTier(row.source_url, row.source)
  const host = extractHostname(row.source_url)
  const domainType = inferDomainType(host, row.source)

  // --- URL liveness ---------------------------------------------------------
  let fetchResult: CachedFetchResult | null = null
  let urlLive = false
  let urlDead = false
  let urlFetched = false

  if (row.source_url) {
    if (ctx.fetchUrls === false) {
      reasons.push({ code: 'fetch_skipped', message: 'URL fetch disabled by caller.', severity: 'info' })
    } else if (host && isFetchDenylisted(host)) {
      reasons.push({
        code: 'fetch_denylisted',
        message: `Host ${host} is on the fetch denylist; relying on free-text + tier classification only.`,
        severity: 'info',
      })
    } else {
      urlFetched = true
      let fetcher = ctx.fetchUrl
      if (!fetcher) {
        const mod = await import('./fetcher')
        fetcher = mod.fetchUrlCached
      }
      try {
        fetchResult = await fetcher(row.source_url)
        if (fetchResult) {
          fetchedUrls.push(fetchResult.url)
          if (fetchResult.error_reason) {
            reasons.push({
              code: 'fetch_error',
              message: `URL fetch failed: ${fetchResult.error_reason}`,
              severity: 'warning',
            })
            urlDead = true
          } else if (fetchResult.status_code && fetchResult.status_code >= 200 && fetchResult.status_code < 400) {
            urlLive = true
            reasons.push({
              code: 'url_live',
              message: `URL returned ${fetchResult.status_code}` + (fetchResult.title ? ` ("${fetchResult.title.slice(0, 80)}")` : ''),
              severity: 'info',
            })
          } else if (fetchResult.status_code && fetchResult.status_code >= 400) {
            urlDead = true
            reasons.push({
              code: 'url_dead',
              message: `URL returned ${fetchResult.status_code}`,
              severity: 'error',
            })
          }
        } else {
          reasons.push({
            code: 'url_invalid',
            message: 'source_url could not be parsed.',
            severity: 'warning',
          })
          urlDead = true
        }
      } catch (e) {
        reasons.push({
          code: 'fetch_exception',
          message: `Fetcher threw: ${(e as Error).message?.slice(0, 100) ?? 'unknown'}`,
          severity: 'warning',
        })
      }
    }
  } else {
    // No URL provided
    reasons.push({
      code: 'url_missing',
      message: 'No source_url provided; relying on free-text + tier classification.',
      severity: tier.tier <= 3 ? 'info' : 'warning',
    })
  }

  // --- Freshness ------------------------------------------------------------
  const freshness = checkFreshness({
    domain_type: domainType,
    year: row.year ?? null,
    published_date: fetchResult?.published_date ?? null,
    now,
  })
  if (freshness.reason) reasons.push(freshness.reason)

  // --- Tier reason ----------------------------------------------------------
  reasons.push({
    code: `tier_${tier.tier}`,
    message: `Classified as Tier ${tier.tier} (${tier.label}) via ${tier.matched_on}.`,
    severity: tier.tier >= 5 ? 'warning' : 'info',
  })

  // --- Status decision ------------------------------------------------------
  let status: ValidationStatus

  if (urlDead && tier.tier >= 4) {
    status = 'rejected'
  } else if (freshness.state === 'stale' && tier.tier >= 3) {
    status = 'quarantined'
  } else if (tier.tier === 5) {
    status = 'quarantined'
  } else if (tier.tier === 4 && !urlLive && urlFetched) {
    status = 'quarantined'
  } else if (tier.tier === 4 && !row.source_url) {
    status = 'quarantined'
  } else if (tier.tier <= 3) {
    status = 'validated'
  } else {
    status = 'validated'
  }

  // --- Methodology ----------------------------------------------------------
  const methodology_note = composeFromTier(
    row.source,
    row.year,
    fetchResult?.published_date ?? null,
    tier,
    {
      fetched_title: fetchResult?.title ?? null,
      fetch_error_reason: fetchResult?.error_reason ?? null,
      adjustment: status === 'quarantined'
        ? 'flagged for human review'
        : status === 'rejected'
          ? 'excluded from $ math'
          : null,
    }
  )

  return {
    status,
    trust_tier: tier.tier,
    reasons,
    methodology_note,
    content_hash: computeContentHash(row),
    validator_version: VALIDATOR_VERSION,
    fetched_urls: fetchedUrls,
  }
}

// -----------------------------------------------------------------------------
// Batch runner: selects rows, runs validateBenchmark, writes results.
// -----------------------------------------------------------------------------

export interface BatchRunOptions {
  mode: 'stale' | 'pending' | 'forced'
  limit?: number
  /** Stale = last_validated_at older than this many days. */
  staleDays?: number
  /** Safety cap: stop after this many ms even if rows remain. */
  maxDurationMs?: number
  /** Safety cap: max URL fetches per run. */
  maxFetches?: number
  /** Inject context (e.g. fetchUrls:false) for tests. */
  ctx?: ValidatorContext
}

const DEFAULT_STALE_DAYS = 30
const DEFAULT_LIMIT = 100
const DEFAULT_MAX_DURATION_MS = 120_000
const DEFAULT_MAX_FETCHES = 200

export async function runBenchmarkValidation(
  options: BatchRunOptions
): Promise<{ summary: BatchRunSummary; items: BatchItemOutcome[] }> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin unavailable - source validator requires server-side execution.')
  }

  const started = Date.now()
  const limit = options.limit ?? DEFAULT_LIMIT
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS
  const maxFetches = options.maxFetches ?? DEFAULT_MAX_FETCHES

  let query = supabaseAdmin
    .from('industry_benchmarks')
    .select('id, industry, company_size_range, benchmark_type, value, source, source_url, year, notes, validation_status, content_hash, validator_version')
    .order('last_validated_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (options.mode === 'pending') {
    query = query.eq('validation_status', 'pending')
  } else if (options.mode === 'stale') {
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString()
    query = query.or(`last_validated_at.is.null,last_validated_at.lt.${cutoff}`)
  }
  // 'forced' mode re-validates any row regardless.

  const { data: rows, error } = await query
  if (error) {
    throw new Error(`Failed to load benchmarks: ${error.message}`)
  }

  const items: BatchItemOutcome[] = []
  let validated = 0
  let rejected = 0
  let quarantined = 0
  let errors = 0
  let fetchCount = 0

  for (const raw of (rows ?? []) as BenchmarkRow[]) {
    if (Date.now() - started > maxDurationMs) break

    // Skip if unchanged and already on this validator version (unless forced)
    if (options.mode !== 'forced' && raw.validator_version === VALIDATOR_VERSION) {
      const unchanged = raw.content_hash === computeContentHash(raw)
      if (unchanged) continue
    }

    const ctx: ValidatorContext = { ...(options.ctx ?? {}) }
    if (fetchCount >= maxFetches && ctx.fetchUrls !== false) {
      ctx.fetchUrls = false
    }

    let result: ValidationResult
    try {
      result = await validateBenchmark(raw, ctx)
      fetchCount += result.fetched_urls.length
    } catch (e) {
      errors += 1
      items.push({
        id: raw.id,
        previous_status: raw.validation_status,
        result: {
          status: (raw.validation_status ?? 'pending') as ValidationStatus,
          trust_tier: null,
          reasons: [{ code: 'validator_exception', message: (e as Error).message?.slice(0, 200) ?? 'unknown', severity: 'error' }],
          methodology_note: null,
          content_hash: computeContentHash(raw),
          validator_version: VALIDATOR_VERSION,
          fetched_urls: [],
        },
        changed: false,
        error: (e as Error).message,
      })
      continue
    }

    const { error: upErr } = await supabaseAdmin
      .from('industry_benchmarks')
      .update({
        trust_tier: result.trust_tier,
        validation_status: result.status,
        validation_reasons: result.reasons,
        methodology_note: result.methodology_note,
        content_hash: result.content_hash,
        validator_version: result.validator_version,
        last_validated_at: new Date().toISOString(),
      })
      .eq('id', raw.id)

    if (upErr) {
      errors += 1
      items.push({
        id: raw.id,
        previous_status: raw.validation_status,
        result,
        changed: false,
        error: upErr.message,
      })
      continue
    }

    if (result.status === 'validated') validated += 1
    else if (result.status === 'rejected') rejected += 1
    else if (result.status === 'quarantined') quarantined += 1

    items.push({
      id: raw.id,
      previous_status: raw.validation_status,
      result,
      changed: raw.validation_status !== result.status,
    })
  }

  const summary: BatchRunSummary = {
    table: 'industry_benchmarks',
    mode: options.mode,
    attempted: items.length,
    validated,
    rejected,
    quarantined,
    errors,
    duration_ms: Date.now() - started,
    validator_version: VALIDATOR_VERSION,
  }

  return { summary, items }
}
