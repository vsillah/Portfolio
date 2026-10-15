import { campaignVideoContext } from './campaign-video-eligibility'
import type { SocialContentItem } from '@/lib/social-content'
import {
  getProductionAssets,
  getVideoRedactionGate,
  type BrollLibraryAsset,
  type SocialProductionAssetsPacket,
} from '@/lib/social-production-assets'

export const SOCIAL_VIDEO_PRODUCTION_VERSION = 'social_video_production_v1'
export const SOCIAL_VIDEO_PRODUCTION_SOURCE = 'youtube_social_content_heygen_bridge'
export const SOCIAL_VIDEO_GENERATION_CONTRACT_VERSION = 'social_video_generation_contract_v1' as const

export const SOCIAL_VIDEO_GENERATION_CONTRACT = {
  version: SOCIAL_VIDEO_GENERATION_CONTRACT_VERSION,
  rule_ids: [
    'research.source_outlier_alignment',
    'evidence.first_party_product_visuals',
    'script.youtube_template_first',
    'script.practitioner_specific',
    'script.complete_conclusion',
    'script.semantic_spoken_cta',
    'frames.customer_facing_only',
    'avatar.approved_identity_voice_rights',
    'avatar.rotate_approved_looks',
    'avatar.native_mp4_visual_truth',
    'layout.presenter_forward_bookends',
    'layout.presenter_left_assets_right',
    'motion.preserve_native_animation',
    'motion.reduced_motion_fallback',
    'assets.once_cue_bound_no_loop',
    'assets.max_one_per_frame',
    'assets.complete_inventory_or_omission',
    'layout.synchronized_safe_uncrowded',
    'music.rights_cleared_instrumental',
    'music.audible_moderate_duck_no_loop',
    'voice.preserve_timing_lip_sync',
    'voice.no_deceptive_word_splicing',
    'packaging.shared_version_bound_evidence',
    'provenance.reviewable_outside_media',
    'validation.exact_output_and_semantics',
    'validation.fail_closed',
    'gates.external_actions_separate',
    'human_qa.complete_review_packet',
    'exceptions.artifact_only_no_default_drift',
  ],
  customer_facing_forbidden_content: ['prompt', 'code_logic', 'receipt', 'qa_label', 'operator_note'],
  separate_explicit_gates: ['render', 'provider', 'upload', 'platform_draft', 'schedule', 'publish', 'external_send'],
  prospective_defaults: {
    spoken_cta_required: true,
    teaching_asset_appearance_count: 1,
    max_concurrent_teaching_assets: 1,
    music_vocals_allowed: false,
    music_loop_allowed: false,
    avatar_look_rotation_required: true,
    native_motion_flattening_allowed: false,
    deceptive_word_splicing_allowed: false,
    first_party_product_evidence_required_when_applicable: true,
  },
} as const

export interface SocialVideoGenerationEvidence {
  contract_version: typeof SOCIAL_VIDEO_GENERATION_CONTRACT_VERSION
  artifact_id: string
  input_version: string
  research: { sources_current: boolean; outlier_evidence_bound: boolean; topic_title_thumbnail_description_script_aligned: boolean }
  product_evidence: {
    topic_references_owned_product: boolean
    approved_first_party_asset_ids: string[]
    screenshots_current: boolean
    privacy_and_rights_cleared: boolean
    visual_claim_bindings_complete: boolean
    narration_cue_bindings_complete: boolean
    omission_reason: string
  }
  script: { youtube_template_run_passed: boolean; practitioner_specific: boolean; complete_conclusion: boolean; approved_cta_text: string; spoken_cta_transcript_present: boolean }
  customer_facing: { internal_text_leakage: string[] }
  avatar: { approved_avatar_id: string; approved_voice_id: string; rights_receipt_id: string; look_rotation_receipt_id: string; repeats_prior_look_without_exception: boolean; native_source_mp4_bound: boolean; native_composite_used_when_required: boolean }
  presentation: { presenter_forward_opening: boolean; presenter_forward_conclusion: boolean; presenter_large_left_during_evidence: boolean; assets_right: boolean; smooth_transitions: boolean }
  motion: { native_animation_preserved: boolean; source_hashes_bound: boolean; reduced_motion_fallback: boolean; lost_or_substituted_scene_ids: string[] }
  assets: { inventory_complete: boolean; every_used_once: boolean; every_asset_cue_bound: boolean; loops_or_repeats: boolean; max_concurrent_visible: number; omissions_have_receipts: boolean }
  layout: { timing_synchronized: boolean; safe_areas_passed: boolean; padding_passed: boolean; overlap_or_crowding: boolean; top_stacking_or_clipping: boolean }
  music: { rights_receipt_id: string; instrumental: boolean; audible_under_speech: boolean; moderate_ducking_passed: boolean; vocals: boolean; loop: boolean; bounded_fades: boolean }
  voice: { timing_preserved: boolean; lip_sync_passed: boolean; dsp_scope: 'none' | 'eq_dynamics_only'; claims_new_prosody: boolean; deceptive_word_splicing: boolean }
  packaging: { shared_research_version_bound: boolean; title_receipt_id: string; thumbnail_receipt_id: string; description_receipt_id: string; script_receipt_id: string }
  provenance: { source_receipts_current: boolean; rights_receipts_current: boolean; privacy_receipt_id: string; field_level_proof_reviewable: boolean; excluded_from_customer_frames: boolean }
  validation: { duration_passed: boolean; frame_count_passed: boolean; full_decode_passed: boolean; av_sync_passed: boolean; speech_audibility_passed: boolean; cta_semantics_passed: boolean; clipping_samples: number; green_spill_passed: boolean; motion_preservation_passed: boolean; no_repeats_passed: boolean; overlap_safe_area_passed: boolean }
  gate_authorizations: Record<(typeof SOCIAL_VIDEO_GENERATION_CONTRACT.separate_explicit_gates)[number], boolean>
  human_qa: { exact_route: string; screenshot_path: string; playable_mp4_path: string; what_changed: string; value: string; review_script: string; next_authorization: string }
  accepted_exceptions: Array<{ artifact_id: string; input_version: string; rule_id: 'script.semantic_spoken_cta'; accepted_by_user: true; visual_cta_present: true; reason: string; weakens_future_default: false }>
}

export function evaluateSocialVideoGenerationContract(value: SocialVideoGenerationEvidence) {
  const blockers: string[] = []
  const exception = value.accepted_exceptions.find((entry) => entry.artifact_id === value.artifact_id && entry.input_version === value.input_version && entry.rule_id === 'script.semantic_spoken_cta' && entry.accepted_by_user && entry.visual_cta_present && entry.weakens_future_default === false)
  if (value.contract_version !== SOCIAL_VIDEO_GENERATION_CONTRACT_VERSION) blockers.push('Social Video Generation Contract version is missing or stale.')
  if (!value.research.sources_current || !value.research.outlier_evidence_bound || !value.research.topic_title_thumbnail_description_script_aligned) blockers.push('Topic and packaging must share current source and outlier evidence.')
  if (value.product_evidence.topic_references_owned_product) {
    const hasApprovedEvidence = value.product_evidence.approved_first_party_asset_ids.length > 0
    const hasValidOmission = Boolean(value.product_evidence.omission_reason.trim())
    if ((!hasApprovedEvidence && !hasValidOmission) || (hasApprovedEvidence && (!value.product_evidence.screenshots_current || !value.product_evidence.privacy_and_rights_cleared || !value.product_evidence.visual_claim_bindings_complete || !value.product_evidence.narration_cue_bindings_complete))) {
      blockers.push('Owned-product topics require approved first-party screenshots or comparable product evidence bound to the exact claims and narration cues, or an explicit omission reason.')
    }
  }
  if (!value.script.youtube_template_run_passed || !value.script.practitioner_specific || !value.script.complete_conclusion) blockers.push('The YouTube template must produce practitioner-specific copy and a complete conclusion before media generation.')
  if (!value.script.spoken_cta_transcript_present && !exception) blockers.push(`Spoken CTA transcript is missing: ${value.script.approved_cta_text}`)
  if (value.customer_facing.internal_text_leakage.length) blockers.push('Customer-facing frames contain internal prompts, logic, receipts, QA labels, or operator notes.')
  if (!value.avatar.approved_avatar_id || !value.avatar.approved_voice_id || !value.avatar.rights_receipt_id || !value.avatar.look_rotation_receipt_id || value.avatar.repeats_prior_look_without_exception || !value.avatar.native_source_mp4_bound || !value.avatar.native_composite_used_when_required) blockers.push('Avatar identity, voice, rights, look rotation, or native-source fidelity is incomplete.')
  if (!value.presentation.presenter_forward_opening || !value.presentation.presenter_forward_conclusion || !value.presentation.presenter_large_left_during_evidence || !value.presentation.assets_right || !value.presentation.smooth_transitions) blockers.push('Presenter and teaching-asset choreography is incomplete.')
  if (!value.motion.native_animation_preserved || !value.motion.source_hashes_bound || !value.motion.reduced_motion_fallback || value.motion.lost_or_substituted_scene_ids.length) blockers.push('Approved native motion, provenance, or reduced-motion coverage is incomplete.')
  if (!value.assets.inventory_complete || !value.assets.every_used_once || !value.assets.every_asset_cue_bound || value.assets.loops_or_repeats || value.assets.max_concurrent_visible > 1 || !value.assets.omissions_have_receipts) blockers.push('Teaching assets must be inventoried, cue-bound, shown once, and mutually exclusive per frame.')
  if (!value.layout.timing_synchronized || !value.layout.safe_areas_passed || !value.layout.padding_passed || value.layout.overlap_or_crowding || value.layout.top_stacking_or_clipping) blockers.push('Layout timing, safe areas, padding, or collision checks failed.')
  if (!value.music.rights_receipt_id || !value.music.instrumental || !value.music.audible_under_speech || !value.music.moderate_ducking_passed || value.music.vocals || value.music.loop || !value.music.bounded_fades) blockers.push('Music must be rights-cleared, instrumental, audible, moderately ducked, non-looping, and bounded by fades.')
  if (!value.voice.timing_preserved || !value.voice.lip_sync_passed || !['none', 'eq_dynamics_only'].includes(value.voice.dsp_scope) || value.voice.claims_new_prosody || value.voice.deceptive_word_splicing) blockers.push('Voice treatment must preserve timing and lip sync without invented prosody or deceptive word splicing.')
  if (!value.packaging.shared_research_version_bound || !value.packaging.title_receipt_id || !value.packaging.thumbnail_receipt_id || !value.packaging.description_receipt_id || !value.packaging.script_receipt_id) blockers.push('Title, thumbnail, description, and script must remain version-bound to the same approved evidence.')
  if (!value.provenance.source_receipts_current || !value.provenance.rights_receipts_current || !value.provenance.privacy_receipt_id || !value.provenance.field_level_proof_reviewable || !value.provenance.excluded_from_customer_frames) blockers.push('Source, rights, privacy, and field-level proof must remain reviewable outside customer-facing media.')
  const validation = value.validation
  if (!validation.duration_passed || !validation.frame_count_passed || !validation.full_decode_passed || !validation.av_sync_passed || !validation.speech_audibility_passed || (!validation.cta_semantics_passed && !exception) || validation.clipping_samples !== 0 || !validation.green_spill_passed || !validation.motion_preservation_passed || !validation.no_repeats_passed || !validation.overlap_safe_area_passed) blockers.push('Exact output validation is incomplete or failed.')
  if (!Object.keys(value.gate_authorizations).every((key) => SOCIAL_VIDEO_GENERATION_CONTRACT.separate_explicit_gates.includes(key as never))) blockers.push('External actions must remain separate explicit gates.')
  if (!value.human_qa.exact_route || !value.human_qa.screenshot_path || !value.human_qa.playable_mp4_path || !value.human_qa.what_changed || !value.human_qa.value || !value.human_qa.review_script || !value.human_qa.next_authorization) blockers.push('Human QA requires the exact route, screenshot, playable MP4, change/value summary, review script, and next authorization.')
  if (value.accepted_exceptions.some((entry) => entry.artifact_id !== value.artifact_id || entry.input_version !== value.input_version || entry.weakens_future_default !== false)) blockers.push('Accepted exceptions must remain artifact- and version-bound without weakening future defaults.')
  return { ready: blockers.length === 0, blockers: [...new Set(blockers)], acceptedExceptionRuleIds: exception ? [exception.rule_id] : [] }
}

export type SocialVideoProductionStatus =
  | 'not_started'
  | 'blocked'
  | 'ready_for_render_approval'
  | 'render_requested'
  | 'processing'
  | 'completed'
  | 'failed'

export interface SocialVideoProductionStoredState {
  version: typeof SOCIAL_VIDEO_PRODUCTION_VERSION
  source: typeof SOCIAL_VIDEO_PRODUCTION_SOURCE
  video_generation_job_id: string | null
  selected_avatar_id: string | null
  selected_voice_id: string | null
  selected_broll_asset_ids: string[]
  broll_candidates: BrollLibraryAsset[]
  render_approval: {
    approved_by: string
    scope: string
    packet_path: string
    approved_at: string
  } | null
  approval_boundary: string
  side_effects: {
    heygen_render: boolean
    youtube_upload: false
    schedule: false
    publish: false
    provider_draft: false
  }
  updated_at: string
}

export interface SocialVideoGenerationJobProjection {
  id: string
  heygenVideoId: string | null
  heygenStatus: string | null
  videoUrl: string | null
  videoShareUrl: string | null
  thumbnailUrl: string | null
  avatarId: string | null
  voiceId: string | null
  brollAssetIds: string[]
  createdAt: string | null
  updatedAt: string | null
}

export interface SocialVideoProductionProjection {
  status: SocialVideoProductionStatus
  isYouTubeTarget: boolean
  selectedAvatarId: string | null
  selectedVoiceId: string | null
  selectedAvatarSource: 'job' | 'stored' | 'default' | 'favorite_pool' | 'missing'
  selectedVoiceSource: 'job' | 'stored' | 'default' | 'favorite' | 'missing'
  avatarPoolSize: number
  broll: {
    status: 'ready' | 'missing' | 'not_prepared'
    selectedAssetIds: string[]
    candidates: BrollLibraryAsset[]
    provenance: string[]
  }
  readiness: {
    readyForRenderApproval: boolean
    blockers: string[]
    warnings: string[]
    nextAction: string
  }
  job: SocialVideoGenerationJobProjection | null
  finalVideoUrl: string | null
  thumbnailUrl: string | null
  privacyRedactionState: 'ready' | 'blocked' | 'not_prepared'
  approvalBoundary: string
  sideEffectsUntilRenderApproval: {
    heygenRender: false
    youtubeUpload: false
    schedule: false
    publish: false
    providerDraft: false
  }
}

export interface SocialVideoConfigAsset {
  asset_id: string
  asset_name?: string | null
  is_default?: boolean
  is_favorite?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function asBrollAssets(value: unknown): BrollLibraryAsset[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      id: asString(item.id),
      route: asString(item.route),
      route_description: asString(item.route_description) || null,
      filename: asString(item.filename),
      screenshot_path: asString(item.screenshot_path) || null,
      clip_path: asString(item.clip_path) || null,
      captured_at: asString(item.captured_at) || null,
    }))
    .filter((item) => item.id)
}

export function getSocialVideoProductionState(ragContext: unknown): SocialVideoProductionStoredState | null {
  const state = asRecord(asRecord(ragContext)?.social_video_production)
  if (!state || state.version !== SOCIAL_VIDEO_PRODUCTION_VERSION) return null
  const sideEffects = asRecord(state.side_effects)
  const approval = asRecord(state.render_approval)

  return {
    version: SOCIAL_VIDEO_PRODUCTION_VERSION,
    source: SOCIAL_VIDEO_PRODUCTION_SOURCE,
    video_generation_job_id: asString(state.video_generation_job_id) || null,
    selected_avatar_id: asString(state.selected_avatar_id) || null,
    selected_voice_id: asString(state.selected_voice_id) || null,
    selected_broll_asset_ids: asStringArray(state.selected_broll_asset_ids),
    broll_candidates: asBrollAssets(state.broll_candidates),
    render_approval: approval
      ? {
        approved_by: asString(approval.approved_by),
        scope: asString(approval.scope),
        packet_path: asString(approval.packet_path),
        approved_at: asString(approval.approved_at),
      }
      : null,
    approval_boundary: asString(state.approval_boundary) || 'Internal HeyGen render preparation only. YouTube upload, scheduling, provider draft creation, and publishing remain separately gated.',
    side_effects: {
      heygen_render: sideEffects?.heygen_render === true,
      youtube_upload: false,
      schedule: false,
      publish: false,
      provider_draft: false,
    },
    updated_at: asString(state.updated_at),
  }
}

export function buildSocialVideoProductionStoredState(input: {
  existing?: SocialVideoProductionStoredState | null
  jobId: string
  avatarId: string
  voiceId: string
  brollCandidates: BrollLibraryAsset[]
  selectedBrollAssetIds: string[]
  renderApproval: {
    approvedBy: string
    scope: string
    packetPath: string
  }
  generatedAt?: string
}): SocialVideoProductionStoredState {
  const generatedAt = input.generatedAt ?? new Date().toISOString()

  return {
    version: SOCIAL_VIDEO_PRODUCTION_VERSION,
    source: SOCIAL_VIDEO_PRODUCTION_SOURCE,
    video_generation_job_id: input.jobId,
    selected_avatar_id: input.avatarId,
    selected_voice_id: input.voiceId,
    selected_broll_asset_ids: input.selectedBrollAssetIds,
    broll_candidates: input.brollCandidates,
    render_approval: {
      approved_by: input.renderApproval.approvedBy,
      scope: input.renderApproval.scope,
      packet_path: input.renderApproval.packetPath,
      approved_at: generatedAt,
    },
    approval_boundary: input.existing?.approval_boundary
      || 'Internal HeyGen render preparation only. YouTube upload, scheduling, provider draft creation, and publishing remain separately gated.',
    side_effects: {
      heygen_render: true,
      youtube_upload: false,
      schedule: false,
      publish: false,
      provider_draft: false,
    },
    updated_at: generatedAt,
  }
}

export function isYouTubeSocialTarget(item: Pick<SocialContentItem, 'platform' | 'target_platforms'> | null | undefined) {
  return item?.platform === 'youtube' || Boolean(item?.target_platforms?.includes('youtube'))
}

export function buildSocialVideoProductionProjection(input: {
  item: Pick<SocialContentItem, 'status' | 'platform' | 'target_platforms' | 'video_url' | 'image_url' | 'rag_context'>
  defaults: { avatarId: string | null; voiceId: string | null }
  favoriteAvatars?: SocialVideoConfigAsset[]
  favoriteVoices?: SocialVideoConfigAsset[]
  job?: SocialVideoGenerationJobProjection | null
}): SocialVideoProductionProjection {
  const item = input.item
  const productionAssets = getProductionAssets(item.rag_context)
  const redactionGate = getVideoRedactionGate(productionAssets)
  const stored = getSocialVideoProductionState(item.rag_context)
  const isYouTubeTarget = isYouTubeSocialTarget(item)
  const favoriteAvatars = input.favoriteAvatars?.filter((asset) => asset.asset_id?.trim()) ?? []
  const favoriteVoices = input.favoriteVoices?.filter((asset) => asset.asset_id?.trim()) ?? []
  const selectedAvatarId = input.job?.avatarId
    || stored?.selected_avatar_id
    || input.defaults.avatarId
    || favoriteAvatars[0]?.asset_id
    || null
  const selectedVoiceId = input.job?.voiceId
    || stored?.selected_voice_id
    || input.defaults.voiceId
    || favoriteVoices[0]?.asset_id
    || null
  const selectedAvatarSource = input.job?.avatarId
    ? 'job'
    : stored?.selected_avatar_id
      ? 'stored'
      : input.defaults.avatarId
        ? 'default'
        : favoriteAvatars[0]?.asset_id
          ? 'favorite_pool'
          : 'missing'
  const selectedVoiceSource = input.job?.voiceId
    ? 'job'
    : stored?.selected_voice_id
      ? 'stored'
      : input.defaults.voiceId
        ? 'default'
        : favoriteVoices[0]?.asset_id
          ? 'favorite'
          : 'missing'
  const brollCandidates = stored?.broll_candidates?.length
    ? stored.broll_candidates
    : productionAssets?.broll.assets ?? []
  const selectedBrollIds = input.job?.brollAssetIds?.length
    ? input.job.brollAssetIds
    : stored?.selected_broll_asset_ids?.length
      ? stored.selected_broll_asset_ids
      : brollCandidates.map((asset) => asset.id)
  const campaign = asRecord(item.rag_context)?.campaign_id || asRecord(item.rag_context)?.campaign_review_handoff ? campaignVideoContext(item) : null
  const editorialBlockers = campaign ? [...campaign.blockers, ...(!campaign.receipt ? ['Record a current production-quality editorial review in Social Content before render.'] : [])] : []
  const blockers = [
    ...editorialBlockers,
    !isYouTubeTarget ? 'This draft is not targeting YouTube.' : '',
    item.status !== 'approved' ? 'Copy must be approved before HeyGen preparation.' : '',
    !productionAssets ? 'Prepare the production asset packet before avatar video preparation.' : '',
    productionAssets && !redactionGate.ready ? redactionGate.message || 'Resolve video privacy and redaction review before render preparation.' : '',
    !selectedAvatarId ? 'No approved HeyGen avatar is available. Pick a default or favorite avatar before render preparation.' : '',
    !selectedVoiceId ? 'No approved HeyGen voice is available. Pick a default or favorite voice before render preparation.' : '',
    productionAssets && selectedBrollIds.length === 0 ? 'Select or capture B-roll from the B-roll library before render preparation.' : '',
  ].filter(Boolean)
  const warnings = [
    productionAssets?.broll.status === 'missing' ? 'The asset packet has no matched B-roll candidates.' : '',
    input.job?.heygenStatus === 'failed' ? 'The linked HeyGen job failed. Review the job before retrying.' : '',
  ].filter(Boolean)
  const finalVideoUrl = input.job?.videoUrl || item.video_url || null
  const thumbnailUrl = input.job?.thumbnailUrl || item.image_url || null
  const jobStatus = input.job?.heygenStatus
  const status: SocialVideoProductionStatus = editorialBlockers.length ? 'blocked' : input.job
    ? jobStatus === 'completed'
      ? finalVideoUrl ? 'completed' : 'blocked'
      : jobStatus === 'failed'
        ? 'failed'
        : jobStatus === 'processing'
          ? 'processing'
          : 'render_requested'
    : blockers.length
      ? 'blocked'
      : 'ready_for_render_approval'
  const readyForRenderApproval = !input.job && blockers.length === 0
  const nextAction = editorialBlockers[0] || (input.job
    ? jobStatus === 'completed'
      ? finalVideoUrl ? 'Review the final video and thumbnail, then keep YouTube submission behind the final platform gate.' : 'Open Video Generation to recover the private archive before media review.'
      : jobStatus === 'failed'
        ? 'Inspect the HeyGen job failure before requesting a new render.'
        : 'Wait for the HeyGen job to finish or refresh the video generation job status.'
    : blockers[0] || 'Confirm internal render preparation to create the HeyGen avatar video job.')

  return {
    status,
    isYouTubeTarget,
    selectedAvatarId,
    selectedVoiceId,
    selectedAvatarSource,
    selectedVoiceSource,
    avatarPoolSize: favoriteAvatars.length,
    broll: {
      status: !productionAssets ? 'not_prepared' : selectedBrollIds.length ? 'ready' : 'missing',
      selectedAssetIds: selectedBrollIds,
      candidates: brollCandidates,
      provenance: brollCandidates.map((asset) => (
        [asset.route, asset.route_description, asset.filename].filter(Boolean).join(' | ')
      )),
    },
    readiness: {
      readyForRenderApproval,
      blockers,
      warnings,
      nextAction,
    },
    job: input.job ?? null,
    finalVideoUrl,
    thumbnailUrl,
    privacyRedactionState: !productionAssets ? 'not_prepared' : redactionGate.ready ? 'ready' : 'blocked',
    approvalBoundary: stored?.approval_boundary
      || 'Readiness does not upload, schedule, create a provider draft, or publish. HeyGen render requires explicit internal render approval.',
    sideEffectsUntilRenderApproval: {
      heygenRender: false,
      youtubeUpload: false,
      schedule: false,
      publish: false,
      providerDraft: false,
    },
  }
}

export function selectRotatingFavoriteAvatar(input: {
  defaults: { avatarId: string | null }
  favoriteAvatars: SocialVideoConfigAsset[]
  stableKey: string
  lastAvatarId?: string | null
}): string | null {
  const favorites = input.favoriteAvatars
    .map((asset) => asset.asset_id.trim())
    .filter(Boolean)

  if (favorites.length === 0) return input.defaults.avatarId
  if (favorites.length === 1) return favorites[0]

  let hash = 0
  for (const char of input.stableKey) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  }

  const ordered = favorites.slice().sort()
  const start = Math.abs(hash) % ordered.length
  for (let offset = 0; offset < ordered.length; offset += 1) {
    const candidate = ordered[(start + offset) % ordered.length]
    if (candidate !== input.lastAvatarId) return candidate
  }

  return ordered[start]
}

export function selectFavoriteVoice(input: {
  defaults: { voiceId: string | null }
  favoriteVoices: SocialVideoConfigAsset[]
}): string | null {
  return input.defaults.voiceId
    || input.favoriteVoices.map((asset) => asset.asset_id.trim()).find(Boolean)
    || null
}

export function selectProductionBrollAssets(
  productionAssets: SocialProductionAssetsPacket,
  selectedIds?: string[],
) {
  const requested = selectedIds?.filter(Boolean) ?? []
  const assets = requested.length
    ? productionAssets.broll.assets.filter((asset) => requested.includes(asset.id))
    : productionAssets.broll.assets
  const missingIds = requested.filter((id) => !assets.some((asset) => asset.id === id))

  return {
    assets,
    ids: assets.map((asset) => asset.id),
    missingIds,
  }
}
