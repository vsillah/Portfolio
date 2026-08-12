import {
  buildSocialCommentIngestionRunInsert,
  upsertSocialContentComments,
  type NormalizedSocialCommentInput,
  type SocialCommentIngestionRunStatus,
} from './social-comment-inbox'

type SupabaseClientLike = {
  from: (table: string) => any
}

type FetchLike = typeof fetch

type PublishRow = {
  id: string
  content_id: string
  platform: string
  status: string
  platform_post_id: string | null
  platform_post_url: string | null
  published_at: string | null
}

type YouTubeCredentials = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  token_obtained_at?: string
  scope?: string
}

type YouTubeConfigRow = {
  credentials: YouTubeCredentials | null
  settings: Record<string, unknown> | null
  is_active: boolean
}

type YouTubeErrorDetail = {
  code: string
  message: string
  status?: number
  reason?: string
}

type GoogleApiError = {
  error?: {
    code?: number
    message?: string
    errors?: Array<{ reason?: string; message?: string }>
  }
}

type YouTubeCommentSnippet = {
  authorDisplayName?: string
  authorProfileImageUrl?: string
  authorChannelUrl?: string
  authorChannelId?: { value?: string }
  textDisplay?: string
  textOriginal?: string
  parentId?: string
  canRate?: boolean
  viewerRating?: string
  likeCount?: number
  moderationStatus?: string
  publishedAt?: string
  updatedAt?: string
}

type YouTubeComment = {
  kind?: string
  etag?: string
  id?: string
  snippet?: YouTubeCommentSnippet
}

type YouTubeCommentThread = {
  kind?: string
  etag?: string
  id?: string
  snippet?: {
    channelId?: string
    videoId?: string
    topLevelComment?: YouTubeComment
    canReply?: boolean
    totalReplyCount?: number
    isPublic?: boolean
  }
  replies?: {
    comments?: YouTubeComment[]
  }
}

type CommentThreadsResponse = GoogleApiError & {
  kind?: string
  etag?: string
  nextPageToken?: string
  pageInfo?: { totalResults?: number; resultsPerPage?: number }
  items?: YouTubeCommentThread[]
}

type CommentsResponse = GoogleApiError & {
  kind?: string
  etag?: string
  nextPageToken?: string
  pageInfo?: { totalResults?: number; resultsPerPage?: number }
  items?: YouTubeComment[]
}

export type YouTubeCommentRefreshResult = {
  platform: 'youtube'
  provider: 'youtube_data_api'
  status: SocialCommentIngestionRunStatus
  publishId: string | null
  contentId: string | null
  videoId: string | null
  runId: string | null
  fetched: number
  upserted: number
  skipped: number
  errors: YouTubeErrorDetail[]
  cursor: Record<string, unknown>
  blockedReason?: string
}

export type YouTubeCommentRefreshInput = {
  db: SupabaseClientLike
  publishId?: string | null
  contentId?: string | null
  limit?: number
  pageSize?: number
  fetchImpl?: FetchLike
  now?: () => Date
}

const YOUTUBE_COMMENT_THREADS_URL = 'https://www.googleapis.com/youtube/v3/commentThreads'
const YOUTUBE_COMMENTS_URL = 'https://www.googleapis.com/youtube/v3/comments'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_PROVIDER = 'youtube_data_api'
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
]

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

export function extractYouTubeVideoId(input: {
  platformPostId?: string | null
  platformPostUrl?: string | null
}) {
  const id = asString(input.platformPostId)
  if (id) {
    const direct = id.match(/^[A-Za-z0-9_-]{11}$/)
    if (direct) return id
  }

  const url = asString(input.platformPostUrl)
  if (!url) return null

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    if (host.endsWith('youtube.com')) {
      return parsed.searchParams.get('v')
        || parsed.pathname.match(/\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1]
        || null
    }
  } catch {
    return null
  }

  return null
}

function mapYouTubeApiError(response: Response, data: GoogleApiError): YouTubeErrorDetail {
  const reason = data.error?.errors?.[0]?.reason
  const message = data.error?.message || data.error?.errors?.[0]?.message || `YouTube API request failed (${response.status})`
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
  } else if (normalized === 'commentsDisabled') {
    code = 'comments_disabled'
  } else if (normalized === 'videoNotFound') {
    code = 'video_not_found'
  }

  return { code, message, status: response.status, reason }
}

async function readPublish(input: YouTubeCommentRefreshInput): Promise<{ row: PublishRow | null; error?: string }> {
  if (!asString(input.publishId) && !asString(input.contentId)) {
    return { row: null, error: 'no_selected_publish' }
  }

  let query = input.db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, published_at')
    .eq('platform', 'youtube')
    .eq('status', 'published')
    .limit(1)

  if (asString(input.publishId)) {
    query = query.eq('id', asString(input.publishId))
  } else {
    query = query.eq('content_id', asString(input.contentId))
  }

  const result = await query.maybeSingle()
  if (result.error) throw new Error(result.error.message)
  return { row: result.data as PublishRow | null }
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

async function updateYouTubeCredentials(db: SupabaseClientLike, credentials: YouTubeCredentials) {
  const result = await db
    .from('social_content_config')
    .update({ credentials })
    .eq('platform', 'youtube')

  if (result.error) throw new Error(result.error.message)
}

async function refreshYouTubeToken(input: {
  db: SupabaseClientLike
  credentials: YouTubeCredentials
  fetchImpl: FetchLike
  now: Date
}): Promise<{ credentials?: YouTubeCredentials; error?: YouTubeErrorDetail }> {
  if (!input.credentials.refresh_token) {
    return {
      error: {
        code: 'token_expired',
        message: 'YouTube access token expired and no refresh token is stored; reconnect YouTube before refreshing comments.',
      },
    }
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return {
      error: {
        code: 'youtube_oauth_config_missing',
        message: 'YouTube OAuth client credentials are not configured.',
      },
    }
  }

  const response = await input.fetchImpl(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: input.credentials.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await response.json() as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    scope?: string
    error_description?: string
    error?: string
  }

  if (!response.ok || !data.access_token) {
    return {
      error: {
        code: 'token_expired',
        message: data.error_description || data.error || 'YouTube token refresh failed; reconnect YouTube before refreshing comments.',
        status: response.status,
      },
    }
  }

  const credentials = {
    ...input.credentials,
    access_token: data.access_token,
    refresh_token: data.refresh_token || input.credentials.refresh_token,
    expires_in: data.expires_in,
    scope: data.scope || input.credentials.scope,
    token_obtained_at: input.now.toISOString(),
  }
  await updateYouTubeCredentials(input.db, credentials)
  return { credentials }
}

async function ensureAccessToken(input: {
  db: SupabaseClientLike
  fetchImpl: FetchLike
  now: Date
}): Promise<{ accessToken?: string; error?: YouTubeErrorDetail }> {
  const config = await readYouTubeConfig(input.db)
  if (!config?.is_active || !config.credentials) {
    return {
      error: {
        code: 'youtube_not_connected',
        message: 'YouTube is not connected or inactive.',
      },
    }
  }

  let credentials = config.credentials
  if (!credentials.access_token) {
    return {
      error: {
        code: 'youtube_credentials_incomplete',
        message: 'YouTube credentials are missing an access token.',
      },
    }
  }

  if (!includesRequiredScopes(credentials.scope)) {
    return {
      error: {
        code: 'insufficient_scope',
        message: 'Stored YouTube OAuth scope is missing youtube.readonly or youtube.force-ssl; reconnect YouTube.',
      },
    }
  }

  if (isTokenExpired(credentials, input.now)) {
    const refresh = await refreshYouTubeToken({
      db: input.db,
      credentials,
      fetchImpl: input.fetchImpl,
      now: input.now,
    })
    if (refresh.error || !refresh.credentials?.access_token) return { error: refresh.error }
    credentials = refresh.credentials
  }

  return { accessToken: credentials.access_token }
}

async function insertRun(input: {
  db: SupabaseClientLike
  publishId: string | null
  contentId: string | null
  videoId: string | null
  status: SocialCommentIngestionRunStatus
  cursorMetadata?: Record<string, unknown>
  counts?: Parameters<typeof buildSocialCommentIngestionRunInsert>[0]['counts']
  errors?: YouTubeErrorDetail[]
  metadata?: Record<string, unknown>
}) {
  const result = await input.db
    .from('social_comment_ingestion_runs')
    .insert(buildSocialCommentIngestionRunInsert({
      platform: 'youtube',
      provider: YOUTUBE_PROVIDER,
      publishId: input.publishId,
      contentId: input.contentId,
      status: input.status,
      cursorMetadata: input.cursorMetadata,
      counts: input.counts,
      errors: input.errors,
      metadata: {
        source: 'youtube_comment_ingestion',
        video_id: input.videoId,
        external_submission_enabled: false,
        ...input.metadata,
      },
    }))
    .select('id')
    .single()

  if (result.error) throw new Error(result.error.message)
  return asString((result.data as { id?: string } | null)?.id)
}

async function completeRun(input: {
  db: SupabaseClientLike
  runId: string
  status: SocialCommentIngestionRunStatus
  cursorMetadata: Record<string, unknown>
  fetched: number
  upserted: number
  skipped: number
  errors: YouTubeErrorDetail[]
  now: Date
}) {
  const result = await input.db
    .from('social_comment_ingestion_runs')
    .update({
      status: input.status,
      cursor_metadata: input.cursorMetadata,
      fetched_count: input.fetched,
      inserted_count: 0,
      updated_count: input.upserted,
      skipped_count: input.skipped,
      error_count: input.errors.length,
      errors: input.errors,
      completed_at: input.now.toISOString(),
    })
    .eq('id', input.runId)

  if (result.error) throw new Error(result.error.message)
}

function commentPermalink(videoId: string, commentId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&lc=${encodeURIComponent(commentId)}`
}

function mapComment(input: {
  publish: PublishRow
  videoId: string
  runId: string
  thread: YouTubeCommentThread
  comment: YouTubeComment
  recordType: 'comment' | 'reply'
  providerParentCommentId?: string
  now: Date
}): NormalizedSocialCommentInput | null {
  const id = asString(input.comment.id)
  const snippet = input.comment.snippet
  const body = asString(snippet?.textOriginal) || asString(snippet?.textDisplay)
  if (!id || !body) return null

  return {
    publishId: input.publish.id,
    contentId: input.publish.content_id,
    platform: 'youtube',
    provider: YOUTUBE_PROVIDER,
    providerCommentId: id,
    providerParentCommentId: input.providerParentCommentId,
    threadId: input.thread.id || id,
    recordType: input.recordType,
    authorPublicHandle: snippet?.authorChannelId?.value,
    authorDisplayName: snippet?.authorDisplayName,
    authorProfileUrl: snippet?.authorChannelUrl,
    body,
    commentUrl: commentPermalink(input.videoId, id),
    providerCreatedAt: snippet?.publishedAt,
    providerUpdatedAt: snippet?.updatedAt,
    capturedAt: input.now.toISOString(),
    status: input.thread.snippet?.isPublic === false ? 'hidden' : 'visible',
    ingestionRunId: input.runId,
    rawPayload: {
      source: 'youtube_data_api',
      thread: input.recordType === 'comment' ? input.thread : undefined,
      comment: input.comment,
    },
    metadata: {
      youtube: {
        video_id: input.videoId,
        thread_id: input.thread.id || id,
        provider_parent_comment_id: input.providerParentCommentId ?? null,
        total_reply_count: input.thread.snippet?.totalReplyCount ?? 0,
        can_reply: input.thread.snippet?.canReply ?? null,
        external_submission_enabled: false,
      },
    },
  }
}

async function fetchJson<T>(input: {
  fetchImpl: FetchLike
  url: URL
  accessToken: string
}): Promise<{ data?: T; error?: YouTubeErrorDetail }> {
  const response = await input.fetchImpl(input.url.toString(), {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: 'application/json',
    },
  })
  const data = await response.json() as T & GoogleApiError
  if (!response.ok) return { error: mapYouTubeApiError(response, data) }
  return { data }
}

async function fetchReplyComments(input: {
  fetchImpl: FetchLike
  accessToken: string
  parentId: string
  pageSize: number
  cursor: Record<string, unknown>
}) {
  const replies: YouTubeComment[] = []
  const errors: YouTubeErrorDetail[] = []
  let pageToken: string | undefined
  let pages = 0

  do {
    const url = new URL(YOUTUBE_COMMENTS_URL)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('parentId', input.parentId)
    url.searchParams.set('maxResults', String(input.pageSize))
    url.searchParams.set('textFormat', 'plainText')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const result = await fetchJson<CommentsResponse>({
      fetchImpl: input.fetchImpl,
      accessToken: input.accessToken,
      url,
    })
    pages += 1
    if (result.error) {
      errors.push(result.error)
      break
    }

    replies.push(...(result.data?.items ?? []))
    pageToken = result.data?.nextPageToken
  } while (pageToken)

  input.cursor[`replies:${input.parentId}`] = { pages, nextPageToken: pageToken ?? null }
  return { replies, errors }
}

async function collectYouTubeComments(input: {
  publish: PublishRow
  videoId: string
  runId: string
  accessToken: string
  fetchImpl: FetchLike
  limit: number
  pageSize: number
  now: Date
}) {
  const comments: NormalizedSocialCommentInput[] = []
  const errors: YouTubeErrorDetail[] = []
  const cursor: Record<string, unknown> = { threadPages: 0, threadNextPageToken: null }
  let pageToken: string | undefined
  let skipped = 0

  do {
    const url = new URL(YOUTUBE_COMMENT_THREADS_URL)
    url.searchParams.set('part', 'snippet,replies')
    url.searchParams.set('videoId', input.videoId)
    url.searchParams.set('maxResults', String(input.pageSize))
    url.searchParams.set('textFormat', 'plainText')
    url.searchParams.set('order', 'time')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const result = await fetchJson<CommentThreadsResponse>({
      fetchImpl: input.fetchImpl,
      accessToken: input.accessToken,
      url,
    })
    cursor.threadPages = Number(cursor.threadPages) + 1
    if (result.error) {
      errors.push(result.error)
      break
    }

    for (const thread of result.data?.items ?? []) {
      const topLevel = thread.snippet?.topLevelComment
      const topComment = topLevel
        ? mapComment({
          publish: input.publish,
          videoId: input.videoId,
          runId: input.runId,
          thread,
          comment: topLevel,
          recordType: 'comment',
          now: input.now,
        })
        : null
      if (topComment) {
        comments.push(topComment)
      } else {
        skipped += 1
      }

      const parentId = asString(topLevel?.id)
      const totalReplyCount = thread.snippet?.totalReplyCount ?? 0
      if (parentId && totalReplyCount > 0) {
        const replies = await fetchReplyComments({
          fetchImpl: input.fetchImpl,
          accessToken: input.accessToken,
          parentId,
          pageSize: input.pageSize,
          cursor,
        })
        errors.push(...replies.errors)
        for (const reply of replies.replies) {
          const mapped = mapComment({
            publish: input.publish,
            videoId: input.videoId,
            runId: input.runId,
            thread,
            comment: reply,
            recordType: 'reply',
            providerParentCommentId: parentId,
            now: input.now,
          })
          if (mapped) {
            comments.push(mapped)
          } else {
            skipped += 1
          }
        }
      }

      if (comments.length >= input.limit) break
    }

    pageToken = comments.length >= input.limit ? undefined : result.data?.nextPageToken
    cursor.threadNextPageToken = pageToken ?? null
  } while (pageToken)

  return {
    comments: comments.slice(0, input.limit),
    errors,
    cursor,
    skipped: skipped + Math.max(0, comments.length - input.limit),
  }
}

function blockedResult(input: {
  publishId: string | null
  contentId: string | null
  videoId: string | null
  runId: string | null
  error: YouTubeErrorDetail
}): YouTubeCommentRefreshResult {
  return {
    platform: 'youtube',
    provider: YOUTUBE_PROVIDER,
    status: 'manual_blocked',
    publishId: input.publishId,
    contentId: input.contentId,
    videoId: input.videoId,
    runId: input.runId,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: [input.error],
    cursor: {},
    blockedReason: input.error.message,
  }
}

export async function refreshPublishedYouTubeComments(input: YouTubeCommentRefreshInput): Promise<YouTubeCommentRefreshResult> {
  const now = input.now?.() ?? new Date()
  const fetchImpl = input.fetchImpl ?? fetch
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  const pageSize = Math.min(Math.max(input.pageSize ?? 100, 1), 100)
  const publishLookup = await readPublish(input)
  const selectedPublishId = asString(input.publishId)
  const selectedContentId = asString(input.contentId)

  if (!publishLookup.row) {
    const error: YouTubeErrorDetail = {
      code: publishLookup.error ?? 'no_eligible_published_youtube_row',
      message: 'No eligible published YouTube row with a canonical provider video ID was selected; reconcile publication first.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: selectedPublishId,
      contentId: selectedContentId,
      videoId: null,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: { recovery: 'reconcile_youtube_publication' },
    })
    return blockedResult({
      publishId: selectedPublishId,
      contentId: selectedContentId,
      videoId: null,
      runId,
      error,
    })
  }

  const publish = publishLookup.row
  const videoId = extractYouTubeVideoId({
    platformPostId: publish.platform_post_id,
    platformPostUrl: publish.platform_post_url,
  })

  if (!videoId) {
    const error: YouTubeErrorDetail = {
      code: 'malformed_provider_video_id',
      message: 'Published YouTube row is missing a canonical provider video ID; reconcile publication first.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: publish.id,
      contentId: publish.content_id,
      videoId: null,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: { recovery: 'reconcile_youtube_publication' },
    })
    return blockedResult({
      publishId: publish.id,
      contentId: publish.content_id,
      videoId: null,
      runId,
      error,
    })
  }

  const token = await ensureAccessToken({ db: input.db, fetchImpl, now })
  if (!token.accessToken) {
    const error = token.error ?? {
      code: 'youtube_credentials_incomplete',
      message: 'YouTube credentials are incomplete.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: publish.id,
      contentId: publish.content_id,
      videoId,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
    })
    return blockedResult({
      publishId: publish.id,
      contentId: publish.content_id,
      videoId,
      runId,
      error,
    })
  }

  const runId = await insertRun({
    db: input.db,
    publishId: publish.id,
    contentId: publish.content_id,
    videoId,
    status: 'running',
    cursorMetadata: { requestedLimit: limit, pageSize },
  })
  if (!runId) throw new Error('YouTube comment ingestion run insert did not return an id')

  const collected = await collectYouTubeComments({
    publish,
    videoId,
    runId,
    accessToken: token.accessToken,
    fetchImpl,
    limit,
    pageSize,
    now,
  })

  let upserted = 0
  if (collected.comments.length) {
    const upsert = await upsertSocialContentComments({
      db: input.db,
      comments: collected.comments,
    })
    upserted = upsert.upserted
  }

  const status: SocialCommentIngestionRunStatus = collected.errors.length
    ? (collected.comments.length ? 'partial' : 'failed')
    : 'succeeded'
  await completeRun({
    db: input.db,
    runId,
    status,
    cursorMetadata: collected.cursor,
    fetched: collected.comments.length,
    upserted,
    skipped: collected.skipped,
    errors: collected.errors,
    now,
  })

  return {
    platform: 'youtube',
    provider: YOUTUBE_PROVIDER,
    status,
    publishId: publish.id,
    contentId: publish.content_id,
    videoId,
    runId,
    fetched: collected.comments.length,
    upserted,
    skipped: collected.skipped,
    errors: collected.errors,
    cursor: collected.cursor,
  }
}
