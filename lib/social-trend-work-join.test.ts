import { describe, expect, it } from 'vitest'
import { buildApprovedSourceProjection, type SocialTopicSourceProjection } from './social-topic-source-receipts'
import {
  approvedPublicMomentumProjectionsFromResearchPackets,
  buildApprovedPublicMomentumProjection,
  buildTrendWorkRelevanceReport,
} from './social-trend-work-join'

const generatedAt = '2026-10-12T16:00:00.000Z'
const approvedAt = '2026-10-12T12:00:00.000Z'

function workReceipt(input: {
  sourceGroup: string
  sourceKind: string
  sourceId: string
  productIdentity: string
  label: string
  summary: string
  topics: string[]
  metadata?: Record<string, unknown>
}) {
  return buildApprovedSourceProjection({
    ...input,
    lifecycleStage: input.sourceGroup === 'github_development' ? 'in_development' : 'insight',
    approvedSummary: input.summary,
    privacyClassification: 'public_safe',
    provenance: `fixture:${input.sourceGroup}:${input.sourceId}`,
    approvedAt,
    approvedBy: 'fixture-reviewer',
    observedAt: approvedAt,
    metadata: { topic_identities: input.topics, ...input.metadata },
  })
}

function momentum(input: { sourceId: string; productIdentity: string; label: string; summary: string; topics: string[]; url: string; observedAt?: string }) {
  return buildApprovedPublicMomentumProjection({
    sourceId: input.sourceId,
    momentumKind: 'public_news',
    productIdentity: input.productIdentity,
    label: input.label,
    approvedSummary: input.summary,
    canonicalUrl: input.url,
    publisher: 'Public fixture publisher',
    topicIdentities: input.topics,
    approvedAt,
    approvedBy: 'fixture-reviewer',
    observedAt: input.observedAt ?? approvedAt,
  })
}

describe('trend-to-work relevance joining', () => {
  it('ingests only explicitly approved public momentum from reviewed research records', () => {
    const collection = approvedPublicMomentumProjectionsFromResearchPackets([{
      id: 'packet-jev', status: 'approved', source_url: 'https://news.example.com/jev', platform: 'other', title: 'Jev momentum', retrieved_at: approvedAt,
      actor_metadata: {
        operator_review: { decision: 'approved', reviewed_at: approvedAt, reviewed_by: 'reviewer' },
        topic_momentum_receipt: {
          approval_status: 'approved', raw_content_included: false, privacy_classification: 'public_safe', momentum_kind: 'public_news',
          approved_summary: 'Approved public momentum around governed capability analysis.', product_identity: 'jev', product_label: 'Jev',
          topic_identities: ['governed capability analysis'], approved_at: approvedAt, approved_by: 'reviewer', publisher: 'Fixture news',
        },
      },
    }, {
      id: 'packet-raw', status: 'approved', source_url: 'https://news.example.com/raw', title: 'Raw record', caption: 'Raw source text is never admitted.',
      actor_metadata: { operator_review: { decision: 'approved' } },
    }])
    expect(collection).toMatchObject({ approved_records_scanned: 2, read_only: true, blockers: [] })
    expect(collection.projections).toHaveLength(1)
    expect(collection.projections[0]).toMatchObject({ source_group: 'public_momentum', source_kind: 'public_news', product_identity: 'jev', raw_content_included: false })
    expect(collection.projections[0].approved_summary).not.toContain('Raw source text')
  })

  it('joins Jev momentum to its approved capability analysis and Portfolio evidence', () => {
    const receipts = [
      momentum({
        sourceId: 'jev-public-momentum', productIdentity: 'jev', label: 'Jev',
        summary: 'A public-safe market signal shows increased attention on governed capability analysis.',
        topics: ['governed capability analysis'], url: 'https://news.example.com/jev-capability',
      }),
      workReceipt({
        sourceGroup: 'codex_insights', sourceKind: 'open_brain_conversation_proposal', sourceId: 'jev-capability-analysis',
        productIdentity: 'jev', label: 'Jev', summary: 'Approved Jev capability analysis documents the operating constraints and tested capabilities.',
        topics: ['governed capability analysis'],
      }),
      workReceipt({
        sourceGroup: 'public_catalog', sourceKind: 'app_prototype', sourceId: 'jev-portfolio-record',
        productIdentity: 'jev', label: 'Jev', summary: 'The approved Portfolio prototype record establishes the existing Jev product identity.',
        topics: ['governed capability analysis'],
      }),
    ]

    const report = buildTrendWorkRelevanceReport(receipts, generatedAt)
    expect(report.status).toBe('ready')
    expect(report.candidates).toHaveLength(1)
    expect(report.candidates[0]).toMatchObject({
      product_identity: 'jev',
      status: 'review_only',
      freshness: 'fresh',
      side_effects: {
        content_generation: false,
        approval: false,
        provider_call: false,
        draft_creation: false,
        schedule: false,
        publish: false,
      },
    })
    expect(report.candidates[0].source_receipt_ids).toHaveLength(3)
    expect(report.candidates[0].why_vambah_can_speak).toContain('2 approved firsthand Portfolio receipts')
  })

  it('joins Dark Castle Chess identity to current GitHub development activity', () => {
    const receipts = [
      momentum({
        sourceId: 'chess-learning-momentum', productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess',
        summary: 'A public-safe trend receipt shows current interest in explainable chess learning tools.',
        topics: ['explainable chess learning'], url: 'https://social.example.com/trends/chess-learning',
      }),
      workReceipt({
        sourceGroup: 'public_catalog', sourceKind: 'app_prototype', sourceId: 'dark-castle-product',
        productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess', summary: 'The approved Portfolio record establishes the Dark Castle Chess product identity.',
        topics: ['explainable chess learning'],
      }),
      workReceipt({
        sourceGroup: 'github_development', sourceKind: 'agent_work_item_github', sourceId: 'dark-castle-pr-181',
        productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess', summary: 'A privacy-safe GitHub receipt records current development activity without claiming deployment.',
        topics: ['explainable chess learning'],
      }),
    ]

    const report = buildTrendWorkRelevanceReport(receipts, generatedAt)
    const candidate = report.candidates[0]
    expect(candidate.product_identity).toBe('dark_castle_chess')
    expect(candidate.work_receipt_ids).toHaveLength(2)
    expect(candidate.claim_boundaries).toContain('Development activity does not prove deployment, customer use, or business outcomes.')
  })

  it('creates a Dark Castle active-work candidate from a bound Portfolio identity and current GitHub activity without public momentum', () => {
    const github = workReceipt({
      sourceGroup: 'github_development', sourceKind: 'github_pull_request_activity', sourceId: 'dark-castle-current-prs',
      productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess', summary: 'Dark Castle Chess has current pull-request activity.',
      topics: ['chess product development'], metadata: { portfolio_product_id: 'dark-castle-product' },
    })

    const report = buildTrendWorkRelevanceReport([github], generatedAt)

    expect(report.status).toBe('ready')
    expect(report.candidates).toHaveLength(1)
    expect(report.candidates[0]).toMatchObject({
      product_identity: 'dark_castle_chess',
      external_receipt_ids: [],
      work_receipt_ids: [github.receipt_id],
      freshness: 'fresh',
      status: 'review_only',
    })
    expect(report.candidates[0].title).toContain('current build')
  })

  it('fails closed when current GitHub activity is not bound to a Portfolio product', () => {
    const github = workReceipt({
      sourceGroup: 'github_development', sourceKind: 'github_repository_activity', sourceId: 'unbound-repository',
      productIdentity: 'unbound_product', label: 'Unbound product', summary: 'A repository has current activity.',
      topics: ['product development'],
    })

    const report = buildTrendWorkRelevanceReport([github], generatedAt)

    expect(report.candidates).toEqual([])
    expect(report.blockers).toContain('[github_product_identity_unbound:unbound_product] Link the GitHub repository to an unambiguous Portfolio product before creating an active-work candidate.')
  })

  it('deduplicates canonical momentum, rejects private receipts, and blocks stale signals', () => {
    const fresh = momentum({
      sourceId: 'signal-new', productIdentity: 'jev', label: 'Jev', summary: 'Approved current summary.',
      topics: ['capability'], url: 'https://news.example.com/signal?tracking=1',
    })
    const duplicate = momentum({
      sourceId: 'signal-old', productIdentity: 'jev', label: 'Jev', summary: 'Earlier approved summary.',
      topics: ['capability'], url: 'https://news.example.com/signal#share', observedAt: '2026-10-11T12:00:00.000Z',
    })
    const stale = momentum({
      sourceId: 'signal-stale', productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess', summary: 'Old public summary.',
      topics: ['chess'], url: 'https://news.example.com/old-signal', observedAt: '2026-08-01T12:00:00.000Z',
    })
    const privateReceipt = {
      ...workReceipt({
        sourceGroup: 'codex_insights', sourceKind: 'open_brain_conversation_proposal', sourceId: 'private-analysis',
        productIdentity: 'jev', label: 'Jev', summary: 'This receipt must be rejected.', topics: ['capability'],
      }),
      raw_content_included: true,
    } as unknown as SocialTopicSourceProjection
    const approvedWork = workReceipt({
      sourceGroup: 'codex_insights', sourceKind: 'open_brain_conversation_proposal', sourceId: 'approved-analysis',
      productIdentity: 'jev', label: 'Jev', summary: 'Approved capability analysis.', topics: ['capability'],
    })

    const report = buildTrendWorkRelevanceReport([fresh, duplicate, stale, privateReceipt, approvedWork], generatedAt)
    expect(report.candidates).toHaveLength(1)
    expect(report.deduplicated_momentum_count).toBe(1)
    expect(report.stale_momentum_count).toBe(1)
    expect(report.privacy_rejected_count).toBe(1)
    expect(report.blockers).toContain('[public_momentum_stale:dark_castle_chess] Refresh or re-approve the public momentum receipt; evidence older than 30 days cannot create a timely candidate.')
  })

  it('fails closed when momentum lacks matching firsthand work', () => {
    const report = buildTrendWorkRelevanceReport([
      momentum({
        sourceId: 'unmatched', productIdentity: 'jev', label: 'Jev', summary: 'Approved public signal.',
        topics: ['capability'], url: 'https://news.example.com/unmatched',
      }),
    ], generatedAt)
    expect(report.status).toBe('blocked')
    expect(report.candidates).toEqual([])
    expect(report.blockers[0]).toContain('trend_work_firsthand_evidence_missing:jev')
  })
})
