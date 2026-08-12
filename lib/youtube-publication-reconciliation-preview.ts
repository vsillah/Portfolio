import { extractYouTubeVideoId } from './youtube-comment-ingestion'
import {
  deriveSocialContentLifecycleProjection,
  lifecyclePrerequisiteFailure,
} from './social-content-lifecycle'
import { getPlatformSubmissionGate } from './social-platform-orchestration'

type SupabaseClientLike = {
  from: (table: string) => any
}

type FetchLike = typeof fetch

type SocialContentRow = {
  id: string
  platform: string
  status: string
  post_text: string | null
  image_url: string | null
  video_url: string | null
  carousel_slide_urls: string[] | null
  youtube_title: string | null
  youtube_description: string | null
  target_platforms: string[] | null
  platform_post_id: string | null
  published_at: string | null
  rag_context: Record<string, unknown> | null
  updated_at: string | null
}

type PublishRow = {
  id: string
  content_id: string
  platform: string
  status: string
  platform_post_id: string | null
  platform_post_url: string | null
  error_message: string | null
  published_at: string | null
  created_at: string | null
  updated_at: string | null
}

type YouTubeCredentials = {
  access_token?: string
  expires_in?: number
  token_obtained_at?: string
  scope?: string
}

type YouTubeConfigRow = {
  credentials: YouTubeCredentials | null
  settings: Record<string, unknown> | null
  is_active: boolean
}

type YouTubeVideo = {
  id?: string
  snippet?: {
    channelId?: string
    channelTitle?: string
    title?: string
    description?: string
    publishedAt?: string
    thumbnails?: Record<string, { url?: string; width?: number; height?: number }>
  }
  status?: {
    privacyStatus?: string
    uploadStatus?: string
    embeddable?: boolean
    madeForKids?: boolean
  }
}

type VideosListResponse = {
  items?: YouTubeVideo[]
  pageInfo?: { totalResults?: number; resultsPerPage?: number }
  error?: {
    code?: number
    message?: string
    errors?: Array<{ reason?: string; message?: string }>
  }
}

export type YouTubePublicationPreviewBlocker = {
  code: string
  message: string
  status?: number
  reason?: string
}

export type YouTubePublicationReconciliationPreview = {
  ok: boolean
  platform: 'youtube'
  provider: 'youtube_data_api'
  contentId: string | null
  videoId: string | null
  selectedContent: Pick<
    SocialContentRow,
    'id' | 'platform' | 'status' | 'youtube_title' | 'youtube_description' | 'target_platforms' | 'platform_post_id' | 'published_at'
  > | null
  existingPublishState: PublishRow | null
  providerVideo: {
    id: string
    title: string | null
    channelId: string | null
    channelTitle: string | null
    publishedAt: string | null
    privacyStatus: string | null
    uploadStatus: string | null
    thumbnailUrl: string | null
  } | null
  channelMatch: {
    configuredChannelId: string | null
    providerChannelId: string | null
    matches: boolean | null
  }
  proposedWrite: {
    table: 'social_content_publishes'
    operation: 'upsert_after_human_approval'
    immutableFields: {
      content_id: string
      platform: 'youtube'
      status: 'published'
      platform_post_id: string
      platform_post_url: string
      published_at: string | null
    }
  } | null
  conflicts: Array<{
    code: string
    message: string
    publishId?: string
    contentId?: string
  }>
  blockers: YouTubePublicationPreviewBlocker[]
  recoveryAction: string
}

export type YouTubePublicationPreviewInput = {
  db: SupabaseClientLike
  contentId?: string | null
  videoId?: string | null
  videoUrl?: string | null
  fetchImpl?: FetchLike
  now?: () => Date
}

const YOUTUBE_VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos'
const YOUTUBE_PROVIDER = 'youtube_data_api'
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
]
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isTokenExpired(credentials: YouTubeCredentials, now: Date, bufferMs = 10 * 60 * 1000) {
  if (!credentials.token_obtained_at || !credentials.expires_in) return false
  const obtainedAt = new Date(credentials.token_obtained_at).getTime()
  const expiresAt = obtainedAt + credentials.expires_in * 1000
  return now.getTime() + bufferMs >= expiresAt
}

function includesRequiredScopes(scope: string | undefined) {
  if (!scope) return false
  const scopes = new Set(scope.split(/\s+/).filter(Boolean))
  return REQUIRED_SCOPES.every((required) => scopes.has(required))
}

function videoUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

function thumbnailUrl(video: YouTubeVideo) {
  return video.snippet?.thumbnails?.maxres?.url
    || video.snippet?.thumbnails?.standard?.url
    || video.snippet?.thumbnails?.high?.url
    || video.snippet?.thumbnails?.medium?.url
    || video.snippet?.thumbnails?.default?.url
    || null
}

function blocked(input: {
  contentId: string | null
  videoId: string | null
  selectedContent?: YouTubePublicationReconciliationPreview['selectedContent']
  existingPublishState?: PublishRow | null
  providerVideo?: YouTubePublicationReconciliationPreview['providerVideo']
  channelMatch?: YouTubePublicationReconciliationPreview['channelMatch']
  blockers: YouTubePublicationPreviewBlocker[]
  conflicts?: YouTubePublicationReconciliationPreview['conflicts']
  recoveryAction: string
}): YouTubePublicationReconciliationPreview {
  return {
    ok: false,
    platform: 'youtube',
    provider: YOUTUBE_PROVIDER,
    contentId: input.contentId,
    videoId: input.videoId,
    selectedContent: input.selectedContent ?? null,
    existingPublishState: input.existingPublishState ?? null,
    providerVideo: input.providerVideo ?? null,
    channelMatch: input.channelMatch ?? {
      configuredChannelId: null,
      providerChannelId: null,
      matches: null,
    },
    proposedWrite: null,
    conflicts: input.conflicts ?? [],
    blockers: input.blockers,
    recoveryAction: input.recoveryAction,
  }
}

function mapVideoApiError(response: Response, data: VideosListResponse): YouTubePublicationPreviewBlocker {
  const reason = data.error?.errors?.[0]?.reason
  const message = data.error?.message || data.error?.errors?.[0]?.message || `YouTube videos.list failed (${response.status})`
  const normalized = reason || String(response.status)
  let code = 'youtube_api_error'

  if (response.status === 401 || normalized === 'authError' || normalized === 'invalidCredentials') {
    code = 'token_expired'
  } else if (normalized === 'insufficientPermissions' || normalized === 'forbidden') {
    code = 'insufficient_scope'
  } else if (
    response.status === 429
    || normalized === 'quotaExceeded'
    || normalized === 'rateLimitExceeded'
    || normalized === 'userRateLimitExceeded'
  ) {
    code = 'quota_or_rate_limited'
  } else if (normalized === 'videoNotFound') {
    code = 'video_not_found'
  }

  return { code, message, status: response.status, reason }
}

async function readYouTubeConfig(db: SupabaseClientLike): Promise<YouTubeConfigRow | null> {
  const result = await db
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'youtube')
    .maybeSingle()

  if (result.error) throw new Error(result.error.message)
  return result.data as YouTubeConfigRow | null
}

async function readContent(db: SupabaseClientLike, contentId: string): Promise<SocialContentRow | null> {
  const result = await db
    .from('social_content_queue')
    .select('id, platform, status, post_text, image_url, video_url, carousel_slide_urls, youtube_title, youtube_description, target_platforms, platform_post_id, published_at, rag_context, updated_at')
    .eq('id', contentId)
    .maybeSingle()

  if (result.error) throw new Error(result.error.message)
  return result.data as SocialContentRow | null
}

async function readExistingPublish(db: SupabaseClientLike, contentId: string): Promise<PublishRow | null> {
  const result = await db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, error_message, published_at, created_at, updated_at')
    .eq('content_id', contentId)
    .eq('platform', 'youtube')
    .maybeSingle()

  if (result.error) throw new Error(result.error.message)
  return result.data as PublishRow | null
}

async function readPublishConflict(db: SupabaseClientLike, contentId: string, videoId: string): Promise<PublishRow | null> {
  const idResult = await db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, error_message, published_at, created_at, updated_at')
    .eq('platform', 'youtube')
    .eq('platform_post_id', videoId)
    .limit(1)
    .maybeSingle()

  if (idResult.error) throw new Error(idResult.error.message)
  const row = idResult.data as PublishRow | null
  if (row && row.content_id !== contentId) return row

  const urlResult = await db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, error_message, published_at, created_at, updated_at')
    .eq('platform', 'youtube')
    .ilike('platform_post_url', `%${videoId}%`)
    .limit(10)

  if (urlResult.error) throw new Error(urlResult.error.message)
  const urlRows = (urlResult.data ?? []) as PublishRow[]
  const urlConflict = urlRows.find((candidate) => (
    candidate.content_id !== contentId
    && extractYouTubeVideoId({ platformPostUrl: candidate.platform_post_url }) === videoId
  ))
  if (urlConflict) return urlConflict

  return row && row.content_id !== contentId ? row : null
}

async function fetchVideo(input: {
  fetchImpl: FetchLike
  accessToken: string
  videoId: string
}): Promise<{ video?: YouTubeVideo; blocker?: YouTubePublicationPreviewBlocker }> {
  const url = new URL(YOUTUBE_VIDEOS_URL)
  url.searchParams.set('part', 'snippet,status')
  url.searchParams.set('id', input.videoId)

  const response = await input.fetchImpl(url.toString(), {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: 'application/json',
    },
  })
  const data = await response.json() as VideosListResponse
  if (!response.ok) return { blocker: mapVideoApiError(response, data) }

  const video = data.items?.[0]
  if (!video?.id) {
    return {
      blocker: {
        code: 'video_not_found',
        message: 'YouTube videos.list returned no item for the selected video ID; the video may be nonexistent, private, or inaccessible.',
      },
    }
  }
  return { video }
}

function selectedContent(row: SocialContentRow): YouTubePublicationReconciliationPreview['selectedContent'] {
  return {
    id: row.id,
    platform: row.platform,
    status: row.status,
    youtube_title: row.youtube_title,
    youtube_description: row.youtube_description,
    target_platforms: row.target_platforms,
    platform_post_id: row.platform_post_id,
    published_at: row.published_at,
  }
}

export async function previewYouTubePublicationReconciliation(
  input: YouTubePublicationPreviewInput,
): Promise<YouTubePublicationReconciliationPreview> {
  const contentId = asString(input.contentId)
  const videoId = extractYouTubeVideoId({
    platformPostId: input.videoId,
    platformPostUrl: input.videoUrl,
  })

  if (!contentId || !videoId) {
    const blockers: YouTubePublicationPreviewBlocker[] = []
    if (!contentId) {
      blockers.push({
        code: 'explicit_selection_required',
        message: 'Select one Social Content row before previewing YouTube publication reconciliation.',
      })
    } else if (!UUID_PATTERN.test(contentId)) {
      blockers.push({
        code: 'invalid_content_id',
        message: 'Selected Social Content id must be a UUID.',
      })
    }
    if (!videoId) {
      blockers.push({
        code: 'malformed_provider_video_id',
        message: 'Provide an explicit 11-character YouTube video ID or URL before previewing reconciliation.',
      })
    }
    return blocked({
      contentId,
      videoId,
      blockers,
      recoveryAction: 'Select one Social Content row and paste the exact YouTube video URL or 11-character video ID.',
    })
  }

  if (!UUID_PATTERN.test(contentId)) {
    return blocked({
      contentId,
      videoId,
      blockers: [{
        code: 'invalid_content_id',
        message: 'Selected Social Content id must be a UUID.',
      }],
      recoveryAction: 'Select a canonical Social Content row before previewing reconciliation.',
    })
  }

  const content = await readContent(input.db, contentId)
  if (!content) {
    return blocked({
      contentId,
      videoId,
      blockers: [{
        code: 'content_not_found',
        message: 'Selected Social Content row was not found.',
      }],
      recoveryAction: 'Select an existing YouTube Social Content row.',
    })
  }

  const contentSnapshot = selectedContent(content)
  const targetsYouTube = content.platform === 'youtube' || Boolean(content.target_platforms?.includes('youtube'))
  if (!targetsYouTube) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      blockers: [{
        code: 'content_not_youtube_targeted',
        message: 'Selected Social Content row is not targeted to YouTube.',
      }],
      recoveryAction: 'Select the intended YouTube Social Content row before previewing reconciliation.',
    })
  }

  const existingPublish = await readExistingPublish(input.db, contentId)
  const conflict = await readPublishConflict(input.db, contentId, videoId)
  const conflicts: YouTubePublicationReconciliationPreview['conflicts'] = []
  const blockers: YouTubePublicationPreviewBlocker[] = []
  const lifecycle = deriveSocialContentLifecycleProjection({
    item: {
      status: content.status as never,
      rag_context: content.rag_context,
      target_platforms: content.target_platforms as never,
      image_url: content.image_url,
      video_url: content.video_url,
      carousel_slide_urls: content.carousel_slide_urls,
      platform_post_id: content.platform_post_id,
      published_at: content.published_at,
      publishes: existingPublish ? [existingPublish as never] : [],
    },
  })
  const lifecycleFailure = lifecyclePrerequisiteFailure(lifecycle, 'submit')
  const platformGate = getPlatformSubmissionGate(content.rag_context)
  const youtubeGateApproved = platformGate?.status === 'approved'
    && Boolean(platformGate.platforms?.includes('youtube'))

  if (lifecycleFailure) {
    blockers.push({
      code: 'lifecycle_prerequisite_blocked',
      message: lifecycleFailure.recovery_action,
    })
  }
  if (!youtubeGateApproved) {
    blockers.push({
      code: 'youtube_submission_gate_required',
      message: 'Approve the platform_submission_gate for YouTube before previewing canonical published reconciliation.',
    })
  }

  if (
    existingPublish?.platform_post_id
    || extractYouTubeVideoId({ platformPostUrl: existingPublish?.platform_post_url })
  ) {
    blockers.push({
      code: 'already_linked_video',
      message: 'Selected Social Content row already has a canonical YouTube provider video ID.',
    })
  }
  if (content.platform_post_id && extractYouTubeVideoId({ platformPostId: content.platform_post_id })) {
    blockers.push({
      code: 'queue_level_publication_evidence',
      message: 'Selected Social Content row already carries queue-level YouTube provider video evidence.',
    })
  }
  if (
    (content.status === 'published' || content.published_at)
    && !existingPublish?.platform_post_id
    && !extractYouTubeVideoId({ platformPostUrl: existingPublish?.platform_post_url })
  ) {
    blockers.push({
      code: 'ambiguous_queue_publication_evidence',
      message: 'Selected Social Content row has queue-level published evidence without a reconcilable YouTube publish row.',
    })
  }
  if (conflict) {
    conflicts.push({
      code: 'conflicting_existing_publish_row',
      message: 'Another Social Content publish row already references this YouTube video ID.',
      publishId: conflict.id,
      contentId: conflict.content_id,
    })
    blockers.push({
      code: 'conflicting_existing_publish_row',
      message: 'Another Social Content publish row already references this YouTube video ID.',
    })
  }
  if (blockers.length) {
    const hasLifecycleOrGateBlocker = blockers.some((blocker) => (
      blocker.code === 'lifecycle_prerequisite_blocked'
      || blocker.code === 'youtube_submission_gate_required'
    ))
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      blockers,
      conflicts,
      recoveryAction: hasLifecycleOrGateBlocker
        ? 'Recover the missing canonical approvals through Draft and approve the YouTube platform submission gate before requesting reconciliation preview.'
        : 'Review existing YouTube publish linkage before proposing a new mapping.',
    })
  }

  const config = await readYouTubeConfig(input.db)
  const credentials = config?.credentials
  const configuredChannelId = asString(config?.settings?.channel_id)
  if (!config?.is_active || !credentials?.access_token) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      blockers: [{
        code: 'youtube_not_connected',
        message: 'YouTube is not connected or active.',
      }],
      recoveryAction: 'Reconnect YouTube before previewing publication reconciliation.',
    })
  }
  if (!includesRequiredScopes(credentials.scope)) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      blockers: [{
        code: 'insufficient_scope',
        message: 'Stored YouTube OAuth scope is missing youtube.readonly or youtube.force-ssl; reconnect YouTube.',
      }],
      recoveryAction: 'Reconnect YouTube with read-only and force-SSL scopes.',
    })
  }
  if (isTokenExpired(credentials, input.now?.() ?? new Date())) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      blockers: [{
        code: 'token_expired',
        message: 'YouTube access token is expired; reconnect YouTube before previewing publication reconciliation.',
      }],
      recoveryAction: 'Reconnect YouTube; this preview does not refresh tokens because it must not mutate stored credentials.',
    })
  }

  const fetched = await fetchVideo({
    fetchImpl: input.fetchImpl ?? fetch,
    accessToken: credentials.access_token,
    videoId,
  })
  if (fetched.blocker || !fetched.video) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      blockers: [fetched.blocker ?? {
        code: 'video_not_found',
        message: 'YouTube video was not returned by videos.list.',
      }],
      recoveryAction: 'Confirm the exact YouTube URL, video visibility, and connected account access.',
    })
  }

  const video = fetched.video
  const providerChannelId = asString(video.snippet?.channelId)
  const providerVideo = {
    id: video.id ?? videoId,
    title: asString(video.snippet?.title),
    channelId: providerChannelId,
    channelTitle: asString(video.snippet?.channelTitle),
    publishedAt: asString(video.snippet?.publishedAt),
    privacyStatus: asString(video.status?.privacyStatus),
    uploadStatus: asString(video.status?.uploadStatus),
    thumbnailUrl: thumbnailUrl(video),
  }
  const channelMatch = {
    configuredChannelId,
    providerChannelId,
    matches: configuredChannelId && providerChannelId ? configuredChannelId === providerChannelId : null,
  }
  const parsedPublishedAt = providerVideo.publishedAt ? Date.parse(providerVideo.publishedAt) : Number.NaN

  if (!configuredChannelId || !providerChannelId) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      providerVideo,
      channelMatch,
      blockers: [{
        code: 'channel_identity_unverified',
        message: 'Configured YouTube channel ID and provider video channel ID must both be present before reconciliation can be proposed.',
      }],
      recoveryAction: 'Reconnect YouTube or confirm the provider returned channel identity before requesting reconciliation.',
    })
  }
  if (providerVideo.id !== videoId) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      providerVideo,
      channelMatch,
      blockers: [{
        code: 'provider_video_id_mismatch',
        message: 'YouTube videos.list returned a different video ID than the requested candidate.',
      }],
      recoveryAction: 'Confirm the exact YouTube video URL before requesting reconciliation.',
    })
  }
  if (providerVideo.uploadStatus !== 'processed') {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      providerVideo,
      channelMatch,
      blockers: [{
        code: 'video_not_processed',
        message: 'The selected YouTube video is not fully processed.',
      }],
      recoveryAction: 'Wait for YouTube processing to complete before requesting reconciliation.',
    })
  }
  if (providerVideo.privacyStatus !== 'public') {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      providerVideo,
      channelMatch,
      blockers: [{
        code: 'video_not_public',
        message: 'The selected YouTube video must be public before canonical published reconciliation can be proposed.',
      }],
      recoveryAction: 'Confirm a public YouTube URL before requesting reconciliation.',
    })
  }
  if (!providerVideo.publishedAt || Number.isNaN(parsedPublishedAt)) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      providerVideo,
      channelMatch,
      blockers: [{
        code: 'published_at_unverified',
        message: 'YouTube videos.list did not return a parseable publishedAt timestamp.',
      }],
      recoveryAction: 'Confirm the exact published YouTube URL and provider metadata before requesting reconciliation.',
    })
  }
  if (channelMatch.matches === false) {
    return blocked({
      contentId,
      videoId,
      selectedContent: contentSnapshot,
      existingPublishState: existingPublish,
      providerVideo,
      channelMatch,
      blockers: [{
        code: 'wrong_channel',
        message: 'The selected YouTube video belongs to a different channel than the configured AmaduTown channel.',
      }],
      recoveryAction: 'Confirm the AmaduTown channel video URL before requesting reconciliation.',
    })
  }

  return {
    ok: true,
    platform: 'youtube',
    provider: YOUTUBE_PROVIDER,
    contentId,
    videoId,
    selectedContent: contentSnapshot,
    existingPublishState: existingPublish,
    providerVideo,
    channelMatch,
    proposedWrite: {
      table: 'social_content_publishes',
      operation: 'upsert_after_human_approval',
      immutableFields: {
        content_id: contentId,
        platform: 'youtube',
        status: 'published',
        platform_post_id: videoId,
        platform_post_url: videoUrl(videoId),
        published_at: providerVideo.publishedAt,
      },
    },
    conflicts: [],
    blockers: [],
    recoveryAction: 'Human approval must explicitly authorize this mapping before any write is implemented.',
  }
}
