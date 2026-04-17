import { describe, it, expect } from 'vitest'
import { composeFromTier, composeMethodologyNote } from './methodology'
import type { TierAssignment } from './tiers'

const t1: TierAssignment = { tier: 1, label: 'BLS', matched_on: 'host' }
const t5: TierAssignment = { tier: 5, label: 'Unclassified / general web', matched_on: 'default' }

describe('composeFromTier', () => {
  it('produces a readable source line with year', () => {
    const s = composeFromTier('BLS Manufacturing Wage Data', 2025, null, t1)
    expect(s).toContain('BLS Manufacturing Wage Data (2025)')
    expect(s).toContain('Tier 1 BLS')
  })

  it('falls back to "vintage unknown" when no year/date', () => {
    const s = composeFromTier('Some source', null, null, t1)
    expect(s).toContain('vintage unknown')
  })

  it('prefers year over published_date', () => {
    const s = composeFromTier('X', 2025, '2020-01-01T00:00:00Z', t1)
    expect(s).toContain('(2025)')
  })

  it('uses year from published_date when year missing', () => {
    const s = composeFromTier('X', null, '2024-06-15T00:00:00Z', t1)
    expect(s).toContain('(2024)')
  })

  it('emits "Unattributed source" when source is blank', () => {
    const s = composeFromTier(null, 2025, null, t1)
    expect(s).toContain('Unattributed source')
  })

  it('appends adjustment when supplied', () => {
    const s = composeFromTier('X', 2025, null, t5, { adjustment: 'flagged for human review' })
    expect(s).toContain('flagged for human review')
  })

  it('includes fetched title when it differs from source', () => {
    const s = composeMethodologyNote({
      source: 'BLS',
      year: 2025,
      published_date: null,
      trust_tier: 1,
      tier_label: 'BLS',
      fetched_title: 'Bureau of Labor Statistics - Occupational Employment and Wages',
    })
    expect(s).toMatch(/title: "Bureau of Labor Statistics/)
  })

  it('notes fetch errors', () => {
    const s = composeMethodologyNote({
      source: 'X',
      year: 2025,
      published_date: null,
      trust_tier: 2,
      tier_label: 'Gartner',
      fetch_error_reason: 'head_error:timeout',
    })
    expect(s).toContain('fetch: head_error:timeout')
  })
})
