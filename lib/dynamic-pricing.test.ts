import { describe, expect, it } from 'vitest'
import {
  applyDynamicPricing,
  computeDynamicPricing,
  resolveHourlyWage,
} from './dynamic-pricing'
import { CATEGORY_RATE_MULTIPLIERS, SEGMENT_FALLBACK_RATES } from './bundle-item-value-methods'
import type { PricingTier, TierItem } from './pricing-model'
import type { IndustryBenchmark } from './value-calculations'

const BASE_BENCHMARK: Omit<IndustryBenchmark, 'id' | 'industry' | 'company_size_range' | 'benchmark_type' | 'value'> = {
  source: 'Test Source',
  source_url: null,
  year: 2026,
  notes: null,
}

function makeBenchmark(
  id: string,
  industry: string,
  companySize: string,
  value: number,
): IndustryBenchmark {
  return {
    id,
    industry,
    company_size_range: companySize,
    benchmark_type: 'avg_hourly_wage',
    value,
    ...BASE_BENCHMARK,
  }
}

function item(title: string, perceivedValue = 1000): TierItem {
  return {
    title,
    perceivedValue,
    offerRole: 'core_offer',
    description: title,
  }
}

function tier(id: string, items: TierItem[], price = 2500): PricingTier {
  return {
    id,
    name: id,
    tagline: '',
    targetAudience: '',
    price,
    isCustomPricing: false,
    totalRetailValue: items.reduce((sum, entry) => sum + entry.perceivedValue, 0),
    savingsPercent: 0,
    items,
    guarantee: null,
    ctaText: 'Get Started',
    ctaHref: '#contact',
  }
}

describe('resolveHourlyWage', () => {
  it('prefers a matching database benchmark over segment fallbacks', () => {
    const resolved = resolveHourlyWage(
      [makeBenchmark('exact', 'healthcare', '11-50', 71)],
      'healthcare',
      '11-50',
      'smb',
    )

    expect(resolved).toEqual({ wage: 71, source: 'database' })
  })

  it('uses the segment fallback when no benchmark matches', () => {
    expect(resolveHourlyWage([], 'healthcare', '11-50', 'nonprofit')).toEqual({
      wage: SEGMENT_FALLBACK_RATES.nonprofit.avg_hourly_wage,
      source: 'segment_fallback',
    })
  })

  it('uses the absolute fallback when the segment is unknown', () => {
    expect(resolveHourlyWage([], 'healthcare', '11-50')).toEqual({
      wage: SEGMENT_FALLBACK_RATES._default.avg_hourly_wage,
      source: 'absolute_fallback',
    })
  })
})

describe('computeDynamicPricing', () => {
  it('computes mapped items as hours × wage × category multiplier', () => {
    const wage = SEGMENT_FALLBACK_RATES.smb.avg_hourly_wage
    const result = computeDynamicPricing(
      [tier('quick-win', [item('AI Audit Calculator', 999)])],
      [],
      'smb',
    )

    const computed = result.tiers[0].items[0]
    expect(computed.dynamicValue).toBe(
      Math.round(6 * wage * CATEGORY_RATE_MULTIPLIERS.consulting),
    )
    expect(computed.staticValue).toBe(999)
    expect(computed.baseHours).toBe(6)
    expect(computed.hourlyRate).toBe(wage)
    expect(computed.multiplier).toBe(CATEGORY_RATE_MULTIPLIERS.consulting)
    expect(computed.isCumulative).toBe(false)
    expect(result.context).toMatchObject({
      segment: 'smb',
      benchmarkSource: 'segment_fallback',
      hourlyWageUsed: wage,
      isDefault: true,
    })
  })

  it('keeps the static perceived value when an item has no mapping', () => {
    const result = computeDynamicPricing(
      [tier('quick-win', [item('Unmapped Bonus Session', 1750)])],
      [],
      'smb',
    )

    expect(result.tiers[0].items[0]).toMatchObject({
      title: 'Unmapped Bonus Session',
      dynamicValue: 1750,
      staticValue: 1750,
      category: 'consulting',
      baseHours: 0,
      isCumulative: false,
    })
    expect(result.tiers[0].totalRetailValue).toBe(1750)
  })

  it('copies a referenced tier total onto cumulative items', () => {
    const wage = SEGMENT_FALLBACK_RATES.smb.avg_hourly_wage
    const auditValue = Math.round(6 * wage * CATEGORY_RATE_MULTIPLIERS.consulting)
    const result = computeDynamicPricing(
      [
        tier('quick-win', [item('AI Audit Calculator')]),
        tier('accelerator', [
          item('Everything in AI Quick Win', 0),
          item('Team Training Session'),
        ]),
      ],
      [],
      'smb',
    )

    const [quickWin, accelerator] = result.tiers
    expect(quickWin.totalRetailValue).toBe(auditValue)
    expect(accelerator.items[0]).toMatchObject({
      title: 'Everything in AI Quick Win',
      dynamicValue: auditValue,
      isCumulative: true,
      cumulativeRef: 'quick-win',
    })
    expect(accelerator.totalRetailValue).toBe(
      auditValue + Math.round(16 * wage * CATEGORY_RATE_MULTIPLIERS.consulting),
    )
  })

  it('falls back to the static value when the cumulative reference is missing', () => {
    const result = computeDynamicPricing(
      [tier('accelerator', [item('Everything in AI Quick Win', 4200)])],
      [],
      'smb',
    )

    expect(result.tiers[0].items[0]).toMatchObject({
      dynamicValue: 4200,
      isCumulative: true,
      cumulativeRef: 'quick-win',
    })
  })

  it('uses industry and company-size overrides in the calculation context', () => {
    const result = computeDynamicPricing(
      [tier('quick-win', [item('AI Audit Calculator')])],
      [makeBenchmark('exact', 'healthcare', '51-200', 80)],
      'smb',
      'healthcare',
      '51-200',
    )

    expect(result.context).toMatchObject({
      industry: 'healthcare',
      companySize: '51-200',
      hourlyWageUsed: 80,
      benchmarkSource: 'database',
      isDefault: false,
    })
    expect(result.tiers[0].items[0].dynamicValue).toBe(
      Math.round(6 * 80 * CATEGORY_RATE_MULTIPLIERS.consulting),
    )
  })
})

describe('applyDynamicPricing', () => {
  it('rewrites perceived values and savings from the dynamic totals', () => {
    const wage = SEGMENT_FALLBACK_RATES.midmarket.avg_hourly_wage
    const dynamicValue = Math.round(6 * wage * CATEGORY_RATE_MULTIPLIERS.consulting)
    const price = Math.round(dynamicValue / 2)
    const result = applyDynamicPricing(
      [tier('quick-win', [item('AI Audit Calculator', 9000)], price)],
      [],
      'midmarket',
    )

    expect(result.tiers[0].items[0].perceivedValue).toBe(dynamicValue)
    expect(result.tiers[0].totalRetailValue).toBe(dynamicValue)
    expect(result.tiers[0].savingsPercent).toBe(50)
    expect(result.context.hourlyWageUsed).toBe(wage)
  })

  it('prices the same item lower for nonprofit than smb when using segment fallbacks', () => {
    const items = [item('AI Audit Calculator')]
    const smb = applyDynamicPricing([tier('quick-win', items)], [], 'smb')
    const nonprofit = applyDynamicPricing([tier('quick-win', items)], [], 'nonprofit')

    expect(smb.context.hourlyWageUsed).toBe(SEGMENT_FALLBACK_RATES.smb.avg_hourly_wage)
    expect(nonprofit.context.hourlyWageUsed).toBe(SEGMENT_FALLBACK_RATES.nonprofit.avg_hourly_wage)
    expect(nonprofit.tiers[0].items[0].perceivedValue).toBeLessThan(
      smb.tiers[0].items[0].perceivedValue,
    )
  })

  it('returns 0% savings when the dynamic retail total is zero', () => {
    const result = applyDynamicPricing(
      [tier('empty', [], 1200)],
      [],
      'smb',
    )

    expect(result.tiers[0].totalRetailValue).toBe(0)
    expect(result.tiers[0].savingsPercent).toBe(0)
  })
})
