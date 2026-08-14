import {
  buildSocialCommentIngestionRunInsert,
  upsertSocialContentComments,
  type NormalizedSocialCommentInput,
  type SocialCommentCapabilityStatus,
  type SocialCommentIngestionRunStatus,
  type SocialCommentProviderCapabilitySnapshot,
} from './social-comment-inbox'
import { X_TWEET_READ_SCOPE, X_USER_READ_SCOPE } from './x-oauth'
import {
  isXAccessTokenStale,
  refreshXOAuthCredentials,
  type XOAuthCredentials,
} from './x-oauth-refresh'

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

type XConfigRow = {
  credentials: XOAuthCredentials | null
  settings: Record<string, unknown> | null
  is_active: boolean
}

type CanonicalCapabilityRow = {
  capability_status: SocialCommentCapabilityStatus
  supports_comment_ingestion: boolean
  supports_reply_draft: boolean
  supports_reply_submission: boolean
  supports_permalink: boolean
  supports_author_profile: boolean
  supports_threading: boolean
  supports_cursor: boolean
  external_submission_enabled: boolean
  gate_notes: string
}

type XReferencedTweet = {
  type?: string
  id?: string
}

type XTweet = {
  id?: string
  text?: string
  author_id?: string
  conversation_id?: string
  created_at?: string
  in_reply_to_user_id?: string
  referenced_tweets?: XReferencedTweet[]
  public_metrics?: Record<string, number>
}

type XUser = {
  id?: string
  username?: string
  name?: string
  url?: string
  verified?: boolean
  profile_image_url?: string
}

type XApiErrorPayload = {
  title?: string
  detail?: string
  type?: string
  status?: number
  reason?: string
  errors?: Array<{
    title?: string
    detail?: string
    type?: string
    status?: number
    parameter?: string
    value?: string
  }>
}

type XSearchRecentResponse = XApiErrorPayload & {
  data?: XTweet[]
  includes?: {
    users?: XUser[]
  }
  meta?: {
    newest_id?: string
    oldest_id?: string
    result_count?: number
    next_token?: string
  }
}

export type XCommentIngestionError = {
  code: string
  message: string
  status?: number
  providerType?: string
}

export type XCommentRefreshResult = {
  platform: 'x'
  provider: 'x_api'
  status: SocialCommentIngestionRunStatus
  publishId: string | null
  contentId: string | null
  postId: string | null
  runId: string | null
  fetched: number
  upserted: number
  skipped: number
  errors: XCommentIngestionError[]
  cursor: Record<string, unknown>
  blockedReason?: string
}

export type XCommentRefreshInput = {
  db: SupabaseClientLike
  publishId?: string | null
  contentId?: string | null
  limit?: number
  pageSize?: number
  fetchImpl?: FetchLike
  now?: () => Date
}

const X_PROVIDER = 'x_api'
const X_SEARCH_RECENT_URL = 'https://api.x.com/2/tweets/search/recent'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const X_POST_ID_PATTERN = /^[0-9]{5,30}$/
const REQUIRED_SCOPES = [X_TWEET_READ_SCOPE, X_USER_READ_SCOPE]

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function scopeSet(scope: string | null | undefined) {
  return new Set((scope ?? '').split(/[,\s]+/).filter(Boolean))
}

function missingScopes(credentials: XOAuthCredentials) {
  const scopes = scopeSet(credentials.scope)
  return REQUIRED_SCOPES.filter((scope) => !scopes.has(scope))
}

function canonicalCapabilitySnapshot(row: CanonicalCapabilityRow | null): SocialCommentProviderCapabilitySnapshot | null {
  if (!row) return null
  return {
    capability_status: row.capability_status,
    supports_comment_ingestion: row.supports_comment_ingestion,
    supports_reply_draft: row.supports_reply_draft,
    supports_reply_submission: row.supports_reply_submission,
    supports_permalink: row.supports_permalink,
    supports_author_profile: row.supports_author_profile,
    supports_threading: row.supports_threading,
    supports_cursor: row.supports_cursor,
    external_submission_enabled: row.external_submission_enabled,
    gate_notes: row.gate_notes,
  }
}

async function readCanonicalCapability(db: SupabaseClientLike) {
  const result = await db
    .from('social_comment_provider_capabilities')
    .select([
      'capability_status',
      'supports_comment_ingestion',
      'supports_reply_draft',
      'supports_reply_submission',
      'supports_permalink',
      'supports_author_profile',
      'supports_threading',
      'supports_cursor',
      'external_submission_enabled',
      'gate_notes',
    ].join(', '))
    .eq('platform', 'x')
    .maybeSingle()

  if (result.error) return { capability: null, error: 'canonical_capability_lookup_failed' }
  return { capability: canonicalCapabilitySnapshot(result.data as CanonicalCapabilityRow | null), error: null }
}

async function readPublish(input: XCommentRefreshInput): Promise<{ row: PublishRow | null; error?: string }> {
  const publishId = asString(input.publishId)
  const contentId = asString(input.contentId)

  if (publishId && !isUuid(publishId)) return { row: null, error: 'invalid_selected_publish_id' }
  if (contentId && !isUuid(contentId)) return { row: null, error: 'invalid_selected_content_id' }
  if (!publishId && !contentId) return { row: null, error: 'no_selected_publish' }

  let query = input.db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, published_at')
    .eq('platform', 'x')
    .eq('status', 'published')
    .limit(1)

  if (publishId) {
    query = query.eq('id', publishId)
  } else {
    query = query.eq('content_id', contentId)
  }

  const result = await query.maybeSingle()
  if (result.error) throw new Error(result.error.message)
  return { row: result.data as PublishRow | null }
}

async function readXConfig(db: SupabaseClientLike): Promise<XConfigRow | null> {
  const result = await db
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'x')
    .maybeSingle()

  if (result.error) throw new Error(result.error.message)
  return result.data as XConfigRow | null
}

export function extractXPostId(input: {
  platformPostId?: string | null
  platformPostUrl?: string | null
}) {
  const direct = asString(input.platformPostId)
  if (direct && X_POST_ID_PATTERN.test(direct)) return direct

  const url = asString(input.platformPostUrl)
  if (!url) return null

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'x.com' && host !== 'twitter.com') return null
    const candidate = parsed.pathname.match(/\/[^/]+\/status\/([0-9]+)/)?.[1] ?? null
    return candidate && X_POST_ID_PATTERN.test(candidate) ? candidate : null
  } catch {
    return null
  }
}

function postUrl(handle: string | null, postId: string) {
  const safeHandle = normalizeHandle(handle)
  return safeHandle
    ? `https://x.com/${encodeURIComponent(safeHandle)}/status/${encodeURIComponent(postId)}`
    : `https://x.com/i/web/status/${encodeURIComponent(postId)}`
}

function normalizeHandle(value: string | null | undefined) {
  return asString(value)?.replace(/^@/, '').toLowerCase() ?? null
}

function connectedHandle(config: XConfigRow | null) {
  return normalizeHandle(asString(config?.settings?.profile_handle))
}

function mapXApiError(response: Response, data: XApiErrorPayload): XCommentIngestionError {
  const first = data.errors?.[0]
  const providerStatus = first?.status ?? data.status ?? response.status
  const providerType = first?.type ?? data.type
  let code = 'x_api_error'
  let message = `X API conversation read failed (${response.status}).`
  const text = [data.title, data.detail, first?.title, first?.detail, providerType].filter(Boolean).join(' ').toLowerCase()

  if (response.status === 401 || text.includes('unauthorized') || text.includes('invalid token')) {
    code = 'token_expired'
    message = 'X access token is expired or invalid; reconnect X before refreshing comments.'
  } else if (response.status === 403) {
    code = text.includes('client') || text.includes('access') || text.includes('product') || text.includes('tier')
      ? 'x_access_tier_blocked'
      : 'insufficient_scope'
    message = code === 'x_access_tier_blocked'
      ? 'X API access tier blocked recent conversation search; verify app access before refreshing comments.'
      : 'X API denied conversation read access; verify tweet.read and users.read OAuth scopes.'
  } else if (response.status === 429) {
    code = 'rate_limited'
    message = 'X API rate limits blocked this comment refresh.'
  } else if (response.status === 404 || text.includes('not found') || text.includes('deleted') || text.includes('unavailable')) {
    code = 'post_unavailable'
    message = 'X post is deleted, unavailable, private, or not visible to the connected account.'
  } else if (response.status === 400) {
    code = 'x_query_rejected'
    message = 'X API rejected the conversation search query.'
  }

  return {
    code,
    message,
    status: providerStatus,
    providerType,
  }
}

async function fetchJson<T>(input: {
  fetchImpl: FetchLike
  url: URL
  accessToken: string
}): Promise<{ data?: T; error?: XCommentIngestionError }> {
  let response: Response
  try {
    response = await input.fetchImpl(input.url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: 'application/json',
      },
    })
  } catch {
    return {
      error: {
        code: 'x_network_error',
        message: 'X API conversation read failed before a response was received.',
      },
    }
  }

  const data = await response.json().catch(() => ({})) as T & XApiErrorPayload
  if (!response.ok) return { error: mapXApiError(response, data) }
  return { data }
}

function searchRecentUrl(input: {
  rootPostId: string
  pageSize: number
  nextToken?: string | null
}) {
  const url = new URL(X_SEARCH_RECENT_URL)
  url.searchParams.set('query', `conversation_id:${input.rootPostId}`)
  url.searchParams.set('max_results', String(input.pageSize))
  url.searchParams.set('tweet.fields', [
    'id',
    'text',
    'author_id',
    'conversation_id',
    'created_at',
    'in_reply_to_user_id',
    'referenced_tweets',
    'public_metrics',
  ].join(','))
  url.searchParams.set('expansions', 'author_id')
  url.searchParams.set('user.fields', [
    'id',
    'username',
    'name',
    'url',
    'verified',
    'profile_image_url',
  ].join(','))
  if (input.nextToken) url.searchParams.set('next_token', input.nextToken)
  return url
}

function parentTweetId(tweet: XTweet) {
  return asString(tweet.referenced_tweets?.find((reference) => reference.type === 'replied_to')?.id)
}

function isConnectedAccountTweet(input: {
  tweet: XTweet
  user: XUser | null
  ownerUserId: string | null
  ownerHandle: string | null
}) {
  const authorId = asString(input.tweet.author_id)
  if (authorId && input.ownerUserId && authorId === input.ownerUserId) return true

  const username = normalizeHandle(input.user?.username)
  return Boolean(username && input.ownerHandle && username === input.ownerHandle)
}

function mapTweet(input: {
  publish: PublishRow
  rootPostId: string
  runId: string
  providerCapability: SocialCommentProviderCapabilitySnapshot
  tweet: XTweet
  user: XUser | null
  fallbackHandle: string | null
  ownerUserId: string | null
  ownerHandle: string | null
  now: Date
}): NormalizedSocialCommentInput | null {
  const id = asString(input.tweet.id)
  const body = asString(input.tweet.text)
  if (!id || !body || id === input.rootPostId) return null
  if (isConnectedAccountTweet({
    tweet: input.tweet,
    user: input.user,
    ownerUserId: input.ownerUserId,
    ownerHandle: input.ownerHandle,
  })) return null

  const username = asString(input.user?.username)
  const authorId = asString(input.tweet.author_id)
  const parentId = parentTweetId(input.tweet)
  const isNestedReply = Boolean(parentId && parentId !== input.rootPostId)

  return {
    publishId: input.publish.id,
    contentId: input.publish.content_id,
    platform: 'x',
    provider: X_PROVIDER,
    providerCommentId: id,
    providerParentCommentId: parentId ?? input.rootPostId,
    threadId: input.rootPostId,
    recordType: isNestedReply ? 'reply' : 'comment',
    authorPublicHandle: username ?? authorId,
    authorDisplayName: asString(input.user?.name) ?? username ?? authorId,
    authorProfileUrl: username ? `https://x.com/${username}` : null,
    body,
    commentUrl: postUrl(username ?? input.fallbackHandle, id),
    providerCreatedAt: asString(input.tweet.created_at),
    capturedAt: input.now.toISOString(),
    status: 'visible',
    providerCapability: input.providerCapability,
    ingestionRunId: input.runId,
    rawPayload: {
      source: X_PROVIDER,
      tweet: input.tweet,
      user: input.user ?? undefined,
    },
    metadata: {
      x: {
        root_post_id: input.rootPostId,
        conversation_id: input.tweet.conversation_id ?? null,
        parent_tweet_id: parentId,
        in_reply_to_user_id: input.tweet.in_reply_to_user_id ?? null,
        public_metrics: input.tweet.public_metrics ?? {},
        external_submission_enabled: false,
      },
    },
  }
}

function pageCap(limit: number, pageSize: number) {
  return Math.max(1, Math.ceil(limit / Math.max(pageSize, 1)) + 1)
}

function paginationError(code: 'pagination_stalled' | 'pagination_limit', message: string): XCommentIngestionError {
  return { code, message }
}

async function collectXComments(input: {
  publish: PublishRow
  rootPostId: string
  runId: string
  accessToken: string
  providerCapability: SocialCommentProviderCapabilitySnapshot
  fetchImpl: FetchLike
  limit: number
  pageSize: number
  fallbackHandle: string | null
  ownerUserId: string | null
  ownerHandle: string | null
  now: Date
}) {
  const comments: NormalizedSocialCommentInput[] = []
  const errors: XCommentIngestionError[] = []
  const cursor: Record<string, unknown> = { pages: 0, nextToken: null, limitReached: false }
  const seenTokens = new Set<string>()
  const maxPages = pageCap(input.limit, input.pageSize)
  let nextToken: string | null = null
  let skipped = 0
  let rootExcluded = 0
  let ownerExcluded = 0

  while (comments.length < input.limit) {
    if (nextToken) {
      if (seenTokens.has(nextToken)) {
        errors.push(paginationError('pagination_stalled', 'X recent-search pagination returned a repeated cursor; refresh stopped before retrying the same page.'))
        break
      }
      seenTokens.add(nextToken)
    }
    if (Number(cursor.pages) >= maxPages) {
      errors.push(paginationError('pagination_limit', 'X recent-search pagination reached the bounded page limit before the provider cursor was exhausted.'))
      break
    }

    const result: { data?: XSearchRecentResponse; error?: XCommentIngestionError } = await fetchJson<XSearchRecentResponse>({
      fetchImpl: input.fetchImpl,
      accessToken: input.accessToken,
      url: searchRecentUrl({
        rootPostId: input.rootPostId,
        pageSize: input.pageSize,
        nextToken,
      }),
    })
    cursor.pages = Number(cursor.pages) + 1
    if (result.error) {
      errors.push(result.error)
      break
    }

    const users = (result.data?.includes?.users ?? []) as XUser[]
    const usersById = new Map(users
      .filter((user) => asString(user.id))
      .map((user) => [asString(user.id) as string, user]))
    const pageItems: XTweet[] = result.data?.data ?? []

    for (const tweet of pageItems) {
      const user = asString(tweet.author_id) ? usersById.get(asString(tweet.author_id) as string) ?? null : null
      const tweetId = asString(tweet.id)
      if (tweetId === input.rootPostId) {
        skipped += 1
        rootExcluded += 1
        continue
      }
      if (isConnectedAccountTweet({
        tweet,
        user,
        ownerUserId: input.ownerUserId,
        ownerHandle: input.ownerHandle,
      })) {
        skipped += 1
        ownerExcluded += 1
        continue
      }
      const mapped = mapTweet({
        publish: input.publish,
        rootPostId: input.rootPostId,
        runId: input.runId,
        providerCapability: input.providerCapability,
        tweet,
        user,
        fallbackHandle: input.fallbackHandle,
        ownerUserId: input.ownerUserId,
        ownerHandle: input.ownerHandle,
        now: input.now,
      })
      if (mapped) {
        comments.push(mapped)
      } else {
        skipped += 1
      }
      if (comments.length >= input.limit) break
    }

    const providerNextToken: string | null = result.data?.meta?.next_token ?? null
    nextToken = comments.length >= input.limit ? null : providerNextToken
    cursor.nextToken = providerNextToken
    cursor.limitReached = comments.length >= input.limit
    cursor.rootExcludedCount = rootExcluded
    cursor.ownerExcludedCount = ownerExcluded

    if (comments.length >= input.limit || !providerNextToken) break
    if (pageItems.length === 0) {
      errors.push(paginationError('pagination_stalled', 'X recent-search pagination returned an empty page with a continuation cursor; refresh stopped to avoid looping.'))
      break
    }
    if (seenTokens.has(providerNextToken)) {
      errors.push(paginationError('pagination_stalled', 'X recent-search pagination returned a repeated cursor; refresh stopped before retrying the same page.'))
      break
    }
    if (Number(cursor.pages) >= maxPages) {
      errors.push(paginationError('pagination_limit', 'X recent-search pagination reached the bounded page limit before the provider cursor was exhausted.'))
      break
    }
  }

  return {
    comments: comments.slice(0, input.limit),
    errors,
    cursor,
    skipped: skipped + Math.max(0, comments.length - input.limit),
  }
}

async function insertRun(input: {
  db: SupabaseClientLike
  publishId: string | null
  contentId: string | null
  postId: string | null
  status: SocialCommentIngestionRunStatus
  cursorMetadata?: Record<string, unknown>
  counts?: Parameters<typeof buildSocialCommentIngestionRunInsert>[0]['counts']
  errors?: XCommentIngestionError[]
  metadata?: Record<string, unknown>
}) {
  const result = await input.db
    .from('social_comment_ingestion_runs')
    .insert(buildSocialCommentIngestionRunInsert({
      platform: 'x',
      provider: X_PROVIDER,
      publishId: input.publishId,
      contentId: input.contentId,
      status: input.status,
      cursorMetadata: input.cursorMetadata,
      counts: input.counts,
      errors: input.errors,
      metadata: {
        source: 'x_comment_ingestion',
        post_id: input.postId,
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
  errors: XCommentIngestionError[]
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

function blockedResult(input: {
  publishId: string | null
  contentId: string | null
  postId: string | null
  runId: string | null
  error: XCommentIngestionError
}): XCommentRefreshResult {
  return {
    platform: 'x',
    provider: X_PROVIDER,
    status: 'manual_blocked',
    publishId: input.publishId,
    contentId: input.contentId,
    postId: input.postId,
    runId: input.runId,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: [input.error],
    cursor: {},
    blockedReason: input.error.message,
  }
}

function ingestionStatus(input: {
  fetched: number
  errors: XCommentIngestionError[]
}): SocialCommentIngestionRunStatus {
  if (!input.errors.length) return 'succeeded'
  if (input.fetched > 0) return 'partial'

  const recoverableManualCodes = new Set([
    'token_expired',
    'token_freshness_unverified',
    'x_credentials_incomplete',
    'x_refresh_token_missing',
    'x_oauth_client_config_missing',
    'x_token_refresh_failed',
    'x_token_refresh_persist_failed',
    'x_token_refresh_concurrent_update',
    'insufficient_scope',
    'x_access_tier_blocked',
    'rate_limited',
    'post_unavailable',
  ])
  return input.errors.every((error) => recoverableManualCodes.has(error.code))
    ? 'manual_blocked'
    : 'failed'
}

function sanitizedUnexpectedError(): XCommentIngestionError {
  return {
    code: 'x_comment_ingestion_failed',
    message: 'X comment ingestion failed unexpectedly.',
  }
}

export async function refreshPublishedXComments(input: XCommentRefreshInput): Promise<XCommentRefreshResult> {
  const now = input.now?.() ?? new Date()
  const fetchImpl = input.fetchImpl ?? fetch
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  const pageSize = Math.min(Math.max(input.pageSize ?? 100, 10), 100)
  const selectedPublishId = asString(input.publishId)
  const selectedContentId = asString(input.contentId)
  const publishLookup = await readPublish(input)

  if (!publishLookup.row) {
    const invalidSelection = publishLookup.error === 'invalid_selected_publish_id'
      || publishLookup.error === 'invalid_selected_content_id'
    const error: XCommentIngestionError = {
      code: publishLookup.error ?? 'no_eligible_published_x_row',
      message: invalidSelection
        ? 'Selected X row id is malformed; choose a canonical published X row before refreshing comments.'
        : 'No eligible published X row with a canonical provider post ID was selected; reconcile publication first.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: null,
      contentId: null,
      postId: null,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: {
        recovery: 'reconcile_x_publication',
        requested_publish_id: selectedPublishId,
        requested_content_id: selectedContentId,
      },
    })
    return blockedResult({
      publishId: selectedPublishId,
      contentId: selectedContentId,
      postId: null,
      runId,
      error,
    })
  }

  const publish = publishLookup.row
  const postId = extractXPostId({
    platformPostId: publish.platform_post_id,
    platformPostUrl: publish.platform_post_url,
  })

  if (!postId) {
    const error: XCommentIngestionError = {
      code: 'malformed_provider_post_id',
      message: 'Published X row is missing a canonical provider post ID; reconcile publication first.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: publish.id,
      contentId: publish.content_id,
      postId: null,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: { recovery: 'reconcile_x_publication' },
    })
    return blockedResult({
      publishId: publish.id,
      contentId: publish.content_id,
      postId: null,
      runId,
      error,
    })
  }

  const capabilityLookup = await readCanonicalCapability(input.db)
  const capability = capabilityLookup.capability
  if (capabilityLookup.error || !capability?.supports_comment_ingestion || capability.capability_status !== 'verified') {
    const error: XCommentIngestionError = {
      code: capabilityLookup.error ?? 'x_comment_ingestion_capability_blocked',
      message: 'Canonical X comment ingestion capability is not verified or enabled; complete a read-only X scope smoke before refreshing comments.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: {
        recovery: 'verify_x_comment_ingestion_capability',
        capability_status: capability?.capability_status ?? null,
        supports_comment_ingestion: capability?.supports_comment_ingestion ?? false,
      },
    })
    return blockedResult({
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      runId,
      error,
    })
  }

  const config = await readXConfig(input.db)
  let credentials = config?.credentials ?? null
  if (!config?.is_active || !credentials || (!asString(credentials.access_token) && !asString(credentials.refresh_token))) {
    const error: XCommentIngestionError = {
      code: 'x_not_connected',
      message: 'X provider is not connected or active; reconnect X before refreshing comments.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
    })
    return blockedResult({
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      runId,
      error,
    })
  }

  const missing = missingScopes(credentials)
  if (missing.length) {
    const error: XCommentIngestionError = {
      code: 'insufficient_scope',
      message: 'Stored X OAuth evidence is missing tweet.read or users.read; reconnect X before refreshing comments.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: { missing_scopes: missing },
    })
    return blockedResult({
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      runId,
      error,
    })
  }

  let accessToken = asString(credentials.access_token)
  if (!accessToken || isXAccessTokenStale({
    credentials,
    now,
    missingMetadataIsStale: true,
  })) {
    const refresh = await refreshXOAuthCredentials({
      db: input.db,
      credentials,
      fetchImpl,
      now,
    })
    if (!refresh.refreshed || refresh.error) {
      const error: XCommentIngestionError = {
        code: refresh.error?.code ?? 'token_expired',
        message: refresh.error?.message ?? 'Stored X access token is expired or stale; reconnect X before refreshing comments.',
        status: refresh.error?.status,
      }
      const runId = await insertRun({
        db: input.db,
        publishId: publish.id,
        contentId: publish.content_id,
        postId,
        status: 'manual_blocked',
        errors: [error],
        counts: { error_count: 1 },
        metadata: { recovery: 'reconnect_x_or_restore_refresh_configuration' },
      })
      return blockedResult({
        publishId: publish.id,
        contentId: publish.content_id,
        postId,
        runId,
        error,
      })
    }

    credentials = refresh.credentials
    accessToken = asString(credentials.access_token)
  }

  if (!accessToken) {
    const error: XCommentIngestionError = {
      code: 'x_credentials_incomplete',
      message: 'X credentials are missing a user access token after refresh; reconnect X before refreshing comments.',
    }
    const runId = await insertRun({
      db: input.db,
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: { recovery: 'reconnect_x' },
    })
    return blockedResult({
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      runId,
      error,
    })
  }

  const runId = await insertRun({
    db: input.db,
    publishId: publish.id,
    contentId: publish.content_id,
    postId,
    status: 'running',
    cursorMetadata: { requestedLimit: limit, pageSize },
  })
  if (!runId) throw new Error('X comment ingestion run insert did not return an id')

  try {
    const collected = await collectXComments({
      publish,
      rootPostId: postId,
      runId,
      accessToken,
      providerCapability: capability,
      fetchImpl,
      limit,
      pageSize,
      fallbackHandle: connectedHandle(config),
      ownerUserId: asString(credentials.user_id),
      ownerHandle: connectedHandle(config),
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

    const status = ingestionStatus({
      fetched: collected.comments.length,
      errors: collected.errors,
    })
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
      platform: 'x',
      provider: X_PROVIDER,
      status,
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      runId,
      fetched: collected.comments.length,
      upserted,
      skipped: collected.skipped,
      errors: collected.errors,
      cursor: collected.cursor,
      blockedReason: status === 'manual_blocked'
        ? collected.errors.map((error) => error.message).join(' ')
        : undefined,
    }
  } catch {
    const error = sanitizedUnexpectedError()
    await completeRun({
      db: input.db,
      runId,
      status: 'failed',
      cursorMetadata: { failed: true },
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: [error],
      now,
    })

    return {
      platform: 'x',
      provider: X_PROVIDER,
      status: 'failed',
      publishId: publish.id,
      contentId: publish.content_id,
      postId,
      runId,
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: [error],
      cursor: { failed: true },
    }
  }
}
