import { deterministicSha256Hex } from '@/lib/deterministic-sha256.mjs'

export const SOCIAL_CAMPAIGN_PACKAGE_KIND = 'social_campaign_review_package'
export const SOCIAL_CAMPAIGN_PACKAGE_VERSION = 'social-campaign-review-package/v1' as const
export const SOCIAL_CAMPAIGN_CANDIDATE_VERSION = 'social-campaign-candidate/v1' as const
export const SOCIAL_CAMPAIGN_THUMBNAIL_CHECKLIST_VERSION = 'youtube-thumbnail-v6' as const

export const SOCIAL_CAMPAIGN_EXTERNAL_GATES = Object.freeze({
  provider_calls: false,
  paid_generation: false,
  uploads: false,
  platform_drafts: false,
  scheduling: false,
  publishing: false,
  external_sends: false,
  credentials: false,
  migrations: false,
  spending: false,
  production_release: false,
})

export const SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST = [
  'Dominant human or product focal point',
  'One idea legible in about one second',
  'Only a few large teaser words',
  'Distinct video-title and thumbnail copy',
  'Actual-feed-size legibility',
  'Playlist visual-similarity calibration',
  'Live topic-specific outlier validation',
  'No face obstruction',
  'Cohesive subject, text, and product composition',
  'Expressive subject',
  'High contrast and polished typography',
  'Reject split-card or pasted-side-by-side layouts',
] as const

export type CampaignGateReceipt = {
  receipt_id: string
  status: 'passed' | 'blocked' | 'unscored'
  observed_at: string
  fresh_until: string | null
  source_href: string
  observed_value: string | number | null
  required_value: string | number
  formula: string | null
  sample_size: number | null
}

export type CampaignPreparationCandidate = {
  version: typeof SOCIAL_CAMPAIGN_CANDIDATE_VERSION
  candidate_id: string
  campaign_identity: string
  product_label: string
  social_content_id: string
  calendar_item_ids: string[]
  content_version: string
  input_version: string
  status: 'eligible' | 'blocked' | 'unscored'
  source_trace: Array<{ source_id: string; label: string; href: string; decision: 'selected' | 'excluded'; reason: string }>
  receipts: {
    evidence: CampaignGateReceipt
    outlier: CampaignGateReceipt & { route: 'social-content-outlier-decision/v1'; threshold: number; score: number | null }
    product_proof: CampaignGateReceipt
    originality: CampaignGateReceipt
    privacy: CampaignGateReceipt
  }
  playlist_calibration: Array<{
    item_id: string
    source_href: string
    traits: string[]
    performance_weight: 0
    evidence_role: 'taste_calibration_only'
    performance_status: 'unscored'
  }>
  thumbnail_checklist: Record<(typeof SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST)[number], boolean>
  deliverables: {
    linkedin: { copy: string; visual_href: string; visual_alt: string }
    youtube: {
      title: string
      thumbnail_teaser: string
      description: string
      script: string
      storyboard: string[]
      thumbnail_href: string
    }
  }
}

export type CampaignPreparationBlocker = {
  code: string
  message: string
  recovery_label: string
  recovery_href: string
}

export type CampaignReviewPackage = {
  version: typeof SOCIAL_CAMPAIGN_PACKAGE_VERSION
  package_id: string
  idempotency_key: string
  campaign_identity: string
  candidate_id: string
  social_content_id: string
  content_version: string
  input_version: string
  prepared_at: string
  status: 'prepared_for_human_review'
  decision_queue_href: string
  deliverables: CampaignPreparationCandidate['deliverables']
  product_proof_bindings: string[]
  source_trace: CampaignPreparationCandidate['source_trace']
  receipt_ids: string[]
  playlist_boundary: 'zero_weight_taste_calibration_only'
  thumbnail_checklist_version: typeof SOCIAL_CAMPAIGN_THUMBNAIL_CHECKLIST_VERSION
  external_gates: typeof SOCIAL_CAMPAIGN_EXTERNAL_GATES
}

export type CampaignPreparationResult = {
  ready: boolean
  state: 'ready' | 'blocked' | 'unscored'
  blockers: CampaignPreparationBlocker[]
  package: CampaignReviewPackage | null
}

function stableHash(value: unknown) {
  return deterministicSha256Hex(JSON.stringify(value, (_key, entry) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)))
      : entry
  )))
}

function validTimestamp(value: string) {
  return Number.isFinite(Date.parse(value))
}

function receiptBlockers(name: string, receipt: CampaignGateReceipt, now: Date): CampaignPreparationBlocker[] {
  const recoveryHref = receipt.source_href || '/admin/agents/content-intelligence?section=research'
  const label = name.replaceAll('_', ' ')
  if (receipt.status === 'unscored') return [{
    code: `${name}_unscored`,
    message: `${label} is Unscored; no review package can be prepared.`,
    recovery_label: `Complete ${label}`,
    recovery_href: recoveryHref,
  }]
  if (receipt.status !== 'passed') return [{
    code: `${name}_blocked`,
    message: `${label} has not passed its required threshold.`,
    recovery_label: `Resolve ${label} blocker`,
    recovery_href: recoveryHref,
  }]
  if (!receipt.receipt_id || !validTimestamp(receipt.observed_at)) return [{
    code: `${name}_receipt_missing`,
    message: `${label} is missing a durable receipt or observed time.`,
    recovery_label: `Record ${label} receipt`,
    recovery_href: recoveryHref,
  }]
  if (receipt.fresh_until && (!validTimestamp(receipt.fresh_until) || Date.parse(receipt.fresh_until) <= now.getTime())) return [{
    code: `${name}_stale`,
    message: `${label} is stale and must be refreshed.`,
    recovery_label: `Refresh ${label}`,
    recovery_href: recoveryHref,
  }]
  return []
}

export function campaignPreparationIdempotencyKey(candidate: CampaignPreparationCandidate) {
  return `social-campaign-package:${candidate.campaign_identity}:${stableHash({
    candidate_id: candidate.candidate_id,
    content_version: candidate.content_version,
    input_version: candidate.input_version,
    calendar_item_ids: [...candidate.calendar_item_ids].sort(),
    receipts: Object.values(candidate.receipts).map((receipt) => receipt.receipt_id).sort(),
  }).slice(0, 32)}`
}

export function evaluateCampaignPreparationCandidate(
  candidate: CampaignPreparationCandidate,
  now = new Date(),
): CampaignPreparationResult {
  const blockers: CampaignPreparationBlocker[] = []
  if (candidate.version !== SOCIAL_CAMPAIGN_CANDIDATE_VERSION) blockers.push({ code: 'candidate_version', message: 'Candidate contract is missing or unsupported.', recovery_label: 'Refresh candidate projection', recovery_href: '/admin/social-content?workflow=evidence' })
  if (!candidate.campaign_identity || !candidate.candidate_id || !candidate.social_content_id || !validTimestamp(candidate.content_version)) blockers.push({ code: 'stable_identity', message: 'Stable campaign identity and version bindings are required.', recovery_label: 'Repair candidate lineage', recovery_href: '/admin/agents/content-intelligence?section=calendar' })
  if (!candidate.calendar_item_ids.length) blockers.push({ code: 'calendar_binding', message: 'At least one canonical Social Content calendar item must be bound.', recovery_label: 'Bind the campaign calendar', recovery_href: '/admin/agents/content-intelligence?section=calendar' })
  for (const [name, receipt] of Object.entries(candidate.receipts)) blockers.push(...receiptBlockers(name, receipt, now))
  if (candidate.receipts.outlier.route !== 'social-content-outlier-decision/v1') blockers.push({ code: 'outlier_route', message: 'The canonical receipt-backed outlier decision route is required.', recovery_label: 'Run the canonical outlier decision', recovery_href: candidate.receipts.outlier.source_href })
  if ((candidate.receipts.outlier.sample_size ?? 0) < 5) blockers.push({ code: 'outlier_sample_size', message: 'Live topic-specific outlier evidence needs at least five qualifying comparisons.', recovery_label: 'Expand live comparison evidence', recovery_href: candidate.receipts.outlier.source_href })
  if (candidate.receipts.outlier.score == null || candidate.receipts.outlier.score < candidate.receipts.outlier.threshold) blockers.push({ code: 'outlier_threshold', message: 'Live topic-specific evidence does not meet the recorded outlier threshold.', recovery_label: 'Refresh or replace the candidate evidence', recovery_href: candidate.receipts.outlier.source_href })
  if (candidate.playlist_calibration.some((signal) => signal.performance_weight !== 0 || signal.evidence_role !== 'taste_calibration_only' || signal.performance_status !== 'unscored')) blockers.push({ code: 'playlist_weight', message: 'Saved playlist examples may calibrate taste only and must carry zero performance weight.', recovery_label: 'Restore zero-weight playlist handling', recovery_href: '/admin/agents/content-intelligence?section=research' })
  for (const label of SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST) {
    if (candidate.thumbnail_checklist[label] !== true) blockers.push({ code: `thumbnail_v6_${stableHash(label).slice(0, 8)}`, message: `Thumbnail v6 check failed: ${label}.`, recovery_label: 'Revise thumbnail package', recovery_href: `/admin/social-content/${encodeURIComponent(candidate.social_content_id)}?step=visuals` })
  }
  const deliverables = candidate.deliverables
  const requiredText = [deliverables.linkedin.copy, deliverables.linkedin.visual_href, deliverables.youtube.title, deliverables.youtube.thumbnail_teaser, deliverables.youtube.description, deliverables.youtube.script, deliverables.youtube.thumbnail_href]
  if (requiredText.some((value) => !value.trim()) || !deliverables.youtube.storyboard.length) blockers.push({ code: 'deliverables_incomplete', message: 'LinkedIn copy/visual and the complete YouTube review package must be supplied by approved inputs.', recovery_label: 'Complete review-only deliverables', recovery_href: `/admin/social-content/${encodeURIComponent(candidate.social_content_id)}?step=copy` })
  if (deliverables.youtube.title.trim().toLowerCase() === deliverables.youtube.thumbnail_teaser.trim().toLowerCase()) blockers.push({ code: 'thumbnail_title_duplicate', message: 'Video title and thumbnail teaser must be distinct.', recovery_label: 'Write a complementary thumbnail teaser', recovery_href: `/admin/social-content/${encodeURIComponent(candidate.social_content_id)}?step=visuals` })
  if (!candidate.source_trace.some((source) => source.decision === 'selected') || !candidate.source_trace.some((source) => source.decision === 'excluded')) blockers.push({ code: 'comparison_logic_missing', message: 'Selected and excluded comparison logic must both remain visible.', recovery_label: 'Complete source comparison trace', recovery_href: candidate.receipts.outlier.source_href })

  const uniqueBlockers = [...new Map(blockers.map((blocker) => [blocker.code, blocker])).values()]
  const unscored = candidate.status === 'unscored' || uniqueBlockers.some((blocker) => blocker.code.endsWith('_unscored'))
  if (uniqueBlockers.length) return { ready: false, state: unscored ? 'unscored' : 'blocked', blockers: uniqueBlockers, package: null }

  const idempotencyKey = campaignPreparationIdempotencyKey(candidate)
  const packageId = `campaign-package-${stableHash(idempotencyKey).slice(0, 24)}`
  return {
    ready: true,
    state: 'ready',
    blockers: [],
    package: {
      version: SOCIAL_CAMPAIGN_PACKAGE_VERSION,
      package_id: packageId,
      idempotency_key: idempotencyKey,
      campaign_identity: candidate.campaign_identity,
      candidate_id: candidate.candidate_id,
      social_content_id: candidate.social_content_id,
      content_version: candidate.content_version,
      input_version: candidate.input_version,
      prepared_at: now.toISOString(),
      status: 'prepared_for_human_review',
      decision_queue_href: `/admin/agents/coordination?proposal=${encodeURIComponent(packageId)}`,
      deliverables,
      product_proof_bindings: [candidate.receipts.product_proof.receipt_id],
      source_trace: candidate.source_trace,
      receipt_ids: Object.values(candidate.receipts).map((receipt) => receipt.receipt_id),
      playlist_boundary: 'zero_weight_taste_calibration_only',
      thumbnail_checklist_version: SOCIAL_CAMPAIGN_THUMBNAIL_CHECKLIST_VERSION,
      external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES,
    },
  }
}

