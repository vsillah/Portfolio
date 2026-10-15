import type { YouTubeMusicBedContract } from '@/lib/youtube-music-bed'
import { evaluateYouTubeMusicBed } from '@/lib/youtube-music-bed'

export const SOCIAL_VIDEO_REVIEW_PACKAGE_VERSION = 'social_video_review_package_v2' as const

export type SocialVideoSceneRole = 'presenter_led' | 'split_screen' | 'asset_detail' | 'return_to_presenter' | 'cta'

export type MotionCue = {
  cue_id: string
  start_seconds: number
  end_seconds: number
  scene_role: SocialVideoSceneRole
  asset_id?: string
  reveal: 'fade' | 'slide_up' | 'focus_frame'
  scale_from: number
  scale_to: number
  pan_x_px: number
  pan_y_px: number
  transition_frames: number
  safe_area: { top: number; right: number; bottom: number; left: number }
  source_crop?: { x: number; y: number; width: number; height: number }
  evidence_region?: { x: number; y: number; width: number; height: number }
  text_box?: { x: number; y: number; width: number; height: number }
  loop: false
}

export type SocialVideoReviewPackage = {
  version: typeof SOCIAL_VIDEO_REVIEW_PACKAGE_VERSION
  package_id: string
  status: 'ready' | 'blocked'
  input_version: string
  duration_seconds: number
  fps: number
  source_assets: Array<{
    asset_id: string
    path: string
    sha256: string
    width: number
    height: number
    source_receipt_id: string
    rights_receipt_id: string
  }>
  asset_coverage: {
    minimum_distinct_source_assets: number
    minimum_distinct_views: number
    maximum_consecutive_repeated_views: number
    ledger: Array<{ asset_id: string; disposition: 'used' | 'omitted'; cue_ids: string[]; view_ids: string[]; reason?: string }>
  }
  motion_provenance: {
    current_source_mode: 'native_animated_composite_with_remotion_cta' | 'native_teaching_scene_clips_with_native_presenter_and_remotion_cta'
    prior_motion_source: { path: string; sha256: string; media_type: 'native_video' }
    native_motion_preserved: boolean
    flattening_reason?: string
    reduced_motion_fallback: 'settled_end_state'
    cue_bindings: Array<{ cue_id: string; source_field: string; animation: string; fallback: 'settled_end_state' }>
    scene_inventory: Array<{ scene_id: string; source_hash: string; disposition: 'restored' | 'restored_once' | 'omitted' | 'blocked'; omission_receipt?: string }>
  }
  vocal_treatment: {
    source_presenter_sha256: string
    production_default: 'original'
    naturalized_mode: 'local_sample_synchronous_review_only'
    timing_edits_applied: false
    lip_sync_tolerance_ms: number
    provider_calls: 0
  }
  music_bed: YouTubeMusicBedContract
  script_cues: Array<{ cue_id: string; start_seconds: number; end_seconds: number }>
  motion_recipe: {
    recipe_id: string
    preset: 'restrained_editorial'
    reduced_motion_recipe_id: string
    layout_preset: {
      preset_id: 'presenter_asset_choreography_v1'
      presenter_prominence: 'full_height_left'
      presenter_min_width_px: number
      asset_detail_min_width_px: number
      panel_gap_px: number
      safe_area: { top: number; right: number; bottom: number; left: number }
    }
    transition_policy: {
      preset_id: 'matched_move_crossfade_v1'
      easing: 'in_out_cubic'
      minimum_frames: number
      maximum_frames: number
      positional_continuity: true
      hard_cuts: false
    }
    cues: MotionCue[]
  }
  outputs: {
    baseline_path: string
    enhanced_path: string
    poster_path: string
    render_receipt_id: string
    render_input_version: string
    enhanced_sha256: string
  }
}

export type SocialVideoReviewReadiness = { ready: boolean; blockers: string[] }

function passedId(value: string, approved: string[]) {
  return value.trim().length > 0 && approved.includes(value)
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function evaluateSocialVideoReviewPackage(input: {
  reviewPackage: SocialVideoReviewPackage | null | undefined
  expectedInputVersion: string
  approvedSourceReceiptIds: string[]
  approvedRightsReceiptIds: string[]
  approvedTrackSha256ById: Record<string, string>
}): SocialVideoReviewReadiness {
  const value = input.reviewPackage
  if (!value) return { ready: false, blockers: ['A version-bound social video review package is required.'] }

  const blockers: string[] = []
  if (value.version !== SOCIAL_VIDEO_REVIEW_PACKAGE_VERSION) blockers.push('Social video review package version is missing or unsupported.')
  if (value.status !== 'ready') blockers.push('Social video review package remains blocked.')
  if (value.input_version !== input.expectedInputVersion) blockers.push('Social video review package is stale for the approved content version.')
  if (!Number.isFinite(value.duration_seconds) || value.duration_seconds <= 0 || !Number.isInteger(value.fps) || value.fps <= 0) blockers.push('Video duration and frame rate must be positive.')

  const assetIds = new Set<string>()
  const assetsById = new Map<string, SocialVideoReviewPackage['source_assets'][number]>()
  for (const asset of value.source_assets) {
    if (!asset.asset_id.trim() || assetIds.has(asset.asset_id) || !asset.path.trim() || !asset.sha256.startsWith('sha256:')) {
      blockers.push('Every motion asset requires a unique identity, local path, and exact SHA-256 binding.')
    }
    assetIds.add(asset.asset_id)
    assetsById.set(asset.asset_id, asset)
    if (!passedId(asset.source_receipt_id, input.approvedSourceReceiptIds)) blockers.push('A motion asset source receipt is missing or unapproved.')
    if (!passedId(asset.rights_receipt_id, input.approvedRightsReceiptIds)) blockers.push('A motion asset rights receipt is missing or unapproved.')
  }
  const usedCoverage = value.asset_coverage?.ledger.filter((entry) => entry.disposition === 'used') ?? []
  const coveredAssets = new Set(usedCoverage.map((entry) => entry.asset_id))
  const coveredViews = new Set(usedCoverage.flatMap((entry) => entry.view_ids))
  if (!value.asset_coverage || coveredAssets.size < value.asset_coverage.minimum_distinct_source_assets || coveredViews.size < value.asset_coverage.minimum_distinct_views) blockers.push('Asset coverage does not meet the version-bound diversity floor.')
  if (usedCoverage.some((entry) => entry.cue_ids.length === 0 || entry.view_ids.length === 0) || value.asset_coverage?.ledger.some((entry) => entry.disposition === 'omitted' && !entry.reason?.trim())) blockers.push('Every approved asset requires cue-bound use or an explicit omission reason.')
  if (value.asset_coverage?.maximum_consecutive_repeated_views !== 0) blockers.push('Asset coverage must prohibit consecutive repeated views.')
  const provenance = value.motion_provenance
  const acceptedMotionModes = ['native_animated_composite_with_remotion_cta', 'native_teaching_scene_clips_with_native_presenter_and_remotion_cta']
  if (!provenance || !acceptedMotionModes.includes(provenance.current_source_mode) || provenance.prior_motion_source.media_type !== 'native_video' || !provenance.prior_motion_source.sha256.startsWith('sha256:')) blockers.push('Motion provenance must bind the prior native motion source and current render mode.')
  if (provenance && !provenance.native_motion_preserved && !provenance.flattening_reason?.trim()) blockers.push('An animated source cannot be flattened without an explicit reason.')
  if (provenance?.reduced_motion_fallback !== 'settled_end_state' || provenance?.cue_bindings.some((binding) => !binding.cue_id.trim() || !binding.source_field.trim() || !binding.animation.trim() || binding.fallback !== 'settled_end_state')) blockers.push('Internal motion requires cue/source bindings and a settled reduced-motion fallback.')
  const evidenceCueIds = new Set(['inspect-score', 'apply-policy', 'retain-ownership', 'retain-receipt', 'hold-the-boundary'])
  if (provenance && new Set(provenance.cue_bindings.map((binding) => binding.cue_id).filter((id) => evidenceCueIds.has(id))).size !== evidenceCueIds.size) blockers.push('Every evidence cue requires a source-bound internal-motion contract.')
  if (!provenance?.native_motion_preserved || provenance.scene_inventory.length < 6 || provenance.scene_inventory.some((scene) => !scene.source_hash.startsWith('sha256:') || (!['restored', 'restored_once'].includes(scene.disposition) && !scene.omission_receipt?.trim()))) blockers.push('Approved prior scenes must be restored or carry a version-bound omission receipt.')
  const vocal = value.vocal_treatment
  if (!vocal || vocal.production_default !== 'original' || vocal.naturalized_mode !== 'local_sample_synchronous_review_only' || vocal.timing_edits_applied !== false || vocal.lip_sync_tolerance_ms > 40 || vocal.provider_calls !== 0 || !vocal.source_presenter_sha256.startsWith('sha256:')) blockers.push('Vocal treatment must remain local-only, sample-synchronous, original-default, and inside the lip-sync tolerance.')

  const music = evaluateYouTubeMusicBed({
    musicBed: value.music_bed,
    expectedInputVersion: input.expectedInputVersion,
    videoDurationSeconds: value.duration_seconds,
    approvedSourceReceiptIds: input.approvedSourceReceiptIds,
    approvedRightsReceiptIds: input.approvedRightsReceiptIds,
    approvedTrackSha256ById: input.approvedTrackSha256ById,
  })
  blockers.push(...music.blockers)

  const recipe = value.motion_recipe
  if (!recipe.recipe_id.trim() || recipe.preset !== 'restrained_editorial' || !recipe.reduced_motion_recipe_id.trim()) {
    blockers.push('Motion requires a named restrained preset and an explicit reduced-motion alternative.')
  }
  const layout = recipe.layout_preset
  if (!layout || layout.preset_id !== 'presenter_asset_choreography_v1' || layout.presenter_prominence !== 'full_height_left'
    || layout.presenter_min_width_px < 420 || layout.asset_detail_min_width_px < 880 || layout.panel_gap_px < 24
    || Object.values(layout.safe_area).some((edge) => edge < 48)) {
    blockers.push('Motion requires the full-height presenter/asset choreography preset with safe padding and readable panel geometry.')
  }
  const transitions = recipe.transition_policy
  if (!transitions || transitions.preset_id !== 'matched_move_crossfade_v1' || transitions.easing !== 'in_out_cubic'
    || transitions.minimum_frames < 8 || transitions.maximum_frames > Math.round(value.fps * 0.8)
    || !transitions.positional_continuity || transitions.hard_cuts !== false) {
    blockers.push('Motion transitions require restrained matched movement, crossfades, positional continuity, and no hard cuts.')
  }
  if (!recipe.cues.length) blockers.push('Motion recipe requires at least one version-bound cue.')
  let previousEnd = 0
  const cueIds = new Set<string>()
  for (const [index, cue] of recipe.cues.entries()) {
    if (!cue.cue_id.trim() || cueIds.has(cue.cue_id)) blockers.push('Motion cues require unique stable identities.')
    cueIds.add(cue.cue_id)
    if (cue.start_seconds < previousEnd - 0.001 || cue.end_seconds <= cue.start_seconds || cue.end_seconds > value.duration_seconds + 0.02) blockers.push('Motion cues must be ordered, non-overlapping, and contained by the video timeline.')
    if (index > 0 && Math.abs(cue.start_seconds - previousEnd) > 0.05) blockers.push('Motion cue timeline contains an unbound gap.')
    previousEnd = cue.end_seconds
    if (cue.asset_id && !assetIds.has(cue.asset_id)) blockers.push('A motion cue references an unbound visual asset.')
    const scriptCue = value.script_cues.find((candidate) => candidate.cue_id === cue.cue_id)
    if (!scriptCue || Math.abs(scriptCue.start_seconds - cue.start_seconds) > 0.02 || Math.abs(scriptCue.end_seconds - cue.end_seconds) > 0.02) blockers.push('Motion cues are not synchronized to stable script cue identities and timing.')
    const requiresAsset = cue.scene_role === 'split_screen' || cue.scene_role === 'asset_detail'
    const asset = cue.asset_id ? assetsById.get(cue.asset_id) : null
    if (requiresAsset && (!asset || !cue.source_crop || cue.source_crop.x < 0 || cue.source_crop.y < 0 || cue.source_crop.width <= 0 || cue.source_crop.height <= 0 || cue.source_crop.x + cue.source_crop.width > asset.width || cue.source_crop.y + cue.source_crop.height > asset.height)) blockers.push('Motion cue crop is missing or outside the bound source asset.')
    if (requiresAsset && (!cue.evidence_region || cue.evidence_region.width < (cue.scene_role === 'asset_detail' ? layout.asset_detail_min_width_px : 480))) blockers.push('Motion cue does not provide the required readable evidence area for its scene role.')
    if (cue.text_box && cue.evidence_region && overlaps(cue.text_box, cue.evidence_region)) blockers.push('Motion cue text occludes the evidence region.')
    if (cue.text_box && (cue.text_box.x < cue.safe_area.left || cue.text_box.y < cue.safe_area.top || cue.text_box.x + cue.text_box.width > 1080 - cue.safe_area.right || cue.text_box.y + cue.text_box.height > 1920 - cue.safe_area.bottom)) blockers.push('Motion cue text leaves the declared title-safe area.')
    if (cue.loop !== false) blockers.push('Social review motion must not loop.')
    if (cue.scale_from < 0.98 || cue.scale_to > 1.08 || Math.abs(cue.scale_to - cue.scale_from) > 0.06 || Math.abs(cue.pan_x_px) > 24 || Math.abs(cue.pan_y_px) > 24) blockers.push('Motion cue exceeds the restrained scale or pan envelope.')
    if (cue.transition_frames < transitions.minimum_frames || cue.transition_frames > transitions.maximum_frames) blockers.push('Motion transition duration must remain inside the approved matched-move transition range.')
    if ([cue.safe_area.top, cue.safe_area.right, cue.safe_area.bottom, cue.safe_area.left].some((edge) => edge < 48)) blockers.push('Motion cue violates the 48-pixel title-safe area.')
  }

  const output = value.outputs
  if (!output.baseline_path.trim() || !output.enhanced_path.trim() || !output.poster_path.trim()) blockers.push('A/B review requires baseline, enhanced, and poster paths.')
  if (!output.render_receipt_id.trim() || output.render_input_version !== value.input_version || !output.enhanced_sha256.startsWith('sha256:')) blockers.push('A passed version-bound render receipt and enhanced-output hash are required.')

  return { ready: blockers.length === 0, blockers: [...new Set(blockers)] }
}
