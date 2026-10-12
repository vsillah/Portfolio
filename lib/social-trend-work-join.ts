import { createHash } from 'crypto'
import {
  buildApprovedSourceProjection,
  sanitizeApprovedSourceSummary,
  stableProductIdentity,
  type SocialTopicSourceProjection,
} from '@/lib/social-topic-source-receipts'
import { collectDirectGitHubActivityProjections } from '@/lib/social-github-activity'
import { approvedRepositoryEvidenceProjections } from '@/lib/social-repository-evidence'

export const PUBLIC_MOMENTUM_SOURCE_GROUP = 'public_momentum'

export type PublicMomentumKind = 'public_news' | 'social_trend'
export type TrendWorkFreshness = 'fresh' | 'aging' | 'stale'
export type PublicSignalSentiment = 'positive' | 'negative' | 'mixed'
export type PublicSignalEvidenceState = 'corroborated' | 'attributable_single_source' | 'uncertain' | 'disputed'

export type PublicSignalEvidence = {
  signal_kind: PublicMomentumKind
  coverage_identity: string
  sentiment: PublicSignalSentiment
  context_summary: string
  entity_identities: string[]
  topic_identities: string[]
  relevance_score: number
  public_attention_score: number
  materiality: 'material'
  evidence_state: Extract<PublicSignalEvidenceState, 'corroborated' | 'attributable_single_source'>
  source_url: string
  published_at: string
  observed_at: string
  expires_at: string
  provenance: string
}

export type SocialCandidateReceiptClass =
  | 'public_momentum'
  | 'repository_evidence'
  | 'product_catalog'
  | 'github_activity'
  | 'owned_capability'

export type SocialCandidateClass =
  | 'public_momentum_repository'
  | 'active_github_product'
  | 'public_theme_owned_capability'

export type SocialCandidateReceiptPolicy = {
  policy_id: string
  version: 'social_candidate_receipt_policy_v1'
  candidate_class: SocialCandidateClass
  required_receipt_classes: SocialCandidateReceiptClass[]
  product_identity_join: 'exact' | 'shared_topic_identity'
}

export type SocialCandidateConfidence = {
  score: number
  level: 'high' | 'medium'
  basis: string[]
}

export type SocialCandidateReceiptLineage = Pick<SocialTopicSourceProjection,
  | 'receipt_id'
  | 'source_group'
  | 'source_kind'
  | 'source_id'
  | 'product_identity'
  | 'lifecycle_stage'
  | 'label'
  | 'approval_status'
  | 'privacy_classification'
  | 'provenance'
  | 'evidence_url'
  | 'summary_sha256'
  | 'approved_at'
  | 'approved_by'
  | 'observed_at'
  | 'raw_content_included'
>

type SocialCandidateReceiptPolicyConfig = SocialCandidateReceiptPolicy & {
  requirements: Array<{
    receipt_class: SocialCandidateReceiptClass
    recovery_action: string
  }>
}

export const SOCIAL_CANDIDATE_RECEIPT_POLICIES: Record<SocialCandidateClass, SocialCandidateReceiptPolicyConfig> = {
  public_momentum_repository: {
    policy_id: 'public_momentum_repository_v1',
    version: 'social_candidate_receipt_policy_v1',
    candidate_class: 'public_momentum_repository',
    required_receipt_classes: ['public_momentum', 'repository_evidence'],
    product_identity_join: 'exact',
    requirements: [
      {
        receipt_class: 'public_momentum',
        recovery_action: 'Approve a fresh public-news or social-trend summary with an HTTPS source and the same stable product identity.',
      },
      {
        receipt_class: 'repository_evidence',
        recovery_action: 'Approve a repository document or implementation summary with provenance, reviewer, privacy classification, timestamp, and the same stable product identity.',
      },
    ],
  },
  active_github_product: {
    policy_id: 'active_github_product_v1',
    version: 'social_candidate_receipt_policy_v1',
    candidate_class: 'active_github_product',
    required_receipt_classes: ['product_catalog', 'github_activity'],
    product_identity_join: 'exact',
    requirements: [
      {
        receipt_class: 'product_catalog',
        recovery_action: 'Add or update the approved app/product catalog record that owns this stable product identity.',
      },
      {
        receipt_class: 'github_activity',
        recovery_action: 'Restore current read-only GitHub activity collection for the repository bound to the same stable product identity.',
      },
    ],
  },
  public_theme_owned_capability: {
    policy_id: 'public_theme_owned_capability_v1',
    version: 'social_candidate_receipt_policy_v1',
    candidate_class: 'public_theme_owned_capability',
    required_receipt_classes: ['public_momentum', 'owned_capability'],
    product_identity_join: 'shared_topic_identity',
    requirements: [
      {
        receipt_class: 'public_momentum',
        recovery_action: 'Approve a fresh public-news or social-trend summary with an HTTPS source and an explicit stable topic identity.',
      },
      {
        receipt_class: 'owned_capability',
        recovery_action: 'Approve a privacy-safe Portfolio or Open Brain capability, product, book, course-material, repository, or public-site summary with the same explicit topic identity.',
      },
    ],
  },
}

export type TrendWorkBacklogCandidate = {
  candidate_key: string
  status: 'review_only'
  candidate_class: SocialCandidateClass
  product_identity: string
  product_label: string
  topic_identities: string[]
  title: string
  triggering_event: string
  why_vambah_can_speak: string
  content_angle: string
  suggested_hook: string
  evidence_summary: string
  source_receipt_ids: string[]
  external_receipt_ids: string[]
  work_receipt_ids: string[]
  freshness: Exclude<TrendWorkFreshness, 'stale'>
  priority_score: number
  priority_reasons: string[]
  dedupe_fingerprint: string
  claim_boundaries: string[]
  theme_identity?: string
  relevant_owned_capability?: {
    product_identity: string
    label: string
    source_receipt_ids: string[]
  }
  confidence?: SocialCandidateConfidence
  actionable_next_step?: string
  public_signal?: PublicSignalEvidence
  receipt_policy: SocialCandidateReceiptPolicy
  receipt_lineage: SocialCandidateReceiptLineage[]
  side_effects: {
    reconciliation: false
    content_generation: false
    approval: false
    provider_call: false
    draft_creation: false
    media_render: false
    upload: false
    schedule: false
    publish: false
    external_send: false
  }
}

export type TrendWorkRelevanceReport = {
  version: 'trend_work_relevance_v1'
  generated_at: string
  status: 'ready' | 'blocked'
  review_only: true
  candidates: TrendWorkBacklogCandidate[]
  blockers: string[]
  source_receipt_count: number
  fresh_momentum_count: number
  stale_momentum_count: number
  deduplicated_momentum_count: number
  privacy_rejected_count: number
}

export type ApprovedMomentumCollection = {
  projections: SocialTopicSourceProjection[]
  blockers: string[]
  approved_records_scanned: number
  read_only: true
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(stableTopicIdentity)
    : []
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function stableTopicIdentity(value: string) {
  return value.toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100)
}

function receiptTopics(receipt: SocialTopicSourceProjection) {
  const metadata = asRecord(receipt.metadata)
  return [...new Set(strings(metadata.topic_identities))].sort()
}

function momentumKind(receipt: SocialTopicSourceProjection): PublicMomentumKind | null {
  const kind = asString(asRecord(receipt.metadata).momentum_kind) || receipt.source_kind
  if (kind === 'public_news' || kind === 'social_trend') return kind
  return null
}

function canonicalMomentumKey(receipt: SocialTopicSourceProjection) {
  const metadata = asRecord(receipt.metadata)
  const coverageIdentity = stableTopicIdentity(asString(metadata.coverage_identity))
  if (coverageIdentity) return `coverage:${coverageIdentity}`
  const canonicalUrl = asString(metadata.canonical_url) || asString(receipt.evidence_url)
  return canonicalUrl
    ? canonicalUrl.toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '')
    : `${receipt.source_kind}:${receipt.source_id}:${receipt.summary_sha256}`
}

function finiteScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null
}

function publicSignalEvidence(receipt: SocialTopicSourceProjection): PublicSignalEvidence | null {
  const metadata = asRecord(receipt.metadata)
  const signalKind = momentumKind(receipt)
  const coverageIdentity = stableTopicIdentity(asString(metadata.coverage_identity))
  const sentiment = asString(metadata.sentiment)
  const evidenceState = asString(metadata.evidence_state)
  const contextSummary = sanitizeApprovedSourceSummary(metadata.context_summary)
  const topicIdentities = receiptTopics(receipt)
  const entityIdentities = strings(metadata.entity_identities)
  const relevanceScore = finiteScore(metadata.relevance_score)
  const publicAttentionScore = finiteScore(metadata.public_attention_score)
  const sourceUrl = asString(metadata.canonical_url) || asString(receipt.evidence_url)
  const publishedAt = asString(metadata.published_at)
  const expiresAt = asString(metadata.expires_at)
  if (
    !signalKind
    || !coverageIdentity
    || !['positive', 'negative', 'mixed'].includes(sentiment)
    || !['corroborated', 'attributable_single_source'].includes(evidenceState)
    || !contextSummary
    || topicIdentities.length === 0
    || entityIdentities.length === 0
    || relevanceScore === null
    || publicAttentionScore === null
    || metadata.materiality !== 'material'
    || !sourceUrl.startsWith('https://')
    || !Number.isFinite(Date.parse(publishedAt))
    || !Number.isFinite(Date.parse(receipt.observed_at))
    || !Number.isFinite(Date.parse(expiresAt))
  ) return null
  return {
    signal_kind: signalKind,
    coverage_identity: coverageIdentity,
    sentiment: sentiment as PublicSignalSentiment,
    context_summary: contextSummary,
    entity_identities: entityIdentities,
    topic_identities: topicIdentities,
    relevance_score: relevanceScore,
    public_attention_score: publicAttentionScore,
    materiality: 'material',
    evidence_state: evidenceState as PublicSignalEvidence['evidence_state'],
    source_url: sourceUrl,
    published_at: publishedAt,
    observed_at: receipt.observed_at,
    expires_at: expiresAt,
    provenance: receipt.provenance,
  }
}

function assessPublicSignal(receipt: SocialTopicSourceProjection, generatedAt: string) {
  const metadata = asRecord(receipt.metadata)
  const blockers: string[] = []
  const evidence = publicSignalEvidence(receipt)
  const coverageIdentity = stableTopicIdentity(asString(metadata.coverage_identity)) || receipt.source_id
  const evidenceState = asString(metadata.evidence_state)
  const relevanceScore = finiteScore(metadata.relevance_score)
  const publicAttentionScore = finiteScore(metadata.public_attention_score)
  const expiresAt = asString(metadata.expires_at)
  if (!evidence) {
    blockers.push(`[public_signal_evidence_incomplete:${coverageIdentity}] Approve an attributable public signal with source URL, published/observed/expiry times, topic and entity identities, sentiment context, materiality, relevance, public attention, evidence state, and provenance.`)
  }
  if (evidenceState === 'uncertain' || evidenceState === 'disputed') {
    blockers.push(`[public_signal_${evidenceState}:${coverageIdentity}] Resolve or explicitly bound the public-source disagreement before projecting an editorial opportunity.`)
  }
  if (relevanceScore !== null && relevanceScore < 0.65) {
    blockers.push(`[public_signal_low_relevance:${coverageIdentity}] The approved signal is below the 0.65 relevance threshold and cannot create a candidate.`)
  }
  if (publicAttentionScore !== null && publicAttentionScore < 0.65) {
    blockers.push(`[public_signal_insufficient_attention:${coverageIdentity}] Public attention is below the 0.65 threshold; keep the signal visible as insufficient rather than inferring momentum.`)
  }
  if (metadata.materiality !== 'material') {
    blockers.push(`[public_signal_not_material:${coverageIdentity}] The approved signal is ambient or noisy rather than a material development.`)
  }
  if (Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) < Date.parse(generatedAt)) {
    blockers.push(`[public_signal_stale:${coverageIdentity}] Refresh or re-approve the signal; its explicit freshness window has expired.`)
  }
  if (momentumFreshness(receipt.observed_at, generatedAt) === 'stale') {
    blockers.push(`[public_momentum_stale:${receipt.product_identity}] Refresh or re-approve the public momentum receipt; evidence older than 30 days cannot create a timely candidate.`)
  }
  return {
    status: evidence && blockers.length === 0 ? 'ready' as const : 'blocked' as const,
    evidence,
    blockers,
  }
}

export function momentumFreshness(observedAt: string, generatedAt: string): TrendWorkFreshness {
  const age = Date.parse(generatedAt) - Date.parse(observedAt)
  if (!Number.isFinite(age) || age < 0) return 'fresh'
  if (age <= 7 * 24 * 60 * 60 * 1000) return 'fresh'
  if (age <= 30 * 24 * 60 * 60 * 1000) return 'aging'
  return 'stale'
}

function isApprovedPrivacySafeReceipt(receipt: SocialTopicSourceProjection) {
  return receipt.approval_status === 'approved'
    && receipt.raw_content_included === false
    && ['public_safe', 'client_safe_summary'].includes(receipt.privacy_classification)
    && Boolean(receipt.provenance)
    && Boolean(receipt.approved_by)
    && Number.isFinite(Date.parse(receipt.approved_at))
}

export function socialCandidateReceiptClass(receipt: SocialTopicSourceProjection): SocialCandidateReceiptClass | null {
  if (receipt.source_group === PUBLIC_MOMENTUM_SOURCE_GROUP && momentumKind(receipt)) return 'public_momentum'
  if (
    receipt.source_group === 'repository_documents'
    && ['approved_repository_document', 'approved_repository_implementation'].includes(receipt.source_kind)
  ) return 'repository_evidence'
  if (
    ['app_prototypes', 'public_catalog'].includes(receipt.source_group)
    && ['app_prototype', 'amadutown_product', 'amadutown_book', 'amadutown_site_material'].includes(receipt.source_kind)
  ) return 'product_catalog'
  if (
    receipt.source_group === 'github_development'
    && (receipt.source_kind === 'agent_work_item_github' || receipt.source_kind.startsWith('github_'))
  ) return 'github_activity'
  return null
}

function isOwnedCapabilityReceipt(receipt: SocialTopicSourceProjection) {
  return (
    receipt.source_group === 'codex_insights'
    && receipt.source_kind === 'open_brain_conversation_proposal'
  ) || (
    receipt.source_group === 'owned_media_summaries'
    && receipt.source_kind === 'owned_media_summary'
  ) || (
    ['app_prototypes', 'public_catalog', 'amadutown_catalog'].includes(receipt.source_group)
    && [
      'app_prototype',
      'amadutown_product',
      'amadutown_book',
      'amadutown_course_material',
      'approved_course_material',
      'course_material',
      'amadutown_site_material',
    ].includes(receipt.source_kind)
  ) || (
    receipt.source_group === 'repository_documents'
    && ['approved_repository_document', 'approved_repository_implementation'].includes(receipt.source_kind)
  )
}

function receiptMatchesClass(receipt: SocialTopicSourceProjection, receiptClass: SocialCandidateReceiptClass) {
  return receiptClass === 'owned_capability'
    ? isOwnedCapabilityReceipt(receipt)
    : socialCandidateReceiptClass(receipt) === receiptClass
}

function receiptPolicy(config: SocialCandidateReceiptPolicyConfig): SocialCandidateReceiptPolicy {
  return {
    policy_id: config.policy_id,
    version: config.version,
    candidate_class: config.candidate_class,
    required_receipt_classes: [...config.required_receipt_classes],
    product_identity_join: config.product_identity_join,
  }
}

function receiptLineage(receipt: SocialTopicSourceProjection): SocialCandidateReceiptLineage {
  return {
    receipt_id: receipt.receipt_id,
    source_group: receipt.source_group,
    source_kind: receipt.source_kind,
    source_id: receipt.source_id,
    product_identity: receipt.product_identity,
    lifecycle_stage: receipt.lifecycle_stage,
    label: receipt.label,
    approval_status: receipt.approval_status,
    privacy_classification: receipt.privacy_classification,
    provenance: receipt.provenance,
    evidence_url: receipt.evidence_url,
    summary_sha256: receipt.summary_sha256,
    approved_at: receipt.approved_at,
    approved_by: receipt.approved_by,
    observed_at: receipt.observed_at,
    raw_content_included: receipt.raw_content_included,
  }
}

export function evaluateSocialCandidateReceiptPolicy(input: {
  candidateClass: SocialCandidateClass
  productIdentity: string
  receipts: SocialTopicSourceProjection[]
  themeIdentity?: string
}) {
  const config = SOCIAL_CANDIDATE_RECEIPT_POLICIES[input.candidateClass]
  const themeIdentity = stableTopicIdentity(input.themeIdentity ?? '')
  const eligibleReceipts = input.receipts.filter(isApprovedPrivacySafeReceipt)
  const matched = new Map<SocialCandidateReceiptClass, SocialTopicSourceProjection[]>()
  for (const receiptClass of config.required_receipt_classes) {
    const matches = eligibleReceipts.filter((receipt) => {
      if (!receiptMatchesClass(receipt, receiptClass)) return false
      if (config.product_identity_join === 'exact') return receipt.product_identity === input.productIdentity
      if (!themeIdentity || !receiptTopics(receipt).includes(themeIdentity)) return false
      return receiptClass === 'public_momentum' || receipt.product_identity === input.productIdentity
    })
    if (matches.length > 0) matched.set(receiptClass, matches)
  }
  const missingThemeIdentity = config.product_identity_join === 'shared_topic_identity' && !themeIdentity
  const missing = config.requirements.filter((requirement) => (matched.get(requirement.receipt_class) ?? []).length === 0)
  const matchedReceipts = config.required_receipt_classes
    .flatMap((receiptClass) => matched.get(receiptClass) ?? [])
    .sort((a, b) => a.receipt_id.localeCompare(b.receipt_id))
  const blockers = missing.map((requirement) => (
    `[candidate_receipt_policy_incomplete:${config.policy_id}:${input.productIdentity}:${requirement.receipt_class}] ${requirement.recovery_action}`
  ))
  if (missingThemeIdentity) {
    blockers.unshift(`[candidate_theme_identity_missing:${config.policy_id}:${input.productIdentity}] Add the same explicit stable topic identity to the approved public signal and owned-capability receipts.`)
  }
  return {
    status: missing.length === 0 && !missingThemeIdentity ? 'ready' as const : 'blocked' as const,
    policy: receiptPolicy(config),
    matched_receipts: matchedReceipts,
    receipt_lineage: matchedReceipts.map(receiptLineage),
    blockers,
  }
}

function productLabel(receipts: SocialTopicSourceProjection[], productIdentity: string) {
  return receipts.find((receipt) => receipt.product_identity === productIdentity && receipt.label)?.label
    || productIdentity.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function buildApprovedPublicMomentumProjection(input: {
  sourceId: string
  momentumKind: PublicMomentumKind
  productIdentity: string
  label: string
  approvedSummary: string
  canonicalUrl: string
  publisher: string
  topicIdentities: string[]
  entityIdentities: string[]
  coverageIdentity: string
  sentiment: PublicSignalSentiment
  contextSummary: string
  relevanceScore: number
  publicAttentionScore: number
  materiality: 'material' | 'ambient' | 'noisy'
  evidenceState: PublicSignalEvidenceState
  publishedAt: string
  expiresAt: string
  approvedAt: string
  approvedBy: string
  observedAt: string
}): SocialTopicSourceProjection {
  const url = new URL(input.canonicalUrl)
  if (url.protocol !== 'https:') throw new Error('Public momentum receipts require an HTTPS canonical URL.')
  const topics = [...new Set(input.topicIdentities.map(stableTopicIdentity).filter(Boolean))].sort()
  const entities = [...new Set(input.entityIdentities.map(stableTopicIdentity).filter(Boolean))].sort()
  if (topics.length === 0) throw new Error('Public momentum receipts require at least one stable topic identity.')
  if (entities.length === 0) throw new Error('Public momentum receipts require at least one stable entity identity.')
  if (!input.publisher.trim()) throw new Error('Public momentum receipts require a publisher or platform label.')
  if (!stableTopicIdentity(input.coverageIdentity)) throw new Error('Public momentum receipts require a stable recurring coverage identity.')
  if (!['positive', 'negative', 'mixed'].includes(input.sentiment)) throw new Error('Public momentum receipts require an explicit sentiment classification.')
  if (!sanitizeApprovedSourceSummary(input.contextSummary)) throw new Error('Public momentum receipts require approved sentiment and source context.')
  if (finiteScore(input.relevanceScore) === null || finiteScore(input.publicAttentionScore) === null) {
    throw new Error('Public momentum relevance and public-attention scores must be between 0 and 1.')
  }
  if (!['material', 'ambient', 'noisy'].includes(input.materiality)) throw new Error('Public momentum receipts require an explicit materiality classification.')
  if (!['corroborated', 'attributable_single_source', 'uncertain', 'disputed'].includes(input.evidenceState)) {
    throw new Error('Public momentum receipts require an explicit evidence state.')
  }
  if (!Number.isFinite(Date.parse(input.publishedAt)) || !Number.isFinite(Date.parse(input.observedAt)) || !Number.isFinite(Date.parse(input.expiresAt))) {
    throw new Error('Public momentum receipts require valid publication, observation, and expiry timestamps.')
  }
  return buildApprovedSourceProjection({
    sourceGroup: PUBLIC_MOMENTUM_SOURCE_GROUP,
    sourceKind: input.momentumKind,
    sourceId: input.sourceId,
    productIdentity: stableProductIdentity(input.productIdentity, input.label),
    lifecycleStage: 'insight',
    label: input.label,
    approvedSummary: input.approvedSummary,
    privacyClassification: 'public_safe',
    provenance: `approved_public_momentum:${input.momentumKind}:${url.hostname}:${input.sourceId}`,
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    observedAt: input.observedAt,
    evidenceUrl: url.toString(),
    metadata: {
      signal_class: 'external_momentum',
      momentum_kind: input.momentumKind,
      canonical_url: url.toString(),
      publisher: input.publisher.trim(),
      topic_identities: topics,
      entity_identities: entities,
      coverage_identity: stableTopicIdentity(input.coverageIdentity),
      sentiment: input.sentiment,
      context_summary: sanitizeApprovedSourceSummary(input.contextSummary),
      relevance_score: input.relevanceScore,
      public_attention_score: input.publicAttentionScore,
      materiality: input.materiality,
      evidence_state: input.evidenceState,
      published_at: input.publishedAt,
      expires_at: input.expiresAt,
      ingestion_boundary: 'approved_public_summary_only',
    },
  })
}

export function approvedPublicMomentumProjectionsFromResearchPackets(rows: Record<string, unknown>[]): ApprovedMomentumCollection {
  const projections: SocialTopicSourceProjection[] = []
  const blockers: string[] = []
  let approvedRecordsScanned = 0
  for (const row of rows) {
    if (row.status !== 'approved') continue
    approvedRecordsScanned += 1
    const actorMetadata = asRecord(row.actor_metadata)
    const patternPacket = asRecord(row.pattern_packet)
    const receipt = Object.keys(asRecord(actorMetadata.topic_momentum_receipt)).length > 0
      ? asRecord(actorMetadata.topic_momentum_receipt)
      : asRecord(patternPacket.topic_momentum_receipt)
    if (Object.keys(receipt).length === 0) continue
    const operatorReview = asRecord(actorMetadata.operator_review)
    const sourceId = asString(row.id)
    const momentum = momentumKind({ source_kind: asString(receipt.momentum_kind), metadata: receipt } as SocialTopicSourceProjection)
    const approvedSummary = asString(receipt.approved_summary)
    const productIdentity = stableProductIdentity(receipt.product_identity, receipt.product_label)
    const topicIdentities = strings(receipt.topic_identities)
    const sourceUrl = asString(row.source_url)
    const approvedAt = asString(receipt.approved_at) || asString(operatorReview.reviewed_at)
    const approvedBy = asString(receipt.approved_by) || asString(operatorReview.reviewed_by)
    const isApproved = receipt.approval_status === 'approved'
      && receipt.raw_content_included === false
      && receipt.privacy_classification === 'public_safe'
      && operatorReview.decision === 'approved'
    if (!sourceId || !momentum || !approvedSummary || productIdentity === 'unassigned_product' || topicIdentities.length === 0 || !sourceUrl || !approvedAt || !approvedBy || !isApproved) {
      blockers.push(`[public_momentum_receipt_invalid:${sourceId || 'unknown'}] Approved research records require an explicit public-safe momentum receipt, operator approval, stable product/topic identities, summary, reviewer, timestamp, and HTTPS source.`)
      continue
    }
    try {
      projections.push(buildApprovedPublicMomentumProjection({
        sourceId: `research_packet:${sourceId}`,
        momentumKind: momentum,
        productIdentity,
        label: asString(receipt.product_label) || asString(row.title) || productIdentity.replace(/_/g, ' '),
        approvedSummary,
        canonicalUrl: sourceUrl,
        publisher: asString(receipt.publisher) || asString(row.platform) || 'Approved public source',
        topicIdentities,
        entityIdentities: strings(receipt.entity_identities),
        coverageIdentity: asString(receipt.coverage_identity),
        sentiment: asString(receipt.sentiment) as PublicSignalSentiment,
        contextSummary: asString(receipt.context_summary),
        relevanceScore: typeof receipt.relevance_score === 'number' ? receipt.relevance_score : Number.NaN,
        publicAttentionScore: typeof receipt.public_attention_score === 'number' ? receipt.public_attention_score : Number.NaN,
        materiality: asString(receipt.materiality) as 'material' | 'ambient' | 'noisy',
        evidenceState: asString(receipt.evidence_state) as PublicSignalEvidenceState,
        publishedAt: asString(receipt.published_at),
        expiresAt: asString(receipt.expires_at),
        approvedAt,
        approvedBy,
        observedAt: asString(receipt.observed_at) || asString(row.retrieved_at) || asString(row.updated_at) || approvedAt,
      }))
    } catch (error) {
      blockers.push(`[public_momentum_projection_failed:${sourceId}] ${error instanceof Error ? error.message : 'Approved public momentum projection failed.'}`)
    }
  }
  return { projections, blockers, approved_records_scanned: approvedRecordsScanned, read_only: true }
}

export async function collectApprovedPublicMomentumProjections(): Promise<ApprovedMomentumCollection> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const { data, error } = await supabaseAdmin
    .from('social_content_research_packets')
    .select('id, source_url, platform, title, pattern_packet, actor_metadata, privacy_notes, retrieved_at, updated_at, status')
    .eq('status', 'approved')
    .order('retrieved_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(`approved_public_source_read_failed:${error.message}`)
  return approvedPublicMomentumProjectionsFromResearchPackets((data ?? []) as Record<string, unknown>[])
}

export function buildTrendWorkRelevanceReport(
  inputReceipts: SocialTopicSourceProjection[],
  generatedAt: string,
): TrendWorkRelevanceReport {
  const privacyRejected = inputReceipts.filter((receipt) => !isApprovedPrivacySafeReceipt(receipt))
  const receipts = [...new Map(
    inputReceipts
      .filter(isApprovedPrivacySafeReceipt)
      .map((receipt) => [receipt.receipt_id, receipt]),
  ).values()]
  const momentum = receipts.filter((receipt) => receipt.source_group === PUBLIC_MOMENTUM_SOURCE_GROUP && momentumKind(receipt))
  const dedupedMomentum = new Map<string, SocialTopicSourceProjection>()
  for (const receipt of momentum) {
    const key = canonicalMomentumKey(receipt)
    const existing = dedupedMomentum.get(key)
    if (!existing || receipt.observed_at > existing.observed_at) dedupedMomentum.set(key, receipt)
  }
  const uniqueMomentum = [...dedupedMomentum.values()]
  const momentumAssessments = new Map(uniqueMomentum.map((receipt) => [
    receipt.receipt_id,
    assessPublicSignal(receipt, generatedAt),
  ]))
  const activeMomentum = uniqueMomentum.filter((receipt) => momentumAssessments.get(receipt.receipt_id)?.status === 'ready')
  const staleMomentum = uniqueMomentum.filter((receipt) => (
    momentumAssessments.get(receipt.receipt_id)?.blockers.some((blocker) => blocker.startsWith('[public_signal_stale:') || blocker.startsWith('[public_momentum_stale:'))
  ))
  const candidates: TrendWorkBacklogCandidate[] = []
  const blockers: string[] = uniqueMomentum.flatMap((receipt) => momentumAssessments.get(receipt.receipt_id)?.blockers ?? [])
  const unmatchedMomentumBlockers = new Map<string, string[]>()
  const matchedMomentumReceiptIds = new Set<string>()

  for (const receipt of activeMomentum) {
    const evaluation = evaluateSocialCandidateReceiptPolicy({
      candidateClass: 'public_momentum_repository',
      productIdentity: receipt.product_identity,
      receipts: [
        receipt,
        ...receipts.filter((candidate) => (
          candidate.product_identity === receipt.product_identity
          && socialCandidateReceiptClass(candidate) === 'repository_evidence'
        )),
      ],
    })
    if (evaluation.status !== 'ready') {
      unmatchedMomentumBlockers.set(receipt.receipt_id, evaluation.blockers)
      continue
    }
    const related = evaluation.matched_receipts
      .filter((candidate) => socialCandidateReceiptClass(candidate) === 'repository_evidence')
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
      .slice(0, 6)
    const topics = [...new Set([...receiptTopics(receipt), ...related.flatMap(receiptTopics)])].sort()
    const joinedReceipts = [receipt, ...related]
    const sourceReceiptIds = joinedReceipts.map((candidate) => candidate.receipt_id).sort()
    const fingerprint = sha256(JSON.stringify({
      product_identity: receipt.product_identity,
      topic_identities: topics,
      momentum_key: canonicalMomentumKey(receipt),
      work_receipt_ids: related.map((work) => work.receipt_id).sort(),
    }))
    const freshness = momentumFreshness(receipt.observed_at, generatedAt) as Exclude<TrendWorkFreshness, 'stale'>
    const publicSignal = momentumAssessments.get(receipt.receipt_id)?.evidence
    if (!publicSignal) continue
    const label = productLabel([receipt, ...related], receipt.product_identity)
    const sourceGroups = [...new Set(related.map((work) => work.source_group))]
    const score = Math.min(100, 62 + (freshness === 'fresh' ? 12 : 5) + Math.min(18, sourceGroups.length * 6) + Math.min(8, topics.length * 2))
    candidates.push({
      candidate_key: `trend-work:${fingerprint.slice(0, 40)}`,
      status: 'review_only',
      candidate_class: 'public_momentum_repository',
      product_identity: receipt.product_identity,
      product_label: label,
      topic_identities: topics,
      title: `${label}: where current momentum meets demonstrated work`,
      triggering_event: sanitizeApprovedSourceSummary(receipt.approved_summary),
      why_vambah_can_speak: `${related.length} approved firsthand Portfolio receipt${related.length === 1 ? '' : 's'} connect this public signal to ${label}.`,
      content_angle: `Review the intersection between the current public signal and the operating choices, capabilities, or shipped work already documented for ${label}.`,
      suggested_hook: `The signal around ${topics[0]?.replace(/_/g, ' ') || label} is moving. The useful question is what the work already teaches us.`,
      evidence_summary: related.map((work) => sanitizeApprovedSourceSummary(work.approved_summary)).join(' '),
      source_receipt_ids: sourceReceiptIds,
      external_receipt_ids: [receipt.receipt_id],
      work_receipt_ids: related.map((work) => work.receipt_id).sort(),
      freshness,
      priority_score: score,
      priority_reasons: [
        `${freshness === 'fresh' ? 'Current' : 'Recent'} approved public momentum`,
        `${sourceGroups.length} firsthand evidence source group${sourceGroups.length === 1 ? '' : 's'}`,
        `Stable product identity: ${receipt.product_identity}`,
        ...(topics.length > 0 ? [`Stable topic identities: ${topics.join(', ')}`] : []),
      ],
      dedupe_fingerprint: fingerprint,
      claim_boundaries: [
        'Use only approved public summaries and privacy-safe Portfolio receipts.',
        'Verify time-sensitive facts at editorial review before drafting.',
        ...(publicSignal.sentiment === 'negative'
          ? ['A negative news cycle supports a critical or cautionary angle only; it does not establish wrongdoing or verify disputed claims.']
          : []),
        'Development activity does not prove deployment, customer use, or business outcomes.',
      ],
      public_signal: publicSignal,
      receipt_policy: evaluation.policy,
      receipt_lineage: joinedReceipts
        .sort((a, b) => a.receipt_id.localeCompare(b.receipt_id))
        .map(receiptLineage),
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
    matchedMomentumReceiptIds.add(receipt.receipt_id)
  }

  for (const receipt of activeMomentum) {
    const exactPolicyReady = evaluateSocialCandidateReceiptPolicy({
      candidateClass: 'public_momentum_repository',
      productIdentity: receipt.product_identity,
      receipts,
    }).status === 'ready'
    const activeProductPolicyReady = evaluateSocialCandidateReceiptPolicy({
      candidateClass: 'active_github_product',
      productIdentity: receipt.product_identity,
      receipts,
    }).status === 'ready'
    for (const themeIdentity of receiptTopics(receipt)) {
      const matchingOwnedReceipts = receipts.filter((candidate) => (
        candidate.receipt_id !== receipt.receipt_id
        && isOwnedCapabilityReceipt(candidate)
        && receiptTopics(candidate).includes(themeIdentity)
      ))
      const ownedProductIdentities = [...new Set(matchingOwnedReceipts.map((candidate) => candidate.product_identity))].sort()
      if (ownedProductIdentities.length === 0) {
        if (!exactPolicyReady && !activeProductPolicyReady) {
          blockers.push(`[thematic_owned_capability_missing:${themeIdentity}] Approve a privacy-safe Portfolio or Open Brain capability, product, book, course-material, repository, or public-site summary with the same explicit topic identity.`)
        }
        continue
      }
      for (const productIdentity of ownedProductIdentities) {
        if ((exactPolicyReady || activeProductPolicyReady) && productIdentity === receipt.product_identity) continue
        const related = matchingOwnedReceipts
          .filter((candidate) => candidate.product_identity === productIdentity)
          .sort((a, b) => b.observed_at.localeCompare(a.observed_at) || a.receipt_id.localeCompare(b.receipt_id))
          .slice(0, 6)
        const evaluation = evaluateSocialCandidateReceiptPolicy({
          candidateClass: 'public_theme_owned_capability',
          productIdentity,
          themeIdentity,
          receipts: [receipt, ...related],
        })
        if (evaluation.status !== 'ready') {
          blockers.push(...evaluation.blockers)
          continue
        }
        const freshness = momentumFreshness(receipt.observed_at, generatedAt) as Exclude<TrendWorkFreshness, 'stale'>
        const publicSignal = momentumAssessments.get(receipt.receipt_id)?.evidence
        if (!publicSignal) continue
        const label = productLabel(related, productIdentity)
        const workReceiptIds = related.map((candidate) => candidate.receipt_id).sort()
        const sourceReceiptIds = evaluation.matched_receipts.map((candidate) => candidate.receipt_id).sort()
        const fingerprint = sha256(JSON.stringify({
          candidate_kind: 'public_theme_owned_capability',
          theme_identity: themeIdentity,
          momentum_key: canonicalMomentumKey(receipt),
          product_identity: productIdentity,
          work_receipt_ids: workReceiptIds,
        }))
        const confidenceScore = Math.min(0.96, 0.82 + (freshness === 'fresh' ? 0.06 : 0) + Math.min(0.08, (related.length - 1) * 0.04))
        const confidence: SocialCandidateConfidence = {
          score: Number(confidenceScore.toFixed(2)),
          level: confidenceScore >= 0.9 ? 'high' : 'medium',
          basis: [
            `Exact shared topic identity: ${themeIdentity}`,
            `${freshness === 'fresh' ? 'Fresh' : 'Recent'} approved public momentum receipt`,
            `${related.length} approved privacy-safe owned-capability receipt${related.length === 1 ? '' : 's'}`,
          ],
        }
        candidates.push({
          candidate_key: `thematic-opportunity:${fingerprint.slice(0, 40)}`,
          status: 'review_only',
          candidate_class: 'public_theme_owned_capability',
          product_identity: productIdentity,
          product_label: label,
          topic_identities: [themeIdentity],
          title: `${label}: a ${themeIdentity.replace(/_/g, ' ')} opportunity to review`,
          triggering_event: sanitizeApprovedSourceSummary(receipt.approved_summary),
          why_vambah_can_speak: `${related.length} approved privacy-safe owned-capability receipt${related.length === 1 ? '' : 's'} connect the ${themeIdentity.replace(/_/g, ' ')} trend to ${label}.`,
          content_angle: publicSignal.sentiment === 'negative'
            ? `Review a critical or cautionary ${label} angle on the ${themeIdentity.replace(/_/g, ' ')} development without treating public reporting as proof of wrongdoing or repeating unverified claims.`
            : `Review whether the external ${themeIdentity.replace(/_/g, ' ')} pattern creates a useful, evidence-bound angle for ${label}.`,
          suggested_hook: `The ${themeIdentity.replace(/_/g, ' ')} pattern is moving. The practical question is what ${label} already knows or can teach about it.`,
          evidence_summary: `${sanitizeApprovedSourceSummary(receipt.approved_summary)} ${related.map((candidate) => sanitizeApprovedSourceSummary(candidate.approved_summary)).join(' ')}`,
          source_receipt_ids: sourceReceiptIds,
          external_receipt_ids: [receipt.receipt_id],
          work_receipt_ids: workReceiptIds,
          freshness,
          priority_score: Math.min(100, 68 + (freshness === 'fresh' ? 10 : 4) + Math.min(12, related.length * 4)),
          priority_reasons: [
            `${freshness === 'fresh' ? 'Current' : 'Recent'} approved public thematic momentum`,
            `Exact shared topic identity: ${themeIdentity}`,
            `${related.length} approved owned-capability receipt${related.length === 1 ? '' : 's'}`,
            `Stable owned capability identity: ${productIdentity}`,
          ],
          dedupe_fingerprint: fingerprint,
          claim_boundaries: [
            'Use only approved public summaries and privacy-safe derived Portfolio or Open Brain receipts.',
            'Never ingest, quote, or expose raw private conversations, transcripts, notes, or source material.',
            ...(publicSignal.sentiment === 'negative'
              ? ['A negative news cycle supports a critical or cautionary perspective only; never assume wrongdoing or repeat unverified claims.']
              : []),
            'Verify the thematic pattern and owned capability during editorial review before any copy is drafted.',
          ],
          theme_identity: themeIdentity,
          relevant_owned_capability: {
            product_identity: productIdentity,
            label,
            source_receipt_ids: workReceiptIds,
          },
          confidence,
          actionable_next_step: `Review the exact receipts and decide whether ${themeIdentity.replace(/_/g, ' ')} should become a bounded ${label} content brief. No copy or downstream action is created automatically.`,
          public_signal: publicSignal,
          receipt_policy: evaluation.policy,
          receipt_lineage: evaluation.receipt_lineage,
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
        matchedMomentumReceiptIds.add(receipt.receipt_id)
      }
    }
  }

  for (const receipt of activeMomentum) {
    if (!matchedMomentumReceiptIds.has(receipt.receipt_id)) {
      blockers.push(...(unmatchedMomentumBlockers.get(receipt.receipt_id) ?? []))
    }
  }

  const currentGitHub = receipts.filter((receipt) => (
    receipt.source_group === 'github_development'
    && socialCandidateReceiptClass(receipt) === 'github_activity'
    && momentumFreshness(receipt.observed_at, generatedAt) !== 'stale'
  ))
  const githubProducts = [...new Set(currentGitHub.map((receipt) => receipt.product_identity))].sort()
  for (const productIdentity of githubProducts) {
    const related = currentGitHub
      .filter((receipt) => receipt.product_identity === productIdentity)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at) || a.receipt_id.localeCompare(b.receipt_id))
      .slice(0, 6)
    const catalog = receipts
      .filter((receipt) => (
        receipt.product_identity === productIdentity
        && socialCandidateReceiptClass(receipt) === 'product_catalog'
      ))
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at) || a.receipt_id.localeCompare(b.receipt_id))
      .slice(0, 1)
    const evaluation = evaluateSocialCandidateReceiptPolicy({
      candidateClass: 'active_github_product',
      productIdentity,
      receipts: [...catalog, ...related],
    })
    if (evaluation.status !== 'ready') {
      blockers.push(...evaluation.blockers)
      continue
    }
    const latest = related[0]
    const freshness = momentumFreshness(latest.observed_at, generatedAt) as Exclude<TrendWorkFreshness, 'stale'>
    const topics = [...new Set([...catalog, ...related].flatMap(receiptTopics))].sort()
    const sourceReceiptIds = evaluation.matched_receipts.map((receipt) => receipt.receipt_id).sort()
    const githubReceiptIds = related.map((receipt) => receipt.receipt_id).sort()
    const fingerprint = sha256(JSON.stringify({
      candidate_kind: 'active_github_work',
      product_identity: productIdentity,
      source_receipt_ids: githubReceiptIds,
    }))
    const label = productLabel(related, productIdentity)
    candidates.push({
      candidate_key: `active-work:${fingerprint.slice(0, 40)}`,
      status: 'review_only',
      candidate_class: 'active_github_product',
      product_identity: productIdentity,
      product_label: label,
      topic_identities: topics,
      title: `${label}: what the current build is teaching us`,
      triggering_event: sanitizeApprovedSourceSummary(latest.approved_summary),
      why_vambah_can_speak: `${related.length} current read-only GitHub receipt${related.length === 1 ? '' : 's'} connect active development to the Portfolio product identity for ${label}.`,
      content_angle: `Review the concrete product and operating lessons visible in the current ${label} build activity without implying deployment, adoption, or outcomes.`,
      suggested_hook: `${label} is still being built. The useful story is what the latest implementation decisions are teaching us.`,
      evidence_summary: related.map((receipt) => sanitizeApprovedSourceSummary(receipt.approved_summary)).join(' '),
      source_receipt_ids: sourceReceiptIds,
      external_receipt_ids: [],
      work_receipt_ids: sourceReceiptIds,
      freshness,
      priority_score: freshness === 'fresh' ? 82 : 72,
      priority_reasons: [
        `${freshness === 'fresh' ? 'Current' : 'Recent'} direct GitHub activity`,
        `Unambiguous Portfolio product binding: ${productIdentity}`,
        `${githubReceiptIds.length} privacy-safe development receipt${githubReceiptIds.length === 1 ? '' : 's'}`,
        `${catalog.length} approved app/product catalog receipt${catalog.length === 1 ? '' : 's'}`,
      ],
      dedupe_fingerprint: fingerprint,
      claim_boundaries: [
        'Use only privacy-safe GitHub activity summaries and the stable Portfolio product identity.',
        'Development activity does not prove deployment, customer use, adoption, or business outcomes.',
        'Verify the specific implementation lesson during editorial review before drafting.',
      ],
      receipt_policy: evaluation.policy,
      receipt_lineage: evaluation.receipt_lineage,
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
  }

  if (uniqueMomentum.length === 0) {
    blockers.push('[approved_public_momentum_missing] Ingest an approved public-news or social-trend summary with an HTTPS source URL and stable topic/product identities.')
  }
  return {
    version: 'trend_work_relevance_v1',
    generated_at: generatedAt,
    status: candidates.length > 0 ? 'ready' : 'blocked',
    review_only: true,
    candidates: candidates.sort((a, b) => b.priority_score - a.priority_score || a.dedupe_fingerprint.localeCompare(b.dedupe_fingerprint)),
    blockers: [...new Set(blockers)],
    source_receipt_count: receipts.length,
    fresh_momentum_count: activeMomentum.filter((receipt) => momentumFreshness(receipt.observed_at, generatedAt) === 'fresh').length,
    stale_momentum_count: staleMomentum.length,
    deduplicated_momentum_count: momentum.length - uniqueMomentum.length,
    privacy_rejected_count: privacyRejected.length,
  }
}

export function sourceReceiptsForTrendWorkCandidates(
  candidates: TrendWorkBacklogCandidate[],
  receipts: SocialTopicSourceProjection[],
) {
  const candidateReceiptIds = new Set(candidates.flatMap((candidate) => candidate.source_receipt_ids))
  return [...new Map(
    receipts
      .filter((receipt) => candidateReceiptIds.has(receipt.receipt_id))
      .map((receipt) => [receipt.receipt_id, receipt]),
  ).values()]
}

export async function collectApprovedTrendWorkRelevance(generatedAt = new Date().toISOString()) {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const [persistedResult, momentumResult, githubResult] = await Promise.all([
    supabaseAdmin
      .from('social_topic_source_receipts')
      .select('*')
      .eq('approval_status', 'approved')
      .eq('raw_content_included', false)
      .order('observed_at', { ascending: false })
      .limit(500),
    collectApprovedPublicMomentumProjections(),
    collectDirectGitHubActivityProjections({ generatedAt }),
  ])
  if (persistedResult.error) throw new Error(`trend_work_receipt_read_failed:${persistedResult.error.message}`)
  const sourceReceipts = [
    ...((persistedResult.data ?? []) as SocialTopicSourceProjection[]),
    ...momentumResult.projections,
    ...githubResult.projections,
    ...approvedRepositoryEvidenceProjections(generatedAt),
  ]
  const report = buildTrendWorkRelevanceReport(sourceReceipts, generatedAt)
  return {
    ...report,
    blockers: [...new Set([...report.blockers, ...momentumResult.blockers, ...githubResult.blockers])],
    source_receipts: sourceReceiptsForTrendWorkCandidates(report.candidates, sourceReceipts),
  }
}
