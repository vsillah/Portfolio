import { describe, it, expect } from 'vitest'
import {
  calculatePayoutAmount,
  calculateRolloverCredit,
  areAllConditionsMet,
  isGuaranteeExpired,
  daysRemaining,
  getResolvedStatus,
  validateConditions,
} from './guarantees'
import type { GuaranteeCondition, GuaranteeMilestone } from './guarantees'

// ============================================================================
// calculatePayoutAmount
// ============================================================================
describe('calculatePayoutAmount', () => {
  it('returns full purchase amount for "full" payout type', () => {
    expect(
      calculatePayoutAmount(1000, { payout_amount_type: 'full', payout_amount_value: null })
    ).toBe(1000)
  })

  it('returns percentage of purchase amount for "partial" payout type', () => {
    expect(
      calculatePayoutAmount(1000, { payout_amount_type: 'partial', payout_amount_value: 75 })
    ).toBe(750)
  })

  it('defaults to 100% when partial has no value', () => {
    expect(
      calculatePayoutAmount(1000, { payout_amount_type: 'partial', payout_amount_value: null })
    ).toBe(1000)
  })

  it('returns fixed amount for "fixed" payout type', () => {
    expect(
      calculatePayoutAmount(1000, { payout_amount_type: 'fixed', payout_amount_value: 250 })
    ).toBe(250)
  })

  it('caps fixed amount at purchase price', () => {
    expect(
      calculatePayoutAmount(500, { payout_amount_type: 'fixed', payout_amount_value: 1000 })
    ).toBe(500)
  })

  it('returns 0 for fixed with no value', () => {
    expect(
      calculatePayoutAmount(1000, { payout_amount_type: 'fixed', payout_amount_value: null })
    ).toBe(0)
  })

  it('defaults to full amount for unknown payout type', () => {
    expect(
      calculatePayoutAmount(1000, { payout_amount_type: 'unknown' as any, payout_amount_value: null })
    ).toBe(1000)
  })
})

// ============================================================================
// calculateRolloverCredit
// ============================================================================
describe('calculateRolloverCredit', () => {
  it('applies 1x multiplier by default', () => {
    expect(
      calculateRolloverCredit(1000, {
        payout_amount_type: 'full',
        payout_amount_value: null,
        rollover_bonus_multiplier: 1.0,
      })
    ).toBe(1000)
  })

  it('applies 1.25x bonus multiplier', () => {
    expect(
      calculateRolloverCredit(1000, {
        payout_amount_type: 'full',
        payout_amount_value: null,
        rollover_bonus_multiplier: 1.25,
      })
    ).toBe(1250)
  })

  it('applies multiplier on top of partial payout', () => {
    expect(
      calculateRolloverCredit(1000, {
        payout_amount_type: 'partial',
        payout_amount_value: 50,
        rollover_bonus_multiplier: 2.0,
      })
    ).toBe(1000) // 50% of 1000 = 500, * 2.0 = 1000
  })

  it('handles null multiplier as 1x', () => {
    expect(
      calculateRolloverCredit(800, {
        payout_amount_type: 'full',
        payout_amount_value: null,
        rollover_bonus_multiplier: null as any,
      })
    ).toBe(800) // null coalesces to 1.0
  })
})

// ============================================================================
// isGuaranteeExpired
// ============================================================================
describe('isGuaranteeExpired', () => {
  it('returns true for past dates', () => {
    expect(
      isGuaranteeExpired({ expires_at: '2020-01-01T00:00:00Z' })
    ).toBe(true)
  })

  it('returns false for future dates', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    expect(
      isGuaranteeExpired({ expires_at: future.toISOString() })
    ).toBe(false)
  })
})

// ============================================================================
// daysRemaining
// ============================================================================
describe('daysRemaining', () => {
  it('returns 0 for expired guarantees', () => {
    expect(
      daysRemaining({ expires_at: '2020-01-01T00:00:00Z' })
    ).toBe(0)
  })

  it('returns positive number for active guarantees', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const result = daysRemaining({ expires_at: future.toISOString() })
    expect(result).toBeGreaterThanOrEqual(29)
    expect(result).toBeLessThanOrEqual(31)
  })

  it('returns 1 for a guarantee expiring tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const result = daysRemaining({ expires_at: tomorrow.toISOString() })
    expect(result).toBe(1)
  })
})

// ============================================================================
// getResolvedStatus
// ============================================================================
describe('getResolvedStatus', () => {
  it('maps refund to refund_issued', () => {
    expect(getResolvedStatus('refund')).toBe('refund_issued')
  })

  it('maps credit to credit_issued', () => {
    expect(getResolvedStatus('credit')).toBe('credit_issued')
  })

  it('maps rollover_upsell to rollover_upsell_applied', () => {
    expect(getResolvedStatus('rollover_upsell')).toBe('rollover_upsell_applied')
  })

  it('maps rollover_continuity to rollover_continuity_applied', () => {
    expect(getResolvedStatus('rollover_continuity')).toBe('rollover_continuity_applied')
  })
})

// ============================================================================
// validateConditions
// ============================================================================
describe('validateConditions', () => {
  it('accepts valid conditions array', () => {
    const conditions: GuaranteeCondition[] = [
      { id: 'attend', label: 'Attend sessions', verification_method: 'admin_verified', required: true },
      { id: 'homework', label: 'Do homework', verification_method: 'client_self_report', required: false },
    ]
    expect(validateConditions(conditions)).toBe(true)
  })

  it('rejects non-array', () => {
    expect(validateConditions('not an array')).toBe(false)
    expect(validateConditions(null)).toBe(false)
    expect(validateConditions(42)).toBe(false)
  })

  it('accepts empty array', () => {
    expect(validateConditions([])).toBe(true)
  })

  it('rejects conditions with missing id', () => {
    expect(
      validateConditions([{ id: '', label: 'Test', verification_method: 'admin_verified', required: true }])
    ).toBe(false)
  })

  it('rejects conditions with missing label', () => {
    expect(
      validateConditions([{ id: 'test', label: '', verification_method: 'admin_verified', required: true }])
    ).toBe(false)
  })

  it('rejects conditions with invalid verification_method', () => {
    expect(
      validateConditions([{ id: 'test', label: 'Test', verification_method: 'magic', required: true }])
    ).toBe(false)
  })

  it('rejects conditions without boolean required', () => {
    expect(
      validateConditions([{ id: 'test', label: 'Test', verification_method: 'admin_verified', required: 'yes' }])
    ).toBe(false)
  })
})

// ============================================================================
// areAllConditionsMet
// ============================================================================
describe('areAllConditionsMet', () => {
  const conditions: GuaranteeCondition[] = [
    { id: 'c1', label: 'Condition 1', verification_method: 'admin_verified', required: true },
    { id: 'c2', label: 'Condition 2', verification_method: 'admin_verified', required: true },
    { id: 'c3', label: 'Condition 3', verification_method: 'admin_verified', required: false },
  ]

  it('returns true when all milestones are met', () => {
    const milestones = [
      { status: 'met' as const },
      { status: 'met' as const },
      { status: 'met' as const },
    ]
    expect(areAllConditionsMet(milestones, conditions)).toBe(true)
  })

  it('returns true when all milestones are met or waived', () => {
    const milestones = [
      { status: 'met' as const },
      { status: 'waived' as const },
      { status: 'met' as const },
    ]
    expect(areAllConditionsMet(milestones, conditions)).toBe(true)
  })

  it('returns false when a required milestone is pending', () => {
    const milestones = [
      { status: 'met' as const },
      { status: 'pending' as const },
      { status: 'met' as const },
    ]
    expect(areAllConditionsMet(milestones, conditions)).toBe(false)
  })

  it('returns false when a required milestone is not_met', () => {
    const milestones = [
      { status: 'met' as const },
      { status: 'not_met' as const },
      { status: 'met' as const },
    ]
    expect(areAllConditionsMet(milestones, conditions)).toBe(false)
  })
})
