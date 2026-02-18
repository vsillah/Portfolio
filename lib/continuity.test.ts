import { describe, it, expect } from 'vitest'
import {
  toStripeInterval,
  toStripeIntervalCount,
  creditCyclesCovered,
  formatBillingInterval,
  formatCurrency,
} from './continuity'

// ============================================================================
// toStripeInterval
// ============================================================================
describe('toStripeInterval', () => {
  it('maps week to week', () => {
    expect(toStripeInterval('week')).toBe('week')
  })

  it('maps month to month', () => {
    expect(toStripeInterval('month')).toBe('month')
  })

  it('maps quarter to month (Stripe has no quarter)', () => {
    expect(toStripeInterval('quarter')).toBe('month')
  })

  it('maps year to year', () => {
    expect(toStripeInterval('year')).toBe('year')
  })
})

// ============================================================================
// toStripeIntervalCount
// ============================================================================
describe('toStripeIntervalCount', () => {
  it('returns count as-is for week', () => {
    expect(toStripeIntervalCount('week', 2)).toBe(2)
  })

  it('returns count as-is for month', () => {
    expect(toStripeIntervalCount('month', 1)).toBe(1)
  })

  it('multiplies by 3 for quarter', () => {
    expect(toStripeIntervalCount('quarter', 1)).toBe(3)
    expect(toStripeIntervalCount('quarter', 2)).toBe(6)
  })

  it('returns count as-is for year', () => {
    expect(toStripeIntervalCount('year', 1)).toBe(1)
  })
})

// ============================================================================
// creditCyclesCovered
// ============================================================================
describe('creditCyclesCovered', () => {
  it('calculates full cycles covered by credit', () => {
    expect(creditCyclesCovered(1500, 500)).toBe(3)
  })

  it('rounds down partial cycles', () => {
    expect(creditCyclesCovered(1200, 500)).toBe(2)
  })

  it('returns 0 when credit is less than one interval', () => {
    expect(creditCyclesCovered(100, 500)).toBe(0)
  })

  it('returns 0 for zero amount', () => {
    expect(creditCyclesCovered(0, 500)).toBe(0)
  })

  it('returns 0 for zero interval amount', () => {
    expect(creditCyclesCovered(1000, 0)).toBe(0)
  })

  it('returns 0 for negative interval amount', () => {
    expect(creditCyclesCovered(1000, -100)).toBe(0)
  })
})

// ============================================================================
// formatBillingInterval
// ============================================================================
describe('formatBillingInterval', () => {
  it('returns "Weekly" for week with count 1', () => {
    expect(formatBillingInterval('week', 1)).toBe('Weekly')
  })

  it('returns "Monthly" for month with count 1', () => {
    expect(formatBillingInterval('month', 1)).toBe('Monthly')
  })

  it('returns "Quarterly" for quarter with count 1', () => {
    expect(formatBillingInterval('quarter', 1)).toBe('Quarterly')
  })

  it('returns "Annually" for year with count 1', () => {
    expect(formatBillingInterval('year', 1)).toBe('Annually')
  })

  it('returns "Every 2 months" for count > 1', () => {
    expect(formatBillingInterval('month', 2)).toBe('Every 2 months')
  })

  it('returns "Every 3 weeks" for count > 1', () => {
    expect(formatBillingInterval('week', 3)).toBe('Every 3 weeks')
  })
})

// ============================================================================
// formatCurrency
// ============================================================================
describe('formatCurrency', () => {
  it('formats USD by default with commas and no cents', () => {
    const result = formatCurrency(1234.56)
    expect(result).toBe('$1,235')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('accepts explicit currency', () => {
    const result = formatCurrency(99.99, 'usd')
    expect(result).toContain('100')
  })
})
