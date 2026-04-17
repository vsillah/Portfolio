import { describe, it, expect } from 'vitest'
import { checkFreshness } from './freshness'

const now = new Date('2026-04-17T00:00:00Z')

describe('checkFreshness', () => {
  it('marks 2025 government data as fresh (within 36 mo)', () => {
    const r = checkFreshness({ domain_type: 'government', year: 2025, now })
    expect(r.state).toBe('fresh')
    expect(r.age_months).toBeGreaterThanOrEqual(12)
    expect(r.reason).toBe(null)
  })

  it('marks 2020 government data as stale (over 36 mo)', () => {
    const r = checkFreshness({ domain_type: 'government', year: 2020, now })
    expect(r.state).toBe('stale')
    expect(r.reason?.code).toBe('freshness_stale')
  })

  it('marks 2025 analyst data as fresh (within 18 mo)', () => {
    const r = checkFreshness({ domain_type: 'analyst', year: 2025, now })
    expect(r.state).toBe('fresh')
  })

  it('marks 2022 analyst data as stale (over 18 mo)', () => {
    const r = checkFreshness({ domain_type: 'analyst', year: 2022, now })
    expect(r.state).toBe('stale')
  })

  it('prefers published_date when year missing', () => {
    const r = checkFreshness({
      domain_type: 'press',
      year: null,
      published_date: '2025-09-01T00:00:00Z',
      now,
    })
    expect(r.state).toBe('fresh')
    expect(r.age_months).toBeLessThan(18)
  })

  it('returns unknown when no date provided', () => {
    const r = checkFreshness({ domain_type: 'general', year: null, now })
    expect(r.state).toBe('unknown')
    expect(r.reason?.code).toBe('freshness_unknown')
  })

  it('ignores invalid published_date strings', () => {
    const r = checkFreshness({
      domain_type: 'general',
      year: null,
      published_date: 'not-a-date',
      now,
    })
    expect(r.state).toBe('unknown')
  })

  it('general web has tighter 12 mo window', () => {
    const r2024 = checkFreshness({ domain_type: 'general', year: 2024, now })
    expect(r2024.state).toBe('stale')
    expect(r2024.max_age_months).toBe(12)
  })
})
