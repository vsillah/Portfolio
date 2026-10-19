import { endAgentRun, startAgentRun } from '@/lib/agent-run'
import { parseArtifactEvidenceManifest, validateYouTubePackagingEvidence } from '@/lib/artifact-evidence-manifest'
import { deterministicSha256Hex } from '@/lib/deterministic-sha256.mjs'
import {
  SOCIAL_CAMPAIGN_CANDIDATE_VERSION,
  SOCIAL_CAMPAIGN_LONG_FORM_INPUT_VERSION,
  SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST,
  type CampaignGateReceipt,
  type CampaignLongFormScriptInputReceipt,
  type CampaignPreparationCandidate,
} from '@/lib/social-campaign-package-preparation'
import { isSocialReleaseLocked } from '@/lib/social-release-safety'
import { stableProductIdentity } from '@/lib/social-topic-source-receipts'
import { supabaseAdmin } from '@/lib/supabase'

export const SOCIAL_CAMPAIGN_CANDIDATE_PRODUCER_KIND = 'social_campaign_candidate_projection'
export const SOCIAL_CAMPAIGN_CANDIDATE_PRODUCER_VERSION = 'social-campaign-candidate-producer/v1' as const

type Row = Record<string, any>

export type CampaignPreparationSnapshot = {
  campaign: Row
  calendar: Row[]
  socialContent: Row[]
  workItems: Row[]
}

export type CampaignPreparationProjection = {
  candidate: CampaignPreparationCandidate | null
  canonicalSocialContentId: string | null
  inputVersion: string
  blockers: string[]
  sealed: boolean
}

export type CampaignPreparationReconciliation = {
  scanned: number
  projected: number
  unchanged: number
  blocked: number
  sealed: number
  conflicted: number
  candidate_ids: string[]
  error?: string
}

function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : []
}

function stable(value: unknown) {
  return JSON.stringify(value, (_key, entry) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([left], [right]) => left.localeCompare(right)))
      : entry
  ))
}

function hash(value: unknown) {
  return `sha256:${deterministicSha256Hex(stable(value))}`
}

function normalizedTimestamp(value: unknown): string | null {
  const parsed = Date.parse(text(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function channel(value: unknown) {
  const normalized = text(value).toLowerCase()
  return normalized === 'linkedin' || normalized === 'youtube' ? normalized : null
}

function contentFor(snapshot: CampaignPreparationSnapshot, calendar: Row) {
  return snapshot.socialContent.find((row) => text(row.id) === text(calendar.social_content_id)) ?? null
}

function sourceWorkItems(snapshot: CampaignPreparationSnapshot, calendar: Row) {
  const metadata = record(calendar.metadata)
  const ids = new Set([
    text(calendar.agent_work_item_id),
    text(metadata.agent_work_item_id),
    text(record(metadata.platform_draft_handoff).work_item_id),
  ].filter(Boolean))
  return snapshot.workItems.filter((row) => ids.has(text(row.id)))
}

function receiptLineage(snapshot: CampaignPreparationSnapshot) {
  const receipts = new Map<string, Row>()
  for (const work of snapshot.workItems) {
    const metadata = record(work.metadata)
    const insight = record(metadata.insight)
    for (const value of [metadata.receipt_lineage, insight.receipt_lineage]) {
      if (!Array.isArray(value)) continue
      for (const receipt of value) {
        const parsed = record(receipt)
        const id = text(parsed.receipt_id)
        if (id) receipts.set(id, parsed)
      }
    }
  }
  return [...receipts.values()]
}

function publicSignals(snapshot: CampaignPreparationSnapshot) {
  const signals = new Map<string, Row>()
  for (const work of snapshot.workItems) {
    const metadata = record(work.metadata)
    const insight = record(metadata.insight)
    for (const value of [metadata.public_signal, insight.public_signal]) {
      const signal = record(value)
      if (Object.keys(signal).length) signals.set(stable(signal), signal)
    }
  }
  return [...signals.values()]
}

function validApprovedReceipt(receipt: Row) {
  return receipt.approval_status === 'approved'
    && receipt.raw_content_included === false
    && ['public_safe', 'client_safe_summary'].includes(text(receipt.privacy_classification))
    && Boolean(text(receipt.receipt_id) && text(receipt.provenance) && normalizedTimestamp(receipt.observed_at))
}

const ATTRIBUTABLE_WORK_SOURCE_GROUPS = new Set(['github_development', 'vercel_deployments', 'app_prototypes', 'amadutown_catalog'])
const ATTRIBUTABLE_WORK_SOURCE_KINDS = new Set([
  'approved_repository_document',
  'approved_repository_implementation',
  'agent_work_item_github',
  'github_repository_activity',
  'github_branch_activity',
  'github_pull_request_activity',
  'github_deployment_status_activity',
  'vercel_preview_receipt',
  'vercel_production_receipt',
  'app_prototype',
  'amadutown_product',
  'convex_approved_product_record',
  'supabase_approved_product_record',
])

function identity(value: unknown) {
  const raw = text(value)
  return raw ? stableProductIdentity(raw) : ''
}

function campaignProductIdentity(campaign: Row) {
  const metadata = record(campaign.metadata)
  const values = [campaign.product_identity, campaign.product_id, metadata.product_identity, metadata.product_id]
    .map(identity)
    .filter(Boolean)
  const unique = [...new Set(values)]
  return { value: unique.length === 1 ? unique[0] : null, ambiguous: unique.length > 1 }
}

function selectIdentityEvidence(snapshot: CampaignPreparationSnapshot, receipts: Row[], signals: Row[]) {
  const campaignIdentity = campaignProductIdentity(snapshot.campaign)
  const productIdentity = campaignIdentity.value
  const publicMatches = productIdentity
    ? receipts.filter((receipt) => receipt.source_group === 'public_momentum' && identity(receipt.product_identity) === productIdentity && validApprovedReceipt(receipt))
    : []
  const workMatches = productIdentity
    ? receipts.filter((receipt) => (
      (ATTRIBUTABLE_WORK_SOURCE_GROUPS.has(text(receipt.source_group)) || ATTRIBUTABLE_WORK_SOURCE_KINDS.has(text(receipt.source_kind)))
      && identity(receipt.product_identity) === productIdentity
      && validApprovedReceipt(receipt)
    ))
    : []
  const signalMatches = productIdentity
    ? signals.filter((signal) => (
      identity(signal.product_identity) === productIdentity
      && Boolean(normalizedTimestamp(signal.observed_at))
      && Boolean(normalizedTimestamp(signal.expires_at))
    ))
    : []
  const conflicting = productIdentity ? [
    ...receipts.filter((receipt) => receipt.source_group === 'public_momentum' && validApprovedReceipt(receipt)),
    ...receipts.filter((receipt) => (
      ATTRIBUTABLE_WORK_SOURCE_GROUPS.has(text(receipt.source_group)) || ATTRIBUTABLE_WORK_SOURCE_KINDS.has(text(receipt.source_kind))
    ) && validApprovedReceipt(receipt)),
    ...signals,
  ].some((value) => identity(value.product_identity) && identity(value.product_identity) !== productIdentity) : false
  return {
    productIdentity,
    publicEvidence: publicMatches.sort((left, right) => text(left.receipt_id).localeCompare(text(right.receipt_id)))[0] ?? null,
    attributableWork: workMatches.sort((left, right) => text(left.receipt_id).localeCompare(text(right.receipt_id)))[0] ?? null,
    signal: signalMatches.length === 1 ? signalMatches[0] : null,
    ambiguous: campaignIdentity.ambiguous || conflicting || signalMatches.length > 1,
  }
}

function materialWorkItem(work: Row) {
  const metadata = record(work.metadata)
  return {
    id: text(work.id),
    updated_at: text(work.updated_at),
    version: text(work.version) || text(metadata.version) || text(metadata.insight_version),
    receipt_lineage: metadata.receipt_lineage ?? record(metadata.insight).receipt_lineage ?? null,
    public_signal: metadata.public_signal ?? record(metadata.insight).public_signal ?? null,
    channel_lanes: metadata.channel_lanes ?? null,
  }
}

function reviewPacket(snapshot: CampaignPreparationSnapshot, expectedChannel: 'linkedin' | 'youtube', socialContentId: string) {
  for (const work of snapshot.workItems) {
    const lanes = record(record(work.metadata).channel_lanes)
    const lane = record(lanes[expectedChannel])
    const packet = record(lane.draft_packet)
    const shared = record(packet.shared_source)
    if (packet.channel === expectedChannel
      && packet.approval_status === 'in_review'
      && shared.social_content_id === socialContentId
      && Object.values(record(packet.side_effects)).every((value) => value === false)) return packet
  }
  return null
}

function passedVersionedReceipt(value: unknown, contentVersion: string) {
  const receipt = record(value)
  return Boolean(
    text(receipt.receipt_id)
      && ['passed', 'approved', 'complete'].includes(text(receipt.status).toLowerCase())
      && normalizedTimestamp(receipt.content_updated_at) === normalizedTimestamp(contentVersion),
  ) ? receipt : null
}

function sourceHref(productIdentity: string) {
  return `/admin/agents/content-intelligence?section=research&candidate=${encodeURIComponent(productIdentity)}`
}

function gateReceipt(input: {
  receiptId: string
  observedAt: string
  freshUntil?: string | null
  href: string
  observedValue?: string | number | null
  requiredValue?: string | number
  formula?: string | null
  sampleSize?: number | null
  status?: CampaignGateReceipt['status']
  blockerCode?: string
  blockerMessage?: string
  recoveryLabel?: string
}): CampaignGateReceipt {
  return {
    receipt_id: input.receiptId,
    status: input.status ?? 'passed',
    observed_at: input.observedAt,
    fresh_until: input.freshUntil ?? null,
    source_href: input.href,
    observed_value: input.observedValue ?? 'passed',
    required_value: input.requiredValue ?? 'passed',
    formula: input.formula ?? null,
    sample_size: input.sampleSize ?? null,
    ...(input.blockerCode ? { blocker_code: input.blockerCode } : {}),
    ...(input.blockerMessage ? { blocker_message: input.blockerMessage } : {}),
    ...(input.recoveryLabel ? { recovery_label: input.recoveryLabel } : {}),
  }
}

function blockedGate(name: string, message: string, href: string): CampaignGateReceipt {
  return gateReceipt({
    receiptId: '',
    observedAt: '',
    href,
    status: 'blocked',
    blockerCode: `${name}_missing`,
    blockerMessage: message,
    recoveryLabel: name === 'evidence' ? 'Refresh campaign evidence' : `Complete ${name.replaceAll('_', ' ')}`,
  })
}

function emptyThumbnailChecklist() {
  return Object.fromEntries(SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST.map((label) => [label, false])) as CampaignPreparationCandidate['thumbnail_checklist']
}

function longFormScriptInput(value: unknown): CampaignLongFormScriptInputReceipt | null {
  const receipt = record(value)
  return receipt.version === SOCIAL_CAMPAIGN_LONG_FORM_INPUT_VERSION && text(receipt.receipt_id)
    ? receipt as CampaignLongFormScriptInputReceipt
    : null
}

function thumbnailChecklist(ragContext: Row, productProofReceiptId: string) {
  const receipt = record(ragContext.youtube_thumbnail_v6_receipt ?? ragContext.thumbnail_selection_receipt)
  const checks = record(receipt.checks ?? receipt.thumbnail_checklist)
  const versionReady = ['youtube-thumbnail-selection/v6', 'youtube-thumbnail-v6'].includes(text(receipt.version))
  const finalGate = record(receipt.final_quality_gate)
  const proofBinding = text(receipt.product_proof_receipt_id ?? record(receipt.candidate_identity).product_proof_receipt_id)
  return Object.fromEntries(SOCIAL_CAMPAIGN_THUMBNAIL_V6_CHECKLIST.map((label) => [
    label,
    versionReady
      && finalGate.status === 'passed'
      && proofBinding === productProofReceiptId
      && checks[label] === true,
  ])) as CampaignPreparationCandidate['thumbnail_checklist']
}

function sealedContent(row: Row | null) {
  return Boolean(row && (
    ['scheduled', 'published'].includes(text(row.status))
      || row.scheduled_for
      || row.published_at
      || row.platform_post_id
      || isSocialReleaseLocked(row.rag_context)
  ))
}

function candidateStatus(receipts: CampaignPreparationCandidate['receipts'], checklist: CampaignPreparationCandidate['thumbnail_checklist'], now: Date) {
  const stale = Object.values(receipts).some((receipt) => receipt.fresh_until && Date.parse(receipt.fresh_until) <= now.getTime())
  const blocked = Object.values(receipts).some((receipt) => receipt.status !== 'passed') || Object.values(checklist).some((value) => value !== true)
  return stale || blocked ? 'blocked' as const : 'eligible' as const
}

export function projectCampaignPreparationCandidate(
  snapshot: CampaignPreparationSnapshot,
  now = new Date(),
): CampaignPreparationProjection {
  const calendar = snapshot.calendar.filter((row) => channel(row.channel) && text(row.social_content_id))
  const linkedinCalendar = calendar.find((row) => channel(row.channel) === 'linkedin') ?? null
  const youtubeCalendar = calendar.find((row) => channel(row.channel) === 'youtube') ?? null
  const linkedin = linkedinCalendar ? contentFor(snapshot, linkedinCalendar) : null
  const youtube = youtubeCalendar ? contentFor(snapshot, youtubeCalendar) : null
  const canonicalId = text(youtube?.id) || null
  const baseInput = {
    producer: SOCIAL_CAMPAIGN_CANDIDATE_PRODUCER_VERSION,
    campaign: {
      id: text(snapshot.campaign.id),
      updated_at: text(snapshot.campaign.updated_at),
      product_identity: campaignProductIdentity(snapshot.campaign),
      metadata: record(snapshot.campaign.metadata),
    },
    calendar: calendar.map((row) => ({ id: text(row.id), channel: channel(row.channel), social_content_id: text(row.social_content_id), updated_at: text(row.updated_at), metadata: record(row.metadata) })),
    content: [linkedin, youtube].filter(Boolean).map((row) => ({ id: text(row!.id), updated_at: text(row!.updated_at), status: text(row!.status) })),
  }
  const blockers: string[] = []
  if (!linkedinCalendar || !youtubeCalendar || !linkedin || !youtube) blockers.push('Bind one current LinkedIn item and one current YouTube item to the same campaign calendar.')
  const sealed = sealedContent(linkedin) || sealedContent(youtube)
  if (sealed) blockers.push('A linked deliverable is sealed by scheduling, publication, or provider-submission evidence and cannot be re-projected.')
  if (blockers.length || !linkedin || !youtube || !linkedinCalendar || !youtubeCalendar) return {
    candidate: null,
    canonicalSocialContentId: canonicalId,
    inputVersion: hash(baseInput),
    blockers,
    sealed,
  }

  const linkedWorkItems = [...new Map([
    ...sourceWorkItems(snapshot, linkedinCalendar),
    ...sourceWorkItems(snapshot, youtubeCalendar),
  ].map((row) => [text(row.id), row])).values()]
  const scopedSnapshot = { ...snapshot, workItems: linkedWorkItems.length ? linkedWorkItems : snapshot.workItems }
  const lineage = receiptLineage(scopedSnapshot)
  const signals = publicSignals(scopedSnapshot)
  const evidence = selectIdentityEvidence(scopedSnapshot, lineage, signals)
  const { productIdentity, publicEvidence, attributableWork, signal } = evidence
  if (!productIdentity) blockers.push('Campaign metadata must declare one unambiguous stable product identity before evidence can be joined.')
  if (evidence.ambiguous) blockers.push('Public receipt, attributable work receipt, public signal, and campaign metadata contain ambiguous or conflicting product identities.')
  if (!publicEvidence || !attributableWork) blockers.push('No qualifying approved public-trend plus attributable product/development/deployment/prototype receipt pair exists for the campaign product identity.')
  if (!signal) blockers.push('Exactly one current public signal with observed time, expiry, and the same stable product identity is required.')

  const linkedinPacket = reviewPacket(snapshot, 'linkedin', text(linkedin.id))
  const youtubePacket = reviewPacket(snapshot, 'youtube', text(youtube.id))
  if (!linkedinPacket || !youtubePacket) blockers.push('LinkedIn and YouTube must both have current review-only calendar preparation packets with every external side effect closed.')

  const youtubeContext = record(youtube.rag_context)
  const manifest = parseArtifactEvidenceManifest(youtubeContext.artifact_evidence_manifest)
  const packaging = validateYouTubePackagingEvidence(youtubeContext.artifact_evidence_manifest, text(youtube.updated_at), 'youtube', now.toISOString())
  if (!manifest || !packaging.ready || !packaging.title || !packaging.thumbnail) blockers.push(...(packaging.blockers.length ? packaging.blockers : ['The current YouTube title and thumbnail evidence is incomplete.']))
  const decision = packaging.thumbnail?.research_cohort?.decision_receipt
  const proofReceiptId = text(decision?.candidate_identity.product_proof_receipt_id)
  if (!decision || !proofReceiptId) blockers.push('The canonical outlier decision and first-party product-proof receipt are missing.')

  const youtubeDecisionPacket = record(youtubeContext.mobile_decision_review)
  const decisionReceipts = record(youtubeDecisionPacket.receipts)
  const originality = passedVersionedReceipt(decisionReceipts.challenger, text(youtube.updated_at))
  const privacy = passedVersionedReceipt(decisionReceipts.privacy, text(youtube.updated_at))
  const longFormInput = longFormScriptInput(youtubeContext.long_form_script_framework_receipt)
  if (!originality || !privacy) blockers.push('Current version-bound originality and privacy receipts are required.')

  const inputMaterial = {
    ...baseInput,
    lineage,
    public_signals: signals,
    linked_work_items: scopedSnapshot.workItems.map(materialWorkItem),
    review_packets: { linkedin: linkedinPacket, youtube: youtubePacket },
    artifact_manifest: manifest,
    packaging: { ready: packaging.ready, blockers: packaging.blockers, title: packaging.title, thumbnail: packaging.thumbnail },
    outlier_decision: decision,
    originality_receipt: decisionReceipts.challenger ?? null,
    privacy_receipt: decisionReceipts.privacy ?? null,
    thumbnail_receipt: record(youtubeContext.youtube_thumbnail_v6_receipt ?? youtubeContext.thumbnail_selection_receipt),
    long_form_script_framework_receipt: youtubeContext.long_form_script_framework_receipt ?? null,
  }
  const inputVersion = hash(inputMaterial)
  const calendarIds = [text(linkedinCalendar.id), text(youtubeCalendar.id)].sort()
  const recoveryHref = productIdentity ? sourceHref(productIdentity) : '/admin/agents/content-intelligence?section=calendar'
  const minimumReady = Boolean(
    productIdentity
      && !evidence.ambiguous
      && publicEvidence
      && attributableWork
      && signal
      && linkedinPacket
      && youtubePacket
      && manifest
      && decision
      && proofReceiptId
      && originality
      && privacy,
  )
  if (!minimumReady) {
    const primaryMessage = blockers[0] || 'Required campaign preparation evidence is missing.'
    const candidate: CampaignPreparationCandidate = {
      version: SOCIAL_CAMPAIGN_CANDIDATE_VERSION,
      candidate_id: `campaign-preparation:${text(snapshot.campaign.id)}`,
      campaign_identity: text(snapshot.campaign.id),
      product_label: text(snapshot.campaign.name) || productIdentity || text(snapshot.campaign.id),
      social_content_id: text(youtube.id),
      calendar_item_ids: calendarIds,
      content_version: text(youtube.updated_at),
      input_version: inputVersion,
      status: 'blocked',
      source_trace: [],
      receipts: {
        evidence: blockedGate('evidence', primaryMessage, recoveryHref),
        outlier: {
          ...blockedGate('outlier', 'Record the canonical live outlier decision after campaign evidence is complete.', `/admin/social-content/${encodeURIComponent(text(youtube.id))}?step=visuals`),
          route: 'social-content-outlier-decision/v1',
          threshold: 0,
          score: null,
        },
        product_proof: blockedGate('product_proof', 'Bind first-party product proof with the same stable product identity.', recoveryHref),
        originality: blockedGate('originality', 'Record a current version-bound originality receipt.', `/admin/social-content/${encodeURIComponent(text(youtube.id))}?step=copy`),
        privacy: blockedGate('privacy', 'Record a current version-bound privacy receipt.', `/admin/social-content/${encodeURIComponent(text(youtube.id))}?step=assets`),
      },
      playlist_calibration: [],
      thumbnail_checklist: emptyThumbnailChecklist(),
      deliverables: {
        linkedin: { copy: '', visual_href: '', visual_alt: '' },
        youtube: { title: '', thumbnail_teaser: '', description: '', script: '', storyboard: [], thumbnail_href: '' },
      },
      long_form_script_input: longFormInput,
    }
    return { candidate, canonicalSocialContentId: canonicalId, inputVersion, blockers: [...new Set(blockers)], sealed: false }
  }

  // The readiness guard above narrows these values at runtime; aliases keep the
  // subsequent deliverable projection explicit and isolated from blocked rows.
  const readyPublicEvidence = publicEvidence!
  const readySignal = signal!
  const readyLinkedinPacket = linkedinPacket!
  const readyYoutubePacket = youtubePacket!
  const readyDecision = decision!
  const readyOriginality = originality!
  const readyPrivacy = privacy!
  const readyProductIdentity = productIdentity!

  const linkedinFields = record(readyLinkedinPacket.fields)
  const youtubeFields = record(readyYoutubePacket.fields)
  const title = text(packaging.title?.input_excerpt) || strings(youtubeFields.title_variants)[0] || text(youtube.youtube_title)
  const teaser = text(packaging.thumbnail?.input_excerpt)
  const description = text(youtubeFields.description) || text(youtube.youtube_description)
  const scriptValue = youtubeFields.full_video_script
  const script = Array.isArray(scriptValue) ? strings(scriptValue).join('\n\n') : text(scriptValue) || text(youtube.voiceover_text)
  const storyboard = strings(youtubeFields.storyboard_beats)
  const visualHref = text(linkedin.image_url)
    || text(parseArtifactEvidenceManifest(record(linkedin.rag_context).artifact_evidence_manifest)?.preview_url)
  const thumbnailHref = text(packaging.thumbnail?.artifact_url)
  if (![text(linkedinFields.post_text), visualHref, title, teaser, description, script, thumbnailHref].every(Boolean) || !storyboard.length) {
    blockers.push('The prepared LinkedIn and YouTube review packets do not contain every sealed deliverable.')
  }

  const included = readyDecision.live_evidence.comparisons.filter((comparison) => comparison.decision === 'included')
  const score = included.reduce<number | null>((best, comparison) => {
    const value = comparison.normalized_performance_score
    return value == null ? best : best == null ? value : Math.max(best, value)
  }, null)
  const comparisonTrace = readyDecision.live_evidence.comparisons.map((comparison) => ({
    source_id: comparison.video_id,
    label: comparison.video_id,
    href: comparison.source_url,
    decision: comparison.decision === 'included' ? 'selected' as const : 'excluded' as const,
    reason: comparison.decision_reason,
  }))
  const sourceTrace = [
    ...comparisonTrace,
    ...lineage.map((receipt) => ({
      source_id: text(receipt.source_id) || text(receipt.receipt_id),
      label: text(receipt.label) || text(receipt.source_kind),
      href: text(receipt.evidence_url) || sourceHref(text(receipt.product_identity)),
      decision: 'selected' as const,
      reason: `${text(receipt.source_group)} receipt approved with privacy-safe provenance.`,
    })),
  ]
  if (!sourceTrace.some((entry) => entry.decision === 'excluded')) blockers.push('The comparable-content trace is missing an explicit excluded source and reason.')

  const evidenceReceipt = gateReceipt({
    receiptId: text(readyPublicEvidence.receipt_id),
    observedAt: text(readySignal.observed_at),
    freshUntil: text(readySignal.expires_at),
    href: recoveryHref,
    observedValue: typeof readySignal.relevance_score === 'number' ? readySignal.relevance_score : 'approved',
    requiredValue: typeof readySignal.relevance_score === 'number' ? 0.6 : 'approved',
    formula: 'approved public momentum relevance score',
    sampleSize: 1,
  })
  const outlierReceipt = {
    ...gateReceipt({
      receiptId: readyDecision.receipt_id,
      observedAt: readyDecision.live_evidence.observed_at,
      freshUntil: readyDecision.live_evidence.fresh_until,
      href: `/admin/social-content/${encodeURIComponent(text(youtube.id))}?step=visuals`,
      observedValue: score,
      requiredValue: readyDecision.live_evidence.outlier_threshold,
      formula: readyDecision.live_evidence.normalization_formula.join(' + '),
      sampleSize: included.length,
      status: readyDecision.selection.status === 'ready' ? 'passed' : 'unscored',
    }),
    route: 'social-content-outlier-decision/v1' as const,
    threshold: readyDecision.live_evidence.outlier_threshold,
    score,
  }
  const checklist = thumbnailChecklist(youtubeContext, proofReceiptId)
  const receipts: CampaignPreparationCandidate['receipts'] = {
    evidence: evidenceReceipt,
    outlier: outlierReceipt,
    product_proof: gateReceipt({ receiptId: proofReceiptId, observedAt: readyDecision.live_evidence.observed_at, freshUntil: readyDecision.live_evidence.fresh_until, href: `/admin/social-content/${encodeURIComponent(text(youtube.id))}?step=visuals` }),
    originality: gateReceipt({ receiptId: text(readyOriginality.receipt_id), observedAt: text(readyOriginality.content_updated_at), href: `/admin/social-content/${encodeURIComponent(text(youtube.id))}?step=copy` }),
    privacy: gateReceipt({ receiptId: text(readyPrivacy.receipt_id), observedAt: text(readyPrivacy.content_updated_at), href: `/admin/social-content/${encodeURIComponent(text(youtube.id))}?step=assets` }),
  }
  const candidate: CampaignPreparationCandidate = {
    version: SOCIAL_CAMPAIGN_CANDIDATE_VERSION,
    candidate_id: `campaign-preparation:${text(snapshot.campaign.id)}`,
    campaign_identity: text(snapshot.campaign.id),
    product_label: text(snapshot.campaign.name) || text(readyPublicEvidence.label) || readyProductIdentity,
    social_content_id: text(youtube.id),
    calendar_item_ids: calendarIds,
    content_version: text(youtube.updated_at),
    input_version: inputVersion,
    status: candidateStatus(receipts, checklist, now),
    source_trace: sourceTrace,
    receipts,
    playlist_calibration: readyDecision.user_preference_signals.flatMap((signal) => signal.item_identities.map((item) => ({
      item_id: item.video_id,
      source_href: item.source_url,
      traits: signal.applied_traits,
      performance_weight: 0 as const,
      evidence_role: 'taste_calibration_only' as const,
      performance_status: 'unscored' as const,
    }))),
    thumbnail_checklist: checklist,
    deliverables: {
      linkedin: { copy: text(linkedinFields.post_text), visual_href: visualHref, visual_alt: text(record(linkedin.rag_context).image_alt) || `${text(snapshot.campaign.name)} review-only visual` },
      youtube: { title, thumbnail_teaser: teaser, description, script, storyboard, thumbnail_href: thumbnailHref },
    },
    long_form_script_input: longFormInput,
  }
  return { candidate, canonicalSocialContentId: canonicalId, inputVersion, blockers: [...new Set(blockers)], sealed: false }
}

async function rowsByIds(table: string, ids: string[]): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return []
  const { data, error } = await supabaseAdmin.from(table).select('*').in('id', unique)
  if (error) throw new Error(`Campaign preparation could not read ${table}: ${error.message}`)
  return data ?? []
}

async function loadSnapshots(campaignIds?: string[]): Promise<CampaignPreparationSnapshot[]> {
  let query = supabaseAdmin
    .from('social_content_calendar_items')
    .select('*')
    .in('channel', ['linkedin', 'youtube'])
    .not('campaign_id', 'is', null)
    .not('social_content_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(500)
  if (campaignIds?.length) query = query.in('campaign_id', [...new Set(campaignIds)])
  const { data, error } = await query
  if (error) throw new Error(`Campaign preparation calendar scan failed: ${error.message}`)
  const calendars = (data ?? []) as Row[]
  const campaigns = await rowsByIds('attraction_campaigns', calendars.map((row) => text(row.campaign_id)))
  const content = await rowsByIds('social_content_queue', calendars.map((row) => text(row.social_content_id)))
  const workIds = calendars.flatMap((row) => {
    const metadata = record(row.metadata)
    return [text(row.agent_work_item_id), text(metadata.agent_work_item_id), text(record(metadata.platform_draft_handoff).work_item_id)]
  })
  const works = await rowsByIds('agent_work_items', workIds)
  return campaigns.map((campaign: Row) => ({
    campaign,
    calendar: calendars.filter((row) => row.campaign_id === campaign.id),
    socialContent: content,
    workItems: works,
  }))
}

export async function persistCampaignPreparationProjection(input: {
  projection: CampaignPreparationProjection
  target: Row
  triggerSource: string
}): Promise<'projected' | 'unchanged' | 'conflicted'> {
  const candidate = input.projection.candidate
  if (!candidate) throw new Error('Campaign preparation projection has no candidate to persist.')
  const currentContext = record(input.target.rag_context)
  const current = record(currentContext.campaign_preparation_candidate)
  if (current.input_version === candidate.input_version && current.version === SOCIAL_CAMPAIGN_CANDIDATE_VERSION) return 'unchanged'

  const runKey = `social-campaign-candidate:${candidate.campaign_identity}:${candidate.input_version}`
  const run = await startAgentRun({
    runtime: 'codex',
    kind: SOCIAL_CAMPAIGN_CANDIDATE_PRODUCER_KIND,
    title: `${candidate.product_label} campaign candidate reconciliation`,
    status: 'running',
    subject: { type: 'social_campaign_candidate', id: candidate.candidate_id, label: candidate.product_label },
    triggerSource: input.triggerSource,
    currentStep: 'Recording durable receipt before candidate projection',
    idempotencyKey: runKey,
    metadata: {
      producer_version: SOCIAL_CAMPAIGN_CANDIDATE_PRODUCER_VERSION,
      candidate_id: candidate.candidate_id,
      input_version: candidate.input_version,
      social_content_id: input.target.id,
      calendar_item_ids: candidate.calendar_item_ids,
      external_execution_enabled: false,
    },
  })

  try {
    const { data, error } = await supabaseAdmin
      .from('social_content_queue')
      .update({ rag_context: { ...currentContext, campaign_preparation_candidate: candidate } })
      .eq('id', input.target.id)
      .eq('updated_at', input.target.updated_at)
      .select('id')
    if (error) throw new Error(`Campaign preparation projection failed: ${error.message}`)
    if (!data?.length) {
      await endAgentRun({
        runId: run.id,
        status: 'failed',
        currentStep: 'Candidate projection rejected by optimistic concurrency guard',
        errorMessage: 'social_content_queue changed after the producer snapshot; refresh before retrying.',
        outcome: { projected: false, conflict: true, candidate_id: candidate.candidate_id, input_version: candidate.input_version, external_execution: false },
      })
      return 'conflicted'
    }
    await endAgentRun({
      runId: run.id,
      status: 'completed',
      currentStep: 'Campaign candidate projection reconciled',
      outcome: { projected: true, candidate_id: candidate.candidate_id, input_version: candidate.input_version, external_execution: false },
    })
    return 'projected'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign preparation projection failed.'
    try {
      await endAgentRun({
        runId: run.id,
        status: 'failed',
        currentStep: 'Candidate projection failed after durable receipt creation',
        errorMessage: message,
        outcome: { projected: false, candidate_id: candidate.candidate_id, input_version: candidate.input_version, external_execution: false },
      })
    } catch (receiptError) {
      console.warn('[social-campaign-preparation-producer] run receipt finalization failed:', receiptError)
    }
    throw error
  }
}

export async function reconcileCampaignPreparationCandidates(options: {
  campaignIds?: string[]
  triggerSource: string
  now?: Date
}): Promise<CampaignPreparationReconciliation> {
  const snapshots = await loadSnapshots(options.campaignIds)
  const result: CampaignPreparationReconciliation = { scanned: snapshots.length, projected: 0, unchanged: 0, blocked: 0, sealed: 0, conflicted: 0, candidate_ids: [] }
  for (const snapshot of snapshots) {
    const projection = projectCampaignPreparationCandidate(snapshot, options.now ?? new Date())
    if (projection.sealed) { result.sealed++; continue }
    if (!projection.candidate || !projection.canonicalSocialContentId) { result.blocked++; continue }
    const target = snapshot.socialContent.find((row) => text(row.id) === projection.canonicalSocialContentId)
    if (!target) { result.blocked++; continue }
    const persisted = await persistCampaignPreparationProjection({ projection, target, triggerSource: options.triggerSource })
    if (persisted === 'unchanged') {
      result.unchanged++
      result.candidate_ids.push(projection.candidate.candidate_id)
      continue
    }
    if (persisted === 'conflicted') { result.conflicted++; continue }
    result.projected++
    result.candidate_ids.push(projection.candidate.candidate_id)
  }
  return result
}

export async function reconcileCampaignPreparationCandidatesSafely(options: {
  campaignIds?: string[]
  triggerSource: string
  now?: Date
}): Promise<CampaignPreparationReconciliation> {
  try {
    return await reconcileCampaignPreparationCandidates(options)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign candidate reconciliation failed.'
    console.warn('[social-campaign-preparation-producer] reconciliation blocked:', message)
    return { scanned: 0, projected: 0, unchanged: 0, blocked: 1, sealed: 0, conflicted: 0, candidate_ids: [], error: message }
  }
}
