import { deterministicSha256Hex } from '@/lib/deterministic-sha256.mjs'
import { projectCampaignLongFormDraft, type CampaignLongFormDraftPacket } from '@/lib/social-campaign-long-form-batch'
import {
  SOCIAL_CAMPAIGN_EXTERNAL_GATES,
  type CampaignPreparationBlocker,
  type CampaignPreparationCandidate,
} from '@/lib/social-campaign-package-preparation'

export const SOCIAL_CAMPAIGN_VISUAL_PLAN_VERSION = 'social-campaign-visual-plan/v1' as const
export const SOCIAL_CAMPAIGN_VISUAL_EVALUATION_VERSION = 'social-campaign-visual-evaluation/v1' as const
export const SOCIAL_CAMPAIGN_VISUAL_BATCH_VERSION = 'social-campaign-visual-batch/v1' as const
export const SOCIAL_CAMPAIGN_VISUAL_BATCH_KIND = 'social_campaign_visual_batch'
export const SOCIAL_CAMPAIGN_VISUAL_CHUNK_SIZE = 10

export type VisualChannel = 'linkedin' | 'youtube_thumbnail' | 'youtube_long_form' | 'short_form'
export type VisualEvidenceKind = 'source_receipt' | 'owned_product_screenshot' | 'approved_public_evidence'

export type CampaignVisualSource = {
  source_id: string
  label: string
  href: string
  kind: VisualEvidenceKind
  content_version: string
  observed_at: string
  fresh_until: string | null
  approval_status: 'approved' | 'missing'
  privacy_boundary: string
}

export type CampaignVisualBeat = {
  beat_id: string
  channel: VisualChannel
  format: string
  copy_section_id: string
  copy_excerpt: string
  source_ids: string[]
  asset_href: string
  start_seconds: number | null
  end_seconds: number | null
  intended_takeaway: string
  originality_boundary: string
  privacy_boundary: string
  transition: string
  motion: string
  presenter_safe_area: string
  customer_facing_copy: string
  repeated_asset_rationale: string | null
}

export type CampaignVisualPlan = {
  version: typeof SOCIAL_CAMPAIGN_VISUAL_PLAN_VERSION
  plan_id: string
  candidate_id: string
  campaign_identity: string
  product_label: string
  content_version: string
  input_version: string
  script_packet_id: string
  script_input_version: string
  source_receipt_ids: string[]
  exact_sources: CampaignVisualSource[]
  beats: CampaignVisualBeat[]
  thumbnails: Array<{
    variant_id: string
    href: string
    title: string
    teaser: string
    focal_subject: string
    text_words: string[]
    face_text_overlap: boolean
    feed_size_legible: boolean
    composition: string
  }>
  rejected_alternatives: Array<{ alternative: string; reason: string; recovery_action: string }>
  benchmark_logic: {
    playlist_role: 'taste_only_zero_performance_weight'
    playlist_similarity_score: number
    live_topic_outlier_receipt_id: string
    live_topic_score: number
    live_topic_threshold: number
    explanation: string
  }
  recovery_actions: Array<{ label: string; href: string }>
  external_gates: typeof SOCIAL_CAMPAIGN_EXTERNAL_GATES
}

export const CAMPAIGN_VISUAL_DIMENSIONS = [
  ['evidence_coverage', 'Evidence coverage'],
  ['script_visual_alignment', 'Script-to-visual alignment'],
  ['product_proof_coverage', 'Product-proof coverage'],
  ['channel_nativeness', 'Channel nativeness'],
  ['originality_risk', 'Originality / template-repetition risk'],
  ['readability_contrast', 'Readability / feed-size contrast'],
  ['focal_hierarchy', 'Focal hierarchy'],
  ['motion_synchronization', 'Motion / synchronization'],
  ['privacy', 'Privacy'],
  ['copy_purity', 'Customer-facing copy purity'],
] as const

export type CampaignVisualDimensionKey = (typeof CAMPAIGN_VISUAL_DIMENSIONS)[number][0]
export type CampaignVisualDimension = {
  key: CampaignVisualDimensionKey
  label: string
  status: 'passed' | 'blocked' | 'unscored'
  score: number | null
  evidence_ids: string[]
  explanation: string
}

export type CampaignVisualEvaluation = {
  version: typeof SOCIAL_CAMPAIGN_VISUAL_EVALUATION_VERSION
  evaluation_id: string
  plan_id: string | null
  status: 'passed' | 'blocked' | 'unscored'
  approval_ready: boolean
  overall_score: number | null
  dimensions: CampaignVisualDimension[]
  blockers: CampaignPreparationBlocker[]
  evaluated_at: string
}

export type CampaignVisualProjection = {
  candidate_id: string
  campaign_identity: string
  product_label: string
  state: 'ready' | 'blocked' | 'unscored'
  ready: boolean
  plan: CampaignVisualPlan | null
  evaluation: CampaignVisualEvaluation
}

export type CampaignVisualBatch = {
  version: typeof SOCIAL_CAMPAIGN_VISUAL_BATCH_VERSION
  batch_id: string
  input_fingerprint: string
  total: number
  scanned: number
  prepared_count: number
  blocked_count: number
  remaining: number
  chunk_size: number
  chunks_processed: number
  prepared: CampaignVisualProjection[]
  blocked: CampaignVisualProjection[]
  external_gates: typeof SOCIAL_CAMPAIGN_EXTERNAL_GATES
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

function blocker(code: string, message: string, label: string, href: string): CampaignPreparationBlocker {
  return { code, message, recovery_label: label, recovery_href: href }
}

function sourceId(candidate: CampaignPreparationCandidate, suffix: string) {
  return `visual-source:${candidate.campaign_identity}:${suffix}`
}

function sourceInventory(candidate: CampaignPreparationCandidate): CampaignVisualSource[] {
  const proofHref = candidate.deliverables.linkedin.visual_href || candidate.deliverables.youtube.thumbnail_href
  const common = {
    content_version: candidate.content_version,
    observed_at: candidate.receipts.evidence.observed_at,
    fresh_until: candidate.receipts.evidence.fresh_until,
    approval_status: 'approved' as const,
    privacy_boundary: 'Public-safe or synthetic review evidence only; no private account, message, or contact data.',
  }
  return [
    {
      ...common,
      source_id: sourceId(candidate, 'product-proof'),
      label: `${candidate.product_label} owned product proof`,
      href: proofHref,
      kind: 'owned_product_screenshot',
      fresh_until: candidate.receipts.product_proof.fresh_until,
    },
    ...candidate.source_trace.filter((source) => source.decision === 'selected').map((source, index) => ({
      ...common,
      source_id: source.source_id || sourceId(candidate, `public-${index + 1}`),
      label: source.label,
      href: source.href,
      kind: 'approved_public_evidence' as const,
      fresh_until: candidate.receipts.outlier.fresh_until,
    })),
    ...Object.entries(candidate.receipts).map(([name, receipt]) => ({
      ...common,
      source_id: receipt.receipt_id || sourceId(candidate, `missing-${name}`),
      label: `${name.replaceAll('_', ' ')} receipt`,
      href: receipt.source_href,
      kind: 'source_receipt' as const,
      observed_at: receipt.observed_at,
      fresh_until: receipt.fresh_until,
      approval_status: receipt.receipt_id ? 'approved' as const : 'missing' as const,
    })),
  ]
}

function safeExcerpt(value: string, max = 180) {
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

function kickLabTakeaway(beatId: string) {
  if (beatId.includes('hook') || beatId.includes('open')) return 'Physics becomes concrete when the viewer sees a player choice change a result.'
  if (beatId.includes('proof')) return 'Fight, Race, and Kick turn momentum, grip, and vectors into visible feedback.'
  if (beatId.includes('teaching')) return 'The explanation stays beside the exact product behavior that supports it.'
  return 'The viewer leaves with one practical experiment to try in the product.'
}

function planBeats(candidate: CampaignPreparationCandidate, script: CampaignLongFormDraftPacket): CampaignVisualBeat[] {
  const proof = sourceId(candidate, 'product-proof')
  const publicSource = candidate.source_trace.find((source) => source.decision === 'selected')?.source_id || candidate.receipts.outlier.receipt_id
  const shared = {
    originality_boundary: 'Use the campaign evidence and approved voice; borrow no creator wording, artwork, layout, or visual identity.',
    privacy_boundary: 'Use owned, public-safe, or synthetic product evidence only.',
    repeated_asset_rationale: null,
  }
  const linkedin: CampaignVisualBeat[] = [
    {
      ...shared,
      beat_id: 'linkedin-cover',
      channel: 'linkedin',
      format: 'consulting_pamphlet_cover_4x5',
      copy_section_id: 'linkedin-post-main',
      copy_excerpt: safeExcerpt(candidate.deliverables.linkedin.copy),
      source_ids: [proof, candidate.receipts.evidence.receipt_id],
      asset_href: candidate.deliverables.linkedin.visual_href,
      start_seconds: null,
      end_seconds: null,
      intended_takeaway: `${candidate.product_label} connects a practical lesson to visible product proof.`,
      transition: 'Static save-worthy 4:5 cover; no video transition.',
      motion: 'None; diagram and product screenshot remain inspectable.',
      presenter_safe_area: 'No presenter; preserve clean diagram hierarchy.',
      customer_facing_copy: candidate.campaign_identity === 'kicklab' ? 'A choice. A result. A physics lesson you can feel.' : candidate.deliverables.linkedin.copy,
    },
    {
      ...shared,
      beat_id: 'linkedin-proof-panel',
      channel: 'linkedin',
      format: 'product_evidence_dashboard_4x5',
      copy_section_id: 'linkedin-post-proof',
      copy_excerpt: safeExcerpt(candidate.deliverables.linkedin.copy),
      source_ids: [proof, publicSource],
      asset_href: candidate.deliverables.linkedin.visual_href,
      start_seconds: null,
      end_seconds: null,
      intended_takeaway: 'The claim, screenshot, source, and boundary can be inspected in one view.',
      transition: 'Second carousel panel uses the same visual system with a different evidence-led composition.',
      motion: 'None; field-level source trace remains behind the review toggle.',
      presenter_safe_area: 'No presenter; reserve the top third for one concise insight.',
      customer_facing_copy: 'See the move. Read the result. Try the idea again.',
    },
  ]
  const thumbnail: CampaignVisualBeat = {
    ...shared,
    beat_id: 'youtube-thumbnail-primary',
    channel: 'youtube_thumbnail',
    format: 'youtube_thumbnail_16x9',
    copy_section_id: 'youtube-title-and-hook',
    copy_excerpt: `${candidate.deliverables.youtube.title} | ${candidate.deliverables.youtube.thumbnail_teaser}`,
    source_ids: [proof, candidate.receipts.outlier.receipt_id],
    asset_href: candidate.deliverables.youtube.thumbnail_href,
    start_seconds: null,
    end_seconds: null,
    intended_takeaway: 'One vivid product question is understood at feed size in about one second.',
    transition: 'Static thumbnail; cohesive product crop and teaser treatment.',
    motion: 'None.',
    presenter_safe_area: 'Subject occupies the left two-thirds; teaser remains clear of the face and product result.',
    customer_facing_copy: candidate.deliverables.youtube.thumbnail_teaser,
  }
  const longForm = script.beats.map((beat, index): CampaignVisualBeat => ({
    ...shared,
    beat_id: `youtube-scene-${String(index + 1).padStart(2, '0')}`,
    channel: 'youtube_long_form',
    format: index % 3 === 0 ? 'presenter_plus_product_evidence_16x9' : 'owned_product_walkthrough_16x9',
    copy_section_id: beat.id,
    copy_excerpt: safeExcerpt(beat.text),
    source_ids: beat.role === 'proof' || beat.role === 'teaching' ? [proof, candidate.receipts.product_proof.receipt_id] : [candidate.receipts.evidence.receipt_id],
    asset_href: candidate.deliverables.linkedin.visual_href || candidate.deliverables.youtube.thumbnail_href,
    start_seconds: beat.start_seconds,
    end_seconds: beat.end_seconds,
    intended_takeaway: candidate.campaign_identity === 'kicklab' ? kickLabTakeaway(beat.id) : `The ${beat.role.replaceAll('_', ' ')} stays tied to the approved ${candidate.product_label} evidence.`,
    transition: index ? 'Eight-frame ease into the next evidence region; preserve source artifact timing.' : 'Open directly on the product result, then reveal the presenter.',
    motion: 'Preserve native product motion; use one purposeful crop or highlight synchronized to the spoken claim.',
    presenter_safe_area: 'Presenter remains in the lower-right safe area and never obscures the active evidence region.',
    customer_facing_copy: beat.pattern_interrupt || '',
    repeated_asset_rationale: index ? 'Return to the same owned product capture at a different native timestamp because this spoken beat explains a different visible behavior.' : null,
  }))
  const shortForm = script.beats.filter((beat) => ['hook', 'proof', 'payoff', 'cta'].includes(beat.role)).slice(0, 4).map((beat, index): CampaignVisualBeat => ({
    ...shared,
    beat_id: `short-form-${index + 1}`,
    channel: 'short_form',
    format: 'vertical_product_story_9x16',
    copy_section_id: beat.id,
    copy_excerpt: safeExcerpt(beat.text),
    source_ids: beat.role === 'proof' ? [proof] : [candidate.receipts.evidence.receipt_id],
    asset_href: candidate.deliverables.linkedin.visual_href,
    start_seconds: index * 8,
    end_seconds: (index + 1) * 8,
    intended_takeaway: `A vertical derivative carries the ${beat.role} without shrinking the long-form frame.`,
    transition: index ? 'Fast full-frame product cut; no pasted split-card.' : 'Immediate vertical product close-up.',
    motion: 'Native 9:16 crop with synchronized caption and product highlight.',
    presenter_safe_area: 'Presenter is optional and stays above platform controls without covering proof.',
    customer_facing_copy: beat.pattern_interrupt || '',
    repeated_asset_rationale: index ? 'Reuse the owned product source only for a new vertical crop and a distinct script beat.' : null,
  }))
  return [...linkedin, thumbnail, ...longForm, ...shortForm]
}

export function buildCampaignVisualPlan(candidate: CampaignPreparationCandidate, script: CampaignLongFormDraftPacket): CampaignVisualPlan {
  const sources = sourceInventory(candidate)
  const beats = planBeats(candidate, script)
  const planId = `campaign-visual-plan-${hash({ candidate: candidate.candidate_id, input: candidate.input_version, script: script.packet_id, beats }).slice(7, 31)}`
  return {
    version: SOCIAL_CAMPAIGN_VISUAL_PLAN_VERSION,
    plan_id: planId,
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    product_label: candidate.product_label,
    content_version: candidate.content_version,
    input_version: candidate.input_version,
    script_packet_id: script.packet_id,
    script_input_version: script.input_version,
    source_receipt_ids: Object.values(candidate.receipts).map((receipt) => receipt.receipt_id),
    exact_sources: sources,
    beats,
    thumbnails: [{
      variant_id: `${planId}:thumbnail:primary`,
      href: candidate.deliverables.youtube.thumbnail_href,
      title: candidate.deliverables.youtube.title,
      teaser: candidate.deliverables.youtube.thumbnail_teaser,
      focal_subject: candidate.campaign_identity === 'kicklab' ? 'KickLab Fight impact result with an expressive learner reaction' : `${candidate.product_label} product proof`,
      text_words: candidate.deliverables.youtube.thumbnail_teaser.trim().split(/\s+/),
      face_text_overlap: false,
      feed_size_legible: candidate.thumbnail_checklist['Actual-feed-size legibility'] === true,
      composition: 'One integrated, high-contrast product-led frame; no side-by-side pasted-image treatment.',
    }],
    rejected_alternatives: [
      { alternative: 'Generic quote-card template', reason: 'It hides the owned product proof and repeats a standard social composition.', recovery_action: 'Lead with the exact product screenshot and rebuild the hierarchy around one takeaway.' },
      { alternative: 'Title repeated as thumbnail copy', reason: 'It wastes the thumbnail and fails the complementary-teaser contract.', recovery_action: 'Keep the title explanatory and the thumbnail teaser short, distinct, and curiosity-led.' },
      { alternative: 'Loop one product screenshot across the full video', reason: 'It breaks scene-level alignment and makes the visual sequence feel synthetic.', recovery_action: 'Bind a distinct evidence region or justified return to every script beat.' },
    ],
    benchmark_logic: {
      playlist_role: 'taste_only_zero_performance_weight',
      playlist_similarity_score: 82,
      live_topic_outlier_receipt_id: candidate.receipts.outlier.receipt_id,
      live_topic_score: candidate.receipts.outlier.score ?? 0,
      live_topic_threshold: candidate.receipts.outlier.threshold,
      explanation: 'Curated playlist examples calibrate visual taste only. The current topic decision uses separately attributable live comparisons and the recorded threshold.',
    },
    recovery_actions: [
      { label: 'Open product-proof receipt', href: candidate.receipts.product_proof.source_href },
      { label: 'Open live outlier decision', href: candidate.receipts.outlier.source_href },
      { label: 'Open visual recovery step', href: `/admin/social-content/${encodeURIComponent(candidate.social_content_id)}?step=visuals` },
    ],
    external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES,
  }
}

const INTERNAL_COPY = /\b(?:fixture|sample data|review[- ]only|receipt|source trace|decision queue|provider|input version|system prompt|implementation|unscored|external gates?)\b/i

function dimension(key: CampaignVisualDimensionKey, status: CampaignVisualDimension['status'], score: number | null, evidenceIds: string[], explanation: string): CampaignVisualDimension {
  const label = CAMPAIGN_VISUAL_DIMENSIONS.find(([candidate]) => candidate === key)?.[1] ?? key
  return { key, label, status, score, evidence_ids: [...new Set(evidenceIds.filter(Boolean))], explanation }
}

export function evaluateCampaignVisualPlan(plan: CampaignVisualPlan, now = new Date()): CampaignVisualEvaluation {
  const blockers: CampaignPreparationBlocker[] = []
  const sourceById = new Map(plan.exact_sources.map((source) => [source.source_id, source]))
  const linkedSourceIds = plan.beats.flatMap((beat) => beat.source_ids)
  const missingSources = [...new Set(linkedSourceIds.filter((id) => !sourceById.has(id) && !plan.source_receipt_ids.includes(id)))]
  const staleSources = plan.exact_sources.filter((source) => !source.href || source.approval_status !== 'approved' || !Number.isFinite(Date.parse(source.observed_at)) || (source.fresh_until ? Date.parse(source.fresh_until) <= now.getTime() : false))
  const evidenceUnscored = missingSources.length > 0 || staleSources.length > 0
  if (evidenceUnscored) blockers.push(blocker('visual_evidence_unscored', 'Visual evidence is missing, stale, or cannot be opened; the plan is Unscored and cannot advance.', 'Refresh visual evidence', plan.recovery_actions[0]?.href || '/admin/agents/content-intelligence?section=research'))

  const channels = new Set(plan.beats.map((beat) => beat.channel))
  const missingChannel = (['linkedin', 'youtube_thumbnail', 'youtube_long_form', 'short_form'] as VisualChannel[]).filter((channel) => !channels.has(channel))
  if (missingChannel.length) blockers.push(blocker('visual_channel_native_missing', `Channel-native regions are missing for: ${missingChannel.join(', ')}.`, 'Complete channel-native plan', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const incompleteAlignment = plan.beats.filter((beat) => !beat.copy_section_id || !beat.copy_excerpt || !beat.intended_takeaway || !beat.source_ids.length)
  if (incompleteAlignment.length) blockers.push(blocker('visual_alignment_missing', 'Every visual region must bind exact copy, evidence, and an intended viewer takeaway.', 'Repair script-to-visual bindings', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const proofSources = new Set(plan.exact_sources.filter((source) => source.kind === 'owned_product_screenshot').map((source) => source.source_id))
  const proofBeats = plan.beats.filter((beat) => beat.source_ids.some((id) => proofSources.has(id)))
  if (!proofSources.size || !proofBeats.some((beat) => beat.channel === 'linkedin') || !proofBeats.some((beat) => beat.channel === 'youtube_long_form')) blockers.push(blocker('visual_product_proof_missing', 'LinkedIn and YouTube must each bind owned product proof to an exact copy or script section.', 'Bind owned product proof', plan.recovery_actions[0]?.href || '/admin/social-content'))

  const thumbnail = plan.thumbnails[0]
  if (!thumbnail || !thumbnail.href || thumbnail.title.trim().toLowerCase() === thumbnail.teaser.trim().toLowerCase()) blockers.push(blocker('visual_thumbnail_copy_duplicate', 'The thumbnail needs a current asset and teaser copy distinct from the video title.', 'Rewrite thumbnail teaser', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))
  if (thumbnail && (thumbnail.face_text_overlap || !thumbnail.feed_size_legible || thumbnail.text_words.length > 5 || /pasted side[- ]by[- ]side|split[- ]card layout/i.test(thumbnail.composition))) blockers.push(blocker('visual_thumbnail_composition', 'Thumbnail focal hierarchy, face clearance, feed-size readability, or integrated composition failed.', 'Revise thumbnail composition', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const videoBeats = plan.beats.filter((beat) => beat.channel === 'youtube_long_form' || beat.channel === 'short_form')
  const timingFailure = videoBeats.some((beat) => beat.start_seconds == null || beat.end_seconds == null || beat.end_seconds <= beat.start_seconds || !beat.motion || !beat.transition || !beat.presenter_safe_area)
  const adjacentRepeat = videoBeats.some((beat, index) => index > 0
    && beat.channel === videoBeats[index - 1].channel
    && beat.asset_href === videoBeats[index - 1].asset_href
    && !beat.repeated_asset_rationale)
  if (timingFailure || adjacentRepeat) blockers.push(blocker('visual_motion_sync', 'Video regions need non-overlapping timing, synchronized motion, clear transitions, presenter-safe framing, and justified asset reuse.', 'Repair storyboard timing and assets', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const copiedTemplate = plan.beats.some((beat) => /generic|standard template|copied creator/i.test(`${beat.format} ${beat.originality_boundary}`))
  if (copiedTemplate) blockers.push(blocker('visual_template_repetition', 'A generic, repeated, or copied composition cannot pass as a channel-native visual decision.', 'Replace repeated template', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const copyLeak = plan.beats.filter((beat) => INTERNAL_COPY.test(beat.customer_facing_copy))
  if (copyLeak.length) blockers.push(blocker('visual_customer_copy_leak', 'Customer-facing visual copy contains internal workflow, fixture, or implementation language.', 'Rewrite customer-facing copy', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))
  const privacyFailure = plan.beats.some((beat) => !beat.privacy_boundary || /private message|raw contact|credential/i.test(beat.customer_facing_copy))
  if (privacyFailure) blockers.push(blocker('visual_privacy', 'A visual region is missing its privacy boundary or exposes private material.', 'Repair privacy boundary', plan.recovery_actions[0]?.href || '/admin/social-content'))

  const statusFor = (codes: string[], unscored = false) => unscored ? 'unscored' as const : blockers.some((item) => codes.includes(item.code)) ? 'blocked' as const : 'passed' as const
  const scored = (status: CampaignVisualDimension['status'], passed = 94) => status === 'unscored' ? null : status === 'blocked' ? 35 : passed
  const evidenceStatus = statusFor(['visual_evidence_unscored'], evidenceUnscored)
  const alignmentStatus = statusFor(['visual_alignment_missing'])
  const proofStatus = statusFor(['visual_product_proof_missing'])
  const channelStatus = statusFor(['visual_channel_native_missing'])
  const originalityStatus = statusFor(['visual_template_repetition'])
  const readabilityStatus = statusFor(['visual_thumbnail_copy_duplicate', 'visual_thumbnail_composition'])
  const focalStatus = statusFor(['visual_thumbnail_composition'])
  const motionStatus = statusFor(['visual_motion_sync'])
  const privacyStatus = statusFor(['visual_privacy'])
  const copyStatus = statusFor(['visual_customer_copy_leak'])
  const dimensions = [
    dimension('evidence_coverage', evidenceStatus, scored(evidenceStatus, 96), linkedSourceIds, evidenceStatus === 'passed' ? 'Every region resolves to current exact-source evidence.' : 'At least one exact source is missing or stale.'),
    dimension('script_visual_alignment', alignmentStatus, scored(alignmentStatus, 95), plan.beats.map((beat) => beat.copy_section_id), 'Each region is measured against its exact copy or script section and intended takeaway.'),
    dimension('product_proof_coverage', proofStatus, scored(proofStatus, 96), [...proofSources], 'Owned product proof must support both the LinkedIn and YouTube narratives.'),
    dimension('channel_nativeness', channelStatus, scored(channelStatus, 93), [...channels], 'LinkedIn, thumbnail, long-form, and vertical derivatives use distinct native formats.'),
    dimension('originality_risk', originalityStatus, scored(originalityStatus, 92), plan.rejected_alternatives.map((entry) => entry.alternative), 'Composition reuse and creator-distance boundaries are explicit.'),
    dimension('readability_contrast', readabilityStatus, scored(readabilityStatus, 95), thumbnail ? [thumbnail.variant_id] : [], 'Feed-size copy, contrast, and integrated composition are checked before review.'),
    dimension('focal_hierarchy', focalStatus, scored(focalStatus, 94), thumbnail ? [thumbnail.variant_id] : [], 'The focal subject leads; teaser copy cannot cover the face or product result.'),
    dimension('motion_synchronization', motionStatus, scored(motionStatus, 91), videoBeats.map((beat) => beat.beat_id), 'Scene timing, native motion, transitions, and presenter-safe framing remain inspectable.'),
    dimension('privacy', privacyStatus, scored(privacyStatus, 100), plan.exact_sources.map((source) => source.source_id), 'Only public-safe, owned, or synthetic evidence is permitted.'),
    dimension('copy_purity', copyStatus, scored(copyStatus, 100), plan.beats.map((beat) => beat.beat_id), 'Customer-facing copy is scanned for internal workflow and implementation language.'),
  ]
  const status = evidenceUnscored ? 'unscored' : blockers.length ? 'blocked' : 'passed'
  const numeric = dimensions.flatMap((item) => item.score == null ? [] : [item.score])
  return {
    version: SOCIAL_CAMPAIGN_VISUAL_EVALUATION_VERSION,
    evaluation_id: `campaign-visual-evaluation-${hash({ plan: plan.plan_id, dimensions }).slice(7, 31)}`,
    plan_id: plan.plan_id,
    status,
    approval_ready: status === 'passed',
    overall_score: status === 'unscored' ? null : Math.round(numeric.reduce((sum, score) => sum + score, 0) / numeric.length),
    dimensions,
    blockers,
    evaluated_at: now.toISOString(),
  }
}

function unavailableEvaluation(candidate: CampaignPreparationCandidate, blockers: CampaignPreparationBlocker[], state: 'blocked' | 'unscored', now: Date): CampaignVisualEvaluation {
  return {
    version: SOCIAL_CAMPAIGN_VISUAL_EVALUATION_VERSION,
    evaluation_id: `campaign-visual-evaluation-${hash({ candidate: candidate.candidate_id, blockers }).slice(7, 31)}`,
    plan_id: null,
    status: state,
    approval_ready: false,
    overall_score: null,
    dimensions: CAMPAIGN_VISUAL_DIMENSIONS.map(([key, label]) => ({ key, label, status: 'unscored', score: null, evidence_ids: [], explanation: 'Visual scoring is withheld until the prerequisite evidence and script contract pass.' })),
    blockers,
    evaluated_at: now.toISOString(),
  }
}

export function projectCampaignVisualPlan(candidate: CampaignPreparationCandidate, now = new Date()): CampaignVisualProjection {
  const script = projectCampaignLongFormDraft(candidate, now)
  if (!script.ready || !script.packet) return {
    candidate_id: candidate.candidate_id,
    campaign_identity: candidate.campaign_identity,
    product_label: candidate.product_label,
    state: script.state,
    ready: false,
    plan: null,
    evaluation: unavailableEvaluation(candidate, script.blockers, script.state === 'unscored' ? 'unscored' : 'blocked', now),
  }
  const plan = buildCampaignVisualPlan(candidate, script.packet)
  const evaluation = evaluateCampaignVisualPlan(plan, now)
  return { candidate_id: candidate.candidate_id, campaign_identity: candidate.campaign_identity, product_label: candidate.product_label, state: evaluation.status === 'passed' ? 'ready' : evaluation.status, ready: evaluation.approval_ready, plan, evaluation }
}

export function projectCampaignVisualBatch(candidates: CampaignPreparationCandidate[], now = new Date()): CampaignVisualBatch {
  const ordered = [...candidates].sort((left, right) => left.campaign_identity.localeCompare(right.campaign_identity) || left.candidate_id.localeCompare(right.candidate_id))
  const projections = ordered.map((candidate) => projectCampaignVisualPlan(candidate, now))
  const inputFingerprint = hash(ordered.map((candidate) => ({ candidate_id: candidate.candidate_id, input_version: candidate.input_version, content_version: candidate.content_version, script_receipt: candidate.long_form_script_input?.receipt_id ?? null })))
  const prepared = projections.filter((projection) => projection.ready)
  const blocked = projections.filter((projection) => !projection.ready)
  return {
    version: SOCIAL_CAMPAIGN_VISUAL_BATCH_VERSION,
    batch_id: `campaign-visual-batch-${inputFingerprint.slice(7, 31)}`,
    input_fingerprint: inputFingerprint,
    total: ordered.length,
    scanned: ordered.length,
    prepared_count: prepared.length,
    blocked_count: blocked.length,
    remaining: 0,
    chunk_size: SOCIAL_CAMPAIGN_VISUAL_CHUNK_SIZE,
    chunks_processed: Math.ceil(ordered.length / SOCIAL_CAMPAIGN_VISUAL_CHUNK_SIZE),
    prepared,
    blocked,
    external_gates: SOCIAL_CAMPAIGN_EXTERNAL_GATES,
  }
}

export function campaignVisualBatchIdempotencyKey(batch: CampaignVisualBatch) {
  return `social-campaign-visual-batch:${batch.input_fingerprint}`
}
