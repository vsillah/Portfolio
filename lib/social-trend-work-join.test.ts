import { describe, expect, it } from 'vitest'
import { buildApprovedSourceProjection, type SocialTopicSourceProjection } from './social-topic-source-receipts'
import {
  approvedPublicMomentumProjectionsFromResearchPackets,
  buildApprovedPublicMomentumProjection,
  buildTrendWorkRelevanceReport,
  sourceReceiptsForTrendWorkCandidates,
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

function momentum(input: {
  sourceId: string
  productIdentity: string
  label: string
  summary: string
  topics: string[]
  url: string
  observedAt?: string
  publishedAt?: string
  expiresAt?: string
  sentiment?: 'positive' | 'negative' | 'mixed'
  contextSummary?: string
  relevanceScore?: number
  publicAttentionScore?: number
  materiality?: 'material' | 'ambient' | 'noisy'
  evidenceState?: 'corroborated' | 'attributable_single_source' | 'uncertain' | 'disputed'
  entities?: string[]
  coverageIdentity?: string
  momentumKind?: 'public_news' | 'social_trend'
}) {
  return buildApprovedPublicMomentumProjection({
    sourceId: input.sourceId,
    momentumKind: input.momentumKind ?? 'public_news',
    productIdentity: input.productIdentity,
    label: input.label,
    approvedSummary: input.summary,
    canonicalUrl: input.url,
    publisher: 'Public fixture publisher',
    topicIdentities: input.topics,
    entityIdentities: input.entities ?? [input.productIdentity],
    coverageIdentity: input.coverageIdentity ?? `${new URL(input.url).hostname}${new URL(input.url).pathname}`,
    sentiment: input.sentiment ?? 'positive',
    contextSummary: input.contextSummary ?? 'Approved attributable public context shows a material development with visible attention.',
    relevanceScore: input.relevanceScore ?? 0.9,
    publicAttentionScore: input.publicAttentionScore ?? 0.85,
    materiality: input.materiality ?? 'material',
    evidenceState: input.evidenceState ?? 'corroborated',
    publishedAt: input.publishedAt ?? input.observedAt ?? approvedAt,
    expiresAt: input.expiresAt ?? '2026-10-26T12:00:00.000Z',
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
          entity_identities: ['jev'], coverage_identity: 'jev-governed-capability-news', sentiment: 'positive',
          context_summary: 'Approved attributable reporting shows material attention around governed capability analysis.',
          relevance_score: 0.9, public_attention_score: 0.82, materiality: 'material', evidence_state: 'corroborated',
          published_at: approvedAt, observed_at: approvedAt, expires_at: '2026-10-26T12:00:00.000Z',
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
        sourceGroup: 'repository_documents', sourceKind: 'approved_repository_document', sourceId: 'jev-capability-analysis',
        productIdentity: 'jev', label: 'Jev', summary: 'Approved Jev capability analysis documents the operating constraints and tested capabilities.',
        topics: ['governed capability analysis'],
      }),
      workReceipt({
        sourceGroup: 'repository_documents', sourceKind: 'approved_repository_implementation', sourceId: 'jev-portfolio-implementation',
        productIdentity: 'jev', label: 'Jev', summary: 'The approved Portfolio implementation records the bounded Jev evaluation harness.',
        topics: ['governed capability analysis'],
      }),
    ]

    const report = buildTrendWorkRelevanceReport(receipts, generatedAt)
    expect(report.status).toBe('ready')
    expect(report.candidates).toHaveLength(1)
    expect(report.candidates[0]).toMatchObject({
      product_identity: 'jev',
      candidate_class: 'public_momentum_repository',
      status: 'review_only',
      freshness: 'fresh',
      receipt_policy: {
        policy_id: 'public_momentum_repository_v1',
        required_receipt_classes: ['public_momentum', 'repository_evidence'],
        product_identity_join: 'exact',
      },
      side_effects: {
        reconciliation: false,
        content_generation: false,
        approval: false,
        provider_call: false,
        draft_creation: false,
        media_render: false,
        upload: false,
        schedule: false,
        publish: false,
        external_send: false,
      },
    })
    expect(report.candidates[0].source_receipt_ids).toHaveLength(3)
    expect(report.candidates[0].receipt_lineage.map((receipt) => receipt.receipt_id).sort())
      .toEqual([...report.candidates[0].source_receipt_ids].sort())
    expect(report.candidates[0].why_vambah_can_speak).toContain('2 approved firsthand Portfolio receipts')
  })

  it('keeps every joined candidate receipt available for durable backlog projection', () => {
    const external = momentum({
      sourceId: 'jev-public-momentum', productIdentity: 'jev', label: 'Jev',
      summary: 'Approved Jev momentum.', topics: ['governed capability analysis'], url: 'https://news.example.com/jev',
    })
    const analysis = workReceipt({
      sourceGroup: 'repository_documents', sourceKind: 'approved_repository_document', sourceId: 'jev-analysis',
      productIdentity: 'jev', label: 'Jev', summary: 'Approved Jev capability analysis.', topics: ['governed capability analysis'],
    })
    const darkCastle = workReceipt({
      sourceGroup: 'github_development', sourceKind: 'github_pull_request_activity', sourceId: 'dark-castle-prs',
      productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess', summary: 'Current Dark Castle pull-request activity.',
      topics: ['chess product development'], metadata: { portfolio_product_id: 'dark-castle-product' },
    })
    const darkCastleProduct = workReceipt({
      sourceGroup: 'app_prototypes', sourceKind: 'app_prototype', sourceId: 'dark-castle-product',
      productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess', summary: 'The approved app record establishes the Dark Castle Chess product identity.',
      topics: ['chess product development'],
    })
    const report = buildTrendWorkRelevanceReport([external, analysis, darkCastleProduct, darkCastle], generatedAt)
    const candidateReceiptIds = new Set(
      sourceReceiptsForTrendWorkCandidates(report.candidates, [external, analysis, darkCastleProduct, darkCastle])
        .map((receipt) => receipt.receipt_id),
    )

    expect(candidateReceiptIds).toEqual(new Set([
      external.receipt_id,
      analysis.receipt_id,
      darkCastleProduct.receipt_id,
      darkCastle.receipt_id,
    ]))
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
    expect(candidate.candidate_class).toBe('active_github_product')
    expect(candidate.work_receipt_ids).toHaveLength(2)
    expect(candidate.claim_boundaries).toContain('Development activity does not prove deployment, customer use, adoption, or business outcomes.')
  })

  it('creates a Dark Castle active-work candidate from a bound Portfolio identity and current GitHub activity without public momentum', () => {
    const product = workReceipt({
      sourceGroup: 'app_prototypes', sourceKind: 'app_prototype', sourceId: 'dark-castle-product',
      productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess', summary: 'The approved app record establishes the Dark Castle Chess product identity.',
      topics: ['chess product development'],
    })
    const github = workReceipt({
      sourceGroup: 'github_development', sourceKind: 'github_pull_request_activity', sourceId: 'dark-castle-current-prs',
      productIdentity: 'dark_castle_chess', label: 'Dark Castle Chess', summary: 'Dark Castle Chess has current pull-request activity.',
      topics: ['chess product development'], metadata: { portfolio_product_id: 'dark-castle-product' },
    })

    const report = buildTrendWorkRelevanceReport([product, github], generatedAt)

    expect(report.status).toBe('ready')
    expect(report.candidates).toHaveLength(1)
    expect(report.candidates[0]).toMatchObject({
      product_identity: 'dark_castle_chess',
      candidate_class: 'active_github_product',
      external_receipt_ids: [],
      work_receipt_ids: expect.arrayContaining([product.receipt_id, github.receipt_id]),
      freshness: 'fresh',
      status: 'review_only',
      receipt_policy: {
        policy_id: 'active_github_product_v1',
        required_receipt_classes: ['product_catalog', 'github_activity'],
        product_identity_join: 'exact',
      },
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
    expect(report.blockers).toContain('[candidate_receipt_policy_incomplete:active_github_product_v1:unbound_product:product_catalog] Add or update the approved app/product catalog record that owns this stable product identity.')
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
      sourceGroup: 'repository_documents', sourceKind: 'approved_repository_document', sourceId: 'approved-analysis',
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
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('candidate_receipt_policy_incomplete:public_momentum_repository_v1:jev:repository_evidence'),
    ]))
    expect(report.blockers).toContain('[thematic_owned_capability_missing:capability] Approve a privacy-safe Portfolio or Open Brain capability, product, book, course-material, repository, or public-site summary with the same explicit topic identity.')
  })

  it('keeps the direct product join exact while allowing an explicit cross-product thematic match', () => {
    const report = buildTrendWorkRelevanceReport([
      momentum({
        sourceId: 'jev-momentum', productIdentity: 'jev', label: 'Jev', summary: 'Approved Jev momentum.',
        topics: ['governed capability analysis'], url: 'https://news.example.com/jev-exact-identity',
      }),
      workReceipt({
        sourceGroup: 'repository_documents', sourceKind: 'approved_repository_document', sourceId: 'other-product-analysis',
        productIdentity: 'another_product', label: 'Another product', summary: 'A repository document uses the same topic words.',
        topics: ['governed capability analysis'],
      }),
    ], generatedAt)

    expect(report.candidates).toHaveLength(1)
    expect(report.candidates[0]).toMatchObject({
      candidate_class: 'public_theme_owned_capability',
      product_identity: 'another_product',
      theme_identity: 'governed_capability_analysis',
      receipt_policy: {
        policy_id: 'public_theme_owned_capability_v1',
        product_identity_join: 'shared_topic_identity',
      },
    })
    expect(report.candidates.some((candidate) => candidate.candidate_class === 'public_momentum_repository')).toBe(false)
    expect(report.blockers).not.toContain('[candidate_receipt_policy_incomplete:public_momentum_repository_v1:jev:repository_evidence] Approve a repository document or implementation summary with provenance, reviewer, privacy classification, timestamp, and the same stable product identity.')
  })

  it('creates a generic course-theme opportunity from approved public momentum and owned course evidence', () => {
    const publicTrend = momentum({
      sourceId: 'course-market-pattern', productIdentity: 'course_industry', label: 'Course industry pattern',
      summary: 'Approved public evidence shows stronger current performance for practical cohort courses.',
      topics: ['practical cohort courses'], url: 'https://news.example.com/course-pattern',
    })
    const ownedCourse = workReceipt({
      sourceGroup: 'public_catalog', sourceKind: 'amadutown_product', sourceId: 'accelerated-course',
      productIdentity: 'accelerated', label: 'Accelerated', summary: 'Accelerated is an owned practical course capability with approved public materials.',
      topics: ['practical cohort courses'],
    })
    const approvedCorpus = workReceipt({
      sourceGroup: 'codex_insights', sourceKind: 'open_brain_conversation_proposal', sourceId: 'accelerated-course-capability',
      productIdentity: 'accelerated', label: 'Accelerated', summary: 'An approved privacy-safe corpus summary documents the course operating capability without raw conversations.',
      topics: ['practical cohort courses'],
    })

    const report = buildTrendWorkRelevanceReport([publicTrend, ownedCourse, approvedCorpus], generatedAt)
    const candidate = report.candidates.find((item) => item.candidate_class === 'public_theme_owned_capability')

    expect(candidate).toMatchObject({
      product_identity: 'accelerated',
      theme_identity: 'practical_cohort_courses',
      status: 'review_only',
      relevant_owned_capability: {
        product_identity: 'accelerated',
        label: 'Accelerated',
        source_receipt_ids: expect.arrayContaining([ownedCourse.receipt_id, approvedCorpus.receipt_id]),
      },
      confidence: {
        score: 0.92,
        level: 'high',
        basis: expect.arrayContaining(['Exact shared topic identity: practical_cohort_courses']),
      },
      receipt_policy: {
        policy_id: 'public_theme_owned_capability_v1',
        required_receipt_classes: ['public_momentum', 'owned_capability'],
        product_identity_join: 'shared_topic_identity',
      },
      side_effects: {
        reconciliation: false,
        content_generation: false,
        approval: false,
        provider_call: false,
        draft_creation: false,
        media_render: false,
        upload: false,
        schedule: false,
        publish: false,
        external_send: false,
      },
    })
    expect(candidate?.source_receipt_ids).toEqual(expect.arrayContaining([
      publicTrend.receipt_id,
      ownedCourse.receipt_id,
      approvedCorpus.receipt_id,
    ]))
    expect(candidate?.actionable_next_step).toContain('Review the exact receipts')
    expect(candidate?.claim_boundaries).toContain('Never ingest, quote, or expose raw private conversations, transcripts, notes, or source material.')
  })

  it('matches qualifying public news to Agentified without vendor-specific logic', () => {
    const news = momentum({
      sourceId: 'vendor-agent-governance-news', productIdentity: 'ai_agent_industry', label: 'AI agent industry news',
      summary: 'Approved attributable reporting shows material positive attention around governed AI-agent operations.',
      topics: ['governed AI agent operations'], entities: ['named_ai_vendor', 'agentic_work'],
      coverageIdentity: 'governed-agent-operations-market-development', sentiment: 'positive',
      contextSummary: 'Multiple attributable public reports describe increased attention to governance in AI-agent operations.',
      relevanceScore: 0.94, publicAttentionScore: 0.88, evidenceState: 'corroborated',
      url: 'https://news.example.com/agent-governance-development',
    })
    const agentified = workReceipt({
      sourceGroup: 'public_catalog', sourceKind: 'amadutown_book', sourceId: 'agentified-book',
      productIdentity: 'agentified', label: 'Agentified', summary: 'Agentified is approved public work about governed agentic operating systems.',
      topics: ['governed AI agent operations'],
    })

    const report = buildTrendWorkRelevanceReport([news, agentified], generatedAt)
    const candidate = report.candidates.find((item) => item.product_identity === 'agentified')

    expect(candidate).toMatchObject({
      candidate_class: 'public_theme_owned_capability',
      product_identity: 'agentified',
      public_signal: {
        signal_kind: 'public_news',
        coverage_identity: 'governed_agent_operations_market_development',
        sentiment: 'positive',
        entity_identities: ['agentic_work', 'named_ai_vendor'],
        relevance_score: 0.94,
        public_attention_score: 0.88,
        evidence_state: 'corroborated',
      },
      relevant_owned_capability: { product_identity: 'agentified', label: 'Agentified' },
    })
    expect(candidate?.source_receipt_ids).toEqual(expect.arrayContaining([news.receipt_id, agentified.receipt_id]))
    expect(candidate?.content_angle).toContain('evidence-bound angle for Agentified')
  })

  it('qualifies attributable social momentum and deduplicates recurring coverage identity', () => {
    const current = momentum({
      sourceId: 'operator-social-pattern-current', momentumKind: 'social_trend', productIdentity: 'agentic_work_community', label: 'Agentic work community pattern',
      summary: 'Approved attributable social evidence shows material attention around human-gated agent operations.',
      topics: ['human gated agent operations'], entities: ['agentic_work_community'],
      coverageIdentity: 'human-gated-agent-operations-social-pattern', sentiment: 'positive',
      contextSummary: 'Approved public social observations show sustained attention to human gates in agent operations.',
      relevanceScore: 0.9, publicAttentionScore: 0.81, evidenceState: 'attributable_single_source',
      url: 'https://social.example.com/current-agent-operations', observedAt: '2026-10-12T12:00:00.000Z',
    })
    const duplicate = momentum({
      sourceId: 'operator-social-pattern-earlier', momentumKind: 'social_trend', productIdentity: 'agentic_work_community', label: 'Agentic work community pattern',
      summary: 'Earlier approved observation of the same recurring social pattern.', topics: ['human gated agent operations'],
      entities: ['agentic_work_community'], coverageIdentity: 'human-gated-agent-operations-social-pattern', sentiment: 'positive',
      contextSummary: 'Earlier attributable public social observation of the same pattern.', relevanceScore: 0.87, publicAttentionScore: 0.76,
      evidenceState: 'attributable_single_source', url: 'https://social.example.com/earlier-agent-operations', observedAt: '2026-10-11T12:00:00.000Z',
    })
    const ownedCapability = workReceipt({
      sourceGroup: 'codex_insights', sourceKind: 'open_brain_conversation_proposal', sourceId: 'approved-agent-ops-capability',
      productIdentity: 'portfolio_agent_ops', label: 'Portfolio Agent Ops', summary: 'An approved privacy-safe summary documents human-gated agent operations.',
      topics: ['human gated agent operations'],
    })

    const report = buildTrendWorkRelevanceReport([duplicate, current, ownedCapability], generatedAt)
    const candidate = report.candidates.find((item) => item.product_identity === 'portfolio_agent_ops')

    expect(report.deduplicated_momentum_count).toBe(1)
    expect(candidate).toMatchObject({
      candidate_class: 'public_theme_owned_capability',
      public_signal: {
        signal_kind: 'social_trend',
        coverage_identity: 'human_gated_agent_operations_social_pattern',
        evidence_state: 'attributable_single_source',
      },
    })
    expect(candidate?.external_receipt_ids).toEqual([current.receipt_id])
  })

  it('rejects stale, noisy, disputed, and insufficiently public signals with visible blockers', () => {
    const stale = momentum({
      sourceId: 'expired-agent-news', productIdentity: 'ai_agent_industry', label: 'Expired AI-agent news',
      summary: 'Approved but expired public reporting.', topics: ['agent operating practices'], entities: ['ai_agent_industry'],
      coverageIdentity: 'expired-agent-news', sentiment: 'positive', contextSummary: 'This attributable report is outside its approved freshness window.',
      relevanceScore: 0.9, publicAttentionScore: 0.8, url: 'https://news.example.com/expired-agent-news',
      observedAt: '2026-10-01T12:00:00.000Z', publishedAt: '2026-10-01T10:00:00.000Z', expiresAt: '2026-10-08T12:00:00.000Z',
    })
    const noisy = momentum({
      sourceId: 'noisy-agent-chatter', momentumKind: 'social_trend', productIdentity: 'ai_agent_industry', label: 'Noisy agent chatter',
      summary: 'Approved observation with insufficient public attention.', topics: ['agent operating practices'], entities: ['ai_agent_industry'],
      coverageIdentity: 'noisy-agent-chatter', sentiment: 'mixed', contextSummary: 'The signal is disputed and does not show material public attention.',
      relevanceScore: 0.8, publicAttentionScore: 0.3, materiality: 'noisy', evidenceState: 'disputed',
      url: 'https://social.example.com/noisy-agent-chatter',
    })
    const ownedCapability = workReceipt({
      sourceGroup: 'public_catalog', sourceKind: 'amadutown_book', sourceId: 'agentified-book', productIdentity: 'agentified', label: 'Agentified',
      summary: 'Agentified covers agent operating practices.', topics: ['agent operating practices'],
    })

    const report = buildTrendWorkRelevanceReport([stale, noisy, ownedCapability], generatedAt)

    expect(report.candidates.filter((item) => item.candidate_class === 'public_theme_owned_capability')).toEqual([])
    expect(report.stale_momentum_count).toBe(1)
    expect(report.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('public_signal_stale:expired_agent_news'),
      expect.stringContaining('public_signal_insufficient_attention:noisy_agent_chatter'),
      expect.stringContaining('public_signal_disputed:noisy_agent_chatter'),
      expect.stringContaining('public_signal_not_material:noisy_agent_chatter'),
    ]))
  })

  it('bounds a qualifying negative news cycle to a neutral critical perspective', () => {
    const negativeNews = momentum({
      sourceId: 'agent-accountability-scrutiny', productIdentity: 'ai_agent_industry', label: 'AI agent accountability reporting',
      summary: 'Approved attributable reporting describes public scrutiny of weak AI-agent accountability practices.',
      topics: ['AI agent accountability'], entities: ['named_ai_vendor', 'agentic_work'],
      coverageIdentity: 'agent-accountability-scrutiny', sentiment: 'negative',
      contextSummary: 'Corroborated public reports describe scrutiny while leaving disputed claims explicitly unverified.',
      relevanceScore: 0.92, publicAttentionScore: 0.84, evidenceState: 'corroborated',
      url: 'https://news.example.com/agent-accountability-scrutiny',
    })
    const agentified = workReceipt({
      sourceGroup: 'public_catalog', sourceKind: 'amadutown_book', sourceId: 'agentified-book', productIdentity: 'agentified', label: 'Agentified',
      summary: 'Agentified is approved public work about accountable agentic operating practices.', topics: ['AI agent accountability'],
    })

    const report = buildTrendWorkRelevanceReport([negativeNews, agentified], generatedAt)
    const candidate = report.candidates.find((item) => item.product_identity === 'agentified')

    expect(candidate?.public_signal?.sentiment).toBe('negative')
    expect(candidate?.content_angle).toContain('critical or cautionary')
    expect(candidate?.content_angle).toContain('without treating public reporting as proof of wrongdoing')
    expect(candidate?.claim_boundaries).toContain('A negative news cycle supports a critical or cautionary perspective only; never assume wrongdoing or repeat unverified claims.')
    expect(candidate?.triggering_event).toBe(negativeNews.approved_summary)
  })

  it('rejects a thematic opportunity when the owned evidence lacks the explicit shared theme', () => {
    const publicTrend = momentum({
      sourceId: 'course-market-pattern', productIdentity: 'course_industry', label: 'Course industry pattern',
      summary: 'Approved public evidence shows stronger current performance for practical cohort courses.',
      topics: ['practical cohort courses'], url: 'https://news.example.com/course-pattern',
    })
    const unrelatedCourse = workReceipt({
      sourceGroup: 'public_catalog', sourceKind: 'amadutown_product', sourceId: 'accelerated-course',
      productIdentity: 'accelerated', label: 'Accelerated', summary: 'Accelerated has an approved public catalog receipt.',
      topics: ['agentic operating systems'],
    })

    const report = buildTrendWorkRelevanceReport([publicTrend, unrelatedCourse], generatedAt)

    expect(report.candidates.filter((item) => item.candidate_class === 'public_theme_owned_capability')).toEqual([])
    expect(report.blockers).toContain('[thematic_owned_capability_missing:practical_cohort_courses] Approve a privacy-safe Portfolio or Open Brain capability, product, book, course-material, repository, or public-site summary with the same explicit topic identity.')
  })

  it('does not treat raw private corpus material as owned-capability evidence', () => {
    const publicTrend = momentum({
      sourceId: 'course-market-pattern', productIdentity: 'course_industry', label: 'Course industry pattern',
      summary: 'Approved public evidence shows stronger current performance for practical cohort courses.',
      topics: ['practical cohort courses'], url: 'https://news.example.com/course-pattern',
    })
    const rawPrivateCorpus = {
      ...workReceipt({
        sourceGroup: 'codex_insights', sourceKind: 'open_brain_conversation_proposal', sourceId: 'raw-course-conversation',
        productIdentity: 'accelerated', label: 'Accelerated', summary: 'Raw private conversation material must not qualify.',
        topics: ['practical cohort courses'],
      }),
      raw_content_included: true,
    } as unknown as SocialTopicSourceProjection

    const report = buildTrendWorkRelevanceReport([publicTrend, rawPrivateCorpus], generatedAt)

    expect(report.candidates.filter((item) => item.candidate_class === 'public_theme_owned_capability')).toEqual([])
    expect(report.privacy_rejected_count).toBe(1)
    expect(report.blockers).toContain('[thematic_owned_capability_missing:practical_cohort_courses] Approve a privacy-safe Portfolio or Open Brain capability, product, book, course-material, repository, or public-site summary with the same explicit topic identity.')
  })
})
