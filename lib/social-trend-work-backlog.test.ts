import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/llm-dispatch', () => ({ generateJsonCompletion: vi.fn() }))
vi.mock('@/lib/agent-work-items', () => ({ createAgentWorkItem: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn() } }))

import { topicCandidateFromTrendWorkJoin } from './social-topic-backlog'
import { socialCandidateReceiptMetadata } from './social-content-intelligence'
import { buildApprovedSourceProjection } from './social-topic-source-receipts'
import { buildApprovedPublicMomentumProjection, buildTrendWorkRelevanceReport } from './social-trend-work-join'

const at = '2026-10-12T12:00:00.000Z'

describe('trend/work topic backlog projection', () => {
  it('promotes a joined receipt set into the existing review-only candidate contract', () => {
    const momentum = buildApprovedPublicMomentumProjection({
      sourceId: 'jev-news', momentumKind: 'public_news', productIdentity: 'jev', label: 'Jev',
      approvedSummary: 'Approved public momentum around governed capability analysis.',
      canonicalUrl: 'https://news.example.com/jev', publisher: 'Fixture publisher', topicIdentities: ['governed capability analysis'],
      entityIdentities: ['jev'], coverageIdentity: 'jev-governed-capability-news', sentiment: 'positive',
      contextSummary: 'Approved attributable reporting shows material attention around governed capability analysis.',
      relevanceScore: 0.9, publicAttentionScore: 0.82, materiality: 'material', evidenceState: 'corroborated',
      publishedAt: at, expiresAt: '2026-10-26T12:00:00.000Z',
      approvedAt: at, approvedBy: 'reviewer', observedAt: at,
    })
    const analysis = buildApprovedSourceProjection({
      sourceGroup: 'repository_documents', sourceKind: 'approved_repository_document', sourceId: 'jev-analysis', productIdentity: 'jev',
      lifecycleStage: 'insight', label: 'Jev', approvedSummary: 'Approved Jev capability analysis.', privacyClassification: 'public_safe',
      provenance: 'fixture:jev-analysis', approvedAt: at, approvedBy: 'reviewer', observedAt: at,
      metadata: { topic_identities: ['governed_capability_analysis'] },
    })
    const report = buildTrendWorkRelevanceReport([momentum, analysis], '2026-10-12T16:00:00.000Z')

    const projected = topicCandidateFromTrendWorkJoin(report.candidates[0], [momentum, analysis])

    expect(projected).toMatchObject({
      candidate_class: 'public_momentum_repository',
      source_type: 'public_momentum',
      product_ids: ['jev'],
      receipt_policy: expect.objectContaining({ policy_id: 'public_momentum_repository_v1' }),
      receipt_lineage: expect.arrayContaining([
        expect.objectContaining({ receipt_id: momentum.receipt_id, product_identity: 'jev' }),
        expect.objectContaining({ receipt_id: analysis.receipt_id, product_identity: 'jev' }),
      ]),
      source_receipts: expect.arrayContaining([
        expect.objectContaining({ source_kind: 'public_news', raw_content_included: false }),
        expect.objectContaining({ source_kind: 'approved_repository_document', raw_content_included: false }),
      ]),
    })
    expect(socialCandidateReceiptMetadata(projected!)).toMatchObject({
      candidate_class: 'public_momentum_repository',
      receipt_policy: expect.objectContaining({ policy_id: 'public_momentum_repository_v1' }),
      receipt_lineage: expect.arrayContaining([
        expect.objectContaining({ receipt_id: momentum.receipt_id, provenance: momentum.provenance }),
        expect.objectContaining({ receipt_id: analysis.receipt_id, provenance: analysis.provenance }),
      ]),
    })
  })

  it('promotes a bound active GitHub work signal as Portfolio work without requiring public momentum', () => {
    const product = buildApprovedSourceProjection({
      sourceGroup: 'app_prototypes', sourceKind: 'app_prototype', sourceId: 'dark-castle-product', productIdentity: 'dark_castle_chess',
      lifecycleStage: 'publicly_cataloged', label: 'Dark Castle Chess', approvedSummary: 'The approved app record establishes the Dark Castle Chess product identity.', privacyClassification: 'public_safe',
      provenance: 'public_catalog:app_prototypes:dark-castle-product', approvedAt: at, approvedBy: 'public_catalog_state', observedAt: at,
      metadata: { topic_identities: ['chess_product_development'] },
    })
    const github = buildApprovedSourceProjection({
      sourceGroup: 'github_development', sourceKind: 'github_pull_request_activity', sourceId: 'dark-castle-prs', productIdentity: 'dark_castle_chess',
      lifecycleStage: 'in_development', label: 'Dark Castle Chess', approvedSummary: 'Dark Castle Chess has current pull-request activity.', privacyClassification: 'client_safe_summary',
      provenance: 'github_authenticated_api:vsillah/dark-castle-chess:pulls', approvedAt: at, approvedBy: 'github_authenticated_api', observedAt: at,
      evidenceUrl: 'https://github.com/vsillah/dark-castle-chess/pulls', metadata: { portfolio_product_id: 'dark-castle-product', topic_identities: ['chess_product_development'] },
    })
    const report = buildTrendWorkRelevanceReport([product, github], '2026-10-12T16:00:00.000Z')

    expect(topicCandidateFromTrendWorkJoin(report.candidates[0], [product, github])).toMatchObject({
      candidate_class: 'active_github_product',
      source_type: 'portfolio_work',
      product_ids: ['dark_castle_chess'],
      sensitivity: 'client_safe_summary',
      receipt_policy: expect.objectContaining({ policy_id: 'active_github_product_v1' }),
      source_receipts: expect.arrayContaining([
        expect.objectContaining({ source_kind: 'app_prototype', raw_content_included: false }),
        expect.objectContaining({ source_kind: 'github_pull_request_activity', raw_content_included: false }),
      ]),
    })
  })

  it('projects a course-theme match into the existing backlog contract with exact lineage and review metadata', () => {
    const publicTrend = buildApprovedPublicMomentumProjection({
      sourceId: 'course-pattern', momentumKind: 'social_trend', productIdentity: 'course_industry', label: 'Course industry pattern',
      approvedSummary: 'Approved public evidence shows stronger performance for practical cohort courses.',
      canonicalUrl: 'https://social.example.com/course-pattern', publisher: 'Public fixture publisher', topicIdentities: ['practical cohort courses'],
      entityIdentities: ['course_industry'], coverageIdentity: 'practical-cohort-course-pattern', sentiment: 'positive',
      contextSummary: 'Approved attributable social evidence shows material public attention around practical cohort courses.',
      relevanceScore: 0.9, publicAttentionScore: 0.85, materiality: 'material', evidenceState: 'corroborated',
      publishedAt: at, expiresAt: '2026-10-26T12:00:00.000Z',
      approvedAt: at, approvedBy: 'reviewer', observedAt: at,
    })
    const ownedCourse = buildApprovedSourceProjection({
      sourceGroup: 'public_catalog', sourceKind: 'amadutown_product', sourceId: 'accelerated-course', productIdentity: 'accelerated',
      lifecycleStage: 'publicly_cataloged', label: 'Accelerated', approvedSummary: 'Accelerated is an approved owned practical course capability.', privacyClassification: 'public_safe',
      provenance: 'public_catalog:products:accelerated-course', approvedAt: at, approvedBy: 'public_catalog_state', observedAt: at,
      metadata: { topic_identities: ['practical_cohort_courses'] },
    })
    const report = buildTrendWorkRelevanceReport([publicTrend, ownedCourse], '2026-10-12T16:00:00.000Z')
    const thematic = report.candidates.find((candidate) => candidate.candidate_class === 'public_theme_owned_capability')!

    const projected = topicCandidateFromTrendWorkJoin(thematic, [publicTrend, ownedCourse])

    expect(projected).toMatchObject({
      candidate_class: 'public_theme_owned_capability',
      source_type: 'public_momentum',
      source_label: 'Accelerated thematic opportunity evidence',
      product_ids: ['accelerated'],
      theme_identity: 'practical_cohort_courses',
      relevant_owned_capability: {
        product_identity: 'accelerated',
        source_receipt_ids: [ownedCourse.receipt_id],
      },
      confidence: { score: 0.88, level: 'medium' },
      public_signal: {
        signal_kind: 'social_trend',
        coverage_identity: 'practical_cohort_course_pattern',
        sentiment: 'positive',
        public_attention_score: 0.85,
      },
      receipt_policy: expect.objectContaining({ policy_id: 'public_theme_owned_capability_v1' }),
      receipt_lineage: expect.arrayContaining([
        expect.objectContaining({ receipt_id: publicTrend.receipt_id, product_identity: 'course_industry' }),
        expect.objectContaining({ receipt_id: ownedCourse.receipt_id, product_identity: 'accelerated' }),
      ]),
    })
    expect(projected?.actionable_next_step).toContain('No copy or downstream action is created automatically.')
    expect(socialCandidateReceiptMetadata(projected!)).toMatchObject({
      theme_identity: 'practical_cohort_courses',
      confidence: { score: 0.88, level: 'medium' },
      public_signal: expect.objectContaining({ coverage_identity: 'practical_cohort_course_pattern' }),
      actionable_next_step: expect.stringContaining('Review the exact receipts'),
    })
  })

  it('does not project a joined candidate when its required receipt set is incomplete', () => {
    const product = buildApprovedSourceProjection({
      sourceGroup: 'app_prototypes', sourceKind: 'app_prototype', sourceId: 'dark-castle-product', productIdentity: 'dark_castle_chess',
      lifecycleStage: 'publicly_cataloged', label: 'Dark Castle Chess', approvedSummary: 'The approved app record establishes the Dark Castle Chess product identity.', privacyClassification: 'public_safe',
      provenance: 'public_catalog:app_prototypes:dark-castle-product', approvedAt: at, approvedBy: 'public_catalog_state', observedAt: at,
    })
    const github = buildApprovedSourceProjection({
      sourceGroup: 'github_development', sourceKind: 'github_pull_request_activity', sourceId: 'dark-castle-prs', productIdentity: 'dark_castle_chess',
      lifecycleStage: 'in_development', label: 'Dark Castle Chess', approvedSummary: 'Dark Castle Chess has current pull-request activity.', privacyClassification: 'client_safe_summary',
      provenance: 'github_authenticated_api:vsillah/dark-castle-chess:pulls', approvedAt: at, approvedBy: 'github_authenticated_api', observedAt: at,
    })
    const report = buildTrendWorkRelevanceReport([product, github], '2026-10-12T16:00:00.000Z')
    const complete = report.candidates[0]
    const incomplete = {
      ...complete,
      source_receipt_ids: [github.receipt_id],
      work_receipt_ids: [github.receipt_id],
      receipt_lineage: complete.receipt_lineage.filter((receipt) => receipt.receipt_id === github.receipt_id),
    }
    const tamperedLineage = {
      ...complete,
      receipt_lineage: complete.receipt_lineage.map((receipt, index) => (
        index === 0 ? { ...receipt, provenance: 'unverified:replacement' } : receipt
      )),
    }

    expect(topicCandidateFromTrendWorkJoin(incomplete, [github])).toBeNull()
    expect(topicCandidateFromTrendWorkJoin(tamperedLineage, [product, github])).toBeNull()
  })
})
