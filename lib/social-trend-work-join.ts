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

export type SocialCandidateReceiptClass =
  | 'public_momentum'
  | 'repository_evidence'
  | 'product_catalog'
  | 'github_activity'

export type SocialCandidateClass =
  | 'public_momentum_repository'
  | 'active_github_product'

export type SocialCandidateReceiptPolicy = {
  policy_id: string
  version: 'social_candidate_receipt_policy_v1'
  candidate_class: SocialCandidateClass
  required_receipt_classes: SocialCandidateReceiptClass[]
  product_identity_join: 'exact'
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
  receipt_policy: SocialCandidateReceiptPolicy
  receipt_lineage: SocialCandidateReceiptLineage[]
  side_effects: {
    content_generation: false
    approval: false
    provider_call: false
    draft_creation: false
    schedule: false
    publish: false
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
  const canonicalUrl = asString(metadata.canonical_url) || asString(receipt.evidence_url)
  return canonicalUrl
    ? canonicalUrl.toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '')
    : `${receipt.source_kind}:${receipt.source_id}:${receipt.summary_sha256}`
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
}) {
  const config = SOCIAL_CANDIDATE_RECEIPT_POLICIES[input.candidateClass]
  const exactIdentityReceipts = input.receipts
    .filter(isApprovedPrivacySafeReceipt)
    .filter((receipt) => receipt.product_identity === input.productIdentity)
  const matched = new Map<SocialCandidateReceiptClass, SocialTopicSourceProjection[]>()
  for (const receipt of exactIdentityReceipts) {
    const receiptClass = socialCandidateReceiptClass(receipt)
    if (!receiptClass) continue
    matched.set(receiptClass, [...(matched.get(receiptClass) ?? []), receipt])
  }
  const missing = config.requirements.filter((requirement) => (matched.get(requirement.receipt_class) ?? []).length === 0)
  const matchedReceipts = config.required_receipt_classes
    .flatMap((receiptClass) => matched.get(receiptClass) ?? [])
    .sort((a, b) => a.receipt_id.localeCompare(b.receipt_id))
  const blockers = missing.map((requirement) => (
    `[candidate_receipt_policy_incomplete:${config.policy_id}:${input.productIdentity}:${requirement.receipt_class}] ${requirement.recovery_action}`
  ))
  return {
    status: missing.length === 0 ? 'ready' as const : 'blocked' as const,
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
  approvedAt: string
  approvedBy: string
  observedAt: string
}): SocialTopicSourceProjection {
  const url = new URL(input.canonicalUrl)
  if (url.protocol !== 'https:') throw new Error('Public momentum receipts require an HTTPS canonical URL.')
  const topics = [...new Set(input.topicIdentities.map(stableTopicIdentity).filter(Boolean))].sort()
  if (topics.length === 0) throw new Error('Public momentum receipts require at least one stable topic identity.')
  if (!input.publisher.trim()) throw new Error('Public momentum receipts require a publisher or platform label.')
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
  const activeMomentum = uniqueMomentum.filter((receipt) => momentumFreshness(receipt.observed_at, generatedAt) !== 'stale')
  const staleMomentum = uniqueMomentum.filter((receipt) => momentumFreshness(receipt.observed_at, generatedAt) === 'stale')
  const candidates: TrendWorkBacklogCandidate[] = []
  const blockers: string[] = []

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
      blockers.push(...evaluation.blockers)
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
        'Development activity does not prove deployment, customer use, or business outcomes.',
      ],
      receipt_policy: evaluation.policy,
      receipt_lineage: joinedReceipts
        .sort((a, b) => a.receipt_id.localeCompare(b.receipt_id))
        .map(receiptLineage),
      side_effects: {
        content_generation: false,
        approval: false,
        provider_call: false,
        draft_creation: false,
        schedule: false,
        publish: false,
      },
    })
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
        content_generation: false,
        approval: false,
        provider_call: false,
        draft_creation: false,
        schedule: false,
        publish: false,
      },
    })
  }

  if (uniqueMomentum.length === 0) {
    blockers.push('[approved_public_momentum_missing] Ingest an approved public-news or social-trend summary with an HTTPS source URL and stable topic/product identities.')
  }
  for (const receipt of staleMomentum) {
    blockers.push(`[public_momentum_stale:${receipt.product_identity}] Refresh or re-approve the public momentum receipt; evidence older than 30 days cannot create a timely candidate.`)
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
