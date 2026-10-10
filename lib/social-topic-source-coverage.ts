import { collectSocialTopicSignals, type SourceSignal } from '@/lib/social-topic-backlog'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildApprovedSourceProjection,
  stableProductIdentity,
  type SocialTopicLifecycleStage,
  type SocialTopicSourceProjection,
} from '@/lib/social-topic-source-receipts'

export type CoverageSourceKey =
  | 'codex_insights'
  | 'github_development'
  | 'vercel_deployments'
  | 'operational_records'
  | 'meeting_summaries'
  | 'owned_media_summaries'
  | 'app_prototypes'
  | 'public_catalog'

export type CoverageSourceHealth = {
  key: CoverageSourceKey
  label: string
  status: 'ready' | 'blocked'
  freshness: 'fresh' | 'aging' | 'stale' | 'never'
  last_successful_scan: string | null
  scanned_at: string
  receipt_count: number
  product_count: number
  collector_failure: string | null
  recovery_action: string
}

export type ProductLifecycleCoverage = {
  product_identity: string
  label: string
  current_stage: SocialTopicLifecycleStage
  stages: SocialTopicLifecycleStage[]
  receipt_count: number
  source_groups: string[]
  latest_evidence_at: string
  gaps: string[]
}

export type SocialTopicLiveCoverage = {
  version: 'social_topic_live_coverage_v1'
  generated_at: string
  status: 'ready' | 'blocked'
  review_only: true
  source_policy: 'approved_privacy_safe_summaries_and_operational_receipts_only'
  sources: CoverageSourceHealth[]
  products: ProductLifecycleCoverage[]
  receipts: SocialTopicSourceProjection[]
  gaps: string[]
  blockers: string[]
  boundaries: string[]
}

const SOURCE_LABELS: Record<CoverageSourceKey, string> = {
  codex_insights: 'Codex insights + approved Open Brain',
  github_development: 'GitHub development',
  vercel_deployments: 'Vercel deployments',
  operational_records: 'Convex + Supabase approved records',
  meeting_summaries: 'Approved meeting summaries',
  owned_media_summaries: 'Approved owned-media summaries',
  app_prototypes: 'App prototypes',
  public_catalog: 'Public catalog + site',
}

const RECOVERY_ACTIONS: Record<CoverageSourceKey, string> = {
  codex_insights: 'Approve a privacy-safe Open Brain proposal, then project the approved summary into social_topic_source_receipts. Never copy raw Codex conversations.',
  github_development: 'Attach a branch or pull request to the canonical Agent Ops work item and confirm its product identity metadata.',
  vercel_deployments: 'Record the preview or production deployment receipt on the canonical Agent Ops work item; do not infer deployment from a merged PR.',
  operational_records: 'Project an approved Convex or Supabase product receipt with provenance; do not read private operational rows into Social Content.',
  meeting_summaries: 'Review and approve a privacy-safe meeting summary with provenance and product identity. Never submit a transcript.',
  owned_media_summaries: 'Review and approve a derived owned-media summary in Content Intelligence. Do not expose raw source media or private notes.',
  app_prototypes: 'Add or update the canonical app prototype record with an accurate stage and public-safe description.',
  public_catalog: 'Publish or correct the canonical product, book, service, or public-site record before claiming public release.',
}

const ORDERED_STAGES: SocialTopicLifecycleStage[] = [
  'insight',
  'in_development',
  'preview_deployed',
  'production_deployed',
  'publicly_cataloged',
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function iso(value: unknown, fallback: string) {
  const candidate = asString(value)
  return Number.isFinite(Date.parse(candidate)) ? candidate : fallback
}

function freshness(lastSuccess: string | null, now: string): CoverageSourceHealth['freshness'] {
  if (!lastSuccess) return 'never'
  const age = Date.parse(now) - Date.parse(lastSuccess)
  if (!Number.isFinite(age)) return 'never'
  if (age <= 36 * 60 * 60 * 1000) return 'fresh'
  if (age <= 7 * 24 * 60 * 60 * 1000) return 'aging'
  return 'stale'
}

export function sourceSignalProjection(signal: SourceSignal): SocialTopicSourceProjection[] {
  const stage: SocialTopicLifecycleStage = signal.kind === 'app_prototype'
    ? signal.lifecycle_stage ?? 'preview_deployed'
    : signal.kind === 'amadutown_product' || signal.kind === 'amadutown_book' || signal.kind === 'amadutown_site_material'
      ? 'publicly_cataloged'
      : 'insight'
  const sourceGroup: CoverageSourceKey = signal.kind === 'open_brain_conversation_proposal'
    ? 'codex_insights'
    : signal.kind === 'meeting_summary'
      ? 'meeting_summaries'
      : signal.kind === 'owned_media_summary'
        ? 'owned_media_summaries'
        : signal.kind === 'app_prototype'
          ? 'app_prototypes'
          : 'public_catalog'
  const productIds = signal.product_ids.length > 0
    ? signal.product_ids
    : [stableProductIdentity(signal.label, signal.summary)]
  return productIds.map((productIdentity) => buildApprovedSourceProjection({
    sourceGroup,
    sourceKind: signal.kind,
    sourceId: signal.id,
    productIdentity,
    lifecycleStage: stage,
    label: signal.label,
    approvedSummary: signal.summary,
    privacyClassification: signal.receipt.privacy_classification,
    provenance: signal.receipt.provenance,
    approvedAt: signal.receipt.approved_at,
    approvedBy: signal.receipt.approved_by,
    observedAt: signal.date ?? signal.receipt.approved_at,
  }))
}

export function workItemCoverageProjections(rows: Record<string, unknown>[], now: string) {
  const projections: SocialTopicSourceProjection[] = []
  for (const row of rows) {
    const metadata = asRecord(row.metadata)
    const approvedReceipt = asRecord(metadata.source_coverage_receipt)
    const privacy = asString(approvedReceipt.privacy_classification)
    if (
      approvedReceipt.approval_status !== 'approved'
      || approvedReceipt.raw_content_included !== false
      || !['public_safe', 'client_safe_summary'].includes(privacy)
      || !asString(approvedReceipt.provenance)
      || !asString(approvedReceipt.approved_at)
      || !asString(approvedReceipt.approved_by)
      || !asString(approvedReceipt.approved_summary)
    ) continue
    const productIdentity = stableProductIdentity(
      approvedReceipt.product_identity,
      ...strings(approvedReceipt.product_ids),
    )
    if (productIdentity === 'unassigned_product') continue
    const label = asString(approvedReceipt.label) || productIdentity.replace(/_/g, ' ')
    const summary = asString(approvedReceipt.approved_summary)
    const observedAt = iso(row.updated_at, now)
    const approvedBy = asString(approvedReceipt.approved_by)
    const approvedAt = iso(approvedReceipt.approved_at, observedAt)
    const provenance = asString(approvedReceipt.provenance)
    const base = {
      sourceId: asString(row.id),
      productIdentity,
      label,
      approvedSummary: summary,
      privacyClassification: privacy as 'public_safe' | 'client_safe_summary',
      approvedAt,
      approvedBy,
      observedAt,
      metadata: { agent_work_item_status: row.status, approved_source_receipt: true },
    }
    if (asString(row.branch_name) || row.pr_number || asString(row.pr_url)) {
      projections.push(buildApprovedSourceProjection({
        ...base,
        sourceGroup: 'github_development',
        sourceKind: 'agent_work_item_github',
        lifecycleStage: 'in_development',
        provenance: `${provenance}:agent_work_items:${asString(row.id)}:github`,
        evidenceUrl: asString(row.pr_url) || null,
      }))
    }
    const previewUrl = asString(metadata.vercel_preview_url) || asString(metadata.preview_url)
    const productionUrl = asString(metadata.vercel_production_url) || asString(metadata.production_url)
    if (previewUrl) {
      projections.push(buildApprovedSourceProjection({
        ...base,
        sourceGroup: 'vercel_deployments',
        sourceKind: 'vercel_preview_receipt',
        lifecycleStage: 'preview_deployed',
        provenance: `${provenance}:agent_work_items:${asString(row.id)}:vercel_preview`,
        evidenceUrl: previewUrl,
      }))
    }
    if (productionUrl || row.status === 'deployed') {
      projections.push(buildApprovedSourceProjection({
        ...base,
        sourceGroup: 'vercel_deployments',
        sourceKind: 'vercel_production_receipt',
        lifecycleStage: 'production_deployed',
        provenance: `${provenance}:agent_work_items:${asString(row.id)}:vercel_production`,
        evidenceUrl: productionUrl || null,
      }))
    }
    for (const store of ['convex', 'supabase'] as const) {
      const receipt = asRecord(metadata[`${store}_product_receipt`])
      if (receipt.status !== 'approved' || !asString(receipt.provenance)) continue
      projections.push(buildApprovedSourceProjection({
        ...base,
        sourceGroup: 'operational_records',
        sourceKind: `${store}_approved_product_record`,
        lifecycleStage: receipt.environment === 'production' ? 'production_deployed' : 'preview_deployed',
        approvedSummary: asString(receipt.summary) || summary,
        provenance: asString(receipt.provenance),
        approvedAt: iso(receipt.approved_at, observedAt),
        approvedBy: asString(receipt.approved_by) || approvedBy,
        evidenceUrl: asString(receipt.evidence_url) || null,
      }))
    }
  }
  return projections
}

function dedupeReceipts(receipts: SocialTopicSourceProjection[]) {
  return [...new Map(receipts.map((receipt) => [receipt.receipt_id, receipt])).values()]
}

function productCoverage(receipts: SocialTopicSourceProjection[]): ProductLifecycleCoverage[] {
  const byProduct = new Map<string, SocialTopicSourceProjection[]>()
  for (const receipt of receipts) {
    byProduct.set(receipt.product_identity, [...(byProduct.get(receipt.product_identity) ?? []), receipt])
  }
  return [...byProduct.entries()].map(([productIdentity, evidence]) => {
    const stages = ORDERED_STAGES.filter((stage) => evidence.some((item) => item.lifecycle_stage === stage))
    const currentStage = stages[stages.length - 1] ?? 'insight'
    const gaps: string[] = []
    const currentIndex = ORDERED_STAGES.indexOf(currentStage)
    for (const stage of ORDERED_STAGES.slice(0, currentIndex)) {
      if (!stages.includes(stage)) gaps.push(`Missing ${stage.replace(/_/g, ' ')} evidence`)
    }
    if (currentStage !== 'publicly_cataloged') gaps.push('No public catalog/site release evidence')
    return {
      product_identity: productIdentity,
      label: evidence[0].label,
      current_stage: currentStage,
      stages,
      receipt_count: evidence.length,
      source_groups: [...new Set(evidence.map((item) => item.source_group))].sort(),
      latest_evidence_at: evidence.map((item) => item.observed_at).sort().at(-1) ?? evidence[0].observed_at,
      gaps,
    }
  }).sort((a, b) => b.latest_evidence_at.localeCompare(a.latest_evidence_at))
}

export function buildLiveCoverage(input: {
  generatedAt: string
  receipts: SocialTopicSourceProjection[]
  collectorFailures?: Partial<Record<CoverageSourceKey, string>>
  persistedScans?: Array<Record<string, unknown>>
}): SocialTopicLiveCoverage {
  const receipts = dedupeReceipts(input.receipts)
  const persisted = new Map((input.persistedScans ?? []).map((scan) => [asString(scan.source_group), scan]))
  const sources = (Object.keys(SOURCE_LABELS) as CoverageSourceKey[]).map((key): CoverageSourceHealth => {
    const matching = receipts.filter((receipt) => receipt.source_group === key)
    const prior = persisted.get(key)
    const failure = input.collectorFailures?.[key] ?? null
    const latestEvidence = matching.map((item) => item.observed_at).sort().at(-1) ?? null
    const lastSuccess = failure
      ? asString(prior?.last_successful_scan_at) || null
      : input.generatedAt
    return {
      key,
      label: SOURCE_LABELS[key],
      status: failure ? 'blocked' : 'ready',
      freshness: freshness(lastSuccess || latestEvidence, input.generatedAt),
      last_successful_scan: lastSuccess || latestEvidence,
      scanned_at: input.generatedAt,
      receipt_count: matching.length,
      product_count: new Set(matching.map((item) => item.product_identity)).size,
      collector_failure: failure,
      recovery_action: RECOVERY_ACTIONS[key],
    }
  })
  const products = productCoverage(receipts)
  const gaps = products.flatMap((product) => product.gaps.map((gap) => `${product.label}: ${gap}`))
  const blockers = sources
    .filter((source) => source.status === 'blocked')
    .map((source) => `${source.label}: ${source.collector_failure}`)
  if (receipts.length === 0) blockers.push('No approved source receipts are available. Candidate creation remains blocked.')
  return {
    version: 'social_topic_live_coverage_v1',
    generated_at: input.generatedAt,
    status: blockers.length > 0 ? 'blocked' : 'ready',
    review_only: true,
    source_policy: 'approved_privacy_safe_summaries_and_operational_receipts_only',
    sources,
    products,
    receipts,
    gaps,
    blockers,
    boundaries: [
      'Raw Codex conversations, meeting transcripts, owned-media source files, secrets, and unrelated task data are never collected.',
      'A branch or pull request proves development, not deployment.',
      'A preview proves preview deployment, not production or public release.',
      'Candidate creation stays review-only and fails closed without approval, provenance, privacy classification, and receipts.',
    ],
  }
}

async function readPersistedCoverage() {
  const [receiptResult, scanResult] = await Promise.all([
    supabaseAdmin.from('social_topic_source_receipts').select('*').eq('approval_status', 'approved').order('observed_at', { ascending: false }).limit(500),
    supabaseAdmin.from('social_topic_source_scans').select('*'),
  ])
  return {
    receipts: receiptResult.error ? [] : (receiptResult.data ?? []) as SocialTopicSourceProjection[],
    scans: scanResult.error ? [] : (scanResult.data ?? []) as Array<Record<string, unknown>>,
    receiptReadError: receiptResult.error?.message ?? null,
  }
}

export async function collectLiveSocialTopicCoverage(options: { persist?: boolean } = {}) {
  const generatedAt = new Date().toISOString()
  const collectorFailures: Partial<Record<CoverageSourceKey, string>> = {}
  const [persisted, socialResult, workItemResult] = await Promise.all([
    readPersistedCoverage(),
    collectSocialTopicSignals().catch((error) => {
      collectorFailures.meeting_summaries = error instanceof Error ? error.message : 'approved_summary_collection_failed'
      return { signals: [] as SourceSignal[], sourceCollections: [] }
    }),
    supabaseAdmin.from('agent_work_items')
      .select('id, title, objective, status, branch_name, pr_number, pr_url, validation_summary, metadata, updated_at')
      .not('status', 'eq', 'cancelled')
      .order('updated_at', { ascending: false })
      .limit(250),
  ])

  for (const collection of socialResult.sourceCollections) {
    if (collection.status !== 'blocked') continue
    const key = collection.source_group === 'open_brain'
      ? 'codex_insights'
      : collection.source_group === 'meeting_summaries'
        ? 'meeting_summaries'
        : collection.source_group === 'owned_media_summaries'
          ? 'owned_media_summaries'
          : collection.source_group === 'app_prototypes'
            ? 'app_prototypes'
            : 'public_catalog'
    collectorFailures[key] = collection.blocker ?? `${collection.source_group}_collection_failed`
  }
  if (persisted.receiptReadError) collectorFailures.codex_insights = persisted.receiptReadError
  if (workItemResult.error) {
    collectorFailures.github_development = workItemResult.error.message
    collectorFailures.vercel_deployments = workItemResult.error.message
    collectorFailures.operational_records = workItemResult.error.message
  }

  const liveReceipts = socialResult.signals.flatMap(sourceSignalProjection)
  const workReceipts = workItemResult.error ? [] : workItemCoverageProjections((workItemResult.data ?? []) as Record<string, unknown>[], generatedAt)
  const report = buildLiveCoverage({
    generatedAt,
    receipts: [...persisted.receipts, ...liveReceipts, ...workReceipts],
    collectorFailures,
    persistedScans: persisted.scans,
  })

  if (options.persist) {
    if (liveReceipts.length > 0 || workReceipts.length > 0) {
      const { error } = await supabaseAdmin.from('social_topic_source_receipts')
        .upsert(dedupeReceipts([...liveReceipts, ...workReceipts]), { onConflict: 'receipt_id' })
      if (error) throw new Error(`coverage_receipt_persist_failed:${error.message}`)
    }
    const scans = report.sources.map((source) => ({
      source_group: source.key,
      status: source.status,
      scanned_at: source.scanned_at,
      last_successful_scan_at: source.last_successful_scan,
      receipt_count: source.receipt_count,
      product_count: source.product_count,
      collector_failure: source.collector_failure,
      recovery_action: source.recovery_action,
      metadata: { freshness: source.freshness, coverage_version: report.version },
      updated_at: generatedAt,
    }))
    const { error } = await supabaseAdmin.from('social_topic_source_scans')
      .upsert(scans, { onConflict: 'source_group' })
    if (error) throw new Error(`coverage_scan_persist_failed:${error.message}`)
  }

  return report
}
