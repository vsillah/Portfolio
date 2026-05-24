import { describe, expect, it } from 'vitest'
import { buildApifyReplacementBakeoffPlan } from './apify-replacement-bakeoff'

describe('buildApifyReplacementBakeoffPlan', () => {
  it('blocks live API replacement tests when keys are missing', () => {
    const plan = buildApifyReplacementBakeoffPlan({}, '2026-05-24T00:00:00.000Z')

    expect(plan.tests).toHaveLength(4)
    expect(plan.blockedCount).toBe(3)
    expect(plan.manualReadyCount).toBe(1)
    expect(plan.tests.find((test) => test.category === 'LinkedIn post search')?.status).toBe('manual_ready')
    expect(plan.nextAction).toContain('missing read-only replacement credentials')
  })

  it('marks Brave and Google challengers ready when replacement keys exist', () => {
    const plan = buildApifyReplacementBakeoffPlan({
      BRAVE_SEARCH_API_KEY: 'brave-test-key',
      GOOGLE_MAPS_API_KEY: 'google-test-key',
    }, '2026-05-24T00:00:00.000Z')

    expect(plan.readyCount).toBe(3)
    expect(plan.blockedCount).toBe(0)
    expect(plan.tests.map((test) => test.status)).toEqual(
      expect.arrayContaining(['ready', 'manual_ready'])
    )
  })
})
