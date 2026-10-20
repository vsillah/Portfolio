import storyboardAssetReceipt from '@/artifacts/research/social-campaign-storyboard-assets-2026-10-19/receipt.json'
import jevHeroReceipt from '@/artifacts/research/jev-hero-thumbnail-candidates-2026-10-19/receipt.json'
import darkCastleHeroReceipt from '@/artifacts/research/dark-castle-hero-thumbnail-candidates-2026-10-19/receipt.json'
import aiAuditHeroReceipt from '@/artifacts/research/ai-audit-hero-thumbnail-candidates-2026-10-19/receipt.json'
import type {
  SocialVideoAdaptationInput,
  SocialVideoAdaptationReceipt,
  SocialVideoEvidenceAsset,
  SocialVideoScene,
  SocialVideoTarget,
} from '@/lib/social-video-adaptation'
import { validateYouTubeThumbnailHeroEvidence } from '@/lib/youtube-thumbnail-hero-evidence'

export const SOCIAL_CAMPAIGN_STORYBOARD_REVIEW_VERSION = 'social-campaign-storyboard-review/v1' as const

export const SOCIAL_CAMPAIGN_STORYBOARD_EXTERNAL_GATES = {
  provider_generation: false,
  render: false,
  production_read: false,
  production_write: false,
  upload: false,
  platform_draft: false,
  schedule: false,
  publish: false,
  credential_change: false,
  spending: false,
  external_send: false,
} as const

export type StoryboardEvidenceGateKey =
  | 'source'
  | 'outlier'
  | 'product_proof'
  | 'description'
  | 'hero'
  | 'thumbnail'
  | 'script'
  | 'privacy'
  | 'rights'
  | 'freshness'
  | 'originality'

export type StoryboardEvidenceGate = {
  key: StoryboardEvidenceGateKey
  label: string
  status: 'passed' | 'blocked' | 'stale'
  detail: string
  receipt_ids: string[]
  observed_at: string | null
  fresh_until: string | null
  recovery_label: string
  recovery_href: string
}

export type CampaignStoryboardReviewAsset = {
  asset_id: string
  campaign_identity: string
  role: 'youtube_thumbnail_review'
  public_path: string
  width: number
  height: number
  aspect_ratio: '16:9'
  title: string
  teaser: string
  focal_subject: string
  focal_hierarchy: string[]
  product_proof_path: string
  source_receipt_ids: string[]
  provider: 'none' | 'openai-imagegen'
  review_only: true
  sha256: string
  direction?: string
  feed_preview_path?: string
  feed_preview_sha256?: string
  safe_text_region?: { x: number; y: number; width: number; height: number }
  hero_asset_id?: string
  evidence_trace?: Array<{
    decision_dimension: string
    cohort_id: string
    live_evidence_video_ids: string[]
    evidence_role: string
    rationale: string
  }>
  fixture_label?: 'Synthetic contract fixture · not final artwork' | 'New campaign-specific generation · review only'
  final_use_eligible?: boolean
  selection_status?: 'selected' | 'rejected' | 'pending_human_qa' | 'review_direction'
  selection_reason?: string
  rejection_reason_code?: string
  rejection_reason?: string
  composition_intent?: string
  customer_facing: true
  approval_status: 'review_direction_only' | 'human_qa_pending' | 'human_qa_selected' | 'human_qa_rejected'
  title_thumbnail_distinct: true
  logo_path: '/amadutown-logo-upscaled.png'
  logo_aspect_ratio: 'natural_portrait'
}

export type CampaignStoryboardScene = {
  scene_id: string
  target: SocialVideoTarget
  start_seconds: number
  end_seconds: number
  duration_seconds: number
  spoken_beat: string
  customer_facing_copy: string[]
  proof: Array<{
    asset_id: string
    label: string
    href: string
    source_receipt_ids: string[]
    privacy_receipt_id: string
    rights_receipt_id: string
  }>
  shot: {
    type: string
    framing: string
    camera_angle: string
    camera_movement: string
  }
  avatar_environment_direction: string
  asset_animation: string
  transition: string
  continuity: string[]
  b_roll_cue: string
  music_ducking_note: string
  proof_source_binding: {
    campaign_identity: string
    channel: 'youtube'
    content_version: string
    script_input_version: string
    approved_scene_id: string
    claim_ids: string[]
    source_receipt_ids: string[]
    artifact_ids: string[]
  }
  cta_delivery: {
    required: boolean
    spoken_line: string | null
    exception_receipt_id: null
  }
  asset_reuse_rationale: string | null
}

export type CampaignStoryboardReviewPacket = {
  version: typeof SOCIAL_CAMPAIGN_STORYBOARD_REVIEW_VERSION
  packet_id: string
  campaign_identity: string
  product_label: string
  channel: 'youtube'
  calendar_item_id: string
  social_content_id: string
  content_version: string
  script_input_version: string
  adaptation_id: string
  source_receipt_ids: string[]
  asset_receipt_id: string
  hero_evidence: {
    receipt_id: string
    status: 'passed' | 'blocked'
    hero_assets: Array<{
      asset_id: string
      public_path: string
      focal_subject: string
      digital_source_type: string
      provenance_note: string
    }>
    product_proof: {
      asset_id: string
      public_path: string
      role: string
    }
    outlier_evidence: {
      cohort_id: string
      decision_receipt_id: string
      observed_at: string
      fresh_until: string
      included_video_ids: string[]
      qualified_outlier_video_ids: string[]
      curated_playlist_role: 'taste_calibration_only'
      curated_playlist_performance_weight: 0
    }
  } | null
  selection_decision: {
    receipt_id: string
    status: 'human_qa_approved' | 'pending_human_qa'
    decided_at: string | null
    content_version: string
    selected_asset_id: string | null
    selected_asset_path: string | null
    rejected_asset_ids: string[]
    decision_logic?: string
  } | null
  assets: CampaignStoryboardReviewAsset[]
  evidence_gates: StoryboardEvidenceGate[]
  scenes: CampaignStoryboardScene[]
  status: 'review_direction_blocked' | 'ready_for_human_review'
  blockers: string[]
  recovery_actions: Array<{ label: string; href: string }>
  value_summary: string
  external_gates: typeof SOCIAL_CAMPAIGN_STORYBOARD_EXTERNAL_GATES
}

type GateSeed = Pick<StoryboardEvidenceGate, 'status' | 'detail' | 'receipt_ids' | 'observed_at' | 'fresh_until'>

export type CampaignStoryboardReviewConfig = {
  campaign_identity: string
  product_label: string
  calendar_item_id: string
  social_content_id: string
  current_content_version: string
  evaluated_at: string
  title: string
  teaser: string
  description_gate: GateSeed
  outlier_gate: GateSeed
  thumbnail_gate: GateSeed
  script_gate: GateSeed
  conclusion: string
  spoken_cta: string
  recovery_href: string
  value_summary: string
}

const gateLabels: Record<StoryboardEvidenceGateKey, string> = {
  source: 'Source',
  outlier: 'Live topic outlier',
  product_proof: 'Product proof',
  description: 'Description',
  hero: 'Campaign-specific hero',
  thumbnail: 'Thumbnail',
  script: 'Script and spoken CTA',
  privacy: 'Privacy',
  rights: 'Rights',
  freshness: 'Freshness and exact version',
  originality: 'Originality',
}

const gateRecovery: Record<StoryboardEvidenceGateKey, string> = {
  source: 'Repair source binding',
  outlier: 'Refresh live outlier evidence',
  product_proof: 'Restore owned product proof',
  description: 'Complete description evidence',
  hero: 'Repair hero evidence',
  thumbnail: 'Evaluate the exact thumbnail',
  script: 'Review the exact script and CTA',
  privacy: 'Complete privacy review',
  rights: 'Complete rights review',
  freshness: 'Rebind the current version',
  originality: 'Complete originality review',
}

function receiptPassed(receipt: SocialVideoAdaptationReceipt | undefined) {
  return Boolean(receipt && ['approved', 'passed', 'complete'].includes(receipt.status))
}

function receiptSeed(receipt: SocialVideoAdaptationReceipt | undefined, passed: string, blocked: string): GateSeed {
  return {
    status: receiptPassed(receipt) ? 'passed' : 'blocked',
    detail: receiptPassed(receipt) ? passed : blocked,
    receipt_ids: receipt?.receipt_id ? [receipt.receipt_id] : [],
    observed_at: receipt?.reviewed_at ?? null,
    fresh_until: receipt?.valid_until ?? null,
  }
}

function gate(key: StoryboardEvidenceGateKey, seed: GateSeed, recoveryHref: string): StoryboardEvidenceGate {
  return {
    key,
    label: gateLabels[key],
    ...seed,
    recovery_label: gateRecovery[key],
    recovery_href: recoveryHref,
  }
}

function validUntil(receipts: SocialVideoAdaptationReceipt[]) {
  return receipts.flatMap((receipt) => receipt.valid_until ? [receipt.valid_until] : []).sort()[0] ?? null
}

function freshnessGate(input: SocialVideoAdaptationInput, config: CampaignStoryboardReviewConfig): GateSeed {
  const receipts = Object.values(input.receipts).filter((receipt): receipt is SocialVideoAdaptationReceipt => Boolean(receipt))
  const stale = receipts.filter((receipt) => receipt.valid_until && Date.parse(receipt.valid_until) < Date.parse(config.evaluated_at))
  if (input.input_version !== config.current_content_version) return {
    status: 'stale',
    detail: 'The approved adaptation input no longer matches the current Social Content version. The storyboard remains visible as a review direction, but it cannot advance.',
    receipt_ids: receipts.map((receipt) => receipt.receipt_id),
    observed_at: input.generated_at,
    fresh_until: validUntil(receipts),
  }
  if (stale.length) return {
    status: 'stale',
    detail: `${stale.length} required receipt${stale.length === 1 ? '' : 's'} expired before this review.`,
    receipt_ids: stale.map((receipt) => receipt.receipt_id),
    observed_at: input.generated_at,
    fresh_until: validUntil(receipts),
  }
  return {
    status: 'passed',
    detail: 'The adaptation input matches the current content version and every dated source receipt remains inside its declared freshness window.',
    receipt_ids: receipts.map((receipt) => receipt.receipt_id),
    observed_at: input.generated_at,
    fresh_until: validUntil(receipts),
  }
}

function proofGate(input: SocialVideoAdaptationInput): GateSeed {
  const complete = input.evidence_assets.length > 0 && input.evidence_assets.every((asset) => (
    asset.reference
    && asset.source_receipt_ids.length
    && asset.privacy_receipt_id
    && asset.rights_receipt_id
  ))
  return {
    status: complete ? 'passed' : 'blocked',
    detail: complete
      ? `${input.evidence_assets.length} owned or public-safe product proof asset${input.evidence_assets.length === 1 ? ' is' : 's are'} bound to source, privacy, and rights receipts.`
      : 'Every visible product artifact needs a source, privacy, and rights binding.',
    receipt_ids: [...new Set(input.evidence_assets.flatMap((asset) => [...asset.source_receipt_ids, asset.privacy_receipt_id, asset.rights_receipt_id]))],
    observed_at: input.generated_at,
    fresh_until: null,
  }
}

function heroReceiptFor(campaignIdentity: string) {
  if (campaignIdentity === 'jev') return jevHeroReceipt
  if (campaignIdentity === 'dark-castle-chess') return darkCastleHeroReceipt
  if (campaignIdentity === 'ai-audit-calculator') return aiAuditHeroReceipt
  return null
}

function heroGate(config: CampaignStoryboardReviewConfig): GateSeed {
  const receipt = heroReceiptFor(config.campaign_identity)
  if (!receipt) return {
    status: 'blocked',
    detail: 'This YouTube campaign has no current campaign-specific hero evidence receipt. A product screenshot or text-first template cannot substitute for the hero.',
    receipt_ids: [],
    observed_at: null,
    fresh_until: null,
  }

  const validation = validateYouTubeThumbnailHeroEvidence(
    receipt,
    config.current_content_version,
    config.evaluated_at,
  )
  return {
    status: validation.review_ready ? 'passed' : 'blocked',
    detail: validation.review_ready
      ? `${receipt.candidates.length} newly generated, campaign-specific integrated scenes pass provenance, likeness, anatomy, freshness, repetition, feed-size, and product-interaction checks.${validation.ready ? '' : ' Final-use eligibility remains closed until Human QA selects one candidate.'}`
      : validation.fixture_ready
        ? `${receipt.candidates.length} integrated synthetic contract fixtures pass the local evidence contract. Real campaign-specific likeness generation remains blocked pending explicit provider authorization.`
        : validation.blockers.join(' '),
    receipt_ids: [receipt.receipt_id, receipt.outlier_evidence.decision_receipt_id],
    observed_at: receipt.outlier_evidence.observed_at,
    fresh_until: receipt.outlier_evidence.fresh_until,
  }
}

function assetHref(asset: SocialVideoEvidenceAsset) {
  if (asset.reference.startsWith('youtube-packet-review-2026-10-14/')) return `/review-assets/social-content/source-proof/${asset.reference.split('/').at(-1)}`
  if (asset.reference.startsWith('https://dark-castle-chess.vercel.app/welcome/media/')) return `/review-assets/social-content/storyboard-review/${asset.reference.split('/').at(-1)}`
  return asset.reference
}

function sceneProof(input: SocialVideoAdaptationInput, scene: SocialVideoScene) {
  return scene.artifact_ids.flatMap((artifactId) => {
    const asset = input.evidence_assets.find((entry) => entry.asset_id === artifactId)
    if (!asset) return []
    return [{
      asset_id: asset.asset_id,
      label: asset.label,
      href: assetHref(asset),
      source_receipt_ids: asset.source_receipt_ids,
      privacy_receipt_id: asset.privacy_receipt_id,
      rights_receipt_id: asset.rights_receipt_id,
    }]
  })
}

function customerCopy(scene: SocialVideoScene, campaignIdentity: string) {
  const safe = scene.on_screen_text.filter((value) => !/(provider|receipt|source|fixture|operator|sample data|prompt|code logic|hold)/i.test(value))
  if (safe.length) return safe
  if (campaignIdentity === 'jev') return ['Score · rule · human decision']
  return ['Position · choice · consequence · lesson']
}

function spokenBeat(scene: SocialVideoScene, config: CampaignStoryboardReviewConfig) {
  if (scene.scene_id.endsWith('traceability') || scene.scene_id.endsWith('close')) return `${config.conclusion} ${config.spoken_cta}`
  return scene.narration
}

const longFormShots = [
  ['consequence cold open', 'tight product detail with breathing room for one line of copy', 'low three-quarter', 'slow 5% push toward the decision point'],
  ['over-shoulder product inspection', 'medium-wide evidence view', 'eye level', 'gentle lateral drift that stops on the proof region'],
  ['decision-region macro', 'close product crop with surrounding context retained', 'high three-quarter', '12-frame rack from context to evidence'],
  ['human-ownership reset', 'presenter-safe medium frame beside product proof', 'eye level', 'measured pull-back to reveal the governing context'],
  ['proof-sequence wide', 'wide product composition with one dominant evidence region', 'slight overhead', 'controlled pan that follows the approved artifact order'],
  ['spoken close', 'quiet medium frame with product proof held behind the CTA', 'eye level', 'two-second settle and hold'],
] as const

const shortFormShots = [
  ['vertical pattern interrupt', 'tight 9:16 product crop', 'slight low angle', 'eight-frame snap-in, then hold'],
  ['vertical evidence handoff', 'medium 9:16 proof sequence', 'eye level', 'fast focus handoff between approved product regions'],
  ['vertical spoken close', 'center-safe close with product proof retained', 'eye level', 'one-second decelerating push and final hold'],
] as const

function timedScenes(input: SocialVideoAdaptationInput, config: CampaignStoryboardReviewConfig): CampaignStoryboardScene[] {
  const formatDurations = new Map(input.draft.format_adaptations.map((format) => [format.target, format.target_duration_seconds]))
  const scenes: CampaignStoryboardScene[] = []
  for (const target of ['youtube_long_form', 'youtube_shorts'] as const) {
    const targetScenes = input.draft.scenes.filter((scene) => scene.target === target)
    if (!targetScenes.length) continue
    const total = formatDurations.get(target) ?? (target === 'youtube_shorts' ? 45 : 240)
    const weights = targetScenes.map((scene) => Math.max(12, scene.narration.split(/\s+/).filter(Boolean).length))
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
    let cursor = 0
    targetScenes.forEach((scene, index) => {
      const end = index === targetScenes.length - 1 ? total : Math.round((cursor + (total * weights[index] / weightTotal)) * 10) / 10
      const proof = sceneProof(input, scene)
      const shot = (target === 'youtube_shorts' ? shortFormShots : longFormShots)[index % (target === 'youtube_shorts' ? shortFormShots.length : longFormShots.length)]
      const previous = targetScenes[index - 1]
      const repeated = previous?.artifact_ids.some((artifactId) => scene.artifact_ids.includes(artifactId)) ?? false
      const isClose = index === targetScenes.length - 1
      scenes.push({
        scene_id: scene.scene_id,
        target,
        start_seconds: cursor,
        end_seconds: end,
        duration_seconds: Math.round((end - cursor) * 10) / 10,
        spoken_beat: spokenBeat(scene, config),
        customer_facing_copy: customerCopy(scene, config.campaign_identity),
        proof,
        shot: { type: shot[0], framing: shot[1], camera_angle: shot[2], camera_movement: shot[3] },
        avatar_environment_direction: target === 'youtube_shorts'
          ? 'No generated avatar in this provider-free review. Reserve the upper third for a future presenter crop; keep the product result centered above platform controls.'
          : 'No generated avatar in this provider-free review. Reserve the left third for a future presenter while the owned product proof remains readable across the right two-thirds.',
        asset_animation: index % 2
          ? 'Preserve the source pixels; use a slow crop change that lands on the exact evidence region named in the spoken beat.'
          : 'Preserve the source pixels; begin on the visible consequence, then ease outward to reveal the decision context.',
        transition: index === 0
          ? 'Open on the consequence before explanation; no decorative title animation.'
          : 'Use an eight-frame eased dissolve or matched camera-axis handoff; never stack two proof assets at once.',
        continuity: [
          'Keep product state chronology intact.',
          'Keep captions and any future presenter clear of the active evidence region.',
          'Show one proof asset at a time and preserve its natural aspect ratio.',
        ],
        b_roll_cue: proof.length
          ? `${proof.map((item) => item.label).join(' then ')} from ${cursor}s to ${end}s; hold long enough to inspect the exact product state.`
          : 'No B-roll until an owned, source-bound product asset is attached.',
        music_ducking_note: 'Use a low, lyric-free bed only after music rights review; duck 9 dB under product explanation and 12 dB under the spoken close. Silence remains the default for this review packet.',
        proof_source_binding: {
          campaign_identity: config.campaign_identity,
          channel: 'youtube',
          content_version: config.current_content_version,
          script_input_version: input.input_version,
          approved_scene_id: scene.scene_id,
          claim_ids: scene.claim_ids,
          source_receipt_ids: scene.source_receipt_ids,
          artifact_ids: scene.artifact_ids,
        },
        cta_delivery: { required: isClose, spoken_line: isClose ? config.spoken_cta : null, exception_receipt_id: null },
        asset_reuse_rationale: repeated ? 'The same owned artifact carries the next approved evidence region; the crop, scale, and proof focus change, and no concurrent duplicate appears.' : null,
      })
      cursor = end
    })
  }
  return scenes
}

function reviewAssets(config: CampaignStoryboardReviewConfig): CampaignStoryboardReviewAsset[] {
  const receipt = heroReceiptFor(config.campaign_identity)
  if (receipt) return receipt.candidates.map((asset) => ({
    asset_id: asset.candidate_id,
    campaign_identity: asset.campaign_identity,
    role: 'youtube_thumbnail_review' as const,
    public_path: asset.public_path,
    width: asset.width,
    height: asset.height,
    aspect_ratio: '16:9' as const,
    title: asset.title,
    teaser: asset.teaser,
    focal_subject: asset.focal_subject,
    focal_hierarchy: ['Campaign-specific human hero', 'Short decision-boundary hook', 'Natural-aspect-ratio AmaduTown mark'],
    product_proof_path: receipt.product_proof.public_path,
    source_receipt_ids: [receipt.receipt_id, receipt.outlier_evidence.decision_receipt_id],
    provider: 'openai-imagegen' as const,
    review_only: true as const,
    sha256: asset.sha256,
    direction: asset.direction,
    feed_preview_path: asset.feed_preview_path,
    feed_preview_sha256: asset.feed_preview_sha256,
    safe_text_region: asset.safe_text_region,
    hero_asset_id: asset.hero_binding.hero_asset_id,
    fixture_label: receipt.generation_request.real_generation_completed
      ? 'New campaign-specific generation · review only' as const
      : 'Synthetic contract fixture · not final artwork' as const,
    final_use_eligible: asset.final_use_eligible,
    selection_status: asset.selection_status as 'selected' | 'rejected' | 'pending_human_qa',
    selection_reason: asset.selection_reason ?? undefined,
    rejection_reason_code: 'rejection_reason_code' in asset ? asset.rejection_reason_code ?? undefined : undefined,
    rejection_reason: 'rejection_reason' in asset ? asset.rejection_reason ?? undefined : undefined,
    composition_intent: asset.integration.pose_gaze_gesture_relationship,
    evidence_trace: asset.evidence_trace,
    customer_facing: true as const,
    approval_status: asset.selection_status === 'selected'
      ? 'human_qa_selected' as const
      : asset.selection_status === 'rejected'
        ? 'human_qa_rejected' as const
        : 'human_qa_pending' as const,
    title_thumbnail_distinct: true as const,
    logo_path: '/amadutown-logo-upscaled.png' as const,
    logo_aspect_ratio: 'natural_portrait' as const,
  }))

  return storyboardAssetReceipt.assets
    .filter((asset) => asset.campaign_identity === config.campaign_identity)
    .filter((asset) => asset.title === config.title && asset.teaser === config.teaser)
    .map((asset) => ({
      ...asset,
      role: 'youtube_thumbnail_review' as const,
      aspect_ratio: '16:9' as const,
      provider: 'none' as const,
      review_only: true as const,
      selection_status: 'review_direction' as const,
      final_use_eligible: false,
      customer_facing: true as const,
      approval_status: 'review_direction_only' as const,
      title_thumbnail_distinct: true as const,
      logo_path: '/amadutown-logo-upscaled.png' as const,
      logo_aspect_ratio: 'natural_portrait' as const,
    }))
}

function heroEvidenceProjection(receipt: NonNullable<ReturnType<typeof heroReceiptFor>>, config: CampaignStoryboardReviewConfig) {
  return {
    receipt_id: receipt.receipt_id,
    status: heroGate(config).status === 'passed' ? 'passed' as const : 'blocked' as const,
    hero_assets: receipt.hero_assets.map((hero) => ({
      asset_id: hero.asset_id,
      public_path: hero.public_path,
      focal_subject: hero.focal_subject,
      digital_source_type: hero.source_type,
      provenance_note: hero.provenance_note,
    })),
    product_proof: {
      asset_id: receipt.product_proof.asset_id,
      public_path: receipt.product_proof.public_path,
      role: receipt.product_proof.role,
    },
    outlier_evidence: {
      cohort_id: receipt.outlier_evidence.cohort_id,
      decision_receipt_id: receipt.outlier_evidence.decision_receipt_id,
      observed_at: receipt.outlier_evidence.observed_at,
      fresh_until: receipt.outlier_evidence.fresh_until,
      included_video_ids: receipt.outlier_evidence.included_video_ids,
      qualified_outlier_video_ids: receipt.outlier_evidence.qualified_outlier_video_ids,
      curated_playlist_role: 'taste_calibration_only' as const,
      curated_playlist_performance_weight: 0 as const,
    },
  }
}

function selectionDecisionProjection(receipt: NonNullable<ReturnType<typeof heroReceiptFor>>) {
  const selected = receipt.candidates.find((candidate) => candidate.candidate_id === receipt.selection_decision.selected_candidate_id)
  return {
    receipt_id: receipt.selection_decision.receipt_id,
    status: receipt.selection_decision.status as 'human_qa_approved' | 'pending_human_qa',
    decided_at: receipt.selection_decision.decided_at,
    content_version: receipt.selection_decision.content_version,
    selected_asset_id: receipt.selection_decision.selected_candidate_id,
    selected_asset_path: selected?.public_path ?? null,
    rejected_asset_ids: receipt.selection_decision.rejected_candidates.map((candidate) => candidate.candidate_id),
    decision_logic: 'decision_logic' in receipt.selection_decision ? receipt.selection_decision.decision_logic : undefined,
  }
}

export function buildCampaignHeroThumbnailReview(config: Pick<CampaignStoryboardReviewConfig, 'campaign_identity' | 'product_label' | 'current_content_version' | 'evaluated_at' | 'recovery_href'> & { calendar_item_id: string }) {
  const receipt = heroReceiptFor(config.campaign_identity)
  if (!receipt) throw new Error(`No campaign-specific hero receipt exists for ${config.campaign_identity}.`)
  const validation = validateYouTubeThumbnailHeroEvidence(receipt, config.current_content_version, config.evaluated_at)
  const storyboardConfig = {
    ...config,
    social_content_id: config.calendar_item_id,
    title: receipt.candidates[0]?.title ?? config.product_label,
    teaser: receipt.candidates[0]?.teaser ?? '',
    description_gate: { status: 'blocked' as const, detail: '', receipt_ids: [], observed_at: null, fresh_until: null },
    outlier_gate: { status: 'passed' as const, detail: '', receipt_ids: [], observed_at: null, fresh_until: null },
    thumbnail_gate: { status: 'blocked' as const, detail: '', receipt_ids: [], observed_at: null, fresh_until: null },
    script_gate: { status: 'blocked' as const, detail: '', receipt_ids: [], observed_at: null, fresh_until: null },
    conclusion: '',
    spoken_cta: '',
    value_summary: '',
  }
  return {
    campaign_identity: config.campaign_identity,
    product_label: config.product_label,
    calendar_item_id: config.calendar_item_id,
    content_version: config.current_content_version,
    receipt_id: receipt.receipt_id,
    status: validation.ready ? 'ready' as const : validation.review_ready ? 'pending_human_qa' as const : 'blocked' as const,
    blockers: validation.blockers,
    recovery_actions: validation.recovery_actions.map((label) => ({ label, href: config.recovery_href })),
    assets: reviewAssets(storyboardConfig),
    hero_evidence: heroEvidenceProjection(receipt, storyboardConfig),
    selection_decision: selectionDecisionProjection(receipt),
    generation: receipt.generation_request,
    external_gates: SOCIAL_CAMPAIGN_STORYBOARD_EXTERNAL_GATES,
  }
}

export function buildCampaignStoryboardReview(
  input: SocialVideoAdaptationInput,
  config: CampaignStoryboardReviewConfig,
): CampaignStoryboardReviewPacket {
  const heroReceipt = heroReceiptFor(config.campaign_identity)
  const source = input.receipts.source
  const privacy = input.receipts.privacy
  const rights = input.receipts.rights
  const originality = input.receipts.challenger
  const gates = [
    gate('source', receiptSeed(source, 'The source packet is approved and bound to the existing campaign identity.', 'A passed source receipt is required.'), config.recovery_href),
    gate('outlier', config.outlier_gate, config.recovery_href),
    gate('product_proof', proofGate(input), config.recovery_href),
    gate('description', config.description_gate, config.recovery_href),
    gate('hero', heroGate(config), config.recovery_href),
    gate('thumbnail', config.thumbnail_gate, config.recovery_href),
    gate('script', config.script_gate, config.recovery_href),
    gate('privacy', receiptSeed(privacy, 'The public-safe privacy receipt passed.', 'A passed privacy receipt is required.'), config.recovery_href),
    gate('rights', receiptSeed(rights, 'The owned-public-assets rights receipt passed.', 'A passed rights receipt is required.'), config.recovery_href),
    gate('freshness', freshnessGate(input, config), config.recovery_href),
    gate('originality', receiptSeed(originality, 'The challenger/originality receipt passed and public comparison pixels carry no composition authority.', 'A passed originality receipt is required.'), config.recovery_href),
  ]
  const assets = reviewAssets(config)
  if (!assets.length) gates.find((entry) => entry.key === 'thumbnail')!.status = 'blocked'
  const blockers = gates.filter((entry) => entry.status !== 'passed').map((entry) => `${entry.label}: ${entry.detail}`)
  const recoveryActions = [...new Map(gates.filter((entry) => entry.status !== 'passed').map((entry) => [entry.recovery_label, { label: entry.recovery_label, href: entry.recovery_href }])).values()]
  return {
    version: SOCIAL_CAMPAIGN_STORYBOARD_REVIEW_VERSION,
    packet_id: `storyboard-review:${config.campaign_identity}:${input.input_version}`,
    campaign_identity: config.campaign_identity,
    product_label: config.product_label,
    channel: 'youtube',
    calendar_item_id: config.calendar_item_id,
    social_content_id: config.social_content_id,
    content_version: config.current_content_version,
    script_input_version: input.input_version,
    adaptation_id: input.adaptation_id,
    source_receipt_ids: [...new Set(Object.values(input.receipts).flatMap((receipt) => receipt?.receipt_id ? [receipt.receipt_id] : []))],
    asset_receipt_id: heroReceipt?.receipt_id ?? storyboardAssetReceipt.receipt_id,
    hero_evidence: heroReceipt ? heroEvidenceProjection(heroReceipt, config) : null,
    selection_decision: heroReceipt ? selectionDecisionProjection(heroReceipt) : null,
    assets,
    evidence_gates: gates,
    scenes: timedScenes(input, config),
    status: blockers.length ? 'review_direction_blocked' : 'ready_for_human_review',
    blockers,
    recovery_actions: recoveryActions,
    value_summary: config.value_summary,
    external_gates: SOCIAL_CAMPAIGN_STORYBOARD_EXTERNAL_GATES,
  }
}
