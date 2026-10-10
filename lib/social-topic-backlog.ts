import { createHash } from 'crypto'
import { generateJsonCompletion } from '@/lib/llm-dispatch'
import { createAgentWorkItem } from '@/lib/agent-work-items'
import {
  defaultSocialChannelLanes,
  socialInsightMetadataFromCandidate,
  socialTopicBacklogItemFromWorkItem,
  SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE,
} from '@/lib/social-content-intelligence'
import { supabaseAdmin } from '@/lib/supabase'

export type SourceType =
  | 'meeting'
  | 'shipped_feature'
  | 'client_safe_project'
  | 'chronicle_observation'
  | 'chatgpt_session'
  | 'open_brain'
  | 'portfolio_work'

export type TopicSensitivity = 'public_safe' | 'client_safe_summary' | 'needs_review'

export const REQUIRED_SOCIAL_TOPIC_PRODUCTS = [
  'dark_castle_chess',
  'accelerated',
  'agentified',
] as const

export type RequiredSocialTopicProduct = typeof REQUIRED_SOCIAL_TOPIC_PRODUCTS[number]

export type SocialTopicSourceKind =
  | 'open_brain_conversation_proposal'
  | 'meeting_summary'
  | 'owned_media_summary'
  | 'app_prototype'
  | 'amadutown_product'
  | 'amadutown_book'
  | 'amadutown_site_material'
  | 'existing_social_content'
  | 'agent_run_summary'
  | 'client_project_summary'

export type SocialTopicSourceReceipt = {
  receipt_id: string
  source_id: string
  source_kind: SocialTopicSourceKind
  approval_status: 'approved'
  approved_at: string
  approved_by: string
  privacy_classification: Extract<TopicSensitivity, 'public_safe' | 'client_safe_summary'>
  provenance: string
  summary_sha256: string
  product_ids: RequiredSocialTopicProduct[]
  raw_content_included: false
}

export type ProductCoverageReceipt = {
  product_id: RequiredSocialTopicProduct
  label: string
  status: 'ready' | 'blocked'
  receipt_ids: string[]
  source_ids: string[]
  blocker: string | null
}

export type SocialTopicSourceGroup =
  | 'open_brain'
  | 'meeting_summaries'
  | 'owned_media_summaries'
  | 'app_prototypes'
  | 'amadutown_catalog'

export type SourceCollectionReceipt = {
  source_group: SocialTopicSourceGroup
  status: 'ready' | 'blocked'
  receipt_count: number
  blocker: string | null
}

export type SocialTopicCoverageReport = {
  version: 'social_topic_source_coverage_v1'
  status: 'ready' | 'blocked'
  generated_at: string
  source_receipt_count: number
  source_kind_counts: Partial<Record<SocialTopicSourceKind, number>>
  source_collections: SourceCollectionReceipt[]
  products: ProductCoverageReceipt[]
  blockers: string[]
}

export type SocialContentTopicContext = {
  id: string
  status: string
  post_text: string | null
  cta_text: string | null
  hashtags: string[] | null
  image_prompt: string | null
  topic_extracted: unknown
  hormozi_framework: unknown
  rag_context: Record<string, unknown> | null
}

export type SourceSignal = {
  id: string
  type: SourceType
  kind: SocialTopicSourceKind
  label: string
  summary: string
  date?: string | null
  sensitivity: TopicSensitivity
  receipt: SocialTopicSourceReceipt
  product_ids: RequiredSocialTopicProduct[]
}

export type TopicTriggerCandidate = {
  id: string
  title: string
  triggering_event: string
  source_type: SourceType
  source_label: string
  source_ids: string[]
  why_vambah_can_speak: string
  brand_goal: string
  content_angle: string
  suggested_hook: string
  audience: string
  sensitivity: TopicSensitivity
  evidence_summary: string
  claim_boundaries: string[]
  source_receipts: SocialTopicSourceReceipt[]
  product_ids: RequiredSocialTopicProduct[]
  priority_score: number
  priority_tier: 'high' | 'medium' | 'low'
  priority_reasons: string[]
  dedupe_fingerprint: string
}

type DiscoveryResponse = {
  candidates?: unknown
  notes?: unknown
}

export type TopicTriggerPacket = {
  version: 'social_topic_trigger_discovery_v2'
  status: 'review_ready'
  generated_at: string
  generated_by: string | null
  model: string
  provider: string
  source_policy: 'sanitized_summaries_only'
  source_counts: Record<SourceType, number>
  source_receipts: SocialTopicSourceReceipt[]
  coverage_report: SocialTopicCoverageReport
  candidates: TopicTriggerCandidate[]
  notes: string[]
  privacy_boundary: string
}

export class SocialTopicCoverageError extends Error {
  coverageReport: SocialTopicCoverageReport

  constructor(coverageReport: SocialTopicCoverageReport) {
    super(coverageReport.blockers.join(' '))
    this.name = 'SocialTopicCoverageError'
    this.coverageReport = coverageReport
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function truncate(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 3).trim()}...`
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone redacted]')
    .replace(/https?:\/\/[^\s]+/gi, (match) => {
      try {
        const url = new URL(match)
        return `${url.origin}/[private-path-redacted]`
      } catch {
        return '[url redacted]'
      }
    })
}

function sanitizeSummary(value: unknown, maxLength = 700): string {
  return truncate(redactSensitiveText(asString(value)), maxLength)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizeProductIds(value: unknown): RequiredSocialTopicProduct[] {
  if (!Array.isArray(value)) return []
  return REQUIRED_SOCIAL_TOPIC_PRODUCTS.filter((product) => value.includes(product))
}

function inferRequiredProducts(...values: unknown[]): RequiredSocialTopicProduct[] {
  const text = values.map((value) => asString(value)).join(' ').toLowerCase()
  return REQUIRED_SOCIAL_TOPIC_PRODUCTS.filter((product) => {
    if (product === 'dark_castle_chess') return text.includes('dark castle chess') || text.includes('dark-castle-chess')
    if (product === 'accelerated') return /\baccelerated\b/.test(text)
    return /\bagentified\b/.test(text)
  })
}

function approvedReceipt(input: {
  sourceId: string
  sourceKind: SocialTopicSourceKind
  summary: string
  privacyClassification: unknown
  provenance: unknown
  approvedAt: unknown
  approvedBy: unknown
  productIds?: unknown
}): SocialTopicSourceReceipt | null {
  const privacyClassification = input.privacyClassification === 'public_safe'
    ? 'public_safe'
    : input.privacyClassification === 'client_safe' || input.privacyClassification === 'client_safe_summary'
      ? 'client_safe_summary'
      : null
  const provenance = asString(input.provenance)
  const approvedAt = asString(input.approvedAt)
  const approvedBy = asString(input.approvedBy)
  const summary = sanitizeSummary(input.summary)
  if (!summary || !privacyClassification || !provenance || !approvedAt || !approvedBy) return null
  const productIds = normalizeProductIds(input.productIds)
  return {
    receipt_id: `source-receipt:${sha256([input.sourceId, provenance, summary].join('|')).slice(0, 24)}`,
    source_id: input.sourceId,
    source_kind: input.sourceKind,
    approval_status: 'approved',
    approved_at: approvedAt,
    approved_by: approvedBy,
    privacy_classification: privacyClassification,
    provenance,
    summary_sha256: sha256(summary),
    product_ids: productIds,
    raw_content_included: false,
  }
}

function signalFromApprovedSummary(input: {
  id: string
  type: SourceType
  kind: SocialTopicSourceKind
  label: string
  summary: string
  date?: string | null
  privacyClassification: unknown
  provenance: unknown
  approvedAt: unknown
  approvedBy: unknown
  productIds?: unknown
}): SourceSignal | null {
  const summary = sanitizeSummary(input.summary)
  const inferredProducts = inferRequiredProducts(input.label, summary)
  const productIds = Array.from(new Set([
    ...normalizeProductIds(input.productIds),
    ...inferredProducts,
  ])) as RequiredSocialTopicProduct[]
  const receipt = approvedReceipt({
    sourceId: input.id,
    sourceKind: input.kind,
    summary,
    privacyClassification: input.privacyClassification,
    provenance: input.provenance,
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    productIds,
  })
  if (!receipt) return null
  return {
    id: input.id,
    type: input.type,
    kind: input.kind,
    label: truncate(input.label, 140),
    summary,
    date: input.date ?? null,
    sensitivity: receipt.privacy_classification,
    receipt,
    product_ids: productIds,
  }
}

const PRODUCT_LABELS: Record<RequiredSocialTopicProduct, string> = {
  dark_castle_chess: 'Dark Castle Chess',
  accelerated: 'Accelerated',
  agentified: 'Agentified',
}

export function buildSocialTopicCoverageReport(
  signals: SourceSignal[],
  generatedAt = new Date().toISOString(),
  sourceCollections: SourceCollectionReceipt[] = [],
): SocialTopicCoverageReport {
  const blockers = sourceCollections
    .map((collection) => collection.blocker)
    .filter((blocker): blocker is string => Boolean(blocker))
  const sourceKindCounts: Partial<Record<SocialTopicSourceKind, number>> = {}
  for (const signal of signals) {
    sourceKindCounts[signal.kind] = (sourceKindCounts[signal.kind] ?? 0) + 1
  }
  const products = REQUIRED_SOCIAL_TOPIC_PRODUCTS.map((productId): ProductCoverageReceipt => {
    const matching = signals.filter((signal) => signal.product_ids.includes(productId))
    const blocker = matching.length > 0
      ? null
      : `[product_coverage_receipt_missing:${productId}] Approve at least one privacy-safe ${PRODUCT_LABELS[productId]} summary in Open Brain, meeting records, owned-media research packets, app prototypes, products/books, or public site materials.`
    if (blocker) blockers.push(blocker)
    return {
      product_id: productId,
      label: PRODUCT_LABELS[productId],
      status: blocker ? 'blocked' : 'ready',
      receipt_ids: matching.map((signal) => signal.receipt.receipt_id).sort(),
      source_ids: matching.map((signal) => signal.id).sort(),
      blocker,
    }
  })
  if (signals.length === 0) {
    blockers.unshift('[approved_source_receipts_missing] Approve a sanitized source summary with provenance, privacy classification, reviewer, and approval timestamp before running topic discovery.')
  }
  return {
    version: 'social_topic_source_coverage_v1',
    status: blockers.length > 0 ? 'blocked' : 'ready',
    generated_at: generatedAt,
    source_receipt_count: signals.length,
    source_kind_counts: sourceKindCounts,
    source_collections: sourceCollections,
    products,
    blockers,
  }
}

function normalizeTopicSensitivity(value: unknown, fallback: TopicSensitivity): TopicSensitivity {
  if (value === 'public_safe' || value === 'client_safe_summary' || value === 'needs_review') {
    return value
  }
  return fallback
}

function normalizeSourceType(value: unknown): SourceType {
  if (
    value === 'meeting'
    || value === 'shipped_feature'
    || value === 'client_safe_project'
    || value === 'chronicle_observation'
    || value === 'chatgpt_session'
    || value === 'open_brain'
    || value === 'portfolio_work'
  ) {
    return value
  }
  return 'portfolio_work'
}

function candidateFingerprint(input: {
  title: string
  sourceIds: string[]
  productIds: RequiredSocialTopicProduct[]
}) {
  return sha256(JSON.stringify({
    title: input.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    source_ids: [...input.sourceIds].sort(),
    product_ids: [...input.productIds].sort(),
  }))
}

function candidatePriority(input: {
  receipts: SocialTopicSourceReceipt[]
  productIds: RequiredSocialTopicProduct[]
  sensitivity: TopicSensitivity
}) {
  const sourceKinds = new Set(input.receipts.map((receipt) => receipt.source_kind))
  let score = 35
  const reasons: string[] = []
  if (input.productIds.length > 0) {
    score += 25
    reasons.push(`Required product coverage: ${input.productIds.map((id) => PRODUCT_LABELS[id]).join(', ')}`)
  }
  if (input.receipts.length > 1) {
    score += Math.min(18, (input.receipts.length - 1) * 6)
    reasons.push(`${input.receipts.length} approved source receipts`)
  }
  if (sourceKinds.size > 1) {
    score += 12
    reasons.push(`${sourceKinds.size} source kinds corroborate the angle`)
  }
  if (input.sensitivity === 'public_safe') {
    score += 10
    reasons.push('Public-safe summary')
  } else {
    reasons.push('Client-safe summary requires final privacy review')
  }
  const bounded = Math.min(100, score)
  return {
    priorityScore: bounded,
    priorityTier: bounded >= 75 ? 'high' as const : bounded >= 55 ? 'medium' as const : 'low' as const,
    priorityReasons: reasons,
  }
}

export function socialTopicSourceCounts(signals: SourceSignal[]) {
  return signals.reduce<Record<SourceType, number>>((counts, signal) => {
    counts[signal.type] = (counts[signal.type] ?? 0) + 1
    return counts
  }, {
    meeting: 0,
    shipped_feature: 0,
    client_safe_project: 0,
    chronicle_observation: 0,
    chatgpt_session: 0,
    open_brain: 0,
    portfolio_work: 0,
  })
}

function normalizeCandidates(parsed: DiscoveryResponse, signals: SourceSignal[]): TopicTriggerCandidate[] {
  const sourceIdSet = new Set(signals.map((signal) => signal.id))
  const signalsById = new Map(signals.map((signal) => [signal.id, signal]))
  const seenFingerprints = new Set<string>()
  return (Array.isArray(parsed.candidates) ? parsed.candidates : [])
    .map((item, index) => {
      const record = asRecord(item)
      if (!record) return null
      const sourceType = normalizeSourceType(record.source_type)
      const sourceIds = asStringArray(record.source_ids).filter((id) => sourceIdSet.has(id)).slice(0, 6)
      if (sourceIds.length === 0) return null
      const sourceReceipts = sourceIds
        .map((id) => signalsById.get(id)?.receipt)
        .filter((receipt): receipt is SocialTopicSourceReceipt => Boolean(receipt))
      if (sourceReceipts.length !== sourceIds.length) return null
      const productIds = Array.from(new Set(sourceIds.flatMap((id) => signalsById.get(id)?.product_ids ?? []))) as RequiredSocialTopicProduct[]
      const sensitivity = sourceReceipts.some((receipt) => receipt.privacy_classification === 'client_safe_summary')
        ? 'client_safe_summary'
        : normalizeTopicSensitivity(record.sensitivity, 'public_safe')
      const title = truncate(asString(record.title), 90)
      const dedupeFingerprint = candidateFingerprint({ title, sourceIds, productIds })
      if (seenFingerprints.has(dedupeFingerprint)) return null
      seenFingerprints.add(dedupeFingerprint)
      const priority = candidatePriority({ receipts: sourceReceipts, productIds, sensitivity })
      const candidate: TopicTriggerCandidate = {
        id: asString(record.id).trim() || `topic-trigger-${index + 1}`,
        title,
        triggering_event: sanitizeSummary(record.triggering_event, 500),
        source_type: sourceType,
        source_label: truncate(asString(record.source_label), 120),
        source_ids: sourceIds,
        why_vambah_can_speak: sanitizeSummary(record.why_vambah_can_speak, 500),
        brand_goal: truncate(asString(record.brand_goal), 180),
        content_angle: sanitizeSummary(record.content_angle, 450),
        suggested_hook: sanitizeSummary(record.suggested_hook, 280),
        audience: truncate(asString(record.audience), 140),
        sensitivity,
        evidence_summary: sanitizeSummary(record.evidence_summary, 500),
        claim_boundaries: asStringArray(record.claim_boundaries).map((boundary) => truncate(boundary, 160)).slice(0, 5),
        source_receipts: sourceReceipts,
        product_ids: productIds,
        priority_score: priority.priorityScore,
        priority_tier: priority.priorityTier,
        priority_reasons: priority.priorityReasons,
        dedupe_fingerprint: dedupeFingerprint,
      }
      if (!candidate.title || !candidate.triggering_event || !candidate.why_vambah_can_speak) return null
      return candidate
    })
    .filter((item): item is TopicTriggerCandidate => Boolean(item))
    .slice(0, 8)
}

function ensureRequiredProductCandidates(
  candidates: TopicTriggerCandidate[],
  signals: SourceSignal[],
): TopicTriggerCandidate[] {
  const next = [...candidates]
  for (const productId of REQUIRED_SOCIAL_TOPIC_PRODUCTS) {
    if (next.some((candidate) => candidate.product_ids.includes(productId))) continue
    const signal = signals.find((item) => item.product_ids.includes(productId))
    if (!signal) continue
    const title = `${PRODUCT_LABELS[productId]}: the operating lesson behind the product`
    const fingerprint = candidateFingerprint({ title, sourceIds: [signal.id], productIds: [productId] })
    const priority = candidatePriority({
      receipts: [signal.receipt],
      productIds: [productId],
      sensitivity: signal.sensitivity,
    })
    next.push({
      id: `required-coverage-${productId}`,
      title,
      triggering_event: signal.summary,
      source_type: signal.type,
      source_label: signal.label,
      source_ids: [signal.id],
      why_vambah_can_speak: `This review-only angle is grounded in the approved ${signal.label} source receipt rather than inferred from private material.`,
      brand_goal: `Maintain recurring, evidence-backed coverage for ${PRODUCT_LABELS[productId]}.`,
      content_angle: `Explain the practical system, constraint, or operating choice behind ${PRODUCT_LABELS[productId]}.`,
      suggested_hook: `${PRODUCT_LABELS[productId]} started with a practical constraint, not a feature list.`,
      audience: 'Operators, builders, and leaders evaluating practical AI and product systems',
      sensitivity: signal.sensitivity,
      evidence_summary: signal.summary,
      claim_boundaries: [
        'Use only the approved summary and source receipt.',
        'Verify any performance or customer claim before drafting.',
      ],
      source_receipts: [signal.receipt],
      product_ids: [productId],
      priority_score: priority.priorityScore,
      priority_tier: priority.priorityTier,
      priority_reasons: [...priority.priorityReasons, 'Required recurring product coverage'],
      dedupe_fingerprint: fingerprint,
    })
  }
  return next
    .sort((a, b) => b.priority_score - a.priority_score || a.dedupe_fingerprint.localeCompare(b.dedupe_fingerprint))
    .slice(0, 12)
}

function buildDiscoveryPrompt(row: SocialContentTopicContext | null, signals: SourceSignal[]) {
  const ragContext = asRecord(row?.rag_context) ?? {}
  const currentDraft = row ? {
    id: row.id,
    status: row.status,
    post_text: truncate(row.post_text ?? '', 1200),
    cta_text: row.cta_text,
    hashtags: row.hashtags,
    topic_extracted: row.topic_extracted,
    hormozi_framework: row.hormozi_framework,
    rag_context: {
      source: ragContext.source,
      goal_id: ragContext.goal_id,
      content_packet_id: ragContext.content_packet_id,
      open_brain_references: ragContext.open_brain_references,
      chronicle_packet_status: ragContext.chronicle_packet_status,
      chronicle_evidence_notes: ragContext.chronicle_evidence_notes,
      source_provenance_checklist: ragContext.source_provenance_checklist,
    },
  } : {
    mode: 'standing_social_topic_backlog',
    instruction: 'Cull evergreen and timely candidate topics for future Social Content drafts.',
  }

  return `Shaka is Vambah Sillah's Agent Ops Chief of Staff.

Cull potential LinkedIn topic triggers from sanctioned internal summaries.
The goal is to answer: why is Vambah qualified to speak about this topic now?

Return JSON only:
{
  "candidates": [
    {
      "id": "short-stable-id",
      "title": "topic title",
      "triggering_event": "recent event or proof that makes the topic timely",
      "source_type": "meeting | shipped_feature | client_safe_project | chronicle_observation | chatgpt_session | open_brain | portfolio_work",
      "source_label": "human-readable source label",
      "source_ids": ["internal source ids from the provided signals"],
      "why_vambah_can_speak": "why this comes from Vambah's lived work, shipped work, or approved evidence",
      "brand_goal": "how this advances AmaduTown or Vambah's thought leadership",
      "content_angle": "plain-language angle for the draft",
      "suggested_hook": "first-sentence candidate",
      "audience": "primary reader",
      "sensitivity": "public_safe | client_safe_summary | needs_review",
      "evidence_summary": "sanitized evidence summary only",
      "claim_boundaries": ["what to avoid or verify before publishing"]
    }
  ],
  "notes": ["review-only notes"]
}

Rules:
- Do not quote raw private chats, raw Chronicle notes, raw meeting transcripts, emails, phone numbers, account IDs, or private URLs.
- Use only the sanitized summaries and approved receipt fields below. Every candidate must cite at least one provided source id.
- Prefer concrete triggers: a meeting theme, shipped feature, client-safe project pattern, approved Open Brain reference, or recent Portfolio work.
- Include at least one candidate for each required product with an approved receipt: Dark Castle Chess, Accelerated, and Agentified.
- Never infer from a raw conversation, raw transcript, private URL, contact detail, or unapproved source. Those inputs are absent by design.
- Mark client-safe summaries as client_safe_summary. Final privacy review remains required.
- These candidates are review-only. Do not publish, schedule, send, call providers, or create drafts outside this packet.

Current Social Content context:
${JSON.stringify(currentDraft, null, 2)}

Sanitized source signals:
${JSON.stringify(signals, null, 2)}

Vambah voice and brand filters:
- Start from a concrete scene, meeting tension, shipped feature, or practical proof.
- Connect the trigger to a larger system problem.
- Keep the topic grounded in product strategy, AI governance, operational reality, access, dignity, and AmaduTown's build-the-system posture.
- Avoid generic AI hype and detached consulting language.`
}

export async function fetchSocialContentTopicContext(id: string) {
  const { data, error } = await supabaseAdmin
    .from('social_content_queue')
    .select('id, status, post_text, cta_text, hashtags, image_prompt, topic_extracted, hormozi_framework, rag_context')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data as SocialContentTopicContext
}

async function fetchRecentMeetingSignals(): Promise<SourceSignal[]> {
  const { data, error } = await supabaseAdmin
    .from('meeting_records')
    .select('id, meeting_type, meeting_date, created_at, social_topic_summary:structured_notes->social_topic_summary')
    .order('meeting_date', { ascending: false })
    .limit(20)

  if (error) throw new Error('meeting_summaries_read_failed')

  return (data ?? []).map((meeting: {
    id: string
    meeting_type: string | null
    meeting_date: string | null
    created_at: string | null
    social_topic_summary: Record<string, unknown> | null
  }) => {
    const approved = asRecord(meeting.social_topic_summary)
    if (approved?.status !== 'approved') return null
    const summary = sanitizeSummary(approved.summary)
    return signalFromApprovedSummary({
      id: `meeting:${meeting.id}`,
      type: 'meeting',
      kind: 'meeting_summary',
      label: asString(approved.title) || meeting.meeting_type || 'Approved meeting summary',
      date: meeting.meeting_date ?? meeting.created_at,
      summary,
      privacyClassification: approved.privacy_classification,
      provenance: approved.provenance || `meeting_records:${meeting.id}:structured_notes.social_topic_summary`,
      approvedAt: approved.approved_at,
      approvedBy: approved.approved_by,
      productIds: approved.product_ids,
    })
  }).filter((signal: SourceSignal | null): signal is SourceSignal => Boolean(signal))
}

async function fetchApprovedOpenBrainSignals(): Promise<SourceSignal[]> {
  const { data, error } = await supabaseAdmin
    .from('social_topic_source_receipts')
    .select('receipt_id, source_id, source_kind, product_identity, label, approved_summary, privacy_classification, provenance, approved_at, approved_by, observed_at')
    .eq('source_group', 'codex_insights')
    .eq('approval_status', 'approved')
    .eq('raw_content_included', false)
    .order('observed_at', { ascending: false })
    .limit(24)

  if (error) throw new Error('open_brain_approved_projection_read_failed')

  return (data ?? [])
    .map((projection: Record<string, unknown>) => signalFromApprovedSummary({
      id: `open_brain_projection:${asString(projection.receipt_id)}`,
      type: 'open_brain',
      kind: 'open_brain_conversation_proposal',
      label: asString(projection.label),
      summary: asString(projection.approved_summary),
      date: asString(projection.observed_at) || asString(projection.approved_at),
      privacyClassification: projection.privacy_classification,
      provenance: asString(projection.provenance),
      approvedAt: projection.approved_at,
      approvedBy: projection.approved_by,
      productIds: [asString(projection.product_identity)],
    }))
    .filter((signal: SourceSignal | null): signal is SourceSignal => Boolean(signal))
    .slice(0, 12)
}

async function fetchOwnedMediaSummarySignals(): Promise<SourceSignal[]> {
  const { data, error } = await supabaseAdmin
    .from('social_content_research_packets')
    .select('id, title, platform, pattern_packet, privacy_notes, retrieved_at, updated_at, status')
    .eq('status', 'approved')
    .order('retrieved_at', { ascending: false })
    .limit(20)

  if (error) throw new Error('owned_media_summaries_read_failed')

  return (data ?? []).map((packet: Record<string, unknown>) => {
    const patternPacket = asRecord(packet.pattern_packet)
    const receipt = asRecord(patternPacket?.topic_source_receipt)
    if (receipt?.source_kind !== 'owned_media_summary' || receipt.status !== 'approved') return null
    return signalFromApprovedSummary({
      id: `owned_media:${asString(packet.id)}`,
      type: 'portfolio_work',
      kind: 'owned_media_summary',
      label: asString(packet.title) || 'Approved owned-media summary',
      summary: asString(receipt.approved_summary),
      date: asString(packet.retrieved_at) || asString(packet.updated_at),
      privacyClassification: receipt.privacy_classification,
      provenance: receipt.provenance,
      approvedAt: receipt.approved_at,
      approvedBy: receipt.approved_by,
      productIds: receipt.product_ids,
    })
  }).filter((signal: SourceSignal | null): signal is SourceSignal => Boolean(signal))
}

async function fetchAppPrototypeSignals(): Promise<SourceSignal[]> {
  const { data, error } = await supabaseAdmin
    .from('app_prototypes')
    .select('id, title, description, production_stage, updated_at, created_at')
    .in('production_stage', ['Pilot', 'Production'])
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) throw new Error('app_prototypes_read_failed')

  return (data ?? []).map((prototype: Record<string, unknown>) => {
    const label = asString(prototype.title)
    const summary = sanitizeSummary(prototype.description)
    const observedAt = asString(prototype.updated_at) || asString(prototype.created_at)
    return signalFromApprovedSummary({
      id: `app_prototype:${asString(prototype.id)}`,
      type: 'shipped_feature',
      kind: 'app_prototype',
      label,
      summary,
      date: observedAt,
      privacyClassification: 'public_safe',
      provenance: `public_catalog:app_prototypes:${asString(prototype.id)}:${asString(prototype.production_stage)}`,
      approvedAt: observedAt,
      approvedBy: 'public_catalog_state',
      productIds: inferRequiredProducts(label, summary),
    })
  }).filter((signal: SourceSignal | null): signal is SourceSignal => Boolean(signal))
}

async function fetchAmaduTownCatalogSignals(): Promise<SourceSignal[]> {
  const [productsResult, publicationsResult, servicesResult] = await Promise.all([
    supabaseAdmin.from('products')
      .select('id, title, description, type, updated_at, created_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(30),
    supabaseAdmin.from('publications')
      .select('id, title, description, author, publication_date, created_at')
      .eq('is_published', true)
      .order('publication_date', { ascending: false })
      .limit(20),
    supabaseAdmin.from('services')
      .select('id, title, description, service_type, updated_at, created_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(30),
  ])

  if (productsResult.error || publicationsResult.error || servicesResult.error) {
    throw new Error('amadutown_catalog_read_failed')
  }

  const rows = [
    ...(productsResult.data ?? []).map((row: Record<string, unknown>) => ({ row, table: 'products', kind: 'amadutown_product' as const })),
    ...(publicationsResult.data ?? []).map((row: Record<string, unknown>) => ({ row, table: 'publications', kind: 'amadutown_book' as const })),
    ...(servicesResult.data ?? []).map((row: Record<string, unknown>) => ({ row, table: 'services', kind: 'amadutown_site_material' as const })),
  ]

  return rows.map(({ row, table, kind }) => {
    const label = asString(row.title)
    const summary = sanitizeSummary(row.description)
    const observedAt = asString(row.updated_at) || asString(row.publication_date) || asString(row.created_at)
    return signalFromApprovedSummary({
      id: `${table}:${asString(row.id)}`,
      type: 'portfolio_work',
      kind,
      label,
      summary,
      date: observedAt,
      privacyClassification: 'public_safe',
      provenance: `public_catalog:${table}:${asString(row.id)}`,
      approvedAt: observedAt,
      approvedBy: 'public_catalog_state',
      productIds: inferRequiredProducts(label, summary),
    })
  }).filter((signal): signal is SourceSignal => Boolean(signal))
}

export async function collectSocialTopicSignals(currentId?: string): Promise<{
  signals: SourceSignal[]
  sourceCollections: SourceCollectionReceipt[]
}> {
  void currentId
  const collectors: Array<{
    sourceGroup: SocialTopicSourceGroup
    run: () => Promise<SourceSignal[]>
  }> = [
    { sourceGroup: 'open_brain', run: fetchApprovedOpenBrainSignals },
    { sourceGroup: 'meeting_summaries', run: fetchRecentMeetingSignals },
    { sourceGroup: 'owned_media_summaries', run: fetchOwnedMediaSummarySignals },
    { sourceGroup: 'app_prototypes', run: fetchAppPrototypeSignals },
    { sourceGroup: 'amadutown_catalog', run: fetchAmaduTownCatalogSignals },
  ]
  const results = await Promise.allSettled(collectors.map((collector) => collector.run()))
  const signals: SourceSignal[] = []
  const sourceCollections = results.map((result, index): SourceCollectionReceipt => {
    const sourceGroup = collectors[index].sourceGroup
    if (result.status === 'rejected') {
      return {
        source_group: sourceGroup,
        status: 'blocked',
        receipt_count: 0,
        blocker: `[source_collection_failed:${sourceGroup}] The approved ${sourceGroup.replace(/_/g, ' ')} source scan could not be completed. Retry after restoring read access or the source contract; no raw material was used as fallback.`,
      }
    }
    signals.push(...result.value)
    return {
      source_group: sourceGroup,
      status: 'ready',
      receipt_count: result.value.length,
      blocker: null,
    }
  })

  return {
    signals: signals.slice(0, 60),
    sourceCollections,
  }
}

export async function discoverSocialTopicCandidates(options: {
  row?: SocialContentTopicContext | null
  actorId?: string | null
  operation?: string
}) {
  const { signals, sourceCollections } = await collectSocialTopicSignals(options.row?.id)
  const coverageReport = buildSocialTopicCoverageReport(signals, new Date().toISOString(), sourceCollections)
  if (coverageReport.status !== 'ready') {
    throw new SocialTopicCoverageError(coverageReport)
  }

  const model = process.env.SOCIAL_TOPIC_DISCOVERY_MODEL || 'gpt-4o-mini'
  const aiResponse = await generateJsonCompletion({
    model,
    systemPrompt: "You are Shaka (Zulu), Vambah Sillah's Chief of Staff. You create review-only Social Content topic trigger packets from sanitized internal evidence.",
    userPrompt: buildDiscoveryPrompt(options.row ?? null, signals),
    temperature: 0.45,
    maxTokens: 1800,
    costContext: {
      reference: options.row
        ? { type: 'social_content_queue', id: options.row.id }
        : { type: 'social_topic_backlog', id: 'standing-topic-scan' },
      metadata: {
        operation: options.operation || 'social_content_topic_trigger_discovery',
        signal_count: signals.length,
        source_counts: socialTopicSourceCounts(signals),
      },
    },
  })

  let parsed: DiscoveryResponse
  try {
    parsed = JSON.parse(aiResponse.content) as DiscoveryResponse
  } catch {
    throw new Error('Topic discovery returned invalid JSON')
  }

  const candidates = ensureRequiredProductCandidates(normalizeCandidates(parsed, signals), signals)
  if (candidates.length === 0) {
    throw new Error('Topic discovery did not return usable candidates')
  }

  const packet: TopicTriggerPacket = {
    version: 'social_topic_trigger_discovery_v2',
    status: 'review_ready',
    generated_at: new Date().toISOString(),
    generated_by: options.actorId ?? null,
    model: aiResponse.model,
    provider: aiResponse.provider,
    source_policy: 'sanitized_summaries_only',
    source_counts: socialTopicSourceCounts(signals),
    source_receipts: signals.map((signal) => signal.receipt),
    coverage_report: coverageReport,
    candidates,
    notes: asStringArray(parsed.notes).map((note) => truncate(note, 240)).slice(0, 5),
    privacy_boundary: 'Review-only topic scouting from approved summaries and durable source receipts. Raw conversations, meeting transcripts, private URLs, contact details, provider sends, publishing, and scheduling stay out of this action.',
  }

  return { packet, signals }
}

export async function saveTopicTriggerPacketToSocialContent(
  row: SocialContentTopicContext,
  packet: TopicTriggerPacket,
) {
  const ragContext = asRecord(row.rag_context) ?? {}
  const existingCalibration = asRecord(ragContext.content_calibration) ?? {}
  const nextRagContext = {
    ...ragContext,
    content_calibration: {
      ...existingCalibration,
      status: 'topic_triggers_ready',
      topic_trigger_packet: packet,
    },
  }

  const { data: updated, error } = await supabaseAdmin
    .from('social_content_queue')
    .update({ rag_context: nextRagContext })
    .eq('id', row.id)
    .select('*')
    .single()

  if (error || !updated) {
    throw new Error('Failed to save topic trigger packet')
  }

  return updated
}

export function candidateKey(candidate: TopicTriggerCandidate) {
  return `topic-${candidate.dedupe_fingerprint.slice(0, 40)}`
}

export async function upsertSocialTopicBacklog(packet: TopicTriggerPacket, triggerSource: string) {
  const now = new Date().toISOString()
  const workItems = []
  const projectionRows = []

  for (const candidate of packet.candidates) {
    const key = candidateKey(candidate)
    const metadata = socialInsightMetadataFromCandidate({
      candidate,
      packet,
      triggerSource,
    })
    const workItem = await createAgentWorkItem({
      title: candidate.title,
      objective: candidate.content_angle || candidate.suggested_hook || candidate.triggering_event,
      priority: candidate.sensitivity === 'public_safe' ? 'medium' : 'high',
      status: 'proposed',
      ownerAgentKey: 'chief-of-staff',
      ownerRuntime: 'codex',
      source: {
        type: SOCIAL_TOPIC_TRIGGER_SOURCE_TYPE,
        id: key,
        label: candidate.source_label || 'Shaka topic trigger',
      },
      overlapGroup: 'social-content-intelligence',
      metadata,
      idempotencyKey: `social-topic-trigger:${key}`,
    })

    workItems.push(workItem)
    projectionRows.push({
      agent_work_item_id: workItem.id,
      candidate_key: key,
      title: candidate.title,
      triggering_event: candidate.triggering_event,
      source_type: candidate.source_type,
      source_label: candidate.source_label || null,
      source_ids: candidate.source_ids,
      why_vambah_can_speak: candidate.why_vambah_can_speak,
      brand_goal: candidate.brand_goal || null,
      content_angle: candidate.content_angle || null,
      suggested_hook: candidate.suggested_hook || null,
      audience: candidate.audience || null,
      sensitivity: candidate.sensitivity,
      evidence_summary: candidate.evidence_summary || null,
      claim_boundaries: candidate.claim_boundaries,
      status: 'available',
      source_policy: packet.source_policy,
      source_counts: packet.source_counts,
      generated_by: packet.generated_by,
      generated_at: packet.generated_at,
      last_seen_at: now,
      channel_lanes: defaultSocialChannelLanes(),
      metadata: {
        trigger_source: triggerSource,
        model: packet.model,
        provider: packet.provider,
        notes: packet.notes,
        privacy_boundary: packet.privacy_boundary,
        source_receipts: candidate.source_receipts,
        product_ids: candidate.product_ids,
        priority_score: candidate.priority_score,
        priority_tier: candidate.priority_tier,
        priority_reasons: candidate.priority_reasons,
        dedupe_fingerprint: candidate.dedupe_fingerprint,
        coverage_report: packet.coverage_report,
        canonical_agent_work_item_id: workItem.id,
      },
    })
  }

  const { data, error } = await supabaseAdmin
    .from('social_topic_backlog')
    .upsert(projectionRows, { onConflict: 'candidate_key' })
    .select('*')

  if (error) {
    console.warn('[social-topic-backlog] projection upsert skipped:', error.message)
    return workItems.map(socialTopicBacklogItemFromWorkItem)
  }

  return data ?? workItems.map(socialTopicBacklogItemFromWorkItem)
}

export async function runSocialTopicBacklogDiscovery(options: {
  actorId?: string | null
  triggerSource: string
}) {
  const { packet, signals } = await discoverSocialTopicCandidates({
    actorId: options.actorId ?? null,
    operation: 'social_topic_backlog_discovery',
  })
  const backlogItems = await upsertSocialTopicBacklog(packet, options.triggerSource)
  return {
    packet,
    signals,
    backlogItems,
    sourceCounts: packet.source_counts,
    coverageReport: packet.coverage_report,
  }
}
