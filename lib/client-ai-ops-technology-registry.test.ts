import { describe, expect, it, vi } from 'vitest'
import { evaluateTechnologyOption, pricingFreshnessState } from './client-ai-ops-technology-registry'

describe('client AI ops technology registry', () => {
  it('scores local low-complexity options as recommended', () => {
    const result = evaluateTechnologyOption({
      startupCost: 1200,
      monthlyCost: 40,
      setupComplexity: 'low',
      integrationComplexity: 'low',
      dataOwnershipFit: 'local',
      monitoringSupport: 'high',
      pricingState: 'fresh',
      stackMatch: true,
    })

    expect(result.decision).toBe('recommend')
    expect(result.reasons).toContain('Strong client-owned data fit')
  })

  it('marks old pricing as stale', () => {
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'))
    expect(pricingFreshnessState('2026-03-01T12:00:00Z', 30)).toBe('stale')
    expect(pricingFreshnessState('2026-04-20T12:00:00Z', 30)).toBe('fresh')
    expect(pricingFreshnessState(null, 30)).toBe('needs_review')
    vi.useRealTimers()
  })
})
