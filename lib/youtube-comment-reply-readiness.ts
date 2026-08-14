import { YOUTUBE_FORCE_SSL_SCOPE } from './youtube-oauth'

export const YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV = 'SOCIAL_COMMENT_YOUTUBE_REPLY_SUBMISSION_ENABLED'
export const YOUTUBE_COMMENTS_INSERT_URL = 'https://www.googleapis.com/youtube/v3/comments'
export const YOUTUBE_REPLY_PROVIDER = 'youtube_data_api'

type FetchLike = typeof fetch

export type YouTubeReplyCredentials = {
  access_token?: string | null
  refresh_token?: string | null
  expires_in?: number | null
  token_obtained_at?: string | null
  scope?: string | null
}

export type YouTubeReplyConfig = {
  credentials?: YouTubeReplyCredentials | null
  settings?: Record<string, unknown> | null
  is_active?: boolean | null
}

export type YouTubeReplyCanonicalCapability = {
  platform?: unknown
  provider?: unknown
  capability_status?: unknown
  supports_reply_submission?: unknown
  external_submission_enabled?: unknown
  gate_notes?: unknown
}

export type YouTubeReplyCommentRow = {
  id?: unknown
  publish_id?: unknown
  content_id?: unknown
  platform?: unknown
  provider?: unknown
  provider_comment_id?: unknown
  provider_parent_comment_id?: unknown
  thread_id?: unknown
  record_type?: unknown
  response_approval_state?: unknown
  reply_submission_state?: unknown
  approved_reply_text?: unknown
  reply_provider_comment_id?: unknown
  reply_submitted_at?: unknown
  provider_capability?: unknown
  raw_payload?: unknown
  metadata?: unknown
}

export type YouTubeReplyBlockerCode =
  | 'youtube_reply_submission_disabled'
  | 'unsupported_provider'
  | 'provider_capability_unverified'
  | 'provider_reply_submission_unsupported'
  | 'provider_external_submission_disabled'
  | 'canonical_capability_missing'
  | 'canonical_capability_unverified'
  | 'canonical_reply_submission_unsupported'
  | 'canonical_external_submission_disabled'
  | 'youtube_not_connected'
  | 'youtube_credentials_incomplete'
  | 'youtube_token_expired'
  | 'youtube_insufficient_scope'
  | 'reply_already_submitted'
  | 'human_approval_required'
  | 'approved_reply_required'
  | 'provider_comment_identity_required'
  | 'policy_evidence_required'
  | 'policy_public_reply_blocked'
  | 'channel_identity_mismatch'

export type YouTubeReplyBlocker = {
  code: YouTubeReplyBlockerCode
  message: string
  recoveryAction: string
}

export type YouTubeReplyRequest = {
  url: string
  init: RequestInit
  idempotencyKey: string
  parentId: string
  textOriginal: string
}

export type YouTubeReplyReadiness = {
  ready: boolean
  blockers: YouTubeReplyBlocker[]
  request: YouTubeReplyRequest | null
  idempotencyKey: string | null
}

export type YouTubeReplySubmitResult = {
  ok: boolean
  blocked: boolean
  status: 'blocked' | 'submitted' | 'failed'
  providerReplyId: string | null
  submittedAt: string | null
  blockers: YouTubeReplyBlocker[]
  error: YouTubeReplyProviderError | null
  request: YouTubeReplyRequest | null
}

export type YouTubeReplyProviderError = {
  code: 'token_expired' | 'insufficient_scope' | 'quota_or_rate_limited' | 'provider_rejected' | 'provider_failure'
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

type YouTubeCommentInsertResponse = GoogleApiError & {
  id?: string
  snippet?: {
    textOriginal?: string
    parentId?: string
  }
}

const PUBLIC_REPLY_POLICY_BLOCKERS = new Set([
  'private_data',
  'unsupported_claim',
  'pricing_or_custom_promise',
  'legal_or_financial_advice',
  'private_source_public_claim',
  'external_public_boundary_uncertainty',
  'provider_ambiguity',
])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function scopeSet(scope: string | null | undefined) {
  return new Set((scope ?? '').split(/\s+/).filter(Boolean))
}

function tokenExpired(credentials: YouTubeReplyCredentials, now: Date, bufferMs = 10 * 60 * 1000) {
  if (!credentials.token_obtained_at || typeof credentials.expires_in !== 'number' || !Number.isFinite(credentials.expires_in) || credentials.expires_in <= 0) {
    return true
  }
  const obtained = new Date(credentials.token_obtained_at).getTime()
  if (Number.isNaN(obtained)) return true
  return now.getTime() + bufferMs >= obtained + credentials.expires_in * 1000
}

function blocker(code: YouTubeReplyBlockerCode, message: string, recoveryAction: string): YouTubeReplyBlocker {
  return { code, message, recoveryAction }
}

function configuredChannelId(config: YouTubeReplyConfig | null | undefined) {
  return asString(asRecord(config?.settings).channel_id)
}

function commentChannelId(comment: YouTubeReplyCommentRow) {
  const metadataYoutube = asRecord(asRecord(comment.metadata).youtube)
  const metadataChannel = asString(metadataYoutube.channel_id)
  if (metadataChannel) return metadataChannel

  const raw = asRecord(comment.raw_payload)
  const threadSnippet = asRecord(asRecord(raw.thread).snippet)
  return asString(threadSnippet.channelId)
}

function policyDecision(comment: YouTubeReplyCommentRow) {
  return asRecord(asRecord(comment.metadata).policy_decision)
}

function policyBlockedReasons(decision: Record<string, unknown>) {
  const autoSend = asRecord(decision.auto_send)
  const snakeAutoSend = asRecord(decision.autoSend)
  const rawReasons = (
    Array.isArray(autoSend.blockedReasons) ? autoSend.blockedReasons
      : Array.isArray(autoSend.blocked_reasons) ? autoSend.blocked_reasons
        : Array.isArray(snakeAutoSend.blockedReasons) ? snakeAutoSend.blockedReasons
          : Array.isArray(snakeAutoSend.blocked_reasons) ? snakeAutoSend.blocked_reasons
            : []
  )
  return rawReasons.map(String).filter((reason) => PUBLIC_REPLY_POLICY_BLOCKERS.has(reason))
}

function hasPolicyEvidence(comment: YouTubeReplyCommentRow) {
  const decision = policyDecision(comment)
  return Boolean(
    asString(decision.classification)
    || asString(decision.provenance_summary)
    || asString(decision.source_distance_note)
    || Object.keys(asRecord(decision.auto_send)).length
    || Object.keys(asRecord(decision.autoSend)).length,
  )
}

function enabledByEnv(env: NodeJS.ProcessEnv) {
  return env[YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV] === 'true'
}

function approvedReply(comment: YouTubeReplyCommentRow) {
  return asString(comment.approved_reply_text)
}

function parentCommentId(comment: YouTubeReplyCommentRow) {
  return asString(comment.provider_parent_comment_id) || asString(comment.provider_comment_id)
}

export function buildYouTubeCommentInsertRequest(input: {
  accessToken: string
  parentId: string
  textOriginal: string
  idempotencyKey: string
}): YouTubeReplyRequest {
  const url = new URL(YOUTUBE_COMMENTS_INSERT_URL)
  url.searchParams.set('part', 'snippet')
  return {
    url: url.toString(),
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          parentId: input.parentId,
          textOriginal: input.textOriginal,
        },
      }),
    },
    idempotencyKey: input.idempotencyKey,
    parentId: input.parentId,
    textOriginal: input.textOriginal,
  }
}

export function buildYouTubeReplyIdempotencyKey(comment: YouTubeReplyCommentRow) {
  const commentId = asString(comment.id) || asString(comment.provider_comment_id) || 'unknown-comment'
  const publishId = asString(comment.publish_id) || 'unknown-publish'
  const providerCommentId = asString(comment.provider_comment_id) || 'unknown-provider-comment'
  return `youtube-comment-reply:${publishId}:${providerCommentId}:${commentId}`
}

export function evaluateYouTubeReplyReadiness(input: {
  comment: YouTubeReplyCommentRow
  config?: YouTubeReplyConfig | null
  canonicalCapability?: YouTubeReplyCanonicalCapability | null
  env?: NodeJS.ProcessEnv
  now?: Date
}): YouTubeReplyReadiness {
  const env = input.env ?? process.env
  const now = input.now ?? new Date()
  const comment = input.comment
  const config = input.config
  const capability = asRecord(comment.provider_capability)
  const canonicalCapability = asRecord(input.canonicalCapability)
  const credentials = config?.credentials ?? null
  const blockers: YouTubeReplyBlocker[] = []
  const reply = approvedReply(comment)
  const parentId = parentCommentId(comment)

  if (!enabledByEnv(env)) {
    blockers.push(blocker(
      'youtube_reply_submission_disabled',
      'YouTube reply submission is disabled by environment.',
      `Set ${YOUTUBE_COMMENT_REPLY_SUBMISSION_ENV}=true only after captain security review and explicit canary approval.`,
    ))
  }

  if (asString(comment.platform) !== 'youtube' || asString(comment.provider) !== YOUTUBE_REPLY_PROVIDER) {
    blockers.push(blocker(
      'unsupported_provider',
      'This comment is not a canonical YouTube Data API comment.',
      'Handle unsupported or ambiguous providers manually from the canonical inbox.',
    ))
  }

  if (capability.capability_status !== 'verified') {
    blockers.push(blocker(
      'provider_capability_unverified',
      'YouTube reply capability is not verified on the canonical comment row.',
      'Run the separate read-only provider capability smoke and update capability evidence before enabling reply submission.',
    ))
  }
  if (capability.supports_reply_submission !== true) {
    blockers.push(blocker(
      'provider_reply_submission_unsupported',
      'The canonical provider capability does not support reply submission.',
      'Keep this comment in manual handling until YouTube reply capability is verified.',
    ))
  }
  if (capability.external_submission_enabled !== true) {
    blockers.push(blocker(
      'provider_external_submission_disabled',
      'External submission is disabled by the canonical provider capability.',
      'Do not submit externally until a later approved lane records verified capability evidence.',
    ))
  }

  if (!input.canonicalCapability || Object.keys(canonicalCapability).length === 0) {
    blockers.push(blocker(
      'canonical_capability_missing',
      'Canonical YouTube reply capability record is missing.',
      'Restore the social_comment_provider_capabilities YouTube row before considering any reply canary.',
    ))
  } else {
    if (asString(canonicalCapability.platform) !== 'youtube' || asString(canonicalCapability.provider) !== YOUTUBE_REPLY_PROVIDER) {
      blockers.push(blocker(
        'canonical_capability_unverified',
        'Canonical YouTube capability record does not match the YouTube Data API provider.',
        'Repair the canonical provider capability row before considering any reply canary.',
      ))
    }
    if (canonicalCapability.capability_status !== 'verified') {
      blockers.push(blocker(
        'canonical_capability_unverified',
        'Canonical YouTube reply capability is not verified.',
        'Run a separately authorized provider capability smoke before any reply canary.',
      ))
    }
    if (canonicalCapability.supports_reply_submission !== true) {
      blockers.push(blocker(
        'canonical_reply_submission_unsupported',
        'Canonical YouTube capability does not support reply submission.',
        'Keep YouTube replies manual until a later authorized capability update records support.',
      ))
    }
    if (canonicalCapability.external_submission_enabled !== true) {
      blockers.push(blocker(
        'canonical_external_submission_disabled',
        'Canonical YouTube external submission is disabled by the provider capability table.',
        'Current schema intentionally CHECKs external_submission_enabled=false; a later authorized migration and capability update are required before any public reply canary.',
      ))
    }
  }

  if (!config?.is_active || !credentials) {
    blockers.push(blocker(
      'youtube_not_connected',
      'YouTube is not connected or inactive.',
      'Reconnect YouTube through the approved OAuth path before any reply can be submitted.',
    ))
  } else {
    if (!asString(credentials.access_token)) {
      blockers.push(blocker(
        'youtube_credentials_incomplete',
        'YouTube credentials are missing an access token.',
        'Reconnect YouTube through the approved OAuth path.',
      ))
    }
    if (!scopeSet(credentials.scope).has(YOUTUBE_FORCE_SSL_SCOPE)) {
      blockers.push(blocker(
        'youtube_insufficient_scope',
        'Stored YouTube OAuth scope is missing youtube.force-ssl.',
        'Reconnect YouTube and confirm the force-ssl scope before reply submission.',
      ))
    }
    if (tokenExpired(credentials, now)) {
      blockers.push(blocker(
        'youtube_token_expired',
        'Stored YouTube access token is expired or has unverifiable expiry metadata.',
        'Refresh or reconnect YouTube with verifiable token expiry metadata before attempting a reply canary.',
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
      'Do not propose or submit a second public reply; review the existing reply evidence instead.',
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
      'Original YouTube provider comment identity is missing.',
      'Refresh or repair the canonical comment import before attempting provider submission.',
    ))
  }

  if (!hasPolicyEvidence(comment)) {
    blockers.push(blocker(
      'policy_evidence_required',
      'Policy provenance evidence is missing from comment metadata.',
      'Re-run comment policy review so public reply provenance and source-distance gates are recorded.',
    ))
  } else {
    const blockedReasons = policyBlockedReasons(policyDecision(comment))
    if (blockedReasons.length) {
      blockers.push(blocker(
        'policy_public_reply_blocked',
        `Policy gates block public reply submission: ${blockedReasons.join(', ')}.`,
        'Revise the reply and policy evidence so it avoids private data, unsupported claims, pricing promises, and sensitive advice.',
      ))
    }
  }

  const configuredChannel = configuredChannelId(config)
  const importedChannel = commentChannelId(comment)
  if (configuredChannel && importedChannel && configuredChannel !== importedChannel) {
    blockers.push(blocker(
      'channel_identity_mismatch',
      'Configured YouTube channel does not match the imported comment channel evidence.',
      'Reconcile the YouTube channel identity before attempting provider submission.',
    ))
  }

  const idempotencyKey = buildYouTubeReplyIdempotencyKey(comment)
  const accessToken = asString(credentials?.access_token)
  const request = blockers.length === 0 && accessToken && parentId && reply
    ? buildYouTubeCommentInsertRequest({
      accessToken,
      parentId,
      textOriginal: reply,
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

function mapProviderError(response: Response, data: GoogleApiError): YouTubeReplyProviderError {
  const reason = data.error?.errors?.[0]?.reason
  const message = data.error?.message || data.error?.errors?.[0]?.message || `YouTube comments.insert failed (${response.status}).`

  if (response.status === 401 || reason === 'authError' || reason === 'invalidCredentials') {
    return { code: 'token_expired', message, status: response.status, reason }
  }
  if (reason === 'insufficientPermissions' || reason === 'forbidden' || response.status === 403 && message.toLowerCase().includes('permission')) {
    return { code: 'insufficient_scope', message, status: response.status, reason }
  }
  if (
    response.status === 429
    || reason === 'quotaExceeded'
    || reason === 'rateLimitExceeded'
    || reason === 'userRateLimitExceeded'
  ) {
    return { code: 'quota_or_rate_limited', message, status: response.status, reason }
  }
  if (response.status >= 500) {
    return { code: 'provider_failure', message, status: response.status, reason }
  }
  return { code: 'provider_rejected', message, status: response.status, reason }
}

export async function submitYouTubeCommentReply(input: {
  comment: YouTubeReplyCommentRow
  config?: YouTubeReplyConfig | null
  canonicalCapability?: YouTubeReplyCanonicalCapability | null
  fetchImpl?: FetchLike
  env?: NodeJS.ProcessEnv
  now?: () => Date
}): Promise<YouTubeReplySubmitResult> {
  const now = input.now?.() ?? new Date()
  const readiness = evaluateYouTubeReplyReadiness({
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
  const data = await response.json() as YouTubeCommentInsertResponse
  if (!response.ok || !data.id) {
    return {
      ok: false,
      blocked: false,
      status: 'failed',
      providerReplyId: null,
      submittedAt: null,
      blockers: [],
      error: mapProviderError(response, data),
      request: readiness.request,
    }
  }

  return {
    ok: true,
    blocked: false,
    status: 'submitted',
    providerReplyId: data.id,
    submittedAt: now.toISOString(),
    blockers: [],
    error: null,
    request: readiness.request,
  }
}
