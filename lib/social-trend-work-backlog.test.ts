import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/llm-dispatch', () => ({ generateJsonCompletion: vi.fn() }))
vi.mock('@/lib/agent-work-items', () => ({ createAgentWorkItem: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn() } }))

import { topicCandidateFromTrendWorkJoin } from './social-topic-backlog'
import { buildApprovedSourceProjection } from './social-topic-source-receipts'
import { buildApprovedPublicMomentumProjection, buildTrendWorkRelevanceReport } from './social-trend-work-join'

const at = '2026-10-12T12:00:00.000Z'

describe('trend/work topic backlog projection', () => {
  it('promotes a joined receipt set into the existing review-only candidate contract', () => {
    const momentum = buildApprovedPublicMomentumProjection({
      sourceId: 'jev-news', momentumKind: 'public_news', productIdentity: 'jev', label: 'Jev',
      approvedSummary: 'Approved public momentum around governed capability analysis.',
      canonicalUrl: 'https://news.example.com/jev', publisher: 'Fixture publisher', topicIdentities: ['governed capability analysis'],
      approvedAt: at, approvedBy: 'reviewer', observedAt: at,
    })
    const analysis = buildApprovedSourceProjection({
      sourceGroup: 'codex_insights', sourceKind: 'open_brain_conversation_proposal', sourceId: 'jev-analysis', productIdentity: 'jev',
      lifecycleStage: 'insight', label: 'Jev', approvedSummary: 'Approved Jev capability analysis.', privacyClassification: 'public_safe',
      provenance: 'fixture:jev-analysis', approvedAt: at, approvedBy: 'reviewer', observedAt: at,
      metadata: { topic_identities: ['governed_capability_analysis'] },
    })
    const report = buildTrendWorkRelevanceReport([momentum, analysis], '2026-10-12T16:00:00.000Z')

    expect(topicCandidateFromTrendWorkJoin(report.candidates[0], [momentum, analysis])).toMatchObject({
      source_type: 'public_momentum',
      product_ids: ['jev'],
      source_receipts: expect.arrayContaining([
        expect.objectContaining({ source_kind: 'public_news', raw_content_included: false }),
        expect.objectContaining({ source_kind: 'open_brain_conversation_proposal', raw_content_included: false }),
      ]),
    })
  })
})
