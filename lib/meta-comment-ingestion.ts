import {
  buildSocialCommentIngestionRunInsert,
  upsertSocialContentComments,
  type NormalizedSocialCommentInput,
  type SocialCommentCapabilityStatus,
  type SocialCommentIngestionRunStatus,
  type SocialCommentProviderCapabilitySnapshot,
} from './social-comment-inbox'
import { META_GRAPH_API_VERSION } from './meta-oauth'
import type { SocialPlatform } from './social-content'

type MetaCommentPlatform = Extract<SocialPlatform, 'facebook' | 'instagram'>

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

type MetaCredentials = {
  access_token?: string
  page_access_token?: string
  user_access_token?: string
  expires_in?: number | null
  token_obtained_at?: string | null
  scope?: string | null
}

type MetaConfigRow = {
  credentials: MetaCredentials | null
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

type MetaGraphError = {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
  }
}

type MetaPaging = {
  cursors?: {
    before?: string
    after?: string
  }
  next?: string
}

type MetaComment = {
  id?: string
  message?: string
  text?: string
  created_time?: string
  timestamp?: string
  from?: {
    id?: string
    name?: string
    link?: string
  }
  username?: string
  permalink_url?: string
  parent?: { id?: string }
  parent_id?: string
  is_hidden?: boolean
  hidden?: boolean
  is_private?: boolean
  comments?: {
    data?: MetaComment[]
    paging?: MetaPaging
  }
  replies?: {
    data?: MetaComment[]
    paging?: MetaPaging
  }
}

type MetaCommentsResponse = MetaGraphError & {
  data?: MetaComment[]
  paging?: MetaPaging
}

export type MetaCommentIngestionError = {
  code: string
  message: string
  status?: number
  providerCode?: number
  providerType?: string
}

export type MetaCommentRefreshResult = {
  platform: MetaCommentPlatform
  provider: 'meta_graph'
  status: SocialCommentIngestionRunStatus
  publishId: string | null
  contentId: string | null
  objectId: string | null
  runId: string | null
  fetched: number
  upserted: number
  skipped: number
  errors: MetaCommentIngestionError[]
  cursor: Record<string, unknown>
  blockedReason?: string
}

export type MetaCommentRefreshInput = {
  db: SupabaseClientLike
  platform: MetaCommentPlatform
  publishId?: string | null
  contentId?: string | null
  limit?: number
  pageSize?: number
  fetchImpl?: FetchLike
  now?: () => Date
}

const META_PROVIDER = 'meta_graph'
const GRAPH_BASE_URL = 'https://graph.facebook.com'
const META_OBJECT_ID_PATTERN = /^[A-Za-z0-9_:-]{3,256}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FACEBOOK_REQUIRED_SCOPES = ['pages_read_engagement']
const INSTAGRAM_REQUIRED_SCOPES = ['instagram_basic', 'instagram_manage_comments']

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function scopeSet(scope: string | null | undefined) {
  return new Set((scope ?? '').split(/[,\s]+/).filter(Boolean))
}

function missingScopes(credentials: MetaCredentials, required: string[]) {
  if (!credentials.scope) return []
  const scopes = scopeSet(credentials.scope)
  return required.filter((scope) => !scopes.has(scope))
}

function tokenExpired(credentials: MetaCredentials, now: Date, bufferMs = 10 * 60 * 1000) {
  if (!credentials.token_obtained_at || typeof credentials.expires_in !== 'number' || !Number.isFinite(credentials.expires_in) || credentials.expires_in <= 0) {
    return false
  }
  const obtained = new Date(credentials.token_obtained_at).getTime()
  if (Number.isNaN(obtained)) return true
  return now.getTime() + bufferMs >= obtained + credentials.expires_in * 1000
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

async function readCanonicalCapability(db: SupabaseClientLike, platform: MetaCommentPlatform) {
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
    .eq('platform', platform)
    .maybeSingle()

  if (result.error) return { capability: null, error: 'canonical_capability_lookup_failed' }
  return { capability: canonicalCapabilitySnapshot(result.data as CanonicalCapabilityRow | null), error: null }
}

async function readPublish(input: MetaCommentRefreshInput): Promise<{ row: PublishRow | null; error?: string }> {
  const publishId = asString(input.publishId)
  const contentId = asString(input.contentId)

  if (publishId && !isUuid(publishId)) {
    return { row: null, error: 'invalid_selected_publish_id' }
  }

  if (contentId && !isUuid(contentId)) {
    return { row: null, error: 'invalid_selected_content_id' }
  }

  if (!publishId && !contentId) {
    return { row: null, error: 'no_selected_publish' }
  }

  let query = input.db
    .from('social_content_publishes')
    .select('id, content_id, platform, status, platform_post_id, platform_post_url, published_at')
    .eq('platform', input.platform)
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

async function readMetaConfig(db: SupabaseClientLike, platform: MetaCommentPlatform): Promise<MetaConfigRow | null> {
  const result = await db
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', platform)
    .maybeSingle()

  if (result.error) throw new Error(result.error.message)
  return result.data as MetaConfigRow | null
}

function graphApiVersion(config: MetaConfigRow | null) {
  return asString(config?.settings?.graph_api_version) ?? META_GRAPH_API_VERSION
}

function providerObjectId(publish: PublishRow) {
  const candidate = asString(publish.platform_post_id)
  return candidate && META_OBJECT_ID_PATTERN.test(candidate) ? candidate : null
}

function accessToken(config: MetaConfigRow | null, platform: MetaCommentPlatform) {
  const credentials = config?.credentials
  if (!credentials) return null
  if (platform === 'facebook') {
    return asString(credentials.page_access_token) ?? asString(credentials.access_token)
  }
  return asString(credentials.access_token) ?? asString(credentials.page_access_token) ?? asString(credentials.user_access_token)
}

function localScopeError(platform: MetaCommentPlatform, config: MetaConfigRow, now: Date): MetaCommentIngestionError | null {
  const credentials = config.credentials ?? {}
  if (tokenExpired(credentials, now)) {
    return {
      code: 'token_expired',
      message: 'Stored Meta access token is expired; reconnect Meta before refreshing comments.',
    }
  }

  const required = platform === 'facebook' ? FACEBOOK_REQUIRED_SCOPES : INSTAGRAM_REQUIRED_SCOPES
  const missing = missingScopes(credentials, required)
  const instagramBasicConfirmed = platform === 'instagram'
    ? asBoolean(config.settings?.instagram_basic_permission)
    : null

  if (missing.length || instagramBasicConfirmed === false) {
    return {
      code: 'insufficient_scope',
      message: platform === 'instagram'
        ? 'Stored Instagram OAuth evidence is missing instagram_basic or instagram_manage_comments; reconnect Meta before refreshing Instagram comments.'
        : 'Stored Facebook OAuth evidence is missing pages_read_engagement; reconnect Meta before refreshing Facebook comments.',
    }
  }

  return null
}

function mapMetaApiError(response: Response, data: MetaGraphError): MetaCommentIngestionError {
  const code = data.error?.code
  const type = data.error?.type
  let normalized = 'meta_api_error'
  let message = `Meta Graph API comment read failed (${response.status}).`

  if (response.status === 401 || code === 190) {
    normalized = 'token_expired'
    message = 'Meta access token is expired or invalid; reconnect Meta before refreshing comments.'
  } else if (response.status === 403 || code === 10 || code === 200) {
    normalized = 'insufficient_scope'
    message = 'Meta Graph API denied comment read access; verify Page tasks and required OAuth permissions.'
  } else if (response.status === 429 || code === 4 || code === 17 || code === 32) {
    normalized = 'rate_limited'
    message = 'Meta Graph API rate or quota limits blocked this comment refresh.'
  } else if (response.status === 404 || code === 100 || code === 803) {
    normalized = 'object_unavailable'
    message = 'Meta post or media object is deleted, hidden, private, or unavailable to the connected account.'
  }

  return {
    code: normalized,
    message,
    status: response.status,
    providerCode: code,
    providerType: type,
  }
}

function paginationError(code: 'pagination_stalled' | 'pagination_limit', message: string): MetaCommentIngestionError {
  return { code, message }
}

function pageCap(limit: number, pageSize: number) {
  return Math.max(1, Math.ceil(limit / Math.max(pageSize, 1)) + 1)
}

async function insertRun(input: {
  db: SupabaseClientLike
  platform: MetaCommentPlatform
  publishId: string | null
  contentId: string | null
  objectId: string | null
  status: SocialCommentIngestionRunStatus
  cursorMetadata?: Record<string, unknown>
  counts?: Parameters<typeof buildSocialCommentIngestionRunInsert>[0]['counts']
  errors?: MetaCommentIngestionError[]
  metadata?: Record<string, unknown>
}) {
  const result = await input.db
    .from('social_comment_ingestion_runs')
    .insert(buildSocialCommentIngestionRunInsert({
      platform: input.platform,
      provider: META_PROVIDER,
      publishId: input.publishId,
      contentId: input.contentId,
      status: input.status,
      cursorMetadata: input.cursorMetadata,
      counts: input.counts,
      errors: input.errors,
      metadata: {
        source: 'meta_comment_ingestion',
        object_id: input.objectId,
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
  errors: MetaCommentIngestionError[]
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
  platform: MetaCommentPlatform
  publishId: string | null
  contentId: string | null
  objectId: string | null
  runId: string | null
  error: MetaCommentIngestionError
}): MetaCommentRefreshResult {
  return {
    platform: input.platform,
    provider: META_PROVIDER,
    status: 'manual_blocked',
    publishId: input.publishId,
    contentId: input.contentId,
    objectId: input.objectId,
    runId: input.runId,
    fetched: 0,
    upserted: 0,
    skipped: 0,
    errors: [input.error],
    cursor: {},
    blockedReason: input.error.message,
  }
}

function sanitizedUnexpectedError(): MetaCommentIngestionError {
  return {
    code: 'meta_comment_ingestion_failed',
    message: 'Meta comment ingestion failed unexpectedly.',
  }
}

function statusForComment(comment: MetaComment) {
  if (comment.is_hidden === true || comment.hidden === true || comment.is_private === true) return 'hidden'
  return 'visible'
}

function commentBody(comment: MetaComment) {
  return asString(comment.message) ?? asString(comment.text)
}

function commentCreatedAt(comment: MetaComment) {
  return asString(comment.created_time) ?? asString(comment.timestamp)
}

function commentAuthor(input: { platform: MetaCommentPlatform; comment: MetaComment }) {
  if (input.platform === 'instagram') {
    return {
      handle: asString(input.comment.username),
      name: asString(input.comment.username),
      profileUrl: null,
    }
  }

  return {
    handle: asString(input.comment.from?.id),
    name: asString(input.comment.from?.name),
    profileUrl: asString(input.comment.from?.link),
  }
}

function childComments(comment: MetaComment) {
  return comment.comments?.data ?? comment.replies?.data ?? []
}

function childPaging(comment: MetaComment) {
  return comment.comments?.paging ?? comment.replies?.paging ?? null
}

function mapComment(input: {
  publish: PublishRow
  objectId: string
  runId: string
  providerCapability: SocialCommentProviderCapabilitySnapshot
  platform: MetaCommentPlatform
  comment: MetaComment
  recordType: 'comment' | 'reply'
  providerParentCommentId?: string
  threadId: string
  now: Date
}): NormalizedSocialCommentInput | null {
  const id = asString(input.comment.id)
  const body = commentBody(input.comment)
  if (!id || !body) return null

  const author = commentAuthor({ platform: input.platform, comment: input.comment })

  return {
    publishId: input.publish.id,
    contentId: input.publish.content_id,
    platform: input.platform,
    provider: META_PROVIDER,
    providerCommentId: id,
    providerParentCommentId: input.providerParentCommentId,
    threadId: input.threadId,
    recordType: input.recordType,
    authorPublicHandle: author.handle,
    authorDisplayName: author.name,
    authorProfileUrl: author.profileUrl,
    body,
    commentUrl: asString(input.comment.permalink_url),
    providerCreatedAt: commentCreatedAt(input.comment),
    capturedAt: input.now.toISOString(),
    status: statusForComment(input.comment),
    providerCapability: input.providerCapability,
    ingestionRunId: input.runId,
    rawPayload: {
      source: 'meta_graph',
      platform: input.platform,
      object_id: input.objectId,
      comment: input.comment,
    },
    metadata: {
      meta: {
        object_id: input.objectId,
        thread_id: input.threadId,
        provider_parent_comment_id: input.providerParentCommentId ?? null,
        child_cursor_after: childPaging(input.comment)?.cursors?.after ?? null,
        external_submission_enabled: false,
      },
    },
  }
}

function commentsUrl(input: {
  apiVersion: string
  objectId: string
  platform: MetaCommentPlatform
  pageSize: number
  after?: string | null
}) {
  const url = new URL(`${GRAPH_BASE_URL}/${input.apiVersion}/${encodeURIComponent(input.objectId)}/comments`)
  url.searchParams.set('limit', String(input.pageSize))
  if (input.platform === 'instagram') {
    url.searchParams.set('fields', [
      'id',
      'text',
      'timestamp',
      'username',
      'hidden',
      'parent_id',
      'replies{id,text,timestamp,username,hidden,parent_id}',
    ].join(','))
  } else {
    url.searchParams.set('fields', [
      'id',
      'message',
      'created_time',
      'from{id,name,link}',
      'permalink_url',
      'parent{id}',
      'is_hidden',
      'is_private',
      'comments{id,message,created_time,from{id,name,link},permalink_url,parent{id},is_hidden,is_private}',
    ].join(','))
  }
  if (input.after) url.searchParams.set('after', input.after)
  return url
}

function childRepliesUrl(input: {
  apiVersion: string
  parentCommentId: string
  platform: MetaCommentPlatform
  pageSize: number
  after?: string | null
}) {
  const edge = input.platform === 'instagram' ? 'replies' : 'comments'
  const url = new URL(`${GRAPH_BASE_URL}/${input.apiVersion}/${encodeURIComponent(input.parentCommentId)}/${edge}`)
  url.searchParams.set('limit', String(input.pageSize))
  url.searchParams.set('fields', input.platform === 'instagram'
    ? [
      'id',
      'text',
      'timestamp',
      'username',
      'hidden',
      'parent_id',
    ].join(',')
    : [
      'id',
      'message',
      'created_time',
      'from{id,name,link}',
      'permalink_url',
      'parent{id}',
      'is_hidden',
      'is_private',
    ].join(','))
  if (input.after) url.searchParams.set('after', input.after)
  return url
}

async function fetchJson<T>(input: {
  fetchImpl: FetchLike
  url: URL
  accessToken: string
}): Promise<{ data?: T; error?: MetaCommentIngestionError }> {
  let response: Response
  try {
    response = await input.fetchImpl(input.url.toString(), {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: 'application/json',
      },
    })
  } catch {
    return {
      error: {
        code: 'meta_network_error',
        message: 'Meta Graph API comment read failed before a response was received.',
      },
    }
  }

  const data = await response.json().catch(() => ({})) as T & MetaGraphError
  if (!response.ok) return { error: mapMetaApiError(response, data) }
  return { data }
}

async function fetchChildReplies(input: {
  fetchImpl: FetchLike
  accessToken: string
  apiVersion: string
  platform: MetaCommentPlatform
  parentCommentId: string
  inlineReplies: MetaComment[]
  inlinePaging: MetaPaging | null
  limit: number
  pageSize: number
  cursor: Record<string, unknown>
}) {
  const replies: MetaComment[] = input.inlineReplies.slice(0, Math.max(input.limit, 0))
  const errors: MetaCommentIngestionError[] = []
  const seenAfter = new Set<string>()
  const maxPages = pageCap(input.limit, input.pageSize)
  let after = input.inlinePaging?.cursors?.after ?? null
  let pages = 0

  if (input.limit <= 0) {
    input.cursor[`children:${input.parentCommentId}`] = {
      inlineCount: input.inlineReplies.length,
      pages,
      nextAfter: after,
      limitReached: true,
    }
    return { replies: [], errors }
  }

  while (after && replies.length < input.limit) {
    if (seenAfter.has(after)) {
      errors.push(paginationError(
        'pagination_stalled',
        'Meta child comment pagination returned a repeated cursor; refresh stopped before retrying the same page.',
      ))
      break
    }
    if (pages >= maxPages) {
      errors.push(paginationError(
        'pagination_limit',
        'Meta child comment pagination reached the bounded page limit before the provider cursor was exhausted.',
      ))
      break
    }

    seenAfter.add(after)
    const remaining = input.limit - replies.length
    const result: { data?: MetaCommentsResponse; error?: MetaCommentIngestionError } = await fetchJson<MetaCommentsResponse>({
      fetchImpl: input.fetchImpl,
      accessToken: input.accessToken,
      url: childRepliesUrl({
        apiVersion: input.apiVersion,
        parentCommentId: input.parentCommentId,
        platform: input.platform,
        pageSize: Math.min(input.pageSize, remaining),
        after,
      }),
    })
    pages += 1

    if (result.error) {
      errors.push(result.error)
      break
    }

    const pageItems = result.data?.data ?? []
    replies.push(...pageItems.slice(0, remaining))
    const providerNextAfter = result.data?.paging?.cursors?.after ?? null
    after = providerNextAfter

    if (providerNextAfter && pageItems.length === 0) {
      errors.push(paginationError(
        'pagination_stalled',
        'Meta child comment pagination returned an empty page with a continuation cursor; refresh stopped to avoid looping.',
      ))
      break
    }
    if (providerNextAfter && seenAfter.has(providerNextAfter)) {
      errors.push(paginationError(
        'pagination_stalled',
        'Meta child comment pagination returned a repeated cursor; refresh stopped before retrying the same page.',
      ))
      break
    }
    if (providerNextAfter && pages >= maxPages && replies.length < input.limit) {
      errors.push(paginationError(
        'pagination_limit',
        'Meta child comment pagination reached the bounded page limit before the provider cursor was exhausted.',
      ))
      break
    }
  }

  input.cursor[`children:${input.parentCommentId}`] = {
    inlineCount: input.inlineReplies.length,
    pages,
    nextAfter: after,
    limitReached: replies.length >= input.limit,
    paginationGuarded: errors.some((error) => error.code === 'pagination_stalled' || error.code === 'pagination_limit'),
  }
  return { replies: replies.slice(0, input.limit), errors }
}

async function collectMetaComments(input: {
  publish: PublishRow
  objectId: string
  runId: string
  accessToken: string
  providerCapability: SocialCommentProviderCapabilitySnapshot
  platform: MetaCommentPlatform
  apiVersion: string
  fetchImpl: FetchLike
  limit: number
  pageSize: number
  now: Date
}) {
  const comments: NormalizedSocialCommentInput[] = []
  const errors: MetaCommentIngestionError[] = []
  const cursor: Record<string, unknown> = { pages: 0, nextAfter: null, limitReached: false }
  const seenAfter = new Set<string>()
  const maxPages = pageCap(input.limit, input.pageSize)
  let after: string | null = null
  let skipped = 0

  while (comments.length < input.limit) {
    if (after) {
      if (seenAfter.has(after)) {
        errors.push(paginationError(
          'pagination_stalled',
          'Meta top-level comment pagination returned a repeated cursor; refresh stopped before retrying the same page.',
        ))
        break
      }
      seenAfter.add(after)
    }
    if (Number(cursor.pages) >= maxPages) {
      errors.push(paginationError(
        'pagination_limit',
        'Meta top-level comment pagination reached the bounded page limit before the provider cursor was exhausted.',
      ))
      break
    }

    const result: { data?: MetaCommentsResponse; error?: MetaCommentIngestionError } = await fetchJson<MetaCommentsResponse>({
      fetchImpl: input.fetchImpl,
      accessToken: input.accessToken,
      url: commentsUrl({
        apiVersion: input.apiVersion,
        objectId: input.objectId,
        platform: input.platform,
        pageSize: Math.min(input.pageSize, input.limit - comments.length),
        after,
      }),
    })
    cursor.pages = Number(cursor.pages) + 1
    if (result.error) {
      errors.push(result.error)
      break
    }

    const pageItems = result.data?.data ?? []
    for (const comment of pageItems) {
      const id = asString(comment.id)
      const mapped = id
        ? mapComment({
          publish: input.publish,
          objectId: input.objectId,
          runId: input.runId,
          providerCapability: input.providerCapability,
          platform: input.platform,
          comment,
          recordType: 'comment',
          threadId: id,
          now: input.now,
        })
        : null
      if (mapped) {
        comments.push(mapped)
      } else {
        skipped += 1
      }

      const replies = id
        ? await fetchChildReplies({
          fetchImpl: input.fetchImpl,
          accessToken: input.accessToken,
          apiVersion: input.apiVersion,
          platform: input.platform,
          parentCommentId: id,
          inlineReplies: childComments(comment),
          inlinePaging: childPaging(comment),
          limit: input.limit - comments.length,
          pageSize: input.pageSize,
          cursor,
        })
        : { replies: [], errors: [] }
      errors.push(...replies.errors)

      for (const reply of replies.replies) {
        if (comments.length >= input.limit) break
        const replyMapped = id
          ? mapComment({
            publish: input.publish,
            objectId: input.objectId,
            runId: input.runId,
            providerCapability: input.providerCapability,
            platform: input.platform,
            comment: reply,
            recordType: 'reply',
            providerParentCommentId: id,
            threadId: id,
            now: input.now,
          })
          : null
        if (replyMapped) {
          comments.push(replyMapped)
        } else {
          skipped += 1
        }
      }

      if (comments.length >= input.limit) break
    }

    const providerNextAfter: string | null = result.data?.paging?.cursors?.after ?? null
    after = comments.length >= input.limit ? null : providerNextAfter
    cursor.nextAfter = providerNextAfter
    cursor.limitReached = comments.length >= input.limit

    if (comments.length >= input.limit || !providerNextAfter) break
    if (pageItems.length === 0) {
      errors.push(paginationError(
        'pagination_stalled',
        'Meta top-level comment pagination returned an empty page with a continuation cursor; refresh stopped to avoid looping.',
      ))
      break
    }
    if (seenAfter.has(providerNextAfter)) {
      errors.push(paginationError(
        'pagination_stalled',
        'Meta top-level comment pagination returned a repeated cursor; refresh stopped before retrying the same page.',
      ))
      break
    }
    if (Number(cursor.pages) >= maxPages) {
      errors.push(paginationError(
        'pagination_limit',
        'Meta top-level comment pagination reached the bounded page limit before the provider cursor was exhausted.',
      ))
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

function ingestionStatus(input: {
  fetched: number
  errors: MetaCommentIngestionError[]
}): SocialCommentIngestionRunStatus {
  if (!input.errors.length) return 'succeeded'
  if (input.fetched > 0) return 'partial'

  const recoverableAuthCodes = new Set(['token_expired', 'insufficient_scope'])
  return input.errors.every((error) => recoverableAuthCodes.has(error.code))
    ? 'manual_blocked'
    : 'failed'
}

export async function refreshPublishedMetaComments(input: MetaCommentRefreshInput): Promise<MetaCommentRefreshResult> {
  const now = input.now?.() ?? new Date()
  const fetchImpl = input.fetchImpl ?? fetch
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 100)
  const selectedPublishId = asString(input.publishId)
  const selectedContentId = asString(input.contentId)
  const publishLookup = await readPublish(input)

  if (!publishLookup.row) {
    const invalidSelection = publishLookup.error === 'invalid_selected_publish_id'
      || publishLookup.error === 'invalid_selected_content_id'
    const error: MetaCommentIngestionError = {
      code: publishLookup.error ?? 'no_eligible_published_meta_row',
      message: invalidSelection
        ? 'Selected Meta row id is malformed; choose a canonical published Facebook or Instagram row before refreshing comments.'
        : 'No eligible published Meta row with a canonical provider post or media ID was selected; reconcile publication first.',
    }
    const runId = await insertRun({
      db: input.db,
      platform: input.platform,
      publishId: null,
      contentId: null,
      objectId: null,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: {
        recovery: 'reconcile_meta_publication',
        requested_publish_id: selectedPublishId,
        requested_content_id: selectedContentId,
      },
    })
    return blockedResult({
      platform: input.platform,
      publishId: selectedPublishId,
      contentId: selectedContentId,
      objectId: null,
      runId,
      error,
    })
  }

  const publish = publishLookup.row
  const objectId = providerObjectId(publish)
  if (!objectId) {
    const error: MetaCommentIngestionError = {
      code: 'malformed_provider_object_id',
      message: 'Published Meta row is missing a canonical provider post or media ID; reconcile publication first.',
    }
    const runId = await insertRun({
      db: input.db,
      platform: input.platform,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId: null,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: { recovery: 'reconcile_meta_publication' },
    })
    return blockedResult({
      platform: input.platform,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId: null,
      runId,
      error,
    })
  }

  const capabilityLookup = await readCanonicalCapability(input.db, input.platform)
  const capability = capabilityLookup.capability
  if (capabilityLookup.error || !capability?.supports_comment_ingestion || capability.capability_status !== 'verified') {
    const error: MetaCommentIngestionError = {
      code: capabilityLookup.error ?? 'meta_comment_ingestion_capability_blocked',
      message: 'Canonical Meta comment ingestion capability is not verified or enabled; complete a read-only Meta scope smoke before refreshing comments.',
    }
    const runId = await insertRun({
      db: input.db,
      platform: input.platform,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
      metadata: {
        recovery: 'verify_meta_comment_ingestion_capability',
        capability_status: capability?.capability_status ?? null,
        supports_comment_ingestion: capability?.supports_comment_ingestion ?? false,
      },
    })
    return blockedResult({
      platform: input.platform,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId,
      runId,
      error,
    })
  }

  const config = await readMetaConfig(input.db, input.platform)
  const token = accessToken(config, input.platform)
  if (!config?.is_active || !token) {
    const error: MetaCommentIngestionError = {
      code: 'meta_not_connected',
      message: 'Meta provider is not connected or active for this platform; reconnect Meta before refreshing comments.',
    }
    const runId = await insertRun({
      db: input.db,
      platform: input.platform,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId,
      status: 'manual_blocked',
      errors: [error],
      counts: { error_count: 1 },
    })
    return blockedResult({
      platform: input.platform,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId,
      runId,
      error,
    })
  }

  const scopeError = localScopeError(input.platform, config, now)
  if (scopeError) {
    const runId = await insertRun({
      db: input.db,
      platform: input.platform,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId,
      status: 'manual_blocked',
      errors: [scopeError],
      counts: { error_count: 1 },
    })
    return blockedResult({
      platform: input.platform,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId,
      runId,
      error: scopeError,
    })
  }

  const runId = await insertRun({
    db: input.db,
    platform: input.platform,
    publishId: publish.id,
    contentId: publish.content_id,
    objectId,
    status: 'running',
    cursorMetadata: { requestedLimit: limit, pageSize },
  })
  if (!runId) throw new Error('Meta comment ingestion run insert did not return an id')

  try {
    const collected = await collectMetaComments({
      publish,
      objectId,
      runId,
      accessToken: token,
      providerCapability: capability,
      platform: input.platform,
      apiVersion: graphApiVersion(config),
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
      platform: input.platform,
      provider: META_PROVIDER,
      status,
      publishId: publish.id,
      contentId: publish.content_id,
      objectId,
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
      platform: input.platform,
      provider: META_PROVIDER,
      status: 'failed',
      publishId: publish.id,
      contentId: publish.content_id,
      objectId,
      runId,
      fetched: 0,
      upserted: 0,
      skipped: 0,
      errors: [error],
      cursor: { failed: true },
    }
  }
}
