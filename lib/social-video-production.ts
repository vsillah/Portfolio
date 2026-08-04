import type { SocialContentItem } from '@/lib/social-content'
import {
  getProductionAssets,
  getVideoRedactionGate,
  type BrollLibraryAsset,
  type SocialProductionAssetsPacket,
} from '@/lib/social-production-assets'

export const SOCIAL_VIDEO_PRODUCTION_VERSION = 'social_video_production_v1'
export const SOCIAL_VIDEO_PRODUCTION_SOURCE = 'youtube_social_content_heygen_bridge'

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
  const blockers = [
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
  const status: SocialVideoProductionStatus = input.job
    ? jobStatus === 'completed'
      ? 'completed'
      : jobStatus === 'failed'
        ? 'failed'
        : jobStatus === 'processing'
          ? 'processing'
          : 'render_requested'
    : blockers.length
      ? 'blocked'
      : 'ready_for_render_approval'
  const readyForRenderApproval = !input.job && blockers.length === 0
  const nextAction = input.job
    ? jobStatus === 'completed'
      ? 'Review the final video and thumbnail, then keep YouTube submission behind the final platform gate.'
      : jobStatus === 'failed'
        ? 'Inspect the HeyGen job failure before requesting a new render.'
        : 'Wait for the HeyGen job to finish or refresh the video generation job status.'
    : blockers[0] || 'Confirm internal render preparation to create the HeyGen avatar video job.'

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
