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

export type TrendWorkBacklogCandidate = {
  candidate_key: string
  status: 'review_only'
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

const FIRSTHAND_SOURCE_GROUPS = new Set([
  'codex_insights',
  'repository_documents',
  'github_development',
  'operational_records',
  'app_prototypes',
  'public_catalog',
])

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

function matchesIdentity(momentum: SocialTopicSourceProjection, work: SocialTopicSourceProjection) {
  if (momentum.product_identity === work.product_identity) return true
  const momentumTopics = new Set(receiptTopics(momentum))
  return receiptTopics(work).some((topic) => momentumTopics.has(topic))
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
  const receipts = inputReceipts.filter(isApprovedPrivacySafeReceipt)
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
  const workReceipts = receipts.filter((receipt) => FIRSTHAND_SOURCE_GROUPS.has(receipt.source_group))
  const candidates: TrendWorkBacklogCandidate[] = []
  const blockers: string[] = []

  for (const receipt of activeMomentum) {
    const matchingWork = workReceipts.filter((work) => matchesIdentity(receipt, work))
    const firsthand = matchingWork.filter((work) => work.source_group !== 'public_catalog')
    if (firsthand.length === 0) {
      blockers.push(`[trend_work_firsthand_evidence_missing:${receipt.product_identity}] Add an approved Codex/Open Brain, GitHub, prototype, or operational receipt with the same product or topic identity.`)
      continue
    }
    const related = [...new Map(matchingWork.map((work) => [work.receipt_id, work])).values()]
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
      .slice(0, 6)
    const topics = [...new Set([...receiptTopics(receipt), ...related.flatMap(receiptTopics)])].sort()
    const sourceReceiptIds = [receipt.receipt_id, ...related.map((work) => work.receipt_id)].sort()
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
  const report = buildTrendWorkRelevanceReport([
    ...((persistedResult.data ?? []) as SocialTopicSourceProjection[]),
    ...momentumResult.projections,
    ...githubResult.projections,
    ...approvedRepositoryEvidenceProjections(generatedAt),
  ], generatedAt)
  return {
    ...report,
    blockers: [...new Set([...report.blockers, ...momentumResult.blockers, ...githubResult.blockers])],
  }
}
