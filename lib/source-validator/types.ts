/**
 * VEP Source Validator - shared types
 *
 * These types cross process boundaries (API request/response, DB rows,
 * downstream consumers like value-report-generator). Keep backward-compatible
 * or bump VALIDATOR_VERSION when the shape changes.
 */

export const VALIDATOR_VERSION = 'v1.0.0-phase1'

export type ValidationStatus = 'pending' | 'validated' | 'rejected' | 'quarantined'

export type TrustTier = 1 | 2 | 3 | 4 | 5

export type ReasonSeverity = 'info' | 'warning' | 'error'

export interface ValidationReason {
  code: string
  message: string
  severity: ReasonSeverity
}

export interface ValidationResult {
  status: ValidationStatus
  trust_tier: TrustTier | null
  reasons: ValidationReason[]
  methodology_note: string | null
  content_hash: string
  validator_version: string
  /** URLs that were fetched (for cache warming / observability). Empty when no URL present. */
  fetched_urls: string[]
}

/**
 * Minimal row shape shared across validators; concrete validators narrow to the
 * specific table's row type.
 */
export interface ValidatableSourceRow {
  id: string
  source?: string | null
  source_url?: string | null
  content?: string | null
  published_date?: string | null
  year?: number | null
}

/** Context passed to validateSource; allows injecting deps for tests. */
export interface ValidatorContext {
  now?: Date
  /** When false, skip live URL fetches (useful for dry runs and Vitest). */
  fetchUrls?: boolean
  /** Injected fetcher for testing; defaults to real DB-cached fetcher. */
  fetchUrl?: (url: string) => Promise<CachedFetchResult | null>
}

export interface CachedFetchResult {
  url: string
  final_url: string | null
  status_code: number | null
  domain: string
  title: string | null
  published_date: string | null
  content_length: number | null
  fetched_at: string
  error_reason: string | null
  cache_hit: boolean
}

/** Per-row outcome of a batch run, returned to the API caller. */
export interface BatchItemOutcome {
  id: string
  previous_status: ValidationStatus | null
  result: ValidationResult
  changed: boolean
  error?: string
}

export interface BatchRunSummary {
  table: 'industry_benchmarks' | 'pain_point_evidence' | 'market_intelligence'
  mode: 'stale' | 'pending' | 'forced'
  attempted: number
  validated: number
  rejected: number
  quarantined: number
  errors: number
  duration_ms: number
  validator_version: string
}
