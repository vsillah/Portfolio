import { describe, expect, it } from 'vitest'
import { OUTREACH_MODE_GATING_NOTE, OUTREACH_MODE_POLICIES } from './outreach-mode-gating'

describe('outreach mode gating', () => {
  it('defines the four review-only outreach modes without external execution', () => {
    expect(Object.keys(OUTREACH_MODE_POLICIES).sort()).toEqual([
      'cold_1_to_1',
      'cold_1_to_many',
      'warm_1_to_1',
      'warm_1_to_many',
    ])

    for (const policy of Object.values(OUTREACH_MODE_POLICIES)) {
      expect(policy.canonicalSurface).toBe('/admin/outreach')
      expect(policy.externalExecutionEnabled).toBe(false)
      expect(policy.requiredGates.join(' ')).toMatch(/human approval/i)
    }

    expect(OUTREACH_MODE_GATING_NOTE).toMatch(/do not enable provider calls/i)
  })
})
