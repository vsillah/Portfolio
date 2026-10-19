import kickLabTypographyReceiptArtifact from '../artifacts/research/kicklab-typography-style-receipt-2026-10-19/receipt.json'
import { deterministicSha256Hex } from '@/lib/deterministic-sha256.mjs'
import { projectCampaignLongFormDraft, type CampaignLongFormDraftPacket } from '@/lib/social-campaign-long-form-batch'
import {
  SOCIAL_CAMPAIGN_EXTERNAL_GATES,
  type CampaignPreparationBlocker,
  type CampaignPreparationCandidate,
} from '@/lib/social-campaign-package-preparation'

export const SOCIAL_CAMPAIGN_VISUAL_PLAN_VERSION = 'social-campaign-visual-plan/v4' as const
export const SOCIAL_CAMPAIGN_VISUAL_EVALUATION_VERSION = 'social-campaign-visual-evaluation/v4' as const
export const SOCIAL_CAMPAIGN_VISUAL_BATCH_VERSION = 'social-campaign-visual-batch/v2' as const
export const SOCIAL_CAMPAIGN_VISUAL_BATCH_KIND = 'social_campaign_visual_batch'
export const SOCIAL_CAMPAIGN_VISUAL_CHUNK_SIZE = 10

export type VisualChannel = 'linkedin' | 'youtube_thumbnail' | 'youtube_long_form' | 'short_form'
export type VisualEvidenceKind = 'source_receipt' | 'owned_product_screenshot' | 'approved_public_evidence'

export type CampaignVisualCinematography = {
  contract_version: 'campaign-scene-cinematography/v1'
  shot_type: string
  framing: string
  camera_angle: string
  camera_movement: string
  camera_movement_duration_seconds: number
  environment: string
  subject_position: string
  product_broll_choreography: string
  entrance_composition: string
  exit_composition: string
  transition_rationale: string
  shot_duration_seconds: number
  continuity_constraints: string[]
  pattern_interrupt_intent: string
  visual_signature: string
}

export type CampaignVisualTypography = {
  contract_version: 'campaign-typography-compositing/v1'
  type_system: string
  scale_hierarchy: string
  color_contrast: string
  depth_treatment: string
  shape_interaction: string
  composition_placement: string
  text_safe_area: string
  compositing_rationale: string
  integrated_with_focal_subject: boolean
}

export type CampaignTypographyComparable = {
  comparable_id: string
  source_url: string
  thumbnail_url: string
  title: string
  channel: string
  published_at: string
  captured_at: string
  age_days_at_capture: number
  views_at_capture: number
  likes_at_capture: number | null
  likes_display_at_capture: string
  audience_source_urls: string[]
  channel_baseline_views: number | null
  normalized_performance: number | null
  matched_style: boolean
  audience_fit: string
  topic_fit: string
  observed_type_traits: string[]
  feed_size_behavior: string
  decision: 'selected' | 'rejected'
  decision_reason: string
  performance_weight: 0 | 1
}

export type CampaignTypographyStyleReceipt = {
  version: 'campaign-typography-style-receipt/v1'
  receipt_id: string
  captured_at: string
  expires_at: string
  topic: string
  audience: string
  channel: 'youtube_thumbnail'
  comparables: CampaignTypographyComparable[]
  selected_style: {
    display_copy: string
    family: string
    weight: string
    case: string
    color: string
    effects: string
    placement: string
  }
  rejected_styles: Array<{ style: string; reason: string }>
  selection_logic: string
  performance_evidence: {
    status: 'scored' | 'unscored'
    sample_size: number
    required_sample_size: number
    matched_style_sample_size: number
    baseline_method: string
    baseline_video_urls: string[]
    channel_baseline_views: number | null
    normalized_threshold: number
    observed_normalized_performance: number | null
    formula: string
    limitation: string
    public_research_audit: {
      captured_at: string
      channel: string
      channel_url: string
      channel_sample_size: number
      matched_style_threshold: number
      matched_style_observed: number
      channels_screened: Array<{
        channel: string
        channel_url: string
        topic_domain: string
        current_feed_size: string
        sample_size: number
        baseline_disposition: string
        eligible_baseline_count?: number
        baseline_30_day_median_views?: number | null
        exact_search_exhaustion: string
      }>
      nearest_candidates: Array<{
        source_url: string
        thumbnail_url: string
        title: string
        channel: string
        published_at: string
        captured_at: string
        duration_seconds: number
        views_at_capture: number
        age_days_at_capture?: number
        style_match: false
        promotion_status: string
        observed_thumbnail_type: string
        exclusion_reason: string
      }>
      baseline_sample: Array<{
        source_url: string
        thumbnail_url: string
        title: string
        channel: string
        published_at: string
        captured_at: string
        duration_seconds: number
        views_at_capture: number
        age_days_at_capture?: number
        normalized_30_day_views?: number | null
        paid_or_hosted_promotion: boolean
        included_in_baseline: boolean
        exclusion_reason: string | null
      }>
      normalization_formula: string
      normalization_result: number | null
      missing_fields: string[]
      conclusion: string
    }
  }
  performance_weight: 0 | 1
  recovery_action: string
  deterministic_verdict: 'approved' | 'rejected' | 'unscored'
}

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
  layout: string
  presenter_placement: string
  product_broll_timing: { cue: string; start_seconds: number; end_seconds: number } | null
  music_ducking_cue: string
  spoken_conclusion_or_cta: string | null
  storyboard_traceability: {
    approved_script_segment_id: string
    source_receipt_ids: string[]
    product_proof_receipt_id: string
    owned_artifact_href: string
    title_thumbnail_receipt_id: string
    video_title: string
    thumbnail_teaser: string
    title_thumbnail_distinct: true
    audience_research_receipt_id: string
    audience_source_urls: string[]
    audience_outlier_receipt_id: string
    originality_receipt_id: string
    privacy_receipt_id: string
  } | null
  repeated_asset_rationale: string | null
  cinematography: CampaignVisualCinematography | null
  typography: CampaignVisualTypography
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
    typography: CampaignVisualTypography
  }>
  typography_style_receipt: CampaignTypographyStyleReceipt | null
  rejected_alternatives: Array<{ alternative: string; reason: string; recovery_action: string }>
  benchmark_logic: {
    playlist_role: 'taste_only_zero_performance_weight'
    playlist_similarity: {
      status: 'scored' | 'unscored'
      score: number | null
      receipt_id: string | null
      observed_at: string | null
      fresh_until: string | null
      numerator: number | null
      denominator: number | null
      formula: string
    }
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
  ['scene_cinematography', 'Scene cinematography / variation'],
  ['typography_compositing', 'Typography / compositing'],
  ['typography_style_evidence', 'Typography style evidence'],
  ['privacy', 'Privacy'],
  ['copy_purity', 'Customer-facing copy purity'],
] as const

export type CampaignVisualDimensionKey = (typeof CAMPAIGN_VISUAL_DIMENSIONS)[number][0]
export type CampaignVisualDimension = {
  key: CampaignVisualDimensionKey
  label: string
  status: 'passed' | 'blocked' | 'unscored'
  score: number | null
  calculation: {
    formula: string
    numerator: number | null
    denominator: number | null
    observed: number | null
    required: number | null
    unit: 'checks' | 'channels' | 'sources' | 'regions'
  }
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

function kickLabTypographyReceipt(): CampaignTypographyStyleReceipt {
  return {
    version: 'campaign-typography-style-receipt/v1',
    receipt_id: 'typography-style:kicklab-youtube:20261019:v1',
    captured_at: '2026-10-19',
    expires_at: '2026-11-02',
    topic: 'football, sports science, and physics learning through gameplay',
    audience: 'young sports-curious learners (9–15), parents, and educators',
    channel: 'youtube_thumbnail',
    comparables: [
      {
        comparable_id: 'mark-rober-ronaldo-goalie-robot',
        source_url: 'https://www.youtube.com/watch?v=jjpjjcMeujM',
        thumbnail_url: 'https://img.youtube.com/vi/jjpjjcMeujM/maxresdefault.jpg',
        title: 'Ronaldo vs My Unbeatable Goalie Robot',
        channel: 'Mark Rober',
        published_at: '2025-11-28',
        captured_at: '2026-10-19',
        age_days_at_capture: 325,
        views_at_capture: 49152957,
        likes_at_capture: null,
        likes_display_at_capture: '814K (rounded display)',
        audience_source_urls: ['https://www.commonsensemedia.org/youtube-reviews/mark-rober'],
        channel_baseline_views: null,
        normalized_performance: null,
        matched_style: false,
        audience_fit: 'Official science-and-engineering creator; family and student audience is supported by the channel subject and independent 8+ audience guidance.',
        topic_fit: 'Football action joined to a real engineering demonstration; direct subject overlap with football and physics learning.',
        observed_type_traits: ['No added display lettering visible in the inspected thumbnail.', 'Real athlete and physical robot provide the hierarchy.', 'Natural stadium colors and photo detail; no drawn arrow or glow treatment.'],
        feed_size_behavior: 'At 320x180 the player/robot contrast and central physical subject remain legible; there is no small headline to decode.',
        decision: 'selected',
        decision_reason: 'Use as a topic-native composition and restraint comparator, not as evidence that any particular font or copy performs.',
        performance_weight: 0,
      },
      {
        comparable_id: 'dude-perfect-trick-shot-contest',
        source_url: 'https://www.youtube.com/watch?v=jvUX3ocBSCk',
        thumbnail_url: 'https://img.youtube.com/vi/jvUX3ocBSCk/maxresdefault.jpg',
        title: '20 YouTubers Compete in Biggest Trick Shot Contest Ever! | TSWC ’25',
        channel: 'Dude Perfect',
        published_at: '2025-02-22',
        captured_at: '2026-10-19',
        age_days_at_capture: 604,
        views_at_capture: 17046978,
        likes_at_capture: null,
        likes_display_at_capture: '172K (rounded display)',
        audience_source_urls: ['https://dudeperfect.com/videos'],
        channel_baseline_views: null,
        normalized_performance: null,
        matched_style: false,
        audience_fit: 'Official family-friendly sports-entertainment channel; directly relevant to youth sports viewing.',
        topic_fit: 'Football-adjacent physical challenge and trick-shot competition; strong audience context, looser physics-learning fit.',
        observed_type_traits: ['No added display lettering visible in the inspected thumbnail.', 'Real people and target activity carry the story.', 'Natural photo treatment and clear subject hierarchy; no procedural arrow.'],
        feed_size_behavior: 'At 320x180 the face and action grouping remain recognizable; the image does not depend on fine text.',
        decision: 'selected',
        decision_reason: 'Use as a youth-sports audience and scene-first comparator; do not transfer the group collage or creator identity.',
        performance_weight: 0,
      },
    ],
    selected_style: {
      display_copy: 'MATH IN THE MOVE',
      family: 'Inter, a contemporary neutral sans-serif already bundled with Portfolio',
      weight: '800; one line; restrained tracking; four words maximum',
      case: 'uppercase for short-form scanability, without condensed or arcade letterforms',
      color: 'warm white over the calm navy dusk region; no gradient fill',
      effects: 'no outline, glow, bevel, extrusion, trajectory, arrow, or decorative curve; only a small soft shadow for local contrast',
      placement: 'upper-left calm sky, outside the actual gameplay proof and player/ball focal area',
    },
    rejected_styles: [
      { style: 'condensed black arcade display with gold-orange gradient, stroke, glow, rings, and impact vectors', reason: 'No matching type treatment appears in either current topic comparator; it would repeat the rejected dated game-poster direction and compete with real product proof.' },
      { style: 'default-font caption pasted beside a rectangular screenshot', reason: 'Creates a generic split-card template and separates the teaching idea from the action.' },
      { style: 'creator-logo, reaction face, fabricated score, or drawn trajectory', reason: 'Not needed to explain the actual product pixels and risks implying evidence or identity that is not present.' },
    ],
    selection_logic: 'Both selected official YouTube comparables are topic/audience adjacent and omit added display text. Their common signal is that real activity carries the thumbnail at feed size. The selected four-word neutral-sans line is a deliberately restrained editorial cue, not a claimed winning font; the real KickLab screenshot remains the sole product-proof layer. Comparable views and likes are captured context only and have zero typography-performance weight.',
    performance_evidence: {
      status: 'unscored',
      sample_size: 2,
      required_sample_size: 4,
      matched_style_sample_size: 0,
      baseline_method: 'Required baseline: median 30-day-equivalent views for at least four standard-length videos published within the prior 90 days on the same channel, normalized by each video age and matched for topic/audience; exclude Shorts, paid promotions, gifted-product integrations, and hosted-travel outliers.',
      baseline_video_urls: [],
      channel_baseline_views: null,
      normalized_threshold: 1.5,
      observed_normalized_performance: null,
      formula: 'matched-style comparable views normalized per day / same-channel baseline views normalized per day; require at least 4 matched-style examples and ratio >= 1.5',
      limitation: 'The expanded scan found five eligible recent Khan Academy AP Physics baseline videos, but zero of four exact-style matched examples. Rounded/heavy sentence-case Khan lesson lettering is adjacent, not the evaluated short uppercase Inter treatment. The baseline cannot create a candidate cohort, so normalization remains null and no font-style performance conclusion is attributable.',
      public_research_audit: kickLabTypographyReceiptArtifact.performance_evidence.public_research_audit as CampaignTypographyStyleReceipt['performance_evidence']['public_research_audit'],
    },
    performance_weight: 0,
    recovery_action: 'Future experiment hypothesis: after explicit publishing/experiment authorization, compare the four-word uppercase Inter cue, a no-added-text treatment, and a short sentence-case neutral-sans variant on the same owned KickLab gameplay frame and matched title/topic, using randomized thumbnail exposure and a fixed observation window. Keep typography Unscored until at least four exact-style examples and the unchanged 1.5× age-normalized same-channel threshold are met.',
    deterministic_verdict: 'unscored',
  }
}

function evaluateTypographyReceipt(receipt: CampaignTypographyStyleReceipt | null, now: Date) {
  if (!receipt) return 'unscored' as const
  const unsafeType = /arcade|impact outline|neon glow|generic default/i.test(`${receipt.selected_style.family} ${receipt.selected_style.effects}`)
  if (unsafeType) return 'rejected' as const
  const complete = receipt.version === 'campaign-typography-style-receipt/v1'
    && receipt.receipt_id
    && Number.isFinite(Date.parse(receipt.captured_at))
    && Date.parse(receipt.expires_at) > now.getTime()
    && receipt.topic
    && receipt.audience
    && receipt.channel === 'youtube_thumbnail'
    && receipt.comparables.length >= 2
    && receipt.comparables.every((item) => /^https:\/\/www\.youtube\.com\/watch\?v=/.test(item.source_url)
      && /^https:\/\/img\.youtube\.com\/vi\//.test(item.thumbnail_url)
      && item.channel && item.title && item.topic_fit && item.audience_fit
      && item.observed_type_traits.length > 0 && item.feed_size_behavior
      && Number.isFinite(Date.parse(item.captured_at)) && Number.isFinite(Date.parse(item.published_at))
      && item.age_days_at_capture > 0 && item.views_at_capture > 0
      && item.likes_display_at_capture && (item.likes_at_capture == null || item.likes_at_capture >= 0)
      && item.audience_source_urls.length > 0 && item.audience_source_urls.every((href) => /^https:\/\//.test(href))
      && (item.performance_weight === 0 || item.performance_weight === 1))
    && receipt.selected_style.display_copy.trim().split(/\s+/).length <= 4
    && /Inter|grotesk|sans-serif/i.test(receipt.selected_style.family)
    && /no outline|no .*glow/i.test(receipt.selected_style.effects)
    && receipt.selected_style.placement
    && receipt.rejected_styles.length >= 3
    && receipt.selection_logic
    && receipt.performance_evidence
    && receipt.performance_evidence.sample_size >= 0
    && receipt.performance_evidence.required_sample_size >= 4
    && receipt.performance_evidence.baseline_method
    && receipt.performance_evidence.formula
    && receipt.performance_evidence.limitation
    && receipt.performance_evidence.normalized_threshold > 1
    && receipt.recovery_action
    && (receipt.performance_weight === 0 || receipt.performance_weight === 1)
  if (!complete) return 'unscored' as const
  const performance = receipt.performance_evidence
  if (performance.status !== 'scored'
    || performance.sample_size < performance.required_sample_size
    || performance.matched_style_sample_size < performance.required_sample_size
    || receipt.comparables.filter((item) => item.matched_style && item.performance_weight === 1 && item.channel_baseline_views && item.normalized_performance != null).length < performance.required_sample_size
    || !performance.baseline_video_urls.length
    || !performance.channel_baseline_views
    || performance.observed_normalized_performance == null
    || performance.observed_normalized_performance < performance.normalized_threshold
    || receipt.performance_weight !== 1
    || receipt.deterministic_verdict !== 'approved') return 'unscored' as const
  return 'approved' as const
}

function typographyContract(channel: VisualChannel, campaignIdentity: string): CampaignVisualTypography {
  const isKickLab = campaignIdentity === 'kicklab'
  const placement = channel === 'youtube_thumbnail'
    ? campaignIdentity === 'kicklab'
      ? 'Single-line display cue uses the calm upper-left sky, clear of gameplay proof, player, and ball.'
      : 'Staggered display lockup follows the focal action without covering the product result.'
    : channel === 'short_form'
      ? 'Captions occupy the center-safe lower third and step around the active product highlight.'
      : channel === 'youtube_long_form'
        ? 'Display callouts anchor beside the active evidence region; captions remain below the presenter eye line.'
        : 'Headline, diagram, and proof form one editorial grid rather than separate text and image columns.'
  return {
    contract_version: 'campaign-typography-compositing/v1',
    type_system: isKickLab ? 'KickLab Editorial: restrained contemporary Inter sans-serif paired with the native product-interface type.' : 'Campaign Editorial: expressive display face paired with a neutral grotesk evidence label.',
    scale_hierarchy: 'One dominant 1.0x display phrase, one 0.28x evidence label, and no competing headline tier.',
    color_contrast: isKickLab ? 'Warm white display type against a calm navy dusk field; retain source-image colors and local contrast.' : 'Campaign brand display colors against a darkened or lightened proof field with WCAG-readable evidence copy.',
    depth_treatment: isKickLab ? 'No stroke, glow, bevel, or extrusion; use only a small soft shadow where required for local contrast.' : 'Restrained directional shadow and selective highlight edge.',
    shape_interaction: isKickLab ? 'Type uses negative space in the photograph and stays clear of real gameplay pixels, player, and ball; no drawn path or arrow.' : 'The display lockup integrates with the focal subject without obscuring evidence.',
    composition_placement: placement,
    text_safe_area: channel === 'short_form' ? 'Keep 12% side gutters and the lower 20% clear of platform controls.' : 'Keep a 7% perimeter and preserve the focal product result and any face clearance.',
    compositing_rationale: 'Typography carries the energy of the product action while the proof remains the first readable object.',
    integrated_with_focal_subject: true,
  }
}

function cinematographyContract(channel: 'youtube_long_form' | 'short_form', index: number, duration: number, role: string): CampaignVisualCinematography {
  const longFormShots = [
    ['impact macro', 'extreme close-up', 'low three-quarter', '18-frame push-in', 'avatar fixed left; product result fills the right proof pane'],
    ['over-shoulder playthrough', 'medium-wide', 'eye-level', 'slow 6% parallax drift', 'avatar left third; result panel right two-thirds'],
    ['split-depth evidence reveal', 'medium close-up', 'high three-quarter', '12-frame lateral slide', 'avatar remains left; owned product capture is foreground on right'],
    ['reaction-to-result match cut', 'tight close-up', 'slight Dutch return-to-level', 'handheld settle over 1.2 seconds', 'avatar reaction left; exact result lands in right proof pane'],
    ['top-down experiment table', 'wide insert', 'overhead', 'clockwise 8-degree orbit', 'avatar inset left; controls and outcome stay right'],
  ] as const
  const shortShots = [
    ['vertical impact punch-in', 'tight 9:16 close-up', 'low angle', '10-frame snap zoom', 'active control above lower UI-safe zone'],
    ['vertical handoff reveal', 'medium 9:16', 'eye-level', 'fast rack-focus simulation', 'result center; caption steps around the moving subject'],
    ['vertical vector track', 'full-height insert', 'high three-quarter', 'upward 7% tracking move', 'motion path follows the central vertical axis'],
    ['vertical payoff hold', 'tight reaction and result', 'slight low angle', '0.8-second decelerating push', 'result upper-middle; CTA stays center-safe'],
  ] as const
  const selected = (channel === 'short_form' ? shortShots : longFormShots)[index % (channel === 'short_form' ? shortShots.length : longFormShots.length)]
  return {
    contract_version: 'campaign-scene-cinematography/v1',
    shot_type: selected[0],
    framing: selected[1],
    camera_angle: selected[2],
    camera_movement: selected[3],
    camera_movement_duration_seconds: Math.min(duration, channel === 'short_form' ? 1.2 : 2.4),
    environment: channel === 'short_form' ? 'Full-bleed KickLab playfield with controlled edge falloff for vertical UI safety.' : 'Tactile dark studio-playfield hybrid using the exact owned product capture as the illuminated evidence surface.',
    subject_position: selected[4],
    product_broll_choreography: `Begin on the ${role.replaceAll('_', ' ')} evidence state, isolate the changing variable, then reveal the resulting motion without leaving the source timestamp.`,
    entrance_composition: index % 2 ? 'Enter from an occluding foreground shape into the active evidence region.' : 'Enter on the visible result before revealing the input that caused it.',
    exit_composition: index % 3 ? 'Exit on a directional vector that motivates the next camera axis.' : 'Exit on a two-beat hold with the result centered for comprehension.',
    transition_rationale: index ? 'The outgoing motion direction hands visual energy to the next evidence region while changing scale or axis.' : 'The cold open prioritizes consequence before explanation to earn the first pattern interrupt.',
    shot_duration_seconds: duration,
    continuity_constraints: ['Preserve product-state chronology.', 'Keep screen direction consistent inside one explanation.', 'Never cover the active result with presenter or captions.'],
    pattern_interrupt_intent: `Reset attention through a distinct ${selected[0]} composition tied to the ${role.replaceAll('_', ' ')} beat, not through a decorative cut.`,
    visual_signature: `${selected[0]}|${selected[1]}|${selected[2]}|${selected[3]}`,
  }
}

function planBeats(candidate: CampaignPreparationCandidate, script: CampaignLongFormDraftPacket): CampaignVisualBeat[] {
  const proof = sourceId(candidate, 'product-proof')
  const publicSource = candidate.source_trace.find((source) => source.decision === 'selected')?.source_id || candidate.receipts.outlier.receipt_id
  const audienceResearch = candidate.campaign_identity === 'kicklab' ? kickLabTypographyReceipt() : null
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
      layout: 'Static 4:5 editorial page; product proof and one takeaway share a single evidence-led grid.',
      presenter_placement: 'No presenter.',
      product_broll_timing: null,
      music_ducking_cue: 'No music; static review asset.',
      spoken_conclusion_or_cta: null,
      storyboard_traceability: null,
      cinematography: null,
      typography: typographyContract('linkedin', candidate.campaign_identity),
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
      layout: 'Static 4:5 evidence panel; source, claim, and product crop remain in one readable grid.',
      presenter_placement: 'No presenter.',
      product_broll_timing: null,
      music_ducking_cue: 'No music; static review asset.',
      spoken_conclusion_or_cta: null,
      storyboard_traceability: null,
      cinematography: null,
      typography: typographyContract('linkedin', candidate.campaign_identity),
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
    layout: 'Static 16:9 integrated thumbnail composition; title stays explanatory while the teaser supplies a distinct hook.',
    presenter_placement: 'No presenter unless the approved raster already contains one.',
    product_broll_timing: null,
    music_ducking_cue: 'No music; static review asset.',
    spoken_conclusion_or_cta: null,
    storyboard_traceability: null,
    cinematography: null,
    typography: typographyContract('youtube_thumbnail', candidate.campaign_identity),
  }
  const longForm = script.beats.map((beat, index): CampaignVisualBeat => ({
    ...shared,
    beat_id: `youtube-scene-${String(index + 1).padStart(2, '0')}`,
    channel: 'youtube_long_form',
    format: index % 3 === 0 ? 'presenter_plus_product_evidence_16x9' : 'owned_product_walkthrough_16x9',
    copy_section_id: beat.id,
    copy_excerpt: safeExcerpt(beat.text),
    source_ids: [...new Set([
      proof,
      candidate.receipts.product_proof.receipt_id,
      candidate.receipts.evidence.receipt_id,
      candidate.receipts.outlier.receipt_id,
      candidate.receipts.originality.receipt_id,
      candidate.receipts.privacy.receipt_id,
      ...(candidate.source_trace.find((source) => source.decision === 'selected') ? [candidate.source_trace.find((source) => source.decision === 'selected')!.source_id] : []),
    ])],
    asset_href: script.product_evidence_bindings[0]?.artifact_href || candidate.deliverables.linkedin.visual_href || candidate.deliverables.youtube.thumbnail_href,
    start_seconds: beat.start_seconds,
    end_seconds: beat.end_seconds,
    intended_takeaway: candidate.campaign_identity === 'kicklab' ? kickLabTakeaway(beat.id) : `The ${beat.role.replaceAll('_', ' ')} stays tied to the approved ${candidate.product_label} evidence.`,
    transition: index ? 'Eight-frame ease into the next evidence region; preserve source artifact timing.' : 'Open directly on the product result, then reveal the presenter.',
    motion: 'Preserve native product motion; use one purposeful crop or highlight synchronized to the spoken claim.',
    presenter_safe_area: 'Avatar remains within the left third; never cover the owned product evidence in the right two-thirds.',
    customer_facing_copy: beat.pattern_interrupt || '',
    layout: '16:9 split screen: avatar on the left third, owned product capture on the right two-thirds; labels sit in padded lower safe area.',
    presenter_placement: 'Avatar anchored left, waist-up, eye-line toward the evidence on the right; face and hands stay clear of captions.',
    product_broll_timing: beat.broll_cue ? { cue: beat.broll_cue, start_seconds: beat.start_seconds, end_seconds: beat.end_seconds } : null,
    music_ducking_cue: 'Low, lyric-free instrumental bed; duck 6 dB under narration and 9 dB during product-proof explanation; no music asset is selected in this review plan.',
    spoken_conclusion_or_cta: beat.role === 'conclusion' || beat.role === 'cta' ? beat.text : null,
    storyboard_traceability: {
      approved_script_segment_id: beat.id,
      source_receipt_ids: [candidate.receipts.evidence.receipt_id, candidate.receipts.product_proof.receipt_id, candidate.receipts.outlier.receipt_id, candidate.receipts.originality.receipt_id, candidate.receipts.privacy.receipt_id],
      product_proof_receipt_id: candidate.receipts.product_proof.receipt_id,
      owned_artifact_href: script.product_evidence_bindings[0]?.artifact_href || candidate.deliverables.linkedin.visual_href || candidate.deliverables.youtube.thumbnail_href,
      title_thumbnail_receipt_id: script.title_thumbnail_receipt_id,
      video_title: script.title,
      thumbnail_teaser: candidate.deliverables.youtube.thumbnail_teaser,
      title_thumbnail_distinct: script.title_thumbnail_distinct,
      audience_research_receipt_id: audienceResearch?.receipt_id || '',
      audience_source_urls: [...new Set(audienceResearch?.comparables.flatMap((item) => item.audience_source_urls) ?? [])],
      audience_outlier_receipt_id: candidate.receipts.outlier.receipt_id,
      originality_receipt_id: script.originality_receipt_id,
      privacy_receipt_id: script.privacy_receipt_id,
    },
    repeated_asset_rationale: index ? 'Return to the same owned product capture at a different native timestamp because this spoken beat explains a different visible behavior.' : null,
    cinematography: cinematographyContract('youtube_long_form', index, beat.end_seconds - beat.start_seconds, beat.role),
    typography: typographyContract('youtube_long_form', candidate.campaign_identity),
  }))
  const shortForm = script.beats.filter((beat) => ['hook', 'proof', 'payoff', 'cta'].includes(beat.role)).slice(0, 4).map((beat, index): CampaignVisualBeat => ({
    ...shared,
    beat_id: `short-form-${index + 1}`,
    channel: 'short_form',
    format: 'vertical_product_story_9x16',
    copy_section_id: beat.id,
    copy_excerpt: safeExcerpt(beat.text),
    source_ids: [...new Set([proof, candidate.receipts.product_proof.receipt_id, candidate.receipts.evidence.receipt_id, candidate.receipts.outlier.receipt_id, candidate.receipts.originality.receipt_id, candidate.receipts.privacy.receipt_id])],
    asset_href: script.product_evidence_bindings[0]?.artifact_href || candidate.deliverables.linkedin.visual_href,
    start_seconds: index * 8,
    end_seconds: (index + 1) * 8,
    intended_takeaway: `A vertical derivative carries the ${beat.role} without shrinking the long-form frame.`,
    transition: index ? 'Fast full-frame product cut; no pasted split-card.' : 'Immediate vertical product close-up.',
    motion: 'Native 9:16 crop with synchronized caption and product highlight.',
    presenter_safe_area: 'Presenter is optional and stays above platform controls without covering proof.',
    customer_facing_copy: beat.pattern_interrupt || '',
    layout: 'Vertical 9:16 crop; product result stays central with captions in padded UI-safe areas.',
    presenter_placement: 'Presenter optional; if present, stays above platform controls and outside the product result.',
    product_broll_timing: beat.broll_cue ? { cue: beat.broll_cue, start_seconds: index * 8, end_seconds: (index + 1) * 8 } : null,
    music_ducking_cue: 'Low, lyric-free instrumental bed; duck 6 dB under narration and 9 dB during product-proof explanation; no music asset is selected in this review plan.',
    spoken_conclusion_or_cta: beat.role === 'conclusion' || beat.role === 'cta' ? beat.text : null,
    storyboard_traceability: {
      approved_script_segment_id: beat.id,
      source_receipt_ids: [candidate.receipts.evidence.receipt_id, candidate.receipts.product_proof.receipt_id, candidate.receipts.outlier.receipt_id, candidate.receipts.originality.receipt_id, candidate.receipts.privacy.receipt_id],
      product_proof_receipt_id: candidate.receipts.product_proof.receipt_id,
      owned_artifact_href: script.product_evidence_bindings[0]?.artifact_href || candidate.deliverables.linkedin.visual_href || candidate.deliverables.youtube.thumbnail_href,
      title_thumbnail_receipt_id: script.title_thumbnail_receipt_id,
      video_title: script.title,
      thumbnail_teaser: candidate.deliverables.youtube.thumbnail_teaser,
      title_thumbnail_distinct: script.title_thumbnail_distinct,
      audience_research_receipt_id: audienceResearch?.receipt_id || '',
      audience_source_urls: [...new Set(audienceResearch?.comparables.flatMap((item) => item.audience_source_urls) ?? [])],
      audience_outlier_receipt_id: candidate.receipts.outlier.receipt_id,
      originality_receipt_id: script.originality_receipt_id,
      privacy_receipt_id: script.privacy_receipt_id,
    },
    repeated_asset_rationale: index ? 'Reuse the owned product source only for a new vertical crop and a distinct script beat.' : null,
    cinematography: cinematographyContract('short_form', index, 8, beat.role),
    typography: typographyContract('short_form', candidate.campaign_identity),
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
      focal_subject: candidate.campaign_identity === 'kicklab' ? 'Actual KickLab free-kick gameplay capture integrated with documentary football photography' : `${candidate.product_label} product proof`,
      text_words: candidate.deliverables.youtube.thumbnail_teaser.trim().split(/\s+/),
      face_text_overlap: false,
      feed_size_legible: candidate.thumbnail_checklist['Actual-feed-size legibility'] === true,
      composition: candidate.campaign_identity === 'kicklab'
        ? 'One integrated documentary action plane: real gameplay evidence sits in the calm left field, the photographed player and ball remain visible on the right, and a short neutral-sans line uses open sky; no added diagram or trajectory.'
        : 'One integrated, high-contrast action plane: product result and focal type share depth and direction; no side-by-side pasted-image treatment.',
      typography: typographyContract('youtube_thumbnail', candidate.campaign_identity),
    }],
    typography_style_receipt: candidate.campaign_identity === 'kicklab' ? kickLabTypographyReceipt() : null,
    rejected_alternatives: [
      { alternative: 'Generic quote-card template', reason: 'It hides the owned product proof and repeats a standard social composition.', recovery_action: 'Lead with the exact product screenshot and rebuild the hierarchy around one takeaway.' },
      { alternative: 'Title repeated as thumbnail copy', reason: 'It wastes the thumbnail and fails the complementary-teaser contract.', recovery_action: 'Keep the title explanatory and the thumbnail teaser short, distinct, and curiosity-led.' },
      { alternative: 'Loop one product screenshot across the full video', reason: 'It breaks scene-level alignment and makes the visual sequence feel synthetic.', recovery_action: 'Bind a distinct evidence region or justified return to every script beat.' },
    ],
    benchmark_logic: {
      playlist_role: 'taste_only_zero_performance_weight',
      playlist_similarity: {
        status: 'unscored',
        score: null,
        receipt_id: null,
        observed_at: null,
        fresh_until: null,
        numerator: null,
        denominator: null,
        formula: 'No attributable similarity receipt supplied; taste references carry zero performance weight.',
      },
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

function dimension(input: {
  key: CampaignVisualDimensionKey
  numerator: number
  denominator: number
  unit: CampaignVisualDimension['calculation']['unit']
  formula: string
  evidenceIds: string[]
  explanation: string
  unscored?: boolean
}): CampaignVisualDimension {
  const { key, numerator, denominator, unit, formula, evidenceIds, explanation, unscored = false } = input
  const label = CAMPAIGN_VISUAL_DIMENSIONS.find(([candidate]) => candidate === key)?.[1] ?? key
  const status = unscored || denominator <= 0 ? 'unscored' : numerator >= denominator ? 'passed' : 'blocked'
  const score = status === 'unscored' ? null : Math.round((numerator / denominator) * 100)
  return {
    key,
    label,
    status,
    score,
    calculation: {
      formula,
      numerator: status === 'unscored' ? null : numerator,
      denominator: status === 'unscored' ? null : denominator,
      observed: status === 'unscored' ? null : numerator,
      required: status === 'unscored' ? null : denominator,
      unit,
    },
    evidence_ids: [...new Set(evidenceIds.filter(Boolean))],
    explanation,
  }
}

export function evaluateCampaignVisualPlan(plan: CampaignVisualPlan, now = new Date()): CampaignVisualEvaluation {
  const blockers: CampaignPreparationBlocker[] = []
  const sourceById = new Map(plan.exact_sources.map((source) => [source.source_id, source]))
  const linkedSourceIds = plan.beats.flatMap((beat) => beat.source_ids)
  const missingSources = [...new Set(linkedSourceIds.filter((id) => !sourceById.has(id) && !plan.source_receipt_ids.includes(id)))]
  const staleSources = plan.exact_sources.filter((source) => !source.href || source.approval_status !== 'approved' || !Number.isFinite(Date.parse(source.observed_at)) || (source.fresh_until ? Date.parse(source.fresh_until) <= now.getTime() : false))
  const evidenceUnscored = missingSources.length > 0 || staleSources.length > 0
  if (evidenceUnscored) blockers.push(blocker('visual_evidence_unscored', 'Visual evidence is missing, stale, or cannot be opened; the plan is Unscored and cannot advance.', 'Refresh visual evidence', plan.recovery_actions[0]?.href || '/admin/agents/content-intelligence?section=research'))

  const similarity = plan.benchmark_logic.playlist_similarity
  const similarityFormulaScore = similarity.numerator != null && similarity.denominator != null && similarity.denominator > 0
    ? Math.round((similarity.numerator / similarity.denominator) * 100)
    : null
  const similarityReceiptCurrent = Boolean(
    similarity.receipt_id
      && (plan.source_receipt_ids.includes(similarity.receipt_id) || plan.exact_sources.some((source) => source.source_id === similarity.receipt_id))
      && similarity.observed_at
      && Number.isFinite(Date.parse(similarity.observed_at))
      && similarity.fresh_until
      && Date.parse(similarity.fresh_until) > now.getTime(),
  )
  const invalidSimilarityScore = similarity.status === 'scored' && (
    !similarityReceiptCurrent
      || similarity.score == null
      || similarityFormulaScore == null
      || similarity.score !== similarityFormulaScore
  )
  if (invalidSimilarityScore) blockers.push(blocker('visual_playlist_similarity_unscored', 'Playlist similarity is Unscored because no current attributable similarity receipt supports the asserted number.', 'Record attributable similarity evidence', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

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
  if (thumbnail?.href && /\.svg(?:$|\?)/i.test(thumbnail.href)) blockers.push(blocker('visual_thumbnail_svg_prohibited', 'Customer-facing thumbnails must be delivered as raster artwork, not hand-authored SVG.', 'Replace thumbnail with raster artwork', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))
  if (thumbnail && (thumbnail.face_text_overlap || !thumbnail.feed_size_legible || thumbnail.text_words.length > 5 || /pasted side[- ]by[- ]side|split[- ]card layout/i.test(thumbnail.composition))) blockers.push(blocker('visual_thumbnail_composition', 'Thumbnail focal hierarchy, face clearance, feed-size readability, or integrated composition failed.', 'Revise thumbnail composition', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const typographyPasses = (typography: CampaignVisualTypography | undefined) => Boolean(
    typography
      && typography.contract_version === 'campaign-typography-compositing/v1'
      && typography.type_system
      && !/plain default|default font|unstyled|ordinary block/i.test(typography.type_system)
      && typography.scale_hierarchy
      && typography.color_contrast
      && typography.depth_treatment
      && typography.shape_interaction
      && typography.composition_placement
      && !/side[- ]by[- ]side|pasted beside|detached from/i.test(typography.composition_placement)
      && typography.text_safe_area
      && typography.compositing_rationale
      && typography.integrated_with_focal_subject,
  )
  const typographyRegions = [...plan.beats.map((beat) => ({ id: beat.beat_id, typography: beat.typography })), ...(thumbnail ? [{ id: thumbnail.variant_id, typography: thumbnail.typography }] : [])]
  const passingTypographyRegions = typographyRegions.filter((region) => typographyPasses(region.typography))
  if (passingTypographyRegions.length !== typographyRegions.length) blockers.push(blocker('visual_typography_compositing', 'Every customer-facing visual needs an expressive type system, deliberate hierarchy and contrast, depth treatment, composition-aware placement, and integration with the focal subject.', 'Art-direct typography and compositing', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))
  const typographyReceiptVerdict = evaluateTypographyReceipt(plan.typography_style_receipt, now)
  if (plan.typography_style_receipt && typographyReceiptVerdict === 'rejected') blockers.push(blocker('visual_typography_style_rejected', 'The selected display style fails the deterministic typography safety rules.', 'Re-art-direct typography', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))
  if (plan.typography_style_receipt && typographyReceiptVerdict === 'unscored') blockers.push(blocker('visual_typography_style_unscored', 'The typography-style receipt is incomplete, stale, unattributable, or carries a prohibited performance weight.', 'Refresh typography comparables', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const videoBeats = plan.beats.filter((beat) => beat.channel === 'youtube_long_form' || beat.channel === 'short_form')
  const timingFailure = videoBeats.some((beat) => beat.start_seconds == null || beat.end_seconds == null || beat.end_seconds <= beat.start_seconds || !beat.motion || !beat.transition || !beat.presenter_safe_area)
  const overlappingScenes = ['youtube_long_form', 'short_form'].some((channel) => {
    const scenes = videoBeats.filter((beat) => beat.channel === channel).sort((left, right) => (left.start_seconds ?? 0) - (right.start_seconds ?? 0))
    return scenes.some((beat, index) => index > 0 && (scenes[index - 1].end_seconds ?? Infinity) > (beat.start_seconds ?? -Infinity))
  })
  const adjacentRepeat = videoBeats.some((beat, index) => index > 0
    && beat.channel === videoBeats[index - 1].channel
    && beat.asset_href === videoBeats[index - 1].asset_href
    && !beat.repeated_asset_rationale)
  if (timingFailure || overlappingScenes || adjacentRepeat) blockers.push(blocker('visual_motion_sync', 'Video regions need non-overlapping timing, synchronized motion, clear transitions, presenter-safe framing, and justified asset reuse.', 'Repair storyboard timing and assets', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const longFormScenes = plan.beats.filter((beat) => beat.channel === 'youtube_long_form')
  const traceabilityComplete = videoBeats.every((beat) => {
    const trace = beat.storyboard_traceability
    return Boolean(
      beat.layout && beat.presenter_placement && beat.music_ducking_cue
        && beat.copy_section_id && beat.copy_excerpt && beat.asset_href
        && trace?.approved_script_segment_id === beat.copy_section_id
        && trace.owned_artifact_href === beat.asset_href
        && trace.title_thumbnail_distinct
        && trace.video_title.trim().toLowerCase() !== trace.thumbnail_teaser.trim().toLowerCase()
        && trace.audience_research_receipt_id === plan.typography_style_receipt?.receipt_id
        && trace.audience_source_urls.length > 0
        && trace.audience_source_urls.every((href) => /^https:\/\//.test(href))
        && trace.source_receipt_ids.length >= 5
        && trace.source_receipt_ids.every((id) => plan.source_receipt_ids.includes(id))
        && trace.source_receipt_ids.includes(trace.product_proof_receipt_id)
        && trace.source_receipt_ids.includes(trace.audience_outlier_receipt_id)
        && trace.source_receipt_ids.includes(trace.originality_receipt_id)
        && trace.source_receipt_ids.includes(trace.privacy_receipt_id)
        && beat.source_ids.includes(trace.product_proof_receipt_id)
        && beat.source_ids.includes(trace.privacy_receipt_id)
        && beat.source_ids.includes(trace.originality_receipt_id)
        && (!beat.product_broll_timing || (beat.product_broll_timing.cue && beat.start_seconds != null && beat.end_seconds != null && beat.product_broll_timing.start_seconds >= beat.start_seconds && beat.product_broll_timing.end_seconds <= beat.end_seconds && beat.product_broll_timing.end_seconds > beat.product_broll_timing.start_seconds))
    )
  })
  const finalLongFormScene = [...longFormScenes].sort((left, right) => (right.end_seconds ?? 0) - (left.end_seconds ?? 0))[0]
  const spokenCloseComplete = Boolean(finalLongFormScene?.spoken_conclusion_or_cta?.trim())
  const splitScreenComplete = longFormScenes.every((beat) => /avatar.*left.*product.*right/i.test(`${beat.layout} ${beat.presenter_placement}`))
  if (!traceabilityComplete || !spokenCloseComplete || !splitScreenComplete) blockers.push(blocker('visual_storyboard_incomplete', 'Every YouTube scene needs exact script, source, owned-proof, title/thumbnail, audience/outlier, originality, and privacy bindings; the closing narration and split-screen staging must be explicit.', 'Complete scene storyboard bindings', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const cinematographyPasses = videoBeats.filter((beat) => {
    const scene = beat.cinematography
    return scene
      && scene.contract_version === 'campaign-scene-cinematography/v1'
      && scene.shot_type
      && scene.framing
      && scene.camera_angle
      && scene.camera_movement
      && scene.camera_movement_duration_seconds > 0
      && scene.environment
      && scene.subject_position
      && scene.product_broll_choreography
      && scene.entrance_composition
      && scene.exit_composition
      && scene.transition_rationale
      && scene.shot_duration_seconds > 0
      && scene.continuity_constraints.length >= 3
      && scene.pattern_interrupt_intent
      && scene.visual_signature
      && !/generic|standard shot|same shot|repeat(?:ed)? scene|basic camera/i.test(Object.values(scene).flat().join(' '))
  })
  const uniqueVisualSignatures = new Set(videoBeats.map((beat) => beat.cinematography?.visual_signature).filter(Boolean))
  const requiredVisualSignatures = Math.min(4, videoBeats.length)
  const variationPasses = uniqueVisualSignatures.size >= requiredVisualSignatures
    && videoBeats.every((beat, index) => index === 0 || beat.cinematography?.visual_signature !== videoBeats[index - 1].cinematography?.visual_signature)
  if (cinematographyPasses.length !== videoBeats.length || !variationPasses) blockers.push(blocker('visual_cinematography_contract', 'Every long-form and short-form scene needs a complete shot/camera contract and the sequence must vary scale, axis, movement, and pattern-interrupt intent.', 'Repair scene cinematography', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const copiedTemplate = plan.beats.some((beat) => /generic|standard template|copied creator/i.test(`${beat.format} ${beat.originality_boundary}`))
  if (copiedTemplate) blockers.push(blocker('visual_template_repetition', 'A generic, repeated, or copied composition cannot pass as a channel-native visual decision.', 'Replace repeated template', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))

  const copyLeak = plan.beats.filter((beat) => INTERNAL_COPY.test(beat.customer_facing_copy))
  if (copyLeak.length) blockers.push(blocker('visual_customer_copy_leak', 'Customer-facing visual copy contains internal workflow, fixture, or implementation language.', 'Rewrite customer-facing copy', plan.recovery_actions.at(-1)?.href || '/admin/social-content'))
  const privacyFailure = plan.beats.some((beat) => !beat.privacy_boundary || /private message|raw contact|credential/i.test(beat.customer_facing_copy))
  if (privacyFailure) blockers.push(blocker('visual_privacy', 'A visual region is missing its privacy boundary or exposes private material.', 'Repair privacy boundary', plan.recovery_actions[0]?.href || '/admin/social-content'))

  const currentSources = plan.exact_sources.filter((source) => source.href && source.approval_status === 'approved' && Number.isFinite(Date.parse(source.observed_at)) && (!source.fresh_until || Date.parse(source.fresh_until) > now.getTime()))
  const alignmentPasses = plan.beats.filter((beat) => beat.copy_section_id && beat.copy_excerpt && beat.intended_takeaway && beat.source_ids.length)
  const requiredProofChannels: VisualChannel[] = ['linkedin', 'youtube_long_form']
  const proofChannels = requiredProofChannels.filter((channel) => proofBeats.some((beat) => beat.channel === channel))
  const requiredChannels: VisualChannel[] = ['linkedin', 'youtube_thumbnail', 'youtube_long_form', 'short_form']
  const originalBeats = plan.beats.filter((beat) => beat.originality_boundary && !/generic|standard template|copied creator/i.test(`${beat.format} ${beat.originality_boundary}`))
  const readabilityChecks = thumbnail ? [
    Boolean(thumbnail.href),
    Boolean(thumbnail.title && thumbnail.teaser && thumbnail.title.trim().toLowerCase() !== thumbnail.teaser.trim().toLowerCase()),
    thumbnail.text_words.length > 0 && thumbnail.text_words.length <= 5,
    thumbnail.feed_size_legible,
    !/pasted side[- ]by[- ]side|split[- ]card layout/i.test(thumbnail.composition),
  ] : [false, false, false, false, false]
  const focalChecks = thumbnail ? [
    Boolean(thumbnail.focal_subject),
    !thumbnail.face_text_overlap,
    Boolean(thumbnail.composition) && !/pasted side[- ]by[- ]side|split[- ]card layout/i.test(thumbnail.composition),
  ] : [false, false, false]
  const motionPasses = videoBeats.filter((beat, index) => {
    const repeatedWithoutRationale = index > 0
      && beat.channel === videoBeats[index - 1].channel
      && beat.asset_href === videoBeats[index - 1].asset_href
      && !beat.repeated_asset_rationale
    return beat.start_seconds != null
      && beat.end_seconds != null
      && beat.end_seconds > beat.start_seconds
      && Boolean(beat.motion && beat.transition && beat.presenter_safe_area)
      && !repeatedWithoutRationale
  })
  const privacyChecks = [
    ...plan.beats.map((beat) => Boolean(beat.privacy_boundary) && !/private message|raw contact|credential/i.test(beat.customer_facing_copy)),
    ...plan.exact_sources.map((source) => Boolean(source.privacy_boundary)),
  ]
  const pureCopyBeats = plan.beats.filter((beat) => !INTERNAL_COPY.test(beat.customer_facing_copy))
  const dimensions = [
    dimension({ key: 'evidence_coverage', numerator: currentSources.length, denominator: plan.exact_sources.length + missingSources.length, unit: 'sources', formula: 'current attributable exact sources / required exact sources and referenced bindings', evidenceIds: linkedSourceIds, explanation: evidenceUnscored ? 'At least one exact source is missing or stale.' : 'Every region resolves to a current attributable exact source.', unscored: evidenceUnscored }),
    dimension({ key: 'script_visual_alignment', numerator: alignmentPasses.length, denominator: plan.beats.length, unit: 'regions', formula: 'regions with copy section + excerpt + takeaway + source binding / all visual regions', evidenceIds: plan.beats.map((beat) => beat.copy_section_id), explanation: 'Each region is checked against its exact copy or script section and intended takeaway.' }),
    dimension({ key: 'product_proof_coverage', numerator: proofChannels.length, denominator: requiredProofChannels.length, unit: 'channels', formula: 'required product-proof channels with an owned screenshot binding / required product-proof channels', evidenceIds: [...proofSources], explanation: 'Owned product proof must support both the LinkedIn and YouTube narratives.' }),
    dimension({ key: 'channel_nativeness', numerator: requiredChannels.filter((channel) => channels.has(channel)).length, denominator: requiredChannels.length, unit: 'channels', formula: 'required channels with a native visual format / required channels', evidenceIds: [...channels], explanation: 'LinkedIn, thumbnail, long-form, and vertical derivatives must each use a native format.' }),
    dimension({ key: 'originality_risk', numerator: originalBeats.length, denominator: plan.beats.length, unit: 'regions', formula: 'regions with explicit originality boundary and no generic/copied template marker / all visual regions', evidenceIds: plan.rejected_alternatives.map((entry) => entry.alternative), explanation: 'Every visual region is checked for an explicit originality boundary and template-repetition risk.' }),
    dimension({ key: 'readability_contrast', numerator: readabilityChecks.filter(Boolean).length, denominator: readabilityChecks.length, unit: 'checks', formula: 'passed asset + distinct copy + word-count + feed-size + integrated-composition checks / five required checks', evidenceIds: thumbnail ? [thumbnail.variant_id] : [], explanation: 'Feed-size copy, contrast, and integrated composition are checked before review.' }),
    dimension({ key: 'focal_hierarchy', numerator: focalChecks.filter(Boolean).length, denominator: focalChecks.length, unit: 'checks', formula: 'passed focal-subject + face-clearance + cohesive-composition checks / three required checks', evidenceIds: thumbnail ? [thumbnail.variant_id] : [], explanation: 'The focal subject must lead while teaser copy stays clear of the face and product result.' }),
    dimension({ key: 'motion_synchronization', numerator: motionPasses.length, denominator: videoBeats.length, unit: 'regions', formula: 'timed video regions with motion + transition + presenter clearance + justified reuse / all timed video regions', evidenceIds: videoBeats.map((beat) => beat.beat_id), explanation: 'Scene timing, native motion, transitions, and presenter-safe framing remain inspectable.' }),
    dimension({ key: 'scene_cinematography', numerator: cinematographyPasses.length + (variationPasses ? 1 : 0), denominator: videoBeats.length + 1, unit: 'checks', formula: 'video scenes with complete non-generic shot contracts plus one sequence-level variation check / all video scenes plus variation check', evidenceIds: videoBeats.map((beat) => beat.beat_id), explanation: `Every scene records shot, framing, angle, movement, environment, blocking, choreography, entrance/exit, rationale, duration, continuity, and pattern-interrupt intent; ${uniqueVisualSignatures.size}/${requiredVisualSignatures} required visual signatures observed.` }),
    dimension({ key: 'typography_compositing', numerator: passingTypographyRegions.length, denominator: typographyRegions.length, unit: 'regions', formula: 'customer-facing regions with approved type system + hierarchy + contrast + depth + shape interaction + safe placement + focal integration / all customer-facing regions', evidenceIds: typographyRegions.map((region) => region.id), explanation: 'Display text must be art-directed into the focal composition rather than pasted beside it as a default-font block.' }),
    dimension({ key: 'typography_style_evidence', numerator: typographyReceiptVerdict === 'approved' ? 1 : 0, denominator: 1, unit: 'checks', formula: 'current attributable receipt with at least 4 matched-style examples at performance_weight=1 and a scored cohort normalized to >=1.5x the same-channel baseline; zero-weight comparables are context-only / one required receipt', evidenceIds: plan.typography_style_receipt ? [plan.typography_style_receipt.receipt_id, ...plan.typography_style_receipt.comparables.map((item) => item.comparable_id)] : [], explanation: 'Zero-weight topic/audience comparables inform context only; approval requires the scored matched-style cohort, an eligible same-channel baseline, the normalized performance threshold, and an approved deterministic verdict.', unscored: typographyReceiptVerdict === 'unscored' }),
    dimension({ key: 'privacy', numerator: privacyChecks.filter(Boolean).length, denominator: privacyChecks.length, unit: 'checks', formula: 'visual regions and exact sources with a valid privacy boundary / all visual regions and exact sources', evidenceIds: plan.exact_sources.map((source) => source.source_id), explanation: 'Only public-safe, owned, or synthetic evidence is permitted.' }),
    dimension({ key: 'copy_purity', numerator: pureCopyBeats.length, denominator: plan.beats.length, unit: 'regions', formula: 'visual regions without internal workflow or implementation language / all visual regions', evidenceIds: plan.beats.map((beat) => beat.beat_id), explanation: 'Customer-facing copy is scanned for internal workflow and implementation language.' }),
  ]
  const status = evidenceUnscored || invalidSimilarityScore || dimensions.some((item) => item.status === 'unscored') ? 'unscored' : blockers.length ? 'blocked' : 'passed'
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
    dimensions: CAMPAIGN_VISUAL_DIMENSIONS.map(([key, label]) => ({
      key,
      label,
      status: 'unscored',
      score: null,
      calculation: { formula: 'Prerequisite evidence and script inputs unavailable.', numerator: null, denominator: null, observed: null, required: null, unit: 'checks' as const },
      evidence_ids: [],
      explanation: 'Visual scoring is withheld until the prerequisite evidence and script contract pass.',
    })),
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
  const inputFingerprint = hash({
    visual_plan_version: SOCIAL_CAMPAIGN_VISUAL_PLAN_VERSION,
    visual_evaluation_version: SOCIAL_CAMPAIGN_VISUAL_EVALUATION_VERSION,
    candidates: ordered.map((candidate) => ({ candidate_id: candidate.candidate_id, input_version: candidate.input_version, content_version: candidate.content_version, script_receipt: candidate.long_form_script_input?.receipt_id ?? null })),
  })
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
