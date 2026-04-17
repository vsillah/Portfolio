/**
 * Shared helper for reading validated industry_benchmarks.
 *
 * Downstream consumers (value-report-generator, calculations/generate,
 * acceleration-engine, pricing) should use this instead of calling
 * `.from('industry_benchmarks').select('*')` directly, so that rejected and
 * quarantined rows are consistently excluded from dollar-math surfaces.
 *
 * The admin list endpoint and dashboard count deliberately do NOT use this -
 * admins need to see and fix rejected rows.
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface BenchmarkRow {
  id: string
  industry: string
  company_size_range: string
  benchmark_type: string
  value: number
  source: string
  source_url: string | null
  year: number
  notes: string | null
  trust_tier: number | null
  validation_status: 'pending' | 'validated' | 'rejected' | 'quarantined'
  methodology_note: string | null
  [key: string]: unknown
}

export interface LoadBenchmarkOptions {
  /** Industries to include (a "_default" fallback is typically added by the caller). */
  industries?: string[]
  /** When true, include rows still awaiting validation (default true - don't block math on pending rows). */
  includePending?: boolean
  /** When true, include quarantined rows (default false). */
  includeQuarantined?: boolean
}

/**
 * Fetch industry_benchmarks excluding rejected rows (and by default
 * quarantined rows too). Safe to call from API routes / libs.
 */
export async function loadValidatedBenchmarks(options: LoadBenchmarkOptions = {}): Promise<BenchmarkRow[]> {
  if (!supabaseAdmin) return []

  const allowedStatuses = new Set<string>(['validated'])
  if (options.includePending !== false) allowedStatuses.add('pending')
  if (options.includeQuarantined) allowedStatuses.add('quarantined')

  let query = supabaseAdmin.from('industry_benchmarks').select('*').in('validation_status', Array.from(allowedStatuses))

  if (options.industries && options.industries.length > 0) {
    query = query.in('industry', options.industries)
  }

  const { data, error } = await query
  if (error) {
    console.error('[loadValidatedBenchmarks] failed:', error.message)
    return []
  }
  return (data ?? []) as BenchmarkRow[]
}
