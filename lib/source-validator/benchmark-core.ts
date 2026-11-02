/** Pure benchmark validation. No provider or database initialization at import time. */
import { createHash } from 'crypto'
import { classifyTier, extractHostname, isFetchDenylisted, inferDomainType } from './tiers'
import { checkFreshness } from './freshness'
import { composeFromTier } from './methodology'
import { VALIDATOR_VERSION, type CachedFetchResult, type ValidationReason, type ValidationResult, type ValidationStatus, type ValidatorContext } from './types'

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

export function computeContentHash(row: BenchmarkRow): string {
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
