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

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
}

const AUTOMATIC_SUBMISSION_SUPPORTED = new Set<SocialPlatform>(['linkedin', 'youtube', 'instagram', 'facebook', 'tiktok'])

const SUBMITTED_STATUSES = new Set<PublishStatus>(['published'])
const SUBMITTABLE_STATUSES = new Set<PublishStatus>(['pending', 'failed'])

export type BuildPlatformOrchestrationInput = {
  item?: Pick<SocialContentItem, 'status' | 'platform' | 'target_platforms' | 'publishes'> | null
  targetPlatforms?: SocialPlatform[]
  publishRecords?: Pick<SocialContentPublish, 'platform' | 'status' | 'platform_post_url'>[]
  platformConfigs?: Pick<SocialContentConfig, 'platform' | 'credentials' | 'settings' | 'is_active'>[]
  copyApproved?: boolean
  productionReady?: boolean
  redactionReady?: boolean
  draftHandoffReady?: boolean
  finalSubmissionGateReady?: boolean
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
      return {
        ready: hasToken,
        detail: hasToken
          ? 'YouTube upload credentials are configured.'
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
    const configuration = input.platformConfigs ? hasPlatformConfiguration(platform, platformConfig) : {
      ready: true,
      detail: `${PLATFORM_LABELS[platform]} configuration check was not requested.`,
    }
    const publishStatus = publishRecord?.status ?? null
    const automaticSubmissionSupported = AUTOMATIC_SUBMISSION_SUPPORTED.has(platform)
    const submissionComplete = Boolean(publishStatus && SUBMITTED_STATUSES.has(publishStatus))
    const finalSubmissionGateReady = input.finalSubmissionGateReady
      ?? Boolean((publishStatus && SUBMITTABLE_STATUSES.has(publishStatus)) || submissionComplete)

    const humanApprovalState: PlatformOrchestrationStageState = copyReady ? 'complete' : 'pending'
    const assetState: PlatformOrchestrationStageState = !copyReady
      ? 'blocked'
      : productionReady
        ? 'complete'
        : redactionReady
          ? 'pending'
          : 'blocked'
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
        assetState === 'complete'
          ? 'Required assets and privacy checks are ready.'
          : redactionReady
            ? 'Finish visual assets, asset packet, and channel-specific readiness.'
            : 'Resolve privacy/redaction blockers before submission.',
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
