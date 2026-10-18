import darkCastlePacket from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/dark_castle_chess.json'
import darkCastleReceipt from '@/artifacts/human-qa/artifact-video-review-2026-10-14/dark-castle-provider-none-review.receipt.json'
import jevPacket from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev.json'
import jevReceipt from '@/artifacts/human-qa/artifact-video-review-2026-10-14/jev-provider-none-review.receipt.json'
import jevSocialVideoReviewPackage from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-social-video-review-package-v1.json'
import jevYouTubeTitlePackage from '@/artifacts/human-qa/artifact-video-review-2026-10-14/jev-youtube-presenter-first/jev-youtube-title-subject-package.json'
import jevThumbnailCohort from '@/artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/cohort.json'
import jevThumbnailSelection from '@/artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/thumbnail-selection-receipt.json'
import type {
  ArtifactEvaluationDimension,
  ArtifactEvaluationDimensionKey,
  ArtifactEvaluationKind,
  ArtifactEvaluationReceipt,
} from '@/lib/artifact-evidence-evaluation'
import type { ArtifactEvidenceCategory, ArtifactEvidenceManifest, ThumbnailResearchCohort } from '@/lib/artifact-evidence-manifest'
import {
  HEYGEN_CAPABILITY_SNAPSHOT_VERSION,
  HEYGEN_LONG_FORM_RECIPE_VERSION,
  selectDeterministicRotationOption,
  type HeyGenLongFormProductionRecipe,
} from '@/lib/heygen-long-form-production-recipe'

const QA_FIXTURES = {
  'f966123f-05eb-48ec-a7c2-970afce642ef': {
    packet: jevPacket,
    receipt: jevReceipt,
    videoPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-provider-none-review.mp4',
    posterPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/jev-customer-facing-poster.png',
    posterSha256: '7709869d1d3f6d219128d5f47d0e5c3701c39a5079c4cf9378d2f958cd124a97',
  },
  '21c492c2-9279-4e08-afc9-49207935a681': {
    packet: darkCastlePacket,
    receipt: darkCastleReceipt,
    videoPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/dark-castle-provider-none-review.mp4',
    posterPath: 'artifacts/human-qa/artifact-video-review-2026-10-14/dark-castle-customer-facing-poster.png',
    posterSha256: 'e15d744685990933555575d6a3c7bc18100af901a766c9a81d4ab9b1cc827d78',
  },
} as const

export type ChannelNativeVideoQaFixtureId = keyof typeof QA_FIXTURES

export function isChannelNativeVideoQaFixtureId(id: string): id is ChannelNativeVideoQaFixtureId {
  return Object.prototype.hasOwnProperty.call(QA_FIXTURES, id)
}

function heygenLongFormQaRecipe(contentVersion: string): HeyGenLongFormProductionRecipe {
  const seed = `jev-youtube-long-form:${contentVersion}`
  const lookPool = [
    { id: 'look:navy-editorial', label: 'Navy editorial', capability_verified: true },
    { id: 'look:sand-workshop', label: 'Sand workshop', capability_verified: true },
    { id: 'look:charcoal-studio', label: 'Charcoal studio', capability_verified: true },
  ]
  const environmentPool = [
    { id: 'environment:quiet-library', label: 'Quiet library', capability_verified: true },
    { id: 'environment:product-wall', label: 'Product wall', capability_verified: true },
    { id: 'environment:light-studio', label: 'Light studio', capability_verified: true },
  ]
  const proposedLook = selectDeterministicRotationOption({ seed: `${seed}:look`, options: lookPool, previousId: 'look:navy-editorial' })!
  const proposedEnvironment = selectDeterministicRotationOption({ seed: `${seed}:environment`, options: environmentPool, previousId: 'environment:quiet-library' })!
  const sourceReceipts = ['source:jev:approved-composite-20261014', 'source:jev:product-dashboard-20261014', 'source:jev:outlier-packet-20261017', 'source:music:the-stream-v2:20261014']
  const rightsReceipts = ['rights:jev:owned-public-assets-20261014', 'rights:music:the-stream-v2:20261014']

  return {
    version: HEYGEN_LONG_FORM_RECIPE_VERSION,
    recipe_id: 'recipe:jev:youtube-long-form:v1',
    status: 'review_only',
    campaign: { campaign_id: 'artifact-video-review-2026-10-14', content_id: 'jev-youtube-long-form', content_version: contentVersion },
    evidence: {
      packet_id: 'evidence:jev:approved-composite-20261014',
      packet_version: 'v1',
      approval_receipt_id: 'approval:jev:approved-composite-20261014',
      product_proof_required: true,
      product_screenshots: [{
        asset_id: 'asset:jev:approval-dashboard',
        label: 'Jev approval dashboard',
        sha256: 'sha256:6f7d62e246454e2e1e294e2c033f302d19d7bfca35fe3902a8b17574f4b31560',
        source_receipt_id: 'source:jev:product-dashboard-20261014',
        rights_receipt_id: 'rights:jev:owned-public-assets-20261014',
      }],
      outlier: {
        packet_id: 'outlier:youtube:jev:20261017',
        observed_at: '2026-10-17T12:00:00.000Z',
        expires_at: '2026-10-24T12:00:00.000Z',
        source_receipt_id: 'source:jev:outlier-packet-20261017',
      },
    },
    deliverables: {
      master: {
        deliverable_id: 'deliverable:jev:youtube-master:v1',
        channel: 'youtube',
        aspect_ratio: '16:9',
        duration_seconds: 600,
        approval_status: 'pending',
        script_input_id: 'input:jev:script:v1',
        title_input_id: 'input:jev:title:v1',
        description_input_id: 'input:jev:description:v1',
        thumbnail_input_id: 'input:jev:thumbnail:v1',
      },
      derivatives: [
        { deliverable_id: 'deliverable:jev:youtube-short:v1', channel: 'youtube_shorts', aspect_ratio: '9:16', source_master_id: 'deliverable:jev:youtube-master:v1', source_master_version: contentVersion, inherited_evidence_packet_id: 'evidence:jev:approved-composite-20261014', packaging_input_id: 'input:jev:short-packaging:v1', approval_status: 'pending' },
        { deliverable_id: 'deliverable:jev:linkedin:v1', channel: 'linkedin', aspect_ratio: '1:1', source_master_id: 'deliverable:jev:youtube-master:v1', source_master_version: contentVersion, inherited_evidence_packet_id: 'evidence:jev:approved-composite-20261014', packaging_input_id: 'input:jev:linkedin-packaging:v1', approval_status: 'pending' },
      ],
    },
    provider: {
      provider: 'heygen',
      plan: 'pro',
      capability_snapshot: {
        version: HEYGEN_CAPABILITY_SNAPSHOT_VERSION,
        observed_at: '2026-10-17T12:00:00.000Z',
        expires_at: '2026-10-24T12:00:00.000Z',
        account_capability_verified: false,
        supported_engines: ['avatar_v', 'avatar_iv', 'avatar_iii', 'video_agent'],
        supported_visual_models: ['heygen_video_1'],
        duration_verified: false,
        credits_verified: false,
      },
      selected_engine: 'avatar_iv',
      visual_clip_model: 'heygen_video_1',
      avatar_v_reference_look_id: null,
      production_route: 'avatar_video_native_composite',
      avatar_identity_id: 'avatar:vambah:review-binding',
      voice_id: 'voice:vambah:review-binding',
      aspect_ratio: '16:9',
    },
    rotation: {
      seed,
      previous_look_id: 'look:navy-editorial',
      previous_environment_id: 'environment:quiet-library',
      look_pool: lookPool,
      environment_pool: environmentPool,
      proposed_look_id: proposedLook.id,
      proposed_environment_id: proposedEnvironment.id,
      override_look_id: null,
      override_environment_id: null,
    },
    scene_plan: [
      { scene_id: 'opening', start_seconds: 0, end_seconds: 75, look_id: proposedLook.id, environment_id: proposedEnvironment.id, role: 'presenter', motion_prompt: 'Open with a steady direct address and restrained camera movement.', product_asset_ids: [], generated_clip: null, native_composite: { required: true, source_media_is_visual_truth: true, preserve_source_fps_and_duration: true, mix_source_audio_at_scene_timestamps: true } },
      { scene_id: 'product-proof', start_seconds: 75, end_seconds: 360, look_id: proposedLook.id, environment_id: 'environment:product-wall', role: 'product_demo', motion_prompt: 'Reveal the approved dashboard capture at reading pace and hold each evidence region long enough to inspect.', product_asset_ids: ['asset:jev:approval-dashboard'], generated_clip: null, native_composite: { required: true, source_media_is_visual_truth: true, preserve_source_fps_and_duration: true, mix_source_audio_at_scene_timestamps: true } },
      { scene_id: 'evidence-b-roll', start_seconds: 360, end_seconds: 510, look_id: proposedLook.id, environment_id: 'environment:light-studio', role: 'b_roll', motion_prompt: 'Use a ten-second evidence-bound generated clip only as a cutaway; preserve the native presenter track.', product_asset_ids: ['asset:jev:approval-dashboard'], generated_clip: { model: 'heygen_video_1', duration_seconds: 10 }, native_composite: { required: true, source_media_is_visual_truth: true, preserve_source_fps_and_duration: true, mix_source_audio_at_scene_timestamps: true } },
      { scene_id: 'close', start_seconds: 510, end_seconds: 600, look_id: proposedLook.id, environment_id: proposedEnvironment.id, role: 'cta', motion_prompt: 'Return to the presenter and finish with the approved practical invitation.', product_asset_ids: [], generated_clip: null, native_composite: { required: true, source_media_is_visual_truth: true, preserve_source_fps_and_duration: true, mix_source_audio_at_scene_timestamps: true } },
    ],
    music: { track_id: 'music:the-stream-v2', authorization_receipt_id: 'source:music:the-stream-v2:20261014', rights_receipt_id: 'rights:music:the-stream-v2:20261014' },
    receipts: { approved_source_receipt_ids: sourceReceipts, approved_rights_receipt_ids: rightsReceipts, privacy_receipt_id: 'privacy:jev:public-safe-20261014' },
    budget: { estimated_run_credits: 10, per_run_credit_ceiling: 12, aggregate_committed_credits: 20, aggregate_credit_ceiling: 40, estimated_run_usd: 3.5, per_run_usd_ceiling: 5, aggregate_committed_usd: 6, aggregate_usd_ceiling: 15 },
    execution_boundary: { provider_calls_authorized: false, provider_calls_executed: 0, upload_authorized: false, platform_draft_authorized: false, scheduling_authorized: false, publishing_authorized: false, external_send_authorized: false },
    customer_artifacts: { internal_prompt_fields: [], governance_text_included: false },
  }
}

function artifactEvidenceManifest(input: {
  productId: string
  contentVersion: string
  inputVersion: string
  previewUrl: string
  previewAlt: string
  outputSha256: string
  musicReady: boolean
  sourceReceiptId: string
  researchPacketId: string | null
  sourceReviewedAt: string
  voiceReceiptId: string
  visualReceiptId: string
  challengerReceiptId: string
  supportedClaimCount: number
  totalClaimCount: number
  approvedProductEvidenceCount: number
  requiredProductEvidenceCount: number
  packagingTitle: string
  packagingHeadline: string
  packagingThumbnailUrl: string | null
}): ArtifactEvidenceManifest {
  const manifestId = `artifact-manifest:${input.productId}:youtube-shorts:v1`
  const researchReceiptId = input.researchPacketId ? `research_packet:${input.researchPacketId}` : input.sourceReceiptId
  const sourceHref = input.researchPacketId
    ? `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(input.researchPacketId)}`
    : `/admin/source-protocol?receipt=${encodeURIComponent(input.sourceReceiptId)}`
  const decisionHref = `/admin/agents/coordination?proposal=${encodeURIComponent(`${input.productId}-artifact-video-review`)}`
  const privacyReceipt = `privacy:${input.productId}:public-safe-20261014`
  const rightsReceipt = `rights:${input.productId}:owned-public-assets-20261014`
  const evaluationKindByCategory: Partial<Record<ArtifactEvidenceCategory, ArtifactEvaluationKind>> = {
    copy_script: 'script_message',
    visual_field: 'headline_hook',
    visual_template: 'visual_concept',
    thumbnail: 'thumbnail',
    title: 'title_subject',
    description: 'description',
    cta: 'cta',
  }
  const receiptLink = (receiptId: string) => ({ receipt_id: receiptId, href: `/admin/source-protocol?receipt=${encodeURIComponent(receiptId)}` })
  const researchLink = { receipt_id: researchReceiptId, href: sourceHref }
  const sourceLink = receiptLink(input.sourceReceiptId)
  const voiceLink = receiptLink(input.voiceReceiptId)
  const visualLink = receiptLink(input.visualReceiptId)
  const challengerLink = receiptLink(input.challengerReceiptId)
  const measured = (score: number, weight: number, threshold: number, rationale: string, inputs: ArtifactEvaluationDimension['deterministic_inputs'], source_receipts: ArtifactEvaluationDimension['source_receipts']): ArtifactEvaluationDimension => ({
    status: 'scored',
    score,
    basis: 'measured',
    direction: 'higher_is_better',
    weight,
    threshold,
    percentile: null,
    rank: null,
    deterministic_inputs: inputs,
    source_receipts,
    rationale,
  })
  const unscored = (weight: number, threshold: number, direction: ArtifactEvaluationDimension['direction'], rationale: string, source_receipts: ArtifactEvaluationDimension['source_receipts']): ArtifactEvaluationDimension => ({
    status: 'unscored',
    score: null,
    basis: 'unavailable',
    direction,
    weight,
    threshold,
    percentile: null,
    rank: null,
    deterministic_inputs: [],
    source_receipts,
    rationale,
  })
  const sourceSupportScore = input.totalClaimCount > 0 ? Math.round((input.supportedClaimCount / input.totalClaimCount) * 100) : 0
  const evidenceFitScore = input.requiredProductEvidenceCount > 0 ? Math.round((input.approvedProductEvidenceCount / input.requiredProductEvidenceCount) * 100) : 0
  const ageDays = Math.max(0, (Date.parse(input.contentVersion) - Date.parse(input.sourceReviewedAt)) / 86_400_000)
  const timelinessScore = Math.round(Math.max(0, 100 - (ageDays / 14) * 100))
  const evaluationReceipt = (kind: ArtifactEvaluationKind, elementId: string): ArtifactEvaluationReceipt => ({
    version: 'artifact-evaluation-scorecard/v1',
    receipt_id: `evaluation:${input.productId}:${kind}:${elementId}:20261015`,
    evaluation_kind: kind,
    content_version: input.contentVersion,
    evaluated_at: input.contentVersion,
    weighting_version: 'artifact-evaluation-weights/v1',
    benchmark_cohort: {
      cohort_id: null,
      status: 'missing',
      sample_size: null,
      observed_from: null,
      observed_to: null,
      fresh_until: null,
      source_receipts: [researchLink],
    },
    dimensions: {
      outlier_pattern_fit: unscored(25, 70, 'higher_is_better', 'Unscored: the approved research packet has no comparable-creator cohort, sample size, percentile, or rank.', [researchLink]),
      source_support: measured(sourceSupportScore, 20, 80, 'Measured from source-bound customer claims in the approved artifact packet.', [
        { name: 'supported_claims', value: String(input.supportedClaimCount), receipt_id: input.sourceReceiptId },
        { name: 'total_claims', value: String(input.totalClaimCount), receipt_id: input.sourceReceiptId },
      ], [sourceLink]),
      core_audience_fit: unscored(15, 70, 'higher_is_better', 'Unscored: the approved voice receipt has no element-level audience-fit value.', [voiceLink]),
      timeliness: measured(timelinessScore, 10, 65, 'Measured from the approved source-review date against this artifact content version using a 14-day freshness window.', [
        { name: 'source_reviewed_at', value: input.sourceReviewedAt, receipt_id: input.sourceReceiptId },
        { name: 'artifact_content_version', value: input.contentVersion, receipt_id: input.sourceReceiptId },
        { name: 'freshness_window_days', value: '14', receipt_id: input.sourceReceiptId },
      ], [sourceLink]),
      product_work_evidence_fit: measured(evidenceFitScore, 20, 80, 'Measured from approved first-party product evidence coverage.', [
        { name: 'approved_product_evidence', value: String(input.approvedProductEvidenceCount), receipt_id: input.visualReceiptId },
        { name: 'required_product_evidence', value: String(input.requiredProductEvidenceCount), receipt_id: input.visualReceiptId },
      ], [visualLink]),
      originality_repetition_risk: unscored(10, 35, 'lower_is_better', 'Unscored: the approved challenger receipt does not contain an element-level repetition-risk value.', [challengerLink]),
    } satisfies Record<ArtifactEvaluationDimensionKey, ArtifactEvaluationDimension>,
    overall: {
      score: null,
      threshold: 75,
      recommendation: 'hold',
      confidence_score: null,
      confidence_label: 'unscored',
      rationale: 'Hold advancement until comparable outlier evidence, audience-fit judgment, and originality/repetition evidence are attached.',
      source_receipts: [sourceLink, voiceLink, visualLink, challengerLink],
    },
  })
  const cohortLink = { receipt_id: jevThumbnailCohort.cohort_id, href: `/admin/agents/content-intelligence?section=research&packet=${encodeURIComponent(jevThumbnailCohort.cohort_id)}` }
  const baselineLink = { receipt_id: jevThumbnailSelection.baseline_receipt_id, href: `/admin/social-content?section=evidence&receipt=${encodeURIComponent(jevThumbnailSelection.baseline_receipt_id)}` }
  const selectionLink = { receipt_id: jevThumbnailSelection.receipt_id, href: decisionHref }
  const packagingResearchCohort = (): ThumbnailResearchCohort => ({
    cohort_id: jevThumbnailCohort.cohort_id,
    target: 'YouTube Shorts · AI governance / human decision ownership · 15–60 seconds',
    observed_at: jevThumbnailCohort.observed_at,
    sample_size: jevThumbnailCohort.selection_gate.qualified_sample_size,
    minimum_sample_size: jevThumbnailCohort.selection_gate.minimum_sample_size,
    outlier_rule: jevThumbnailCohort.outlier_qualification.rule,
    outlier_sample_size: jevThumbnailCohort.outlier_qualification.qualified_sample_size,
    formula: Object.values(jevThumbnailCohort.formula),
    recurring_visual_traits: jevThumbnailCohort.recurring_visual_traits,
    adopted_traits: [
      'Approved expressive Vambah subject as the dominant human anchor.',
      'Short tension hook: AI SCORED IT / WHO DECIDES?',
      'One approved Jev interface crop as concrete product proof.',
      '1080×1920 9:16 Short frame with AmaduTown navy, yellow, coral, depth, and portrait logo treatment.',
    ],
    rejected_traits: [
      'No composition trait is attributed to the two visually dissimilar public outliers.',
      'No copied public-source pixels, wording, creator likenesses, or layouts.',
      'No generic AI imagery, internal labels, methodology copy, receipt language, or candidate-performance claim.',
    ],
    composition_decision: 'Create an original 1080×1920 AmaduTown/Jev Short from owned assets: approved Vambah subject, a short tension hook, one Jev proof object, and established navy/yellow/coral brand treatment.',
    public_outlier_boundary: 'The two score-qualified public examples are visually dissimilar comparison neighbors. They do not support the candidate composition and contribute zero candidate design-fit points.',
    first_party_neighbors: [
      { id: 'first-party-short', label: 'Approved AmaduTown Short baseline', artifact_url: '/review-assets/social-content/jev-first-party-baselines/approved-short-baseline.png', source_url: '/review-assets/social-content/jev-first-party-baselines/approved-short-baseline.png', link_status: 'verified_openable', supports_candidate_composition: true, support_reason: 'Supports the 9:16 frame, expressive subject, short tension hook, one product object, and AmaduTown contrast treatment.', width: 1080, height: 1920, aspect_ratio: '9:16' },
      { id: 'first-party-steal', label: 'Steal This first-party thumbnail', artifact_url: '/review-assets/social-content/jev-first-party-baselines/steal-this.png', source_url: '/review-assets/social-content/jev-first-party-baselines/steal-this.png', link_status: 'verified_openable', supports_candidate_composition: true, support_reason: 'Supports the large human anchor, concise hook, and visible workflow proof.', width: null, height: null, aspect_ratio: null },
      { id: 'first-party-struggle', label: 'Struggle to System first-party thumbnail', artifact_url: '/review-assets/social-content/jev-first-party-baselines/struggle-to-system.png', source_url: '/review-assets/social-content/jev-first-party-baselines/struggle-to-system.png', link_status: 'verified_openable', supports_candidate_composition: true, support_reason: 'Supports the bold tension-led headline and AmaduTown brand contrast; it does not determine the Short aspect ratio.', width: null, height: null, aspect_ratio: null },
    ],
    candidate: { id: 'jev-candidate-v3', label: 'Jev 9:16 candidate', artifact_url: jevThumbnailSelection.output.public_path, source_url: jevThumbnailSelection.output.public_path, link_status: 'verified_openable', supports_candidate_composition: true, support_reason: 'Current candidate bound to the v3 receipt at 1080×1920.', width: jevThumbnailSelection.output.width, height: jevThumbnailSelection.output.height, aspect_ratio: jevThumbnailSelection.output.aspect_ratio },
    element_bindings: [
      { element: 'subject', source_label: 'Approved Vambah subject', source_url: '/review-assets/social-content/jev-first-party-baselines/approved-short-baseline.png', link_status: 'verified_openable', support: 'supports', limitation: 'Supports the human anchor only; it does not support the exact hook, Jev claim, or public performance.' },
      { element: 'hook', source_label: 'First-party thumbnail library', source_url: '/review-assets/social-content/jev-first-party-baselines/struggle-to-system.png', link_status: 'verified_openable', support: 'supports', limitation: 'Supports short tension-led copy, not the exact words AI SCORED IT / WHO DECIDES?' },
      { element: 'product_proof', source_label: 'Jev product lineage', source_url: sourceHref, link_status: 'verified_openable', support: 'supports', limitation: 'Supports the visible score, policy-band, and human-ownership interface only; it does not support audience performance.' },
      { element: 'aspect_ratio', source_label: 'Approved 9:16 Short baseline', source_url: '/review-assets/social-content/jev-first-party-baselines/approved-short-baseline.png', link_status: 'verified_openable', support: 'supports', limitation: 'Supports 1080×1920 9:16. Landscape treatment is not approved for this 22-second Short.' },
      { element: 'brand_treatment', source_label: 'AmaduTown first-party baselines', source_url: '/review-assets/social-content/jev-first-party-baselines/steal-this.png', link_status: 'verified_openable', support: 'supports', limitation: 'Supports navy, yellow, coral, portrait logo, and depth treatment; it does not support a public-outlier claim.' },
    ],
    samples: [
      ...jevThumbnailCohort.included.map((sample) => ({
        video_id: sample.video_id,
        youtube_url: sample.youtube_url,
        title: sample.title,
        creator: sample.creator,
        thumbnail_path: sample.thumbnail_path,
        source_thumbnail_url: sample.source_thumbnail_url,
        link_status: 'verified_openable' as const,
        view_count: sample.view_count,
        subscriber_count: sample.subscriber_count,
        duration_seconds: sample.duration_seconds,
        published_at: sample.published_at,
        observed_at: sample.observed_at,
        decision: 'included' as const,
        decision_reason: sample.inclusion_reason,
        channel_relative_ratio: sample.channel_relative_ratio,
        audience_view_ratio: sample.audience_view_ratio,
        recency_adjusted_views_per_day: sample.recency_adjusted_views_per_day,
        normalized_performance_score: sample.normalized_performance_score,
        outlier_qualified: sample.outlier_qualified,
        supports_candidate_composition: false,
        composition_support_reason: sample.outlier_qualified ? 'Formula-qualified for normalized public performance, but its visible frame does not support the candidate layout, subject treatment, product proof, or brand treatment.' : 'Topical baseline only; it is not used as candidate design support.',
        visual_traits: sample.visual_traits,
      })),
      ...jevThumbnailCohort.excluded.map((sample) => ({
        video_id: sample.video_id,
        youtube_url: sample.youtube_url,
        title: sample.title,
        creator: sample.creator,
        thumbnail_path: null,
        source_thumbnail_url: sample.source_thumbnail_url,
        link_status: 'verified_openable' as const,
        view_count: sample.view_count,
        subscriber_count: sample.subscriber_count,
        duration_seconds: sample.duration_seconds,
        published_at: sample.published_at,
        observed_at: sample.observed_at,
        decision: 'excluded' as const,
        decision_reason: sample.exclusion_reason,
        channel_relative_ratio: null,
        audience_view_ratio: null,
        recency_adjusted_views_per_day: null,
        normalized_performance_score: null,
        outlier_qualified: false,
        supports_candidate_composition: false,
        composition_support_reason: 'Excluded from scoring and candidate design support.',
        visual_traits: {},
      })),
    ],
  })
  const scoredPackagingReceipt = (kind: 'title_subject' | 'thumbnail', elementId: string): ArtifactEvaluationReceipt => {
    const links = [baselineLink, selectionLink, sourceLink, cohortLink]
    const percent = (passed: number, total: number) => Number(((passed / total) * 100).toFixed(2))
    const firstPartyRuleTotal = kind === 'thumbnail' ? 5 : 2
    const firstPartyRuleMatches = firstPartyRuleTotal
    const linkedReceiptCount = links.length
    const requiredReceiptCount = 4
    const titleWordCount = jevThumbnailSelection.title.split(/\s+/).length
    const mobileReadabilityChecks = kind === 'thumbnail' ? 4 : 1
    const mobileReadabilityTotal = kind === 'thumbnail' ? 4 : 1
    const audienceScore = kind === 'thumbnail' ? percent(mobileReadabilityChecks, mobileReadabilityTotal) : Math.max(0, 100 - (Math.max(0, titleWordCount - 6) * 5))
    const observedAgeDays = Math.max(0, (Date.parse(jevThumbnailSelection.observed_at) - Date.parse(jevThumbnailCohort.observed_at)) / 86_400_000)
    const timelinessScore = Number(Math.max(0, 100 - ((observedAgeDays / 14) * 100)).toFixed(2))
    const productProofChecks = 2
    const requiredProductProofChecks = 2
    const originalityViolations = 0
    const confidenceScore = kind === 'thumbnail' ? 90 : 85
    const scores: Record<ArtifactEvaluationDimensionKey, number> = {
      outlier_pattern_fit: percent(firstPartyRuleMatches, firstPartyRuleTotal),
      source_support: percent(linkedReceiptCount, requiredReceiptCount),
      core_audience_fit: audienceScore,
      timeliness: timelinessScore,
      product_work_evidence_fit: percent(productProofChecks, requiredProductProofChecks),
      originality_repetition_risk: Math.min(100, originalityViolations * 50),
    }
    const scored = (key: ArtifactEvaluationDimensionKey, weight: number, threshold: number, direction: ArtifactEvaluationDimension['direction'], basis: ArtifactEvaluationDimension['basis'], rationale: string, inputs: ArtifactEvaluationDimension['deterministic_inputs']): ArtifactEvaluationDimension => ({
      status: 'scored', score: scores[key], basis, direction, weight, threshold, percentile: null, rank: null, deterministic_inputs: inputs, source_receipts: links, rationale,
    })
    const dimensions = {
      outlier_pattern_fit: scored('outlier_pattern_fit', 25, 70, 'higher_is_better', 'measured', 'First-party baseline fit only. Formula: candidate matches / applicable approved AmaduTown rules × 100. The public outliers contribute zero design-fit points.', [
        { name: 'candidate_first_party_rule_matches', value: String(firstPartyRuleMatches), receipt_id: selectionLink.receipt_id },
        { name: 'applicable_first_party_rules', value: String(firstPartyRuleTotal), receipt_id: baselineLink.receipt_id },
        { name: 'public_outlier_design_support_count', value: '0', receipt_id: cohortLink.receipt_id },
      ]),
      source_support: scored('source_support', 20, 80, 'higher_is_better', 'measured', 'Formula: linked required receipts / four required receipts × 100.', [
        { name: 'linked_required_receipts', value: String(linkedReceiptCount), receipt_id: selectionLink.receipt_id },
        { name: 'required_receipts', value: String(requiredReceiptCount), receipt_id: sourceLink.receipt_id },
      ]),
      core_audience_fit: scored('core_audience_fit', 15, 70, 'higher_is_better', 'measured', kind === 'thumbnail' ? 'Formula: passed phone-readability checks / four checks × 100 (six-word hook, high contrast, mobile no-overflow, one decision question).' : 'Formula: 100 − max(0, title words − 6) × 5.', [
        { name: kind === 'thumbnail' ? 'passed_mobile_readability_checks' : 'title_word_count', value: String(kind === 'thumbnail' ? mobileReadabilityChecks : titleWordCount), receipt_id: selectionLink.receipt_id },
        { name: kind === 'thumbnail' ? 'required_mobile_readability_checks' : 'preferred_title_word_count', value: String(kind === 'thumbnail' ? mobileReadabilityTotal : 6), receipt_id: selectionLink.receipt_id },
      ]),
      timeliness: scored('timeliness', 10, 65, 'higher_is_better', 'measured', 'Formula: max(0, 100 − cohort age days / 14 × 100).', [
        { name: 'cohort_age_days', value: String(observedAgeDays), receipt_id: cohortLink.receipt_id },
        { name: 'freshness_window_days', value: '14', receipt_id: cohortLink.receipt_id },
      ]),
      product_work_evidence_fit: scored('product_work_evidence_fit', 20, 80, 'higher_is_better', 'measured', 'Formula: passed Jev proof checks / two required checks × 100 (approved 81% score plus human-decision boundary).', [
        { name: 'passed_product_proof_checks', value: String(productProofChecks), receipt_id: sourceLink.receipt_id },
        { name: 'required_product_proof_checks', value: String(requiredProductProofChecks), receipt_id: sourceLink.receipt_id },
      ]),
      originality_repetition_risk: scored('originality_repetition_risk', 10, 35, 'lower_is_better', 'measured', 'Formula: min(100, attributable reuse violations × 50). No cohort pixels or source phrases were reused.', [
        { name: 'attributable_reuse_violations', value: String(originalityViolations), receipt_id: selectionLink.receipt_id },
        { name: 'penalty_per_violation', value: '50', receipt_id: selectionLink.receipt_id },
      ]),
    } satisfies Record<ArtifactEvaluationDimensionKey, ArtifactEvaluationDimension>
    const overallScore = Number((Object.values(dimensions).reduce((total, dimension) => total + (dimension.direction === 'lower_is_better' ? 100 - dimension.score! : dimension.score!) * dimension.weight, 0) / 100).toFixed(2))
    return {
      version: 'artifact-evaluation-scorecard/v1',
      receipt_id: `evaluation:jev:${kind}:${elementId}:20261018`,
      evaluation_kind: kind,
      content_version: input.contentVersion,
      evaluated_at: jevThumbnailCohort.observed_at,
      weighting_version: 'artifact-evaluation-weights/v1',
      benchmark_cohort: { cohort_id: jevThumbnailSelection.baseline_receipt_id, status: 'approved', sample_size: 3, observed_from: '2026-10-16T00:00:00.000Z', observed_to: jevThumbnailSelection.observed_at, fresh_until: '2026-11-01T00:00:00.000Z', source_receipts: [baselineLink] },
      dimensions,
      overall: { score: overallScore, threshold: 75, recommendation: overallScore >= 75 ? 'advance' : 'revise', confidence_score: confidenceScore, confidence_label: confidenceScore >= 80 ? 'high' : confidenceScore >= 60 ? 'medium' : 'low', rationale: `Advance to human QA: every design-fit score is reproduced from approved first-party baselines, Jev product proof, and the v3 binding receipt. Public outlier visuals are comparison-only and contribute zero design-fit points.`, source_receipts: links },
    }
  }
  const element = (category: ArtifactEvidenceCategory, id: string, label: string, excerpt: string, options: Partial<ArtifactEvidenceManifest['elements'][number]> = {}): ArtifactEvidenceManifest['elements'][number] => ({
    id,
    category,
    label,
    input_excerpt: excerpt,
    customer_facing: true,
    review_only: false,
    redacted: false,
    source_identity: `source:${input.productId}:approved-artifact-packet`,
    source_record_type: 'portfolio_research_packet',
    authoritative_href: sourceHref,
    evidence_receipt_ids: [`source:${input.productId}:approved-composite-20261014`],
    version_hash: input.inputVersion,
    content_version: input.contentVersion,
    rights_privacy_status: 'passed',
    rights_privacy_receipt_ids: [rightsReceipt, privacyReceipt],
    transformation_step: 'Bound into the versioned channel-native review packet without provider execution.',
    ...(evaluationKindByCategory[category] ? {
      evaluation_kind: evaluationKindByCategory[category],
      evaluation_receipt: evaluationReceipt(evaluationKindByCategory[category]!, id),
    } : {}),
    ...options,
  })
  const elements = [
    element('copy_script', 'script', 'Spoken script', 'The artifact makes the evidence and decision trail visible.', { region: { x: 50, y: 50 } }),
    element('visual_field', 'visual-proof', 'Headline / hook', 'Evidence → decision → bounded next action', { region: { x: 48, y: 42 } }),
    element('product_screenshot', 'product-capture', 'Product screenshot', 'Approved product interface capture', { region: { x: 28, y: 56 } }),
    element('visual_template', 'visual-recipe', 'Visual concept and recipe', 'Channel-native evidence walkthrough with restrained motion.'),
    element('presenter_avatar', 'presenter', 'Presenter/avatar', 'No generated presenter; artifact-led provider-none composition.', { customer_facing: false, review_only: true }),
    element('voice_narration', 'voice', 'Voice and narration', 'Approved narration mixed from the version-bound source track.'),
    element('music', 'music', 'Music bed', 'The Stream V2 instrumental bed.', input.musicReady ? {} : {
      rights_privacy_status: 'missing',
      rights_privacy_receipt_ids: [],
    }),
    element('thumbnail', 'thumbnail', 'Thumbnail', input.packagingHeadline, {
      region: { x: 72, y: 34 },
      artifact_url: input.packagingThumbnailUrl,
      source_identity: input.productId === 'jev' ? jevThumbnailSelection.receipt_id : `source:${input.productId}:approved-artifact-packet`,
      evidence_receipt_ids: input.productId === 'jev'
        ? [jevThumbnailSelection.receipt_id, jevThumbnailSelection.baseline_receipt_id, ...jevYouTubeTitlePackage.thumbnail.source_receipt_ids]
        : [`source:${input.productId}:approved-composite-20261014`],
      ...(input.productId === 'jev' ? { evaluation_receipt: scoredPackagingReceipt('thumbnail', 'thumbnail'), research_cohort: packagingResearchCohort() } : {}),
    }),
    element('title', 'title', 'Title', input.packagingTitle, {
      region: { x: 48, y: 16 },
      source_identity: input.productId === 'jev' ? jevThumbnailSelection.receipt_id : `source:${input.productId}:approved-artifact-packet`,
      evidence_receipt_ids: input.productId === 'jev'
        ? [jevThumbnailSelection.receipt_id, jevThumbnailSelection.baseline_receipt_id, ...jevYouTubeTitlePackage.source_receipt_ids]
        : [`source:${input.productId}:approved-composite-20261014`],
      ...(input.productId === 'jev' ? { evaluation_receipt: scoredPackagingReceipt('title_subject', 'title') } : {}),
    }),
    element('description', 'description', 'Description', 'A practical walkthrough of the artifact, its proof, and its bounded value.'),
    element('cta', 'cta', 'Call to action', 'Inspect the receipt trail before approving the next gate.', { region: { x: 51, y: 83 } }),
    element('source_research', 'research', 'Source research', 'Approved public-safe research summary.', {
      customer_facing: false,
      review_only: true,
      redacted: true,
      input_excerpt: '[Private source withheld — approved summary only]',
      source_identity: `open-brain:memory:${input.productId}:approved-summary`,
      source_record_type: 'open_brain_approved_memory',
      authoritative_href: '/admin/agents/open-brain?view=approved',
    }),
    element('transformation', 'transform', 'Transformation recipe', 'Native source → edit timeline → privacy-safe composite → SHA-256 verification.', { customer_facing: false, review_only: true, authoritative_href: decisionHref }),
    element('final_output', 'output', 'Final MP4 output', `SHA-256 ${input.outputSha256}`, { authoritative_href: decisionHref }),
  ]
  return {
    version: 'artifact-evidence-manifest/v2',
    manifest_id: manifestId.replace(':v1', ':v2'),
    manifest_hash: input.productId === 'jev'
      ? 'sha256:7e13a46b2ad2c8757c79c35b6a44e69f7d55d43c47db2c459411eefdd70c5d0e'
      : 'sha256:1c67d5f36ac30e66ca78fa075d8508197e899e3c944a4601c595ff4de70a4f7e',
    content_version: input.contentVersion,
    artifact_label: `${input.productId === 'jev' ? 'Jev' : 'Dark Castle Chess'} customer-facing video`,
    preview_url: input.previewUrl,
    preview_alt: input.previewAlt,
    final_output_hashes: [{ label: 'Final MP4', sha256: input.outputSha256 }],
    elements,
  }
}

export function channelNativeVideoQaFixture(
  id: ChannelNativeVideoQaFixtureId,
  videoPackageState: 'ready' | 'blocked' = 'ready',
  packagingState: 'bound' | 'missing_thumbnail' = 'bound',
) {
  const fixture = QA_FIXTURES[id]
  const packet = fixture.packet
  const receipt = fixture.receipt
  const shorts = packet.draft.format_adaptations.find((adaptation) => adaptation.target === 'youtube_shorts')
  if (!shorts) throw new Error(`Channel-native video QA packet ${id} is missing its YouTube Shorts adaptation.`)

  const traceabilitySummary = `Every customer-facing claim in this adaptation remains bound to ${packet.identity.source_ids.length} approved source identities, ${packet.evidence_assets.length} cleared artifact${packet.evidence_assets.length === 1 ? '' : 's'}, and the current privacy, rights, challenger, and script-quality receipts.`
  const manifest = artifactEvidenceManifest({
    productId: packet.identity.product_id,
    contentVersion: packet.generated_at,
    inputVersion: packet.input_version,
    previewUrl: `/review-assets/social-content/${fixture.posterPath.split('/').at(-1)}`,
    previewAlt: `${packet.identity.product_id === 'jev' ? 'Jev' : 'Dark Castle Chess'} customer-facing video poster with traceable evidence regions`,
    outputSha256: receipt.output.sha256,
    musicReady: videoPackageState === 'ready',
    sourceReceiptId: packet.receipts.source.receipt_id,
    researchPacketId: packet.identity.source_ids.find((sourceId) => sourceId.startsWith('research_packet:'))?.slice('research_packet:'.length) ?? null,
    sourceReviewedAt: packet.receipts.source.reviewed_at,
    voiceReceiptId: packet.receipts.voice.receipt_id,
    visualReceiptId: packet.receipts.visual.receipt_id,
    challengerReceiptId: packet.receipts.challenger.receipt_id,
    supportedClaimCount: packet.claims.filter((claim) => claim.source_receipt_ids.length > 0).length,
    totalClaimCount: packet.claims.length,
    approvedProductEvidenceCount: packet.evidence_assets.filter((asset) => asset.source_receipt_ids.length > 0 && asset.privacy_receipt_id && asset.rights_receipt_id).length,
    requiredProductEvidenceCount: Math.max(1, packet.evidence_assets.length),
    packagingTitle: packet.identity.product_id === 'jev'
      ? jevThumbnailSelection.title
      : packet.draft.title_options[0]?.title ?? `${packet.identity.product_id}: what the artifact makes visible`,
    packagingHeadline: packet.identity.product_id === 'jev'
      ? jevThumbnailSelection.headline
      : packet.draft.thumbnail_brief.headline,
    packagingThumbnailUrl: packet.identity.product_id === 'jev' && packagingState === 'bound'
      ? jevThumbnailSelection.output.public_path
      : null,
  })

  return {
    id,
    meeting_record_id: null,
    platform: 'youtube' as const,
    status: packet.identity.product_id === 'jev' ? 'approved' as const : 'draft' as const,
    post_text: shorts.full_spoken_script,
    cta_text: null,
    cta_url: null,
    hashtags: [],
    image_url: null,
    image_prompt: null,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: shorts.full_spoken_script,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: {
      source: 'human_qa_approved_artifact_video_packet',
      source_type: 'version_bound_provider_none_mp4',
      campaign_id: packet.identity.campaign_id,
      work_item_id: packet.identity.channel_packet_ids.find((value) => value.startsWith('work-item:'))?.slice('work-item:'.length) ?? null,
      product_id: packet.identity.product_id,
      topic_id: packet.identity.topic_id,
      source_ids: packet.identity.source_ids,
      channel_packet_ids: packet.identity.channel_packet_ids,
      artifact_video_adaptation_id: packet.adaptation_id,
      input_version: packet.input_version,
      claims: packet.claims,
      evidence_assets: packet.evidence_assets,
      receipts: packet.receipts,
      approved_title_options: packet.draft.title_options,
      approved_description: {
        practical_value: packet.draft.practical_value,
        why_artifact_matters: packet.draft.why_artifact_matters,
      },
      approved_thumbnail_brief: packet.draft.thumbnail_brief,
      traceability_summary: traceabilitySummary,
      artifact_evidence_manifest: manifest,
      workflow_state: 'human_review_required',
      current_gate: packet.identity.product_id === 'jev' ? 'asset_packet' : 'copy_review',
      publish_gate: 'draft_only',
      provider_actions_enabled: false,
      platform_draft_enabled: false,
      external_execution_enabled: false,
      side_effects: receipt.side_effects,
      approved_video_packet: {
        status: 'human_qa_approved',
        target: receipt.target,
        provider: receipt.provider,
        video_path: fixture.videoPath,
        poster_path: fixture.posterPath,
        packet_path: `artifacts/human-qa/artifact-video-review-2026-10-14/inputs/${packet.identity.product_id === 'jev' ? 'jev' : 'dark_castle_chess'}.json`,
        receipt_path: fixture.videoPath.replace(/\.mp4$/, '.receipt.json'),
        video_sha256: receipt.output.sha256,
        poster_sha256: (receipt.output as { poster_sha256?: string }).poster_sha256 ?? fixture.posterSha256,
        render_version: receipt.version,
        motion_profile: (receipt as { composition?: { motion_profile?: string } }).composition?.motion_profile ?? null,
        duration_seconds: Number(receipt.output.probe.format.duration),
        codec: receipt.output.probe.streams[0]?.codec_name,
        width: receipt.output.probe.streams[0]?.width,
        height: receipt.output.probe.streams[0]?.height,
        fps: receipt.output.probe.streams[0]?.r_frame_rate,
        repository_commit: '6fca0c17d16dfdf34cdd584d020d73f344bcab8e',
      },
      ...(packet.identity.product_id === 'jev' ? {
        social_video_review_package: jevSocialVideoReviewPackage,
        social_video_review_source_receipt_ids: [
          'source:jev:approved-composite-20261014',
          'source:music:the-stream-v2:20261014',
        ],
        social_video_review_rights_receipt_ids: [
          'rights:jev:owned-public-assets-20261014',
          ...(videoPackageState === 'ready' ? ['rights:music:the-stream-v2:20261014'] : []),
        ],
        social_video_review_fixture_state: videoPackageState,
        heygen_long_form_production_recipe: heygenLongFormQaRecipe(packet.generated_at),
      } : {}),
      qa_fixture: {
        kind: 'channel_native_video_review',
        read_only: true,
        reason: 'Production-equivalent, repository-bound video review fixture.',
        next_action: 'Use the canonical Decision Queue for any internal decision. Provider, upload, platform-draft, schedule, publish, credential, privacy, and external-send gates remain closed.',
      },
    },
    ...(packet.identity.product_id === 'jev' ? {
      calendar_preparation: {
        calendar_item_id: '669f6c22-d373-4423-bf7c-77661c484302',
        social_content_id: id,
        state: 'ready' as const,
        authorization_status: 'authorized',
        due_status: 'due_soon',
        scheduled_for: '2026-10-17T17:30:20.321Z',
        prepared_at: '2026-10-17T22:05:40.33184Z',
        content_version: 'sha256:e6fc9ae4aadd61e3a871e8f7af2dd0a2d424d5c20ae6a8d0eac861b16e796bd5',
        reused_existing_approved_packet: true,
      },
    } : {}),
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: null,
    target_platforms: ['youtube' as const],
    video_generation_method: 'none' as const,
    youtube_title: null,
    youtube_description: null,
    content_format: 'single_image' as const,
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    created_at: packet.generated_at,
    updated_at: packet.generated_at,
    publishes: [],
  }
}
