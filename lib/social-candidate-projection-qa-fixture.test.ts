import { describe, expect, it } from 'vitest'
import { buildSocialCandidateProjectionQaFixture } from './social-candidate-projection-qa-fixture'

describe('social candidate projection QA fixture', () => {
  it('demonstrates paginated candidate joins and an actionable incomplete policy without side effects', () => {
    const coverage = buildSocialCandidateProjectionQaFixture()
    const candidates = coverage.trend_work_relevance?.candidates ?? []

    expect(candidates).toHaveLength(5)
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ candidate_class: 'public_momentum_repository', product_identity: 'jev' }),
      expect.objectContaining({ candidate_class: 'active_github_product', product_identity: 'dark_castle_chess' }),
      expect.objectContaining({ candidate_class: 'public_theme_owned_capability', product_identity: 'agentified' }),
      expect.objectContaining({ candidate_class: 'public_momentum_repository', product_identity: 'mentorri' }),
      expect.objectContaining({ candidate_class: 'public_momentum_repository', product_identity: 'reversr' }),
    ]))
    expect(coverage.trend_work_relevance?.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('candidate_receipt_policy_incomplete:public_momentum_repository_v1:policy_watch:repository_evidence'),
    ]))
    expect(candidates.every((candidate) => Object.values(candidate.side_effects).every((enabled) => enabled === false))).toBe(true)
    expect(coverage).toMatchObject({ status: 'blocked', review_only: true })
    expect(coverage.boundaries.join(' ')).toContain('No reconciliation, model or provider call, render, upload, schedule, publish, external send, or candidate approval')
  })
})

