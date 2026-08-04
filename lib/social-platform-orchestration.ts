import type {
  ContentStatus,
  PublishStatus,
  SocialContentConfig,
  SocialContentItem,
  SocialContentPublish,
  SocialPlatform,
} from '@/lib/social-content'

export type PlatformOrchestrationStageKey =
  | 'human_approval'
  | 'asset_readiness'
  | 'platform_draft_handoff'
  | 'platform_configuration'
  | 'final_submission_gate'
  | 'automatic_submission'

export type PlatformOrchestrationStageState = 'complete' | 'available' | 'pending' | 'blocked'

export type PlatformOrchestrationStage = {
  key: PlatformOrchestrationStageKey
  label: string
  state: PlatformOrchestrationStageState
  detail: string
}

export type PlatformOrchestrationPlatformPlan = {
  platform: SocialPlatform
  label: string
  automaticSubmissionSupported: boolean
  publishStatus: PublishStatus | null
  platformPostUrl: string | null
  nextAction: string
  stages: PlatformOrchestrationStage[]
  youtubeReadiness?: YouTubePublishingReadiness
}

export type PlatformOrchestrationPlan = {
  platforms: PlatformOrchestrationPlatformPlan[]
  anyAutomaticSubmissionAvailable: boolean
  allAutomaticSubmissionComplete: boolean
  sideEffectsUntilFinalGate: {
    providerGeneration: false
    upload: false
    externalSchedule: false
    publish: false
    externalPost: false
  }
}

export type PlatformSubmissionGate = {
  status?: 'approved' | 'rejected' | 'pending' | 'blocked'
  approved_at?: string
  approved_by?: string
  platforms?: SocialPlatform[]
  decision_note?: string
}

export type PlatformAssetReadiness = {
  ready: boolean
  detail: string
}

export type YouTubePublishingReadinessCheckKey =
  | 'context_source_basis'
  | 'script_copy_review'
  | 'video_asset_privacy_qa'
  | 'platform_draft_readiness'
  | 'final_human_submission_gate'
  | 'configured_youtube_upload_adapter'

export type YouTubePublishingReadinessCheck = {
  key: YouTubePublishingReadinessCheckKey
  label: string
  state: PlatformOrchestrationStageState
  detail: string
}

export type YouTubePublishingReadiness = {
  ready: boolean
  blockers: string[]
  reviewValues: {
    title: string | null
    description: string | null
    thumbnail: string | null
    finalVideoUrl: string | null
    privacyRightsRedaction: string
    visibility: string
    targetChannel: string
    providerConfig: string
  }
  checks: YouTubePublishingReadinessCheck[]
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
}

const AUTOMATIC_SUBMISSION_SUPPORTED = new Set<SocialPlatform>(['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok'])

const SUBMITTED_STATUSES = new Set<PublishStatus>(['published'])
export type BuildPlatformOrchestrationInput = {
  item?: Pick<SocialContentItem,
    | 'status'
    | 'platform'
    | 'target_platforms'
    | 'publishes'
    | 'post_text'
    | 'image_url'
    | 'video_url'
    | 'carousel_slide_urls'
  > & Partial<Pick<SocialContentItem,
    | 'meeting_record_id'
    | 'youtube_title'
    | 'youtube_description'
    | 'topic_extracted'
    | 'rag_context'
  >> | null
  targetPlatforms?: SocialPlatform[]
  publishRecords?: Pick<SocialContentPublish, 'platform' | 'status' | 'platform_post_url'>[]
  platformConfigs?: Pick<SocialContentConfig, 'platform' | 'credentials' | 'settings' | 'is_active'>[]
  platformAssetReadiness?: Partial<Record<SocialPlatform, PlatformAssetReadiness>>
  copyApproved?: boolean
  productionReady?: boolean
  redactionReady?: boolean
  draftHandoffReady?: boolean
  finalSubmissionGateReady?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function uniquePlatforms(platforms: SocialPlatform[]) {
  return Array.from(new Set(platforms)).filter((platform): platform is SocialPlatform => Boolean(PLATFORM_LABELS[platform]))
}

function resolveTargetPlatforms(input: BuildPlatformOrchestrationInput) {
  if (input.targetPlatforms?.length) return uniquePlatforms(input.targetPlatforms)
  if (input.item?.target_platforms?.length) return uniquePlatforms(input.item.target_platforms)
  if (input.item?.platform) return uniquePlatforms([input.item.platform])
  return ['linkedin'] as SocialPlatform[]
}

export function getPlatformSubmissionGate(ragContext: unknown): PlatformSubmissionGate | null {
  const gate = asRecord(asRecord(ragContext)?.platform_submission_gate)
  if (!gate) return null

  return {
    status: typeof gate.status === 'string' ? gate.status as PlatformSubmissionGate['status'] : undefined,
    approved_at: typeof gate.approved_at === 'string' ? gate.approved_at : undefined,
    approved_by: typeof gate.approved_by === 'string' ? gate.approved_by : undefined,
    platforms: Array.isArray(gate.platforms)
      ? uniquePlatforms(gate.platforms.filter((platform): platform is SocialPlatform => typeof platform === 'string' && Boolean(PLATFORM_LABELS[platform as SocialPlatform])) as SocialPlatform[])
      : undefined,
    decision_note: typeof gate.decision_note === 'string' ? gate.decision_note : undefined,
  }
}

export function isPlatformSubmissionGateApproved(ragContext: unknown, platforms: SocialPlatform[]) {
  const gate = getPlatformSubmissionGate(ragContext)
  if (gate?.status !== 'approved') return false
  const approvedPlatforms = gate.platforms?.length ? gate.platforms : platforms
  return platforms.every((platform) => approvedPlatforms.includes(platform))
}

function isCopyApproved(status?: ContentStatus) {
  return status === 'approved' || status === 'scheduled' || status === 'published'
}

function stage(
  key: PlatformOrchestrationStageKey,
  label: string,
  state: PlatformOrchestrationStageState,
  detail: string,
): PlatformOrchestrationStage {
  return { key, label, state, detail }
}

function nextActionFor(stages: PlatformOrchestrationStage[], platform: SocialPlatform) {
  const actionable = stages.find((candidate) => candidate.state !== 'complete')
  if (!actionable) return `${PLATFORM_LABELS[platform]} submission is complete.`
  return actionable.detail
}

function truthyString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function configField(config: Pick<SocialContentConfig, 'credentials' | 'settings'> | undefined, key: string) {
  const credentials = config?.credentials as Record<string, unknown> | undefined
  const settings = config?.settings as Record<string, unknown> | undefined
  return credentials?.[key] ?? settings?.[key]
}

function configSettings(config: Pick<SocialContentConfig, 'settings'> | undefined) {
  return config?.settings as Record<string, unknown> | undefined
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

function hasListItems(value: unknown) {
  return Array.isArray(value) && value.some((item) => hasText(item))
}

function recordString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function firstRecordString(record: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = recordString(record, key)
    if (value) return value
  }
  return null
}

function booleanOrStringReady(value: unknown) {
  if (value === true) return true
  return typeof value === 'string' && ['approved', 'ready', 'complete', 'completed', 'passed'].includes(value.toLowerCase())
}

function youtubeConfigVisibility(
  config: Pick<SocialContentConfig, 'settings'> | undefined,
) {
  const settings = configSettings(config)
  const configured = firstRecordString(settings, ['default_privacy', 'privacy_status', 'visibility'])
  if (configured && ['private', 'unlisted', 'public'].includes(configured.toLowerCase())) {
    return configured.toLowerCase()
  }
  return 'private'
}

function youtubeTargetChannel(config: Pick<SocialContentConfig, 'credentials' | 'settings'> | undefined) {
  const credentials = config?.credentials as Record<string, unknown> | undefined
  const settings = config?.settings as Record<string, unknown> | undefined
  return firstRecordString(settings, ['channel_title', 'channel_name', 'channel_id', 'target_channel'])
    ?? firstRecordString(credentials, ['channel_title', 'channel_name', 'channel_id', 'target_channel'])
    ?? 'Connected OAuth channel'
}

export function getYouTubePublishingReadiness(input: {
  item?: BuildPlatformOrchestrationInput['item']
  config?: Pick<SocialContentConfig, 'platform' | 'credentials' | 'settings' | 'is_active'>
  redactionReady?: boolean
  draftHandoffReady?: boolean
  finalSubmissionGateReady?: boolean
  publishRecord?: Pick<SocialContentPublish, 'platform' | 'status' | 'platform_post_url'> | null
}): YouTubePublishingReadiness {
  const item = input.item
  const ragContext = asRecord(item?.rag_context)
  const youtubeRelease = asRecord(ragContext?.youtube_release)
    ?? asRecord(ragContext?.youtube_video_release)
    ?? {}
  const productionAssets = asRecord(ragContext?.production_assets)
  const visualQa = asRecord(productionAssets?.visual_qa)
  const sourceBasisReady = Boolean(
    item?.meeting_record_id
    || item?.topic_extracted
    || ragContext?.source
    || ragContext?.source_packet_path
    || ragContext?.calendar_item_id
    || ragContext?.campaign_id,
  )
  const title = hasText(item?.youtube_title) ? item!.youtube_title!.trim() : null
  const description = hasText(item?.youtube_description) ? item!.youtube_description!.trim() : null
  const thumbnail = firstRecordString(youtubeRelease, ['thumbnail_url', 'thumbnail_asset_url', 'thumbnail_path'])
    ?? firstRecordString(visualQa, ['selected_asset_url', 'thumbnail_url'])
    ?? (hasText(item?.image_url) ? item!.image_url!.trim() : null)
  const thumbnailReady = Boolean(thumbnail)
    || booleanOrStringReady(youtubeRelease.thumbnail_ready)
    || booleanOrStringReady(youtubeRelease.thumbnail_review_status)
  const finalVideoUrl = hasText(item?.video_url) ? item!.video_url!.trim() : null
  const redactionReady = input.redactionReady ?? true
  const visibility = youtubeConfigVisibility(input.config)
  const targetChannel = youtubeTargetChannel(input.config)
  const configReady = Boolean(input.config?.is_active && truthyString(configField(input.config, 'access_token')))
  const draftReady = Boolean(input.draftHandoffReady || input.publishRecord)
  const finalGateReady = Boolean(input.finalSubmissionGateReady)
  const copyReady = isCopyApproved(item?.status)

  const assetBlockers = [
    !title ? 'YouTube title is required.' : null,
    !description ? 'YouTube description is required.' : null,
    !thumbnailReady ? 'Reviewed thumbnail or thumbnail readiness is required.' : null,
    !finalVideoUrl ? 'YouTube needs a final video URL before submission.' : null,
    !redactionReady ? 'Privacy, rights, and redaction review must be clear.' : null,
  ].filter((blocker): blocker is string => Boolean(blocker))

  const checks: YouTubePublishingReadinessCheck[] = [
    {
      key: 'context_source_basis',
      label: 'Context/source basis',
      state: sourceBasisReady ? 'complete' : 'pending',
      detail: sourceBasisReady
        ? 'Source basis is attached to the Social Content item.'
        : 'Attach the source basis, calendar item, research packet, or meeting context before release review.',
    },
    {
      key: 'script_copy_review',
      label: 'Script/copy review',
      state: copyReady && title && description ? 'complete' : copyReady ? 'pending' : 'blocked',
      detail: copyReady && title && description
        ? 'Copy is approved with YouTube title and description ready.'
        : !copyReady
          ? 'Approve the script/copy packet before YouTube release readiness.'
          : 'Add the final YouTube title and description before submission.',
    },
    {
      key: 'video_asset_privacy_qa',
      label: 'Video/asset/privacy QA',
      state: assetBlockers.length === 0 ? 'complete' : copyReady ? 'blocked' : 'pending',
      detail: assetBlockers.length === 0
        ? 'Final video URL, thumbnail readiness, and privacy/rights/redaction review are ready.'
        : assetBlockers.join(' '),
    },
    {
      key: 'platform_draft_readiness',
      label: 'Platform draft/readiness',
      state: draftReady ? 'complete' : assetBlockers.length === 0 ? 'pending' : 'blocked',
      detail: draftReady
        ? 'Internal YouTube publish row or draft handoff exists.'
        : 'Create or authorize the internal YouTube publish row before final submission.',
    },
    {
      key: 'final_human_submission_gate',
      label: 'Final human submission gate',
      state: finalGateReady ? 'complete' : draftReady ? 'pending' : 'blocked',
      detail: finalGateReady
        ? 'Final human submission approval is recorded for YouTube.'
        : 'Approve the YouTube final submission gate as a separate action.',
    },
    {
      key: 'configured_youtube_upload_adapter',
      label: 'Configured YouTube upload adapter',
      state: configReady ? 'complete' : 'blocked',
      detail: configReady
        ? `YouTube adapter is active. Visibility: ${visibility}. Target channel: ${targetChannel}.`
        : 'Connect and activate YouTube upload credentials before submission.',
    },
  ]

  const blockers = checks
    .filter((check) => check.state === 'blocked')
    .map((check) => check.detail)

  return {
    ready: blockers.length === 0 && checks.every((check) => check.state === 'complete'),
    blockers,
    reviewValues: {
      title,
      description,
      thumbnail: thumbnail ?? (thumbnailReady ? 'Marked ready without attached URL' : null),
      finalVideoUrl,
      privacyRightsRedaction: redactionReady ? 'Clear for submission' : 'Blocked by privacy, rights, or redaction review',
      visibility,
      targetChannel,
      providerConfig: configReady ? 'YouTube Data API upload adapter active' : 'YouTube upload adapter not configured',
    },
    checks,
  }
}

export function getPlatformAssetReadiness(
  item: Pick<SocialContentItem, 'post_text' | 'image_url' | 'video_url' | 'carousel_slide_urls'> | null | undefined,
  platform: SocialPlatform,
): PlatformAssetReadiness {
  if (!item) {
    return {
      ready: true,
      detail: `${PLATFORM_LABELS[platform]} asset readiness check was not requested.`,
    }
  }

  const hasPostText = hasText(item.post_text)
  const hasImage = hasText(item.image_url)
  const hasVideo = hasText(item.video_url)
  const hasCarousel = hasListItems(item.carousel_slide_urls)

  switch (platform) {
    case 'linkedin':
      return {
        ready: hasPostText,
        detail: hasPostText
          ? 'LinkedIn copy is ready for submission.'
          : 'LinkedIn needs post text before submission.',
      }
    case 'youtube':
      return getYouTubeAssetReadiness(item)
    case 'instagram':
      return {
        ready: hasImage || hasVideo || hasCarousel,
        detail: hasImage || hasVideo || hasCarousel
          ? 'Instagram has a publishable image, carousel, or Reel video asset.'
          : 'Instagram needs an image, carousel slide URLs, or final Reel video URL before submission.',
      }
    case 'facebook':
      return {
        ready: hasPostText || hasImage || hasVideo,
        detail: hasPostText || hasImage || hasVideo
          ? 'Facebook has copy or media ready for submission.'
          : 'Facebook needs post text, an image, or a video before submission.',
      }
    case 'tiktok':
      return {
        ready: hasVideo,
        detail: hasVideo
          ? 'TikTok has a final video URL.'
          : 'TikTok needs a final video URL before Direct Post submission.',
      }
    default:
      return {
        ready: false,
        detail: `${PLATFORM_LABELS[platform]} asset requirements are not configured.`,
      }
  }
}

function getYouTubeAssetReadiness(
  item: Pick<SocialContentItem,
    'post_text'
    | 'image_url'
    | 'video_url'
    | 'carousel_slide_urls'
  > | BuildPlatformOrchestrationInput['item'],
): PlatformAssetReadiness {
  const readiness = getYouTubePublishingReadiness({ item: item as BuildPlatformOrchestrationInput['item'] })
  const assetCheck = readiness.checks.find((check) => check.key === 'video_asset_privacy_qa')
  const copyCheck = readiness.checks.find((check) => check.key === 'script_copy_review')
  const blockers = [
    copyCheck?.state !== 'complete' ? copyCheck?.detail : null,
    assetCheck?.state !== 'complete' ? assetCheck?.detail : null,
  ].filter((blocker): blocker is string => Boolean(blocker))

  return {
    ready: blockers.length === 0,
    detail: blockers.length
      ? blockers.join(' ')
      : 'YouTube release metadata, thumbnail readiness, final video URL, and privacy review are ready.',
  }
}

function hasPlatformConfiguration(
  platform: SocialPlatform,
  config: Pick<SocialContentConfig, 'platform' | 'credentials' | 'settings' | 'is_active'> | undefined,
) {
  if (!config?.is_active) {
    return {
      ready: false,
      detail: `Connect and activate ${PLATFORM_LABELS[platform]} in Social Content settings.`,
    }
  }

  switch (platform) {
    case 'linkedin': {
      const hasToken = truthyString(configField(config, 'access_token'))
      const hasAuthor = truthyString(configField(config, 'author_urn')) || truthyString(configField(config, 'person_urn'))
      return {
        ready: hasToken && hasAuthor,
        detail: hasToken && hasAuthor
          ? 'LinkedIn credentials are configured.'
          : 'LinkedIn needs an access token and author/person URN.',
      }
    }
    case 'youtube': {
      const hasToken = truthyString(configField(config, 'access_token'))
      const visibility = youtubeConfigVisibility(config)
      const targetChannel = youtubeTargetChannel(config)
      return {
        ready: hasToken,
        detail: hasToken
          ? `YouTube upload credentials are configured. Visibility: ${visibility}. Target channel: ${targetChannel}.`
          : 'YouTube needs an access token before upload.',
      }
    }
    case 'instagram': {
      const hasToken = truthyString(configField(config, 'access_token'))
      const hasAccount = truthyString(configField(config, 'ig_user_id'))
        || truthyString(configField(config, 'instagram_user_id'))
        || truthyString(configField(config, 'business_account_id'))
      return {
        ready: hasToken && hasAccount,
        detail: hasToken && hasAccount
          ? 'Instagram business publishing credentials are configured.'
          : 'Instagram needs an access token and business/IG user ID.',
      }
    }
    case 'facebook': {
      const hasToken = truthyString(configField(config, 'page_access_token')) || truthyString(configField(config, 'access_token'))
      const hasPage = truthyString(configField(config, 'page_id'))
      return {
        ready: hasToken && hasPage,
        detail: hasToken && hasPage
          ? 'Facebook Page publishing credentials are configured.'
          : 'Facebook needs a Page access token and Page ID.',
      }
    }
    case 'tiktok': {
      const hasToken = truthyString(configField(config, 'access_token'))
      const settings = configSettings(config)
      const creatorConfirmed = settings?.creator_info_confirmed === true
        || truthyString(settings?.creator_info_confirmed_at)
      const sourceUrlApproved = settings?.source_url_approved === true
        || (Array.isArray(settings?.approved_media_domains) && settings.approved_media_domains.length > 0)
      const missing = [
        !hasToken ? 'access token' : null,
        !creatorConfirmed ? 'creator-info confirmation' : null,
        !sourceUrlApproved ? 'approved URL ingestion' : null,
      ].filter(Boolean)
      return {
        ready: hasToken && creatorConfirmed && sourceUrlApproved,
        detail: hasToken && creatorConfirmed && sourceUrlApproved
          ? 'TikTok Direct Post credentials and URL ingestion approval are configured.'
          : `TikTok needs ${missing.join(', ')}.`,
      }
    }
    default:
      return {
        ready: false,
        detail: `${PLATFORM_LABELS[platform]} configuration is missing.`,
      }
  }
}

export function buildPlatformOrchestrationPlan(input: BuildPlatformOrchestrationInput): PlatformOrchestrationPlan {
  const targetPlatforms = resolveTargetPlatforms(input)
  const publishRecords = input.publishRecords ?? input.item?.publishes ?? []
  const copyReady = input.copyApproved ?? isCopyApproved(input.item?.status)
  const redactionReady = input.redactionReady ?? true
  const productionReady = input.productionReady ?? redactionReady
  const draftHandoffReady = input.draftHandoffReady ?? false

  const platforms = targetPlatforms.map((platform) => {
    const publishRecord = publishRecords.find((record) => record.platform === platform)
    const platformConfig = input.platformConfigs?.find((config) => config.platform === platform)
    const publishStatus = publishRecord?.status ?? null
    const submissionComplete = Boolean(publishStatus && SUBMITTED_STATUSES.has(publishStatus))
    const finalSubmissionGateReady = input.finalSubmissionGateReady ?? submissionComplete
    const youtubeReadiness = platform === 'youtube'
      ? getYouTubePublishingReadiness({
        item: input.item,
        config: platformConfig,
        redactionReady: input.redactionReady,
        draftHandoffReady: input.draftHandoffReady ?? false,
        finalSubmissionGateReady,
        publishRecord,
      })
      : undefined
    const assetReadiness = input.platformAssetReadiness?.[platform]
      ?? (platform === 'youtube'
        ? {
          ready: !youtubeReadiness?.checks.some((check) => (
            (check.key === 'script_copy_review' || check.key === 'video_asset_privacy_qa')
            && check.state !== 'complete'
          )),
          detail: youtubeReadiness?.checks
            .filter((check) => (
              (check.key === 'script_copy_review' || check.key === 'video_asset_privacy_qa')
              && check.state !== 'complete'
            ))
            .map((check) => check.detail)
            .join(' ') || 'YouTube release metadata, thumbnail readiness, final video URL, and privacy review are ready.',
        }
        : getPlatformAssetReadiness(input.item, platform))
    const configuration = input.platformConfigs ? hasPlatformConfiguration(platform, platformConfig) : {
      ready: true,
      detail: `${PLATFORM_LABELS[platform]} configuration check was not requested.`,
    }
    const automaticSubmissionSupported = AUTOMATIC_SUBMISSION_SUPPORTED.has(platform)

    const humanApprovalState: PlatformOrchestrationStageState = copyReady ? 'complete' : 'pending'
    const assetState: PlatformOrchestrationStageState = !copyReady
      ? 'blocked'
      : !redactionReady
        ? 'blocked'
        : !assetReadiness.ready
          ? 'blocked'
          : productionReady
            ? 'complete'
            : 'pending'
    const assetDetail = !redactionReady
      ? 'Resolve privacy/redaction blockers before submission.'
      : !assetReadiness.ready
        ? assetReadiness.detail
        : productionReady
          ? assetReadiness.detail
          : 'Finish visual assets, asset packet, and channel-specific readiness.'
    const draftState: PlatformOrchestrationStageState = assetState !== 'complete'
      ? 'blocked'
      : (draftHandoffReady || Boolean(publishRecord))
        ? 'complete'
        : 'pending'
    const configurationState: PlatformOrchestrationStageState = draftState !== 'complete'
      ? 'blocked'
      : configuration.ready
        ? 'complete'
        : 'blocked'
    const finalGateState: PlatformOrchestrationStageState = configurationState !== 'complete'
      ? 'blocked'
      : finalSubmissionGateReady || submissionComplete
        ? 'complete'
        : 'pending'
    const automaticState: PlatformOrchestrationStageState = submissionComplete
      ? 'complete'
      : finalGateState !== 'complete'
        ? 'blocked'
        : automaticSubmissionSupported
          ? 'available'
          : 'blocked'

    const stages = [
      stage(
        'human_approval',
        'Human approval',
        humanApprovalState,
        copyReady ? 'Copy is approved.' : 'Approve the content packet before any platform handoff.',
      ),
      stage(
        'asset_readiness',
        'Assets and privacy',
        assetState,
        assetDetail,
      ),
      stage(
        'platform_draft_handoff',
        'Platform draft handoff',
        draftState,
        draftState === 'complete'
          ? 'Internal platform draft handoff exists.'
          : `Create or authorize the ${PLATFORM_LABELS[platform]} draft handoff.`,
      ),
      stage(
        'platform_configuration',
        'Platform configuration',
        configurationState,
        configurationState === 'complete'
          ? configuration.detail
          : draftState !== 'complete'
            ? `Create the ${PLATFORM_LABELS[platform]} draft handoff before checking platform credentials.`
            : configuration.detail,
      ),
      stage(
        'final_submission_gate',
        'Final submission gate',
        finalGateState,
        finalGateState === 'complete'
          ? 'Final submission approval is recorded.'
          : `Approve ${PLATFORM_LABELS[platform]} platform submission as a separate gate.`,
      ),
      stage(
        'automatic_submission',
        'Automatic submission',
        automaticState,
        automaticState === 'complete'
          ? `${PLATFORM_LABELS[platform]} has a published platform record.`
          : !automaticSubmissionSupported
            ? `${PLATFORM_LABELS[platform]} automatic submission is not connected yet.`
            : `Submit to ${PLATFORM_LABELS[platform]} through the configured platform integration.`,
      ),
    ]

    return {
      platform,
      label: PLATFORM_LABELS[platform],
      automaticSubmissionSupported,
      publishStatus,
      platformPostUrl: publishRecord?.platform_post_url ?? null,
      nextAction: nextActionFor(stages, platform),
      stages,
      youtubeReadiness,
    }
  })

  return {
    platforms,
    anyAutomaticSubmissionAvailable: platforms.some((platform) => (
      platform.stages.some((stageItem) => stageItem.key === 'automatic_submission' && stageItem.state === 'available')
    )),
    allAutomaticSubmissionComplete: platforms.length > 0 && platforms.every((platform) => (
      platform.stages.some((stageItem) => stageItem.key === 'automatic_submission' && stageItem.state === 'complete')
    )),
    sideEffectsUntilFinalGate: {
      providerGeneration: false,
      upload: false,
      externalSchedule: false,
      publish: false,
      externalPost: false,
    },
  }
}
