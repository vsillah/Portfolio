import type { SocialPlatform } from './social-content'
import { META_GRAPH_API_VERSION } from './meta-oauth'
import {
  submitYouTubeCommentReply,
  YOUTUBE_REPLY_PROVIDER,
  type YouTubeReplyCanonicalCapability,
  type YouTubeReplyCommentRow,
  type YouTubeReplyConfig,
  type YouTubeReplyRequest,
} from './youtube-comment-reply-readiness'

type FetchLike = typeof fetch
type MetaReplyPlatform = Extract<SocialPlatform, 'facebook' | 'instagram'>

export type CommentReplySubmissionBlocker = {
  code: string
  message: string
  recoveryAction: string
}

export type CommentReplySubmissionProviderError = {
  code: string
  message: string
  status?: number
  reason?: string
}

export type CommentReplySubmissionRequest = YouTubeReplyRequest
  | {
    url: string
    init: RequestInit
    idempotencyKey: string
    parentId: string
    message: string
    platform: MetaReplyPlatform
  }

export type MetaReplyCredentials = {
  access_token?: string | null
  page_access_token?: string | null
  user_access_token?: string | null
  expires_in?: number | null
  token_obtained_at?: string | null
  scope?: string | null
  tasks?: unknown
}

export type MetaReplyConfig = {
  credentials?: MetaReplyCredentials | null
  settings?: Record<string, unknown> | null
  is_active?: boolean | null
}

export type MetaReplyCanonicalCapability = {
  platform?: unknown
  provider?: unknown
  capability_status?: unknown
  supports_reply_submission?: unknown
  external_submission_enabled?: unknown
  gate_notes?: unknown
}

export type MetaReplyCommentRow = {
  id?: unknown
  publish_id?: unknown
  content_id?: unknown
  platform?: unknown
  provider?: unknown
  provider_comment_id?: unknown
  response_approval_state?: unknown
  reply_submission_state?: unknown
  approved_reply_text?: unknown
  reply_provider_comment_id?: unknown
  reply_submitted_at?: unknown
  provider_capability?: unknown
  metadata?: unknown
}

export type CommentReplySubmissionResult = {
  ok: boolean
  blocked: boolean
  status: 'blocked' | 'submitted' | 'failed'
  providerReplyId: string | null
  submittedAt: string | null
  blockers: CommentReplySubmissionBlocker[]
  error: CommentReplySubmissionProviderError | null
  request: CommentReplySubmissionRequest | null
}

export type CommentReplySubmissionContext = {
  comment: Record<string, unknown>
  youtube?: {
    config?: YouTubeReplyConfig | null
    canonicalCapability?: YouTubeReplyCanonicalCapability | null
  }
  meta?: {
    config?: MetaReplyConfig | null
    canonicalCapability?: MetaReplyCanonicalCapability | null
  }
  fetchImpl?: FetchLike
  env?: Partial<NodeJS.ProcessEnv>
  now?: () => Date
}

export type CommentReplySubmitAdapter = {
  platform: SocialPlatform | string
  provider: string
  concreteProviderWrite: boolean
  submitReply: (context: CommentReplySubmissionContext) => Promise<CommentReplySubmissionResult>
}

export const META_REPLY_PROVIDER = 'meta_graph'
export const META_COMMENT_REPLY_SUBMISSION_ENV = 'SOCIAL_COMMENT_META_REPLY_SUBMISSION_ENABLED'
export const META_FACEBOOK_GRAPH_BASE_URL = 'https://graph.facebook.com'
export const META_INSTAGRAM_GRAPH_BASE_URL = 'https://graph.instagram.com'

const FACEBOOK_REPLY_REQUIRED_SCOPES = ['pages_manage_engagement', 'pages_read_user_content']
const INSTAGRAM_REPLY_FACEBOOK_LOGIN_REQUIRED_SCOPES = ['instagram_basic', 'instagram_manage_comments', 'pages_read_engagement']
const INSTAGRAM_REPLY_INSTAGRAM_LOGIN_REQUIRED_SCOPES = ['instagram_business_basic', 'instagram_business_manage_comments']
const META_PAGE_MODERATE_TASKS = new Set(['MODERATE', 'MANAGE', 'PROFILE_PLUS_MODERATE', 'PROFILE_PLUS_FULL_CONTROL', 'PROFILE_PLUS_MANAGE'])

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function scopeSet(scope: string | null | undefined) {
  return new Set((scope ?? '').split(/[,\s]+/).filter(Boolean))
}

function tokenExpired(credentials: MetaReplyCredentials, now: Date, bufferMs = 10 * 60 * 1000) {
  if (!credentials.token_obtained_at || typeof credentials.expires_in !== 'number' || !Number.isFinite(credentials.expires_in) || credentials.expires_in <= 0) {
    return false
  }
  const obtained = new Date(credentials.token_obtained_at).getTime()
  if (Number.isNaN(obtained)) return true
  return now.getTime() + bufferMs >= obtained + credentials.expires_in * 1000
}

function blocker(code: string, message: string, recoveryAction: string): CommentReplySubmissionBlocker {
  return { code, message, recoveryAction }
}

function unsupportedProviderResult(platform: string): CommentReplySubmissionResult {
  const label = platform === 'tiktok'
    ? 'TikTok'
    : platform === 'x'
      ? 'X'
      : platform.charAt(0).toUpperCase() + platform.slice(1)

  return {
    ok: false,
    blocked: true,
    status: 'blocked',
    providerReplyId: null,
    submittedAt: null,
    blockers: [{
      code: `${platform || 'unknown'}_reply_submission_unsupported`,
      message: `${label} provider reply submission is not available from Portfolio.`,
      recoveryAction: 'Use the provider permalink or manual channel workflow, then return to Portfolio to record the local decision.',
    }],
    error: null,
    request: null,
  }
}

function approvedReply(comment: MetaReplyCommentRow) {
  return asString(comment.approved_reply_text)
}

function metaAccessToken(config: MetaReplyConfig | null | undefined, platform: MetaReplyPlatform) {
  const credentials = config?.credentials
  if (!credentials) return null
  if (platform === 'facebook') {
    return asString(credentials.page_access_token) ?? asString(credentials.access_token)
  }
  return asString(credentials.access_token) ?? asString(credentials.page_access_token) ?? asString(credentials.user_access_token)
}

function graphApiVersion(config: MetaReplyConfig | null | undefined) {
  return asString(config?.settings?.graph_api_version) ?? META_GRAPH_API_VERSION
}

function metaIdentity(config: MetaReplyConfig | null | undefined, platform: MetaReplyPlatform) {
  const settings = asRecord(config?.settings)
  if (platform === 'facebook') {
    return asString(settings.page_id) ?? asString(settings.facebook_page_id)
  }
  return asString(settings.instagram_business_account_id)
    ?? asString(settings.ig_user_id)
    ?? asString(settings.instagram_user_id)
}

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

function metaTaskEvidence(config: MetaReplyConfig | null | undefined, platform: MetaReplyPlatform) {
  if (platform === 'instagram') return true
  const settings = asRecord(config?.settings)
  const credentials = config?.credentials ?? {}
  const tasks = [
    ...arrayOfStrings(settings.page_tasks),
    ...arrayOfStrings(settings.facebook_page_tasks),
    ...arrayOfStrings(credentials.tasks),
  ]
  return tasks.some((task) => META_PAGE_MODERATE_TASKS.has(task))
}

function hasMetaCapabilityEvidence(config: MetaReplyConfig | null | undefined, platform: MetaReplyPlatform) {
  const settings = asRecord(config?.settings)
  if (platform === 'facebook') {
    return settings.facebook_comment_reply_capability_verified === true
      || settings.pages_manage_engagement_permission === true
  }
  return settings.instagram_comment_reply_capability_verified === true
    || settings.instagram_manage_comments_permission === true
    || settings.instagram_business_manage_comments_permission === true
}

function missingMetaScopes(config: MetaReplyConfig | null | undefined, platform: MetaReplyPlatform) {
  const scopes = scopeSet(config?.credentials?.scope)
  if (platform === 'facebook') {
    return FACEBOOK_REPLY_REQUIRED_SCOPES.filter((scope) => !scopes.has(scope))
  }

  const hasFacebookLoginScopes = INSTAGRAM_REPLY_FACEBOOK_LOGIN_REQUIRED_SCOPES.every((scope) => scopes.has(scope))
  const hasInstagramLoginScopes = INSTAGRAM_REPLY_INSTAGRAM_LOGIN_REQUIRED_SCOPES.every((scope) => scopes.has(scope))
  if (hasFacebookLoginScopes || hasInstagramLoginScopes) return []

  return [...INSTAGRAM_REPLY_FACEBOOK_LOGIN_REQUIRED_SCOPES]
}

export function buildMetaCommentReplyRequest(input: {
  platform: MetaReplyPlatform
  apiVersion: string
  accessToken: string
  parentId: string
  message: string
  idempotencyKey: string
}): CommentReplySubmissionRequest {
  const edge = input.platform === 'instagram' ? 'replies' : 'comments'
  const baseUrl = input.platform === 'instagram' ? META_INSTAGRAM_GRAPH_BASE_URL : META_FACEBOOK_GRAPH_BASE_URL
  const url = new URL(`${baseUrl}/${input.apiVersion}/${encodeURIComponent(input.parentId)}/${edge}`)
  return {
    url: url.toString(),
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ message: input.message }),
    },
    idempotencyKey: input.idempotencyKey,
    parentId: input.parentId,
    message: input.message,
    platform: input.platform,
  }
}

function buildMetaReplyIdempotencyKey(comment: MetaReplyCommentRow, platform: MetaReplyPlatform) {
  const commentId = asString(comment.id) || asString(comment.provider_comment_id) || 'unknown-comment'
  const publishId = asString(comment.publish_id) || 'unknown-publish'
  const providerCommentId = asString(comment.provider_comment_id) || 'unknown-provider-comment'
  return `${platform}-comment-reply:${publishId}:${providerCommentId}:${commentId}`
}

function evaluateMetaReplyReadiness(input: {
  platform: MetaReplyPlatform
  comment: MetaReplyCommentRow
  config?: MetaReplyConfig | null
  canonicalCapability?: MetaReplyCanonicalCapability | null
  env?: Partial<NodeJS.ProcessEnv>
  now?: Date
}) {
  const env = input.env ?? process.env
  const now = input.now ?? new Date()
  const comment = input.comment
  const config = input.config
  const credentials = config?.credentials ?? null
  const providerCapability = asRecord(comment.provider_capability)
  const canonicalCapability = asRecord(input.canonicalCapability)
  const platformLabel = input.platform === 'facebook' ? 'Facebook' : 'Instagram'
  const blockers: CommentReplySubmissionBlocker[] = []
  const reply = approvedReply(comment)
  const parentId = asString(comment.provider_comment_id)
  const accessToken = metaAccessToken(config, input.platform)

  if (env[META_COMMENT_REPLY_SUBMISSION_ENV] !== 'true') {
    blockers.push(blocker(
      'meta_reply_submission_disabled',
      'Meta reply submission is disabled by environment.',
      `Set ${META_COMMENT_REPLY_SUBMISSION_ENV}=true only after provider review, captain security review, and explicit canary approval.`,
    ))
  }

  if (asString(comment.platform) !== input.platform || asString(comment.provider) !== META_REPLY_PROVIDER) {
    blockers.push(blocker(
      'unsupported_provider',
      `This comment is not a canonical ${platformLabel} Meta Graph comment.`,
      'Handle unsupported or ambiguous providers manually from the canonical inbox.',
    ))
  }

  if (providerCapability.capability_status !== 'verified') {
    blockers.push(blocker(
      'provider_capability_unverified',
      `${platformLabel} reply capability is not verified on the canonical comment row.`,
      'Run a separate provider capability smoke and record verified row evidence before enabling reply submission.',
    ))
  }
  if (providerCapability.supports_reply_submission !== true) {
    blockers.push(blocker(
      'provider_reply_submission_unsupported',
      `The canonical ${platformLabel} provider capability does not support reply submission.`,
      'Keep this comment in manual handling until Meta reply capability is explicitly verified.',
    ))
  }
  if (providerCapability.external_submission_enabled !== true) {
    blockers.push(blocker(
      'provider_external_submission_disabled',
      `External ${platformLabel} submission is disabled by the canonical provider capability.`,
      'Do not submit externally until a later approved lane records verified capability evidence and enables the provider row.',
    ))
  }

  if (!input.canonicalCapability || Object.keys(canonicalCapability).length === 0) {
    blockers.push(blocker(
      'canonical_capability_missing',
      `Canonical ${platformLabel} reply capability record is missing.`,
      'Restore the social_comment_provider_capabilities Meta row before considering any reply canary.',
    ))
  } else {
    if (asString(canonicalCapability.platform) !== input.platform || asString(canonicalCapability.provider) !== META_REPLY_PROVIDER) {
      blockers.push(blocker(
        'canonical_capability_unverified',
        `Canonical ${platformLabel} capability record does not match the Meta Graph provider.`,
        'Repair the canonical provider capability row before considering any reply canary.',
      ))
    }
    if (canonicalCapability.capability_status !== 'verified') {
      blockers.push(blocker(
        'canonical_capability_unverified',
        `Canonical ${platformLabel} reply capability is not verified.`,
        'Run a separately authorized provider capability smoke before any reply canary.',
      ))
    }
    if (canonicalCapability.supports_reply_submission !== true) {
      blockers.push(blocker(
        'canonical_reply_submission_unsupported',
        `Canonical ${platformLabel} capability does not support reply submission.`,
        'Keep Meta replies manual until a later authorized capability update records support.',
      ))
    }
    if (canonicalCapability.external_submission_enabled !== true) {
      blockers.push(blocker(
        'canonical_external_submission_disabled',
        `Canonical ${platformLabel} external submission is disabled by the provider capability table.`,
        'Do not submit externally until an authorized migration/capability update permits the canary.',
      ))
    }
  }

  if (!config?.is_active || !credentials) {
    blockers.push(blocker(
      'meta_not_connected',
      `${platformLabel} Meta Graph config is inactive or missing.`,
      'Reconnect Meta through the approved OAuth path before any reply can be submitted.',
    ))
  } else {
    if (!accessToken) {
      blockers.push(blocker(
        'meta_credentials_incomplete',
        `${platformLabel} credentials are missing an access token.`,
        'Reconnect Meta through the approved OAuth path.',
      ))
    }
    if (tokenExpired(credentials, now)) {
      blockers.push(blocker(
        'meta_token_expired',
        `Stored ${platformLabel} access token is expired or has stale expiry metadata.`,
        'Refresh or reconnect Meta with verifiable token metadata before attempting a reply canary.',
      ))
    }
    const missingScopes = missingMetaScopes(config, input.platform)
    if (missingScopes.length) {
      blockers.push(blocker(
        'meta_insufficient_scope',
        `Stored ${platformLabel} OAuth evidence is missing required reply scopes: ${missingScopes.join(', ')}.`,
        'Reconnect Meta and confirm exact comment-management scopes before reply submission.',
      ))
    }
    if (!metaTaskEvidence(config, input.platform)) {
      blockers.push(blocker(
        'meta_capability_task_evidence_required',
        `${platformLabel} task/capability evidence for comment moderation is missing.`,
        'Record Page MODERATE task evidence or equivalent Meta capability evidence before reply submission.',
      ))
    }
    if (!hasMetaCapabilityEvidence(config, input.platform)) {
      blockers.push(blocker(
        'meta_capability_evidence_required',
        `${platformLabel} comment reply capability evidence is missing.`,
        'Record explicit pages_manage_engagement or instagram_manage_comments capability evidence before reply submission.',
      ))
    }
    if (!metaIdentity(config, input.platform)) {
      blockers.push(blocker(
        'meta_identity_required',
        `${platformLabel} Page or Instagram identity is missing from provider settings.`,
        'Reconnect Meta and record the exact Page or Instagram professional account identity before reply submission.',
      ))
    }
  }

  if (
    asString(comment.reply_submission_state) === 'submitted'
    || asString(comment.reply_provider_comment_id)
    || asString(comment.reply_submitted_at)
  ) {
    blockers.push(blocker(
      'reply_already_submitted',
      'This canonical comment already has submitted reply evidence.',
      'Do not submit a second public reply; review the existing reply evidence instead.',
    ))
  }

  if (asString(comment.response_approval_state) !== 'approved' || asString(comment.reply_submission_state) !== 'approved') {
    blockers.push(blocker(
      'human_approval_required',
      'Human approval and approved reply submission state are required.',
      'Approve the exact reply text in the canonical Comment Inbox before any provider submission.',
    ))
  }

  if (!reply) {
    blockers.push(blocker(
      'approved_reply_required',
      'Approved reply text is empty.',
      'Draft and approve a nonempty public reply before attempting provider submission.',
    ))
  }

  if (!parentId) {
    blockers.push(blocker(
      'provider_comment_identity_required',
      `Original ${platformLabel} provider comment identity is missing.`,
      'Refresh or repair the canonical comment import before attempting provider submission.',
    ))
  }

  const idempotencyKey = buildMetaReplyIdempotencyKey(comment, input.platform)
  const request = blockers.length === 0 && accessToken && parentId && reply
    ? buildMetaCommentReplyRequest({
      platform: input.platform,
      apiVersion: graphApiVersion(config),
      accessToken,
      parentId,
      message: reply,
      idempotencyKey,
    })
    : null

  return {
    ready: blockers.length === 0,
    blockers,
    request,
    idempotencyKey,
  }
}

function mapMetaProviderError(platform: MetaReplyPlatform, response: Response, data: { error?: { message?: string; code?: number; type?: string; error_subcode?: number } }): CommentReplySubmissionProviderError {
  const code = data.error?.code
  const type = data.error?.type
  const message = data.error?.message || `Meta ${platform} comment reply failed (${response.status}).`
  if (response.status === 401 || code === 190) {
    return { code: 'token_expired', message, status: response.status, reason: type }
  }
  if (response.status === 403 || code === 10 || code === 200) {
    return { code: 'insufficient_scope', message, status: response.status, reason: type }
  }
  if (response.status === 429 || code === 4 || code === 17 || code === 32) {
    return { code: 'quota_or_rate_limited', message, status: response.status, reason: type }
  }
  if (response.status >= 500) {
    return { code: 'provider_failure', message, status: response.status, reason: type }
  }
  return { code: 'provider_rejected', message, status: response.status, reason: type }
}

async function submitMetaCommentReply(input: {
  platform: MetaReplyPlatform
  comment: MetaReplyCommentRow
  config?: MetaReplyConfig | null
  canonicalCapability?: MetaReplyCanonicalCapability | null
  fetchImpl?: FetchLike
  env?: Partial<NodeJS.ProcessEnv>
  now?: () => Date
}): Promise<CommentReplySubmissionResult> {
  const now = input.now?.() ?? new Date()
  const readiness = evaluateMetaReplyReadiness({
    platform: input.platform,
    comment: input.comment,
    config: input.config,
    canonicalCapability: input.canonicalCapability,
    env: input.env,
    now,
  })

  if (!readiness.ready || !readiness.request) {
    return {
      ok: false,
      blocked: true,
      status: 'blocked',
      providerReplyId: null,
      submittedAt: null,
      blockers: readiness.blockers,
      error: null,
      request: readiness.request,
    }
  }

  const response = await (input.fetchImpl ?? fetch)(readiness.request.url, readiness.request.init)
  const data = await response.json().catch(() => ({})) as { id?: unknown; error?: { message?: string; code?: number; type?: string; error_subcode?: number } }
  const replyId = asString(data.id)
  if (!response.ok || !replyId) {
    return {
      ok: false,
      blocked: false,
      status: 'failed',
      providerReplyId: null,
      submittedAt: null,
      blockers: [],
      error: mapMetaProviderError(input.platform, response, data),
      request: readiness.request,
    }
  }

  return {
    ok: true,
    blocked: false,
    status: 'submitted',
    providerReplyId: replyId,
    submittedAt: now.toISOString(),
    blockers: [],
    error: null,
    request: readiness.request,
  }
}

function createUnsupportedAdapter(platform: string, provider: string): CommentReplySubmitAdapter {
  return {
    platform,
    provider,
    concreteProviderWrite: false,
    submitReply: async () => unsupportedProviderResult(platform),
  }
}

export function createCommentReplySubmitAdapter(input: {
  platform?: string | null
  provider?: string | null
}): CommentReplySubmitAdapter {
  const platform = asString(input.platform) ?? 'unknown'
  const provider = asString(input.provider) ?? 'manual'

  if (platform === 'youtube' && provider === YOUTUBE_REPLY_PROVIDER) {
    return {
      platform,
      provider,
      concreteProviderWrite: true,
      submitReply: async (context) => submitYouTubeCommentReply({
        comment: context.comment as YouTubeReplyCommentRow,
        config: context.youtube?.config,
        canonicalCapability: context.youtube?.canonicalCapability,
        fetchImpl: context.fetchImpl,
        env: context.env,
        now: context.now,
      }),
    }
  }

  if ((platform === 'facebook' || platform === 'instagram') && provider === META_REPLY_PROVIDER) {
    return {
      platform,
      provider,
      concreteProviderWrite: true,
      submitReply: async (context) => submitMetaCommentReply({
        platform,
        comment: context.comment as MetaReplyCommentRow,
        config: context.meta?.config,
        canonicalCapability: context.meta?.canonicalCapability,
        fetchImpl: context.fetchImpl,
        env: context.env,
        now: context.now,
      }),
    }
  }

  return createUnsupportedAdapter(platform, provider)
}

export async function submitCommentProviderReply(context: CommentReplySubmissionContext): Promise<CommentReplySubmissionResult> {
  const adapter = createCommentReplySubmitAdapter({
    platform: asString(context.comment.platform),
    provider: asString(context.comment.provider),
  })
  return adapter.submitReply(context)
}
