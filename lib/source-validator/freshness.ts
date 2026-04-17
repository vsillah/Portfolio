/**
 * VEP Source Validator - freshness / vintage checks
 *
 * Maps domain types to the maximum acceptable vintage (in months). When a
 * source is older than the window for its domain type, we emit a warning
 * reason and, if the source is tier 4-5, downgrade status to `quarantined`.
 *
 * Windows loosely follow the consulting-firm convention:
 *   - Government / regulatory: 36 months (SEC/BLS data has long shelf life)
 *   - Analyst reports:         18 months
 *   - Trade / association:     24 months
 *   - Press:                   18 months
 *   - General web:             12 months
 *
 * Benchmark rows use the `year` column (integer). Evidence rows may use
 * `published_date` (timestamptz) extracted from the source URL or scraper.
 */

import type { ValidationReason } from './types'

type DomainType = 'government' | 'analyst' | 'trade' | 'press' | 'general'

const MAX_AGE_MONTHS: Record<DomainType, number> = {
  government: 36,
  analyst: 18,
  trade: 24,
  press: 18,
  general: 12,
}

export interface FreshnessInput {
  domain_type: DomainType
  /** Year of the source (e.g. industry_benchmarks.year). Takes precedence when present. */
  year?: number | null
  /** ISO date string (e.g. extracted published_date). */
  published_date?: string | null
  /** Reference time; defaults to now. Useful for tests. */
  now?: Date
}

export interface FreshnessResult {
  /** `fresh` = inside window; `stale` = outside window; `unknown` = no date available. */
  state: 'fresh' | 'stale' | 'unknown'
  age_months: number | null
  max_age_months: number
  reason: ValidationReason | null
}

function monthsBetween(older: Date, newer: Date): number {
  const ms = newer.getTime() - older.getTime()
  if (ms < 0) return 0
  const msPerMonth = (1000 * 60 * 60 * 24 * 365.25) / 12
  return Math.floor(ms / msPerMonth)
}

export function checkFreshness(input: FreshnessInput): FreshnessResult {
  const now = input.now ?? new Date()
  const maxMonths = MAX_AGE_MONTHS[input.domain_type]

  let asOf: Date | null = null
  if (input.year && Number.isFinite(input.year)) {
    // Treat year as Jan 1 of that year for a conservative check.
    asOf = new Date(Date.UTC(input.year, 0, 1))
  } else if (input.published_date) {
    const d = new Date(input.published_date)
    if (!Number.isNaN(d.getTime())) asOf = d
  }

  if (!asOf) {
    return {
      state: 'unknown',
      age_months: null,
      max_age_months: maxMonths,
      reason: {
        code: 'freshness_unknown',
        message: 'No year or published_date available - freshness cannot be assessed.',
        severity: 'warning',
      },
    }
  }

  const ageMonths = monthsBetween(asOf, now)
  if (ageMonths <= maxMonths) {
    return {
      state: 'fresh',
      age_months: ageMonths,
      max_age_months: maxMonths,
      reason: null,
    }
  }

  return {
    state: 'stale',
    age_months: ageMonths,
    max_age_months: maxMonths,
    reason: {
      code: 'freshness_stale',
      message: `Source is ${ageMonths} months old; max acceptable for ${input.domain_type} is ${maxMonths} months.`,
      severity: 'warning',
    },
  }
}
