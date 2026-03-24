import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: null,
  default: null,
}))

import { computeDerivedMetrics } from './gamma-report-builder'
import type { CalculationMethod, ConfidenceLevel } from './value-calculations'

function makeStatement(overrides: Partial<{
  painPoint: string
  painPointId: string
  annualValue: number
  calculationMethod: CalculationMethod
  formulaReadable: string
  evidenceSummary: string
  confidence: ConfidenceLevel
}> = {}) {
  return {
    painPoint: overrides.painPoint ?? 'Test Pain Point',
    painPointId: overrides.painPointId ?? 'pp-1',
    annualValue: overrides.annualValue ?? 10000,
    calculationMethod: overrides.calculationMethod ?? 'time_saved',
    formulaReadable: overrides.formulaReadable ?? '10 hrs * $50 * 52',
    evidenceSummary: overrides.evidenceSummary ?? 'test evidence',
    confidence: overrides.confidence ?? 'medium',
  }
}

const BASE_SERVICE = {
  id: 's-1',
  title: 'Test Service',
  description: 'Desc',
  service_type: 'advisory',
  delivery_method: 'remote',
  price: 5000,
  is_quote_based: false,
  duration_description: null,
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    contact: null,
    audit: null,
    valueReport: null,
    services: [],
    painPoints: [],
    benchmarks: [],
    ...overrides,
  } as Parameters<typeof computeDerivedMetrics>[0]
}

describe('computeDerivedMetrics', () => {
  it('returns all nulls when no value report or audit', () => {
    const m = computeDerivedMetrics(makeContext())
    expect(m.totalAnnualValue).toBeNull()
    expect(m.estimatedInvestment).toBeNull()
    expect(m.roi).toBeNull()
    expect(m.paybackMonths).toBeNull()
    expect(m.topPainPoints).toHaveLength(0)
    expect(m.urgencyScore).toBeNull()
    expect(m.opportunityScore).toBeNull()
  })

  it('computes metrics from a full value report', () => {
    const stmts = [
      makeStatement({ annualValue: 20000, painPoint: 'A' }),
      makeStatement({ annualValue: 10000, painPoint: 'B' }),
    ]
    const ctx = makeContext({
      valueReport: {
        id: 'vr-1',
        title: 'Test Report',
        report_type: 'client_facing',
        industry: 'nonprofit',
        company_size_range: '11-50',
        summary_markdown: '',
        value_statements: stmts,
        total_annual_value: 30000,
        evidence_chain: {},
      },
      services: [BASE_SERVICE],
    })
    const m = computeDerivedMetrics(ctx)

    expect(m.totalAnnualValue).toBe(30000)
    expect(m.estimatedInvestment).toBeTypeOf('number')
    expect(m.estimatedInvestment).toBeGreaterThan(0)
    expect(m.roi).toBeTypeOf('number')
    expect(m.paybackMonths).toBeTypeOf('number')
    expect(m.paybackMonths).toBeGreaterThan(0)
  })

  it('sorts topPainPoints by annualValue desc and caps at 5', () => {
    const stmts = Array.from({ length: 8 }, (_, i) =>
      makeStatement({ annualValue: (i + 1) * 1000, painPoint: `PP-${i + 1}` })
    )
    const ctx = makeContext({
      valueReport: {
        id: 'vr-1',
        title: 'Test',
        report_type: 'client_facing',
        industry: 'tech',
        company_size_range: '11-50',
        summary_markdown: '',
        value_statements: stmts,
        total_annual_value: 36000,
        evidence_chain: {},
      },
    })
    const m = computeDerivedMetrics(ctx)

    expect(m.topPainPoints).toHaveLength(5)
    expect(m.topPainPoints[0].annualValue).toBe(8000)
    expect(m.topPainPoints[4].annualValue).toBe(4000)
  })

  it('handles zero-value pain points gracefully', () => {
    const stmts = [
      makeStatement({ annualValue: 0, painPoint: 'Zero' }),
      makeStatement({ annualValue: 5000, painPoint: 'NonZero' }),
    ]
    const ctx = makeContext({
      valueReport: {
        id: 'vr-1',
        title: 'Test',
        report_type: 'client_facing',
        industry: 'nonprofit',
        company_size_range: '1-10',
        summary_markdown: '',
        value_statements: stmts,
        total_annual_value: 5000,
        evidence_chain: {},
      },
      services: [BASE_SERVICE],
    })
    const m = computeDerivedMetrics(ctx)

    expect(m.topPainPoints).toHaveLength(2)
    expect(m.topPainPoints[0].painPoint).toBe('NonZero')
    expect(m.topPainPoints[1].painPoint).toBe('Zero')
  })

  it('pulls urgency and opportunity scores from audit', () => {
    const ctx = makeContext({
      audit: {
        id: 1,
        business_challenges: null,
        tech_stack: null,
        automation_needs: null,
        ai_readiness: null,
        budget_timeline: null,
        decision_making: null,
        diagnostic_summary: 'summary',
        key_insights: ['a', 'b'],
        recommended_actions: ['c'],
        urgency_score: 7,
        opportunity_score: 9,
      },
    })
    const m = computeDerivedMetrics(ctx)
    expect(m.urgencyScore).toBe(7)
    expect(m.opportunityScore).toBe(9)
  })

  it('returns null roi/payback when investment is zero (no services)', () => {
    const ctx = makeContext({
      valueReport: {
        id: 'vr-1',
        title: 'Test',
        report_type: 'client_facing',
        industry: 'nonprofit',
        company_size_range: '11-50',
        summary_markdown: '',
        value_statements: [],
        total_annual_value: 0,
        evidence_chain: {},
      },
    })
    const m = computeDerivedMetrics(ctx)
    expect(m.totalAnnualValue).toBe(0)
    expect(m.roi).toBeNull()
    expect(m.paybackMonths).toBeNull()
  })

  it('computes correct ROI formula', () => {
    const stmts = [makeStatement({ annualValue: 20000 })]
    const ctx = makeContext({
      valueReport: {
        id: 'vr-1',
        title: 'Test',
        report_type: 'client_facing',
        industry: 'nonprofit',
        company_size_range: '11-50',
        summary_markdown: '',
        value_statements: stmts,
        total_annual_value: 20000,
        evidence_chain: {},
      },
      services: [{ ...BASE_SERVICE, price: 10000 }],
    })
    const m = computeDerivedMetrics(ctx)

    expect(m.totalAnnualValue).toBe(20000)
    if (m.estimatedInvestment && m.roi !== null) {
      const expectedRoi = Math.round(((20000 - m.estimatedInvestment) / m.estimatedInvestment) * 100)
      expect(m.roi).toBe(expectedRoi)
    }
  })

  it('handles single pain point', () => {
    const stmts = [makeStatement({ annualValue: 50000, painPoint: 'Solo' })]
    const ctx = makeContext({
      valueReport: {
        id: 'vr-1',
        title: 'Test',
        report_type: 'client_facing',
        industry: 'tech',
        company_size_range: '51-200',
        summary_markdown: '',
        value_statements: stmts,
        total_annual_value: 50000,
        evidence_chain: {},
      },
    })
    const m = computeDerivedMetrics(ctx)

    expect(m.topPainPoints).toHaveLength(1)
    expect(m.topPainPoints[0].painPoint).toBe('Solo')
  })
})
