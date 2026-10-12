import type { SocialTopicLiveCoverage } from '@/lib/social-topic-source-coverage'
import { buildApprovedSourceProjection } from '@/lib/social-topic-source-receipts'
import {
  buildApprovedPublicMomentumProjection,
  buildTrendWorkRelevanceReport,
} from '@/lib/social-trend-work-join'
import { SOCIAL_CANDIDATE_PROJECTION_QA_FIXTURE } from '@/lib/social-candidate-projection-qa-contract'

export { SOCIAL_CANDIDATE_PROJECTION_QA_FIXTURE }

const GENERATED_AT = '2026-10-12T18:00:00.000Z'
const EXPIRES_AT = '2026-10-22T18:00:00.000Z'

export function socialCandidateProjectionQaFixtureEnabled() {
  if (process.env.VERCEL_ENV === 'production') return false

  return process.env.SOCIAL_CANDIDATE_PROJECTION_QA_FIXTURE === 'true'
    || process.env.VERCEL_ENV === 'preview'
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test'
}

export function buildSocialCandidateProjectionQaFixture(): SocialTopicLiveCoverage {
  const jevMomentum = buildApprovedPublicMomentumProjection({
    sourceId: 'qa:jev-public-momentum',
    momentumKind: 'public_news',
    productIdentity: 'jev',
    label: 'Jev',
    approvedSummary: 'Synthetic public coverage shows material attention around governed agent capability analysis.',
    canonicalUrl: 'https://example.com/qa/jev-governed-capability',
    publisher: 'Synthetic public-news fixture',
    topicIdentities: ['governed_agent_capability'],
    entityIdentities: ['jev'],
    coverageIdentity: 'jev-governed-agent-capability',
    sentiment: 'positive',
    contextSummary: 'Synthetic, attributable public-news context for testing the exact Jev identity join.',
    relevanceScore: 0.94,
    publicAttentionScore: 0.86,
    materiality: 'material',
    evidenceState: 'corroborated',
    publishedAt: '2026-10-12T15:00:00.000Z',
    expiresAt: EXPIRES_AT,
    approvedAt: GENERATED_AT,
    approvedBy: 'synthetic-qa-reviewer',
    observedAt: GENERATED_AT,
  })
  const jevRepository = buildApprovedSourceProjection({
    sourceGroup: 'repository_documents',
    sourceKind: 'approved_repository_implementation',
    sourceId: 'qa:jev-repository-evidence',
    productIdentity: 'jev',
    lifecycleStage: 'in_development',
    label: 'Jev',
    approvedSummary: 'Synthetic repository evidence documents a privacy-safe governed capability analysis implementation.',
    privacyClassification: 'public_safe',
    provenance: 'synthetic_qa:repository:jev',
    approvedAt: GENERATED_AT,
    approvedBy: 'synthetic-qa-reviewer',
    observedAt: GENERATED_AT,
    evidenceUrl: 'https://github.com/example/jev',
    metadata: { topic_identities: ['governed_agent_capability'] },
  })
  const darkCastleCatalog = buildApprovedSourceProjection({
    sourceGroup: 'app_prototypes',
    sourceKind: 'app_prototype',
    sourceId: 'qa:dark-castle-catalog',
    productIdentity: 'dark_castle_chess',
    lifecycleStage: 'preview_deployed',
    label: 'Dark Castle Chess',
    approvedSummary: 'Synthetic product receipt binds Dark Castle Chess to its canonical app identity.',
    privacyClassification: 'public_safe',
    provenance: 'synthetic_qa:catalog:dark_castle_chess',
    approvedAt: GENERATED_AT,
    approvedBy: 'synthetic-qa-reviewer',
    observedAt: GENERATED_AT,
    metadata: { topic_identities: ['learning_mode_chess'] },
  })
  const darkCastleGitHub = buildApprovedSourceProjection({
    sourceGroup: 'github_development',
    sourceKind: 'github_pull_request_activity',
    sourceId: 'qa:dark-castle-github',
    productIdentity: 'dark_castle_chess',
    lifecycleStage: 'in_development',
    label: 'Dark Castle Chess',
    approvedSummary: 'Synthetic read-only GitHub activity shows current work on learning-mode clarity.',
    privacyClassification: 'public_safe',
    provenance: 'synthetic_qa:github:dark_castle_chess',
    approvedAt: GENERATED_AT,
    approvedBy: 'synthetic-qa-reviewer',
    observedAt: GENERATED_AT,
    evidenceUrl: 'https://github.com/example/dark-castle-chess/pull/1',
    metadata: { topic_identities: ['learning_mode_chess'] },
  })
  const agenticMomentum = buildApprovedPublicMomentumProjection({
    sourceId: 'qa:agentic-work-momentum',
    momentumKind: 'social_trend',
    productIdentity: 'public_agentic_work_theme',
    label: 'Public agentic-work discussion',
    approvedSummary: 'Synthetic social momentum shows material public attention around accountable agentic work.',
    canonicalUrl: 'https://example.com/qa/agentic-work-momentum',
    publisher: 'Synthetic social-momentum fixture',
    topicIdentities: ['accountable_agentic_work'],
    entityIdentities: ['agentic_work_community'],
    coverageIdentity: 'accountable-agentic-work-discussion',
    sentiment: 'mixed',
    contextSummary: 'Synthetic public discussion includes both optimism and governance concerns without alleging wrongdoing.',
    relevanceScore: 0.91,
    publicAttentionScore: 0.89,
    materiality: 'material',
    evidenceState: 'corroborated',
    publishedAt: '2026-10-12T14:00:00.000Z',
    expiresAt: EXPIRES_AT,
    approvedAt: GENERATED_AT,
    approvedBy: 'synthetic-qa-reviewer',
    observedAt: GENERATED_AT,
  })
  const agentifiedCapability = buildApprovedSourceProjection({
    sourceGroup: 'public_catalog',
    sourceKind: 'amadutown_book',
    sourceId: 'qa:agentified-owned-capability',
    productIdentity: 'agentified',
    lifecycleStage: 'publicly_cataloged',
    label: 'Agentified',
    approvedSummary: 'Synthetic public-safe catalog evidence connects Agentified to accountable agentic work.',
    privacyClassification: 'public_safe',
    provenance: 'synthetic_qa:public_catalog:agentified',
    approvedAt: GENERATED_AT,
    approvedBy: 'synthetic-qa-reviewer',
    observedAt: GENERATED_AT,
    evidenceUrl: 'https://example.com/qa/agentified',
    metadata: { topic_identities: ['accountable_agentic_work'] },
  })
  const incompletePolicySignal = buildApprovedPublicMomentumProjection({
    sourceId: 'qa:policy-watch-incomplete',
    momentumKind: 'public_news',
    productIdentity: 'policy_watch',
    label: 'AI policy watch',
    approvedSummary: 'Synthetic public reporting identifies a material AI policy development, but no owned-work receipt is attached.',
    canonicalUrl: 'https://example.com/qa/ai-policy-watch',
    publisher: 'Synthetic policy-news fixture',
    topicIdentities: ['frontier_ai_policy'],
    entityIdentities: ['policy_watch'],
    coverageIdentity: 'frontier-ai-policy-watch',
    sentiment: 'mixed',
    contextSummary: 'Synthetic source context is attributable, but the candidate policy intentionally lacks required owned-work evidence.',
    relevanceScore: 0.8,
    publicAttentionScore: 0.78,
    materiality: 'material',
    evidenceState: 'attributable_single_source',
    publishedAt: '2026-10-12T13:00:00.000Z',
    expiresAt: EXPIRES_AT,
    approvedAt: GENERATED_AT,
    approvedBy: 'synthetic-qa-reviewer',
    observedAt: GENERATED_AT,
  })
  const receipts = [
    jevMomentum,
    jevRepository,
    darkCastleCatalog,
    darkCastleGitHub,
    agenticMomentum,
    agentifiedCapability,
    incompletePolicySignal,
  ]
  const trendWorkRelevance = buildTrendWorkRelevanceReport(receipts, GENERATED_AT)
  const policyBlocker = trendWorkRelevance.blockers.find((blocker) => blocker.includes('candidate_receipt_policy_incomplete'))
    ?? '[candidate_receipt_policy_incomplete:public_momentum_repository_v1:policy_watch:repository_evidence] Approve matching owned-work evidence before candidate projection.'

  return {
    version: 'social_topic_live_coverage_v1',
    generated_at: GENERATED_AT,
    status: 'blocked',
    review_only: true,
    source_policy: 'approved_privacy_safe_summaries_and_operational_receipts_only',
    sources: [
      { key: 'public_momentum', label: 'Approved public news + social trends', status: 'ready', freshness: 'fresh', last_successful_scan: GENERATED_AT, scanned_at: GENERATED_AT, receipt_count: 3, product_count: 3, collector_failure: null, recovery_action: 'Synthetic fixture only. Review the exact public-signal receipts; no collector runs from this route.' },
      { key: 'repository_documents', label: 'Approved Portfolio repository evidence', status: 'ready', freshness: 'fresh', last_successful_scan: GENERATED_AT, scanned_at: GENERATED_AT, receipt_count: 1, product_count: 1, collector_failure: null, recovery_action: 'Synthetic fixture only. No repository write or reconciliation is available.' },
      { key: 'github_development', label: 'GitHub development', status: 'ready', freshness: 'fresh', last_successful_scan: GENERATED_AT, scanned_at: GENERATED_AT, receipt_count: 1, product_count: 1, collector_failure: null, recovery_action: 'Synthetic fixture only. GitHub activity is read-only and cannot trigger external action.' },
      { key: 'public_catalog', label: 'Public catalog + site', status: 'ready', freshness: 'fresh', last_successful_scan: GENERATED_AT, scanned_at: GENERATED_AT, receipt_count: 2, product_count: 2, collector_failure: null, recovery_action: 'Synthetic fixture only. No catalog or provider mutation is available.' },
    ],
    products: [
      { product_identity: 'dark_castle_chess', label: 'Dark Castle Chess', current_stage: 'preview_deployed', stages: ['in_development', 'preview_deployed'], receipt_count: 2, source_groups: ['app_prototypes', 'github_development'], latest_evidence_at: GENERATED_AT, gaps: [], historical_gaps: [], priority: true, priority_order: 1, priority_source: 'approved_metadata' },
      { product_identity: 'agentified', label: 'Agentified', current_stage: 'publicly_cataloged', stages: ['publicly_cataloged'], receipt_count: 1, source_groups: ['public_catalog'], latest_evidence_at: GENERATED_AT, gaps: [], historical_gaps: [], priority: true, priority_order: 2, priority_source: 'approved_metadata' },
      { product_identity: 'jev', label: 'Jev', current_stage: 'in_development', stages: ['insight', 'in_development'], receipt_count: 2, source_groups: ['public_momentum', 'repository_documents'], latest_evidence_at: GENERATED_AT, gaps: [], historical_gaps: [], priority: false, priority_order: null, priority_source: null },
      { product_identity: 'policy_watch', label: 'AI policy watch', current_stage: 'insight', stages: ['insight'], receipt_count: 1, source_groups: ['public_momentum'], latest_evidence_at: GENERATED_AT, gaps: [policyBlocker], historical_gaps: [], priority: false, priority_order: null, priority_source: null },
    ],
    receipts,
    gaps: [policyBlocker],
    historical_gaps: [],
    blockers: [policyBlocker],
    boundaries: [
      'Synthetic, preview-only, read-only QA evidence. No production record is read or changed.',
      'No reconciliation, model or provider call, render, upload, schedule, publish, external send, or candidate approval is available.',
      'Public source URLs use example.com placeholders and every receipt is synthetic.',
      'Candidate cards demonstrate receipt-policy behavior only; they are not publishable copy or editorial approval.',
    ],
    trend_work_relevance: trendWorkRelevance,
  }
}
