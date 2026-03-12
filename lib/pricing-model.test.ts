import { describe, expect, it } from 'vitest'
import {
  calculateHormoziScore,
  calculateValueStack,
  determineTier,
  formatPriceOrFree,
  hasValueEquationComponents,
  type PricingTier,
} from './pricing-model'

describe('hasValueEquationComponents', () => {
  it('returns true when all four components are present', () => {
    expect(
      hasValueEquationComponents({
        dream_outcome_description: 'Increase qualified leads',
        likelihood_multiplier: 8,
        time_reduction: 7,
        effort_reduction: 6,
      })
    ).toBe(true)
  })

  it('returns false when dream outcome is blank or a numeric field is missing', () => {
    expect(
      hasValueEquationComponents({
        dream_outcome_description: '   ',
        likelihood_multiplier: 8,
        time_reduction: 7,
        effort_reduction: 6,
      })
    ).toBe(false)

    expect(
      hasValueEquationComponents({
        dream_outcome_description: 'Increase qualified leads',
        likelihood_multiplier: 8,
        time_reduction: 7,
        effort_reduction: null,
      })
    ).toBe(false)
  })
})

describe('calculateHormoziScore', () => {
  it('inverts time/effort scales and rounds to 2 decimals', () => {
    const result = calculateHormoziScore({
      dreamOutcome: 7,
      likelihood: 9,
      timeDelay: 7,
      effortSacrifice: 5,
    })

    // timeInverse = 4, effortInverse = 6 => 63 / 24 = 2.625 -> 2.63
    expect(result.valueScore).toBe(2.63)
  })
})

describe('determineTier', () => {
  it('uses community-impact tiers for nonprofit/education by default', () => {
    expect(
      determineTier({
        companySize: '1-10',
        orgType: 'nonprofit',
      })
    ).toBe('ci-starter')

    expect(
      determineTier({
        companySize: '11-50',
        orgType: 'education',
      })
    ).toBe('ci-accelerator')
  })

  it('lets high-budget nonprofits bypass to premium tiers', () => {
    expect(
      determineTier({
        companySize: '11-50',
        orgType: 'nonprofit',
        budgetSignal: 'enterprise',
      })
    ).toBe('accelerator')
  })

  it('applies budget and size/opportunity branching for for-profit orgs', () => {
    expect(
      determineTier({
        companySize: '51-200',
        budgetSignal: 'enterprise',
      })
    ).toBe('digital-transformation')

    expect(
      determineTier({
        companySize: '11-50',
        opportunityScore: 7,
      })
    ).toBe('growth-engine')

    expect(
      determineTier({
        companySize: '11-50',
        opportunityScore: 6,
      })
    ).toBe('accelerator')
  })
})

describe('calculateValueStack', () => {
  const tier: PricingTier = {
    id: 'test-tier',
    name: 'Test Tier',
    tagline: 'Test',
    targetAudience: 'Testers',
    price: 30,
    isCustomPricing: false,
    totalRetailValue: 100,
    savingsPercent: 70,
    items: [
      {
        title: 'Item A',
        perceivedValue: 60,
        offerRole: 'core_offer',
        description: 'A',
      },
      {
        title: 'Item B',
        perceivedValue: 40,
        offerRole: 'bonus',
        description: 'B',
      },
    ],
    guarantee: null,
    ctaText: 'Start',
    ctaHref: '#contact',
  }

  it('allocates bundle price proportionally and computes total savings', () => {
    const result = calculateValueStack(tier)

    expect(result.items).toEqual([
      {
        name: 'Item A',
        retailValue: 60,
        bundlePrice: 18,
        savings: 42,
        role: 'core_offer',
      },
      {
        name: 'Item B',
        retailValue: 40,
        bundlePrice: 12,
        savings: 28,
        role: 'bonus',
      },
    ])
    expect(result.totalSavings).toBe(70)
    expect(result.bundlePrice).toBe(30)
  })
})

describe('formatPriceOrFree', () => {
  it('returns "Free" for zero and currency text for paid tiers', () => {
    expect(formatPriceOrFree(0)).toBe('Free')
    expect(formatPriceOrFree(14997)).toBe('$14,997')
  })
})
