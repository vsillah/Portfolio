import { describe, it, expect } from 'vitest'
import { validateBenchmark, VALIDATOR_VERSION, type BenchmarkRow } from './index'
import type { CachedFetchResult, ValidatorContext } from './types'

const now = new Date('2026-04-17T00:00:00Z')

function makeRow(overrides: Partial<BenchmarkRow> = {}): BenchmarkRow {
  return {
    id: 'b1',
    industry: 'manufacturing',
    company_size_range: '11-50',
    benchmark_type: 'avg_hourly_wage',
    value: 40,
    source: 'BLS Manufacturing Wage Data',
    source_url: 'https://www.bls.gov/oes/current/oes172011.htm',
    year: 2025,
    notes: null,
    validation_status: 'pending',
    content_hash: null,
    validator_version: null,
    ...overrides,
  }
}

function mockFetch(result: Partial<CachedFetchResult> | null): ValidatorContext['fetchUrl'] {
  return async (url: string) => {
    if (!result) return null
    return {
      url,
      final_url: result.final_url ?? url,
      status_code: result.status_code ?? 200,
      domain: result.domain ?? 'example.com',
      title: result.title ?? null,
      published_date: result.published_date ?? null,
      content_length: result.content_length ?? null,
      fetched_at: result.fetched_at ?? new Date().toISOString(),
      error_reason: result.error_reason ?? null,
      cache_hit: result.cache_hit ?? false,
    }
  }
}

describe('validateBenchmark', () => {
  it('marks a fresh Tier 1 BLS row with live URL as validated', async () => {
    const row = makeRow()
    const result = await validateBenchmark(row, {
      now,
      fetchUrl: mockFetch({ status_code: 200, domain: 'www.bls.gov', title: 'OES' }),
    })
    expect(result.status).toBe('validated')
    expect(result.trust_tier).toBe(1)
    expect(result.validator_version).toBe(VALIDATOR_VERSION)
    expect(result.methodology_note).toMatch(/BLS Manufacturing/)
    expect(result.methodology_note).toMatch(/Tier 1/)
  })

  it('quarantines a Tier 5 "industry estimate" row', async () => {
    const row = makeRow({ source: 'Industry estimate', source_url: null })
    const result = await validateBenchmark(row, { now, fetchUrls: false })
    expect(result.trust_tier).toBe(5)
    expect(result.status).toBe('quarantined')
  })

  it('rejects a Tier 5 row whose URL is dead', async () => {
    const row = makeRow({
      source: 'Some blog',
      source_url: 'https://randomblog.example.com/post',
    })
    const result = await validateBenchmark(row, {
      now,
      fetchUrl: mockFetch({ status_code: 404, domain: 'randomblog.example.com' }),
    })
    expect(result.trust_tier).toBe(5)
    expect(result.status).toBe('rejected')
    expect(result.reasons.some((r) => r.code === 'url_dead')).toBe(true)
  })

  it('quarantines a stale Tier 3 row', async () => {
    const row = makeRow({ source: 'Glassdoor', source_url: null, year: 2020 })
    const result = await validateBenchmark(row, { now, fetchUrls: false })
    expect(result.trust_tier).toBe(3)
    expect(result.status).toBe('quarantined')
    expect(result.reasons.some((r) => r.code === 'freshness_stale')).toBe(true)
  })

  it('validates a Tier 1 row without a URL (free-text BLS is trustworthy)', async () => {
    const row = makeRow({ source: 'BLS', source_url: null })
    const result = await validateBenchmark(row, { now, fetchUrls: false })
    expect(result.trust_tier).toBe(1)
    expect(result.status).toBe('validated')
  })

  it('quarantines a Tier 4 press row with no URL', async () => {
    const row = makeRow({ source: 'Financial Times', source_url: null })
    const result = await validateBenchmark(row, { now, fetchUrls: false })
    expect(result.trust_tier).toBe(4)
    expect(result.status).toBe('quarantined')
  })

  it('handles a fetch exception gracefully', async () => {
    const row = makeRow()
    const throwingFetch: ValidatorContext['fetchUrl'] = async () => {
      throw new Error('network exploded')
    }
    const result = await validateBenchmark(row, { now, fetchUrl: throwingFetch })
    expect(result.trust_tier).toBe(1)
    expect(result.status).toBe('validated')
    expect(result.reasons.some((r) => r.code === 'fetch_exception')).toBe(true)
  })

  it('skips fetch when fetchUrls:false', async () => {
    const row = makeRow()
    let called = false
    const spyFetch: ValidatorContext['fetchUrl'] = async () => {
      called = true
      return null
    }
    const result = await validateBenchmark(row, { now, fetchUrls: false, fetchUrl: spyFetch })
    expect(called).toBe(false)
    expect(result.status).toBe('validated')
    expect(result.reasons.some((r) => r.code === 'fetch_skipped')).toBe(true)
  })

  it('produces stable content_hash for identical input', async () => {
    const row = makeRow()
    const a = await validateBenchmark(row, { now, fetchUrls: false })
    const b = await validateBenchmark(row, { now, fetchUrls: false })
    expect(a.content_hash).toBe(b.content_hash)
  })
})
