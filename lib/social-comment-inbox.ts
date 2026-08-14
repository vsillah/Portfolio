import type { SocialPlatform } from './social-content'

export type SocialCommentCapabilityStatus = 'verified' | 'manual' | 'blocked' | 'unsupported'

export type SocialCommentRecordType = 'comment' | 'reply'
export type SocialCommentStatus = 'visible' | 'hidden' | 'deleted' | 'held_for_review' | 'blocked' | 'unknown'
export type SocialCommentClassificationStatus = 'unreviewed' | 'needs_response' | 'answered' | 'spam' | 'blocked' | 'ignored'
export type SocialCommentSentiment = 'positive' | 'neutral' | 'negative' | 'mixed' | 'unknown'
export type SocialCommentPriority = 'low' | 'normal' | 'high' | 'urgent'
export type SocialCommentResponseApprovalState = 'not_required' | 'pending' | 'approved' | 'rejected' | 'blocked'
export type SocialCommentReplySubmissionState = 'not_applicable' | 'draft' | 'approved' | 'submitted' | 'failed' | 'blocked'
export type SocialCommentIngestionRunStatus = 'pending' | 'running' | 'succeeded' | 'partial' | 'failed' | 'manual_blocked'

export type SocialCommentProviderCapability = {
  platform: SocialPlatform
  provider: string
  capabilityStatus: SocialCommentCapabilityStatus
  supportsCommentIngestion: boolean
  supportsReplyDraft: boolean
  supportsReplySubmission: boolean
  supportsPermalink: boolean
  supportsAuthorProfile: boolean
  supportsThreading: boolean
  supportsCursor: boolean
  externalSubmissionEnabled: boolean
  gateNotes: string
}

export type SocialCommentProviderCapabilitySnapshot = {
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

export const COMMENT_INBOX_PLATFORM_CAPABILITIES: Record<SocialPlatform, SocialCommentProviderCapability> = {
  linkedin: {
    platform: 'linkedin',
    provider: 'linkedin_organization',
    capabilityStatus: 'manual',
    supportsCommentIngestion: false,
    supportsReplyDraft: true,
    supportsReplySubmission: false,
    supportsPermalink: true,
    supportsAuthorProfile: true,
    supportsThreading: true,
    supportsCursor: false,
    externalSubmissionEnabled: false,
    gateNotes: 'Foundation only. LinkedIn comment ingestion and replies require a later provider-authorized lane.',
  },
  youtube: {
    platform: 'youtube',
    provider: 'youtube_data_api',
    capabilityStatus: 'manual',
    supportsCommentIngestion: true,
    supportsReplyDraft: true,
    supportsReplySubmission: false,
    supportsPermalink: true,
    supportsAuthorProfile: true,
    supportsThreading: true,
    supportsCursor: true,
    externalSubmissionEnabled: false,
    gateNotes: 'Foundation only. YouTube comment API access is represented but not activated.',
  },
  instagram: {
    platform: 'instagram',
    provider: 'meta_graph',
    capabilityStatus: 'manual',
    supportsCommentIngestion: false,
    supportsReplyDraft: true,
    supportsReplySubmission: false,
    supportsPermalink: true,
    supportsAuthorProfile: true,
    supportsThreading: true,
    supportsCursor: true,
    externalSubmissionEnabled: false,
    gateNotes: 'Foundation only. Instagram comment permissions require a separate Meta provider gate.',
  },
  facebook: {
    platform: 'facebook',
    provider: 'meta_graph',
    capabilityStatus: 'manual',
    supportsCommentIngestion: false,
    supportsReplyDraft: true,
    supportsReplySubmission: false,
    supportsPermalink: true,
    supportsAuthorProfile: true,
    supportsThreading: true,
    supportsCursor: true,
    externalSubmissionEnabled: false,
    gateNotes: 'Foundation only. Facebook comment permissions require a separate Meta provider gate.',
  },
  x: {
    platform: 'x',
    provider: 'x_api',
    capabilityStatus: 'manual',
    supportsCommentIngestion: false,
    supportsReplyDraft: true,
    supportsReplySubmission: false,
    supportsPermalink: true,
    supportsAuthorProfile: true,
    supportsThreading: true,
    supportsCursor: true,
    externalSubmissionEnabled: false,
    gateNotes: 'Foundation only. X comment ingestion and replies remain disabled pending provider authorization.',
  },
  tiktok: {
    platform: 'tiktok',
    provider: 'tiktok_api',
    capabilityStatus: 'blocked',
    supportsCommentIngestion: false,
    supportsReplyDraft: true,
    supportsReplySubmission: false,
    supportsPermalink: true,
    supportsAuthorProfile: false,
    supportsThreading: true,
    supportsCursor: false,
    externalSubmissionEnabled: false,
    gateNotes: 'Foundation only. TikTok comment automation is visible for planning but blocked until verified.',
  },
}

export type NormalizedSocialCommentInput = {
  publishId: string
  contentId: string
  platform: SocialPlatform
  provider?: string | null
  providerCommentId: string
  providerParentCommentId?: string | null
  parentCommentId?: string | null
  threadId?: string | null
  recordType?: SocialCommentRecordType
  authorPublicHandle?: string | null
  authorDisplayName?: string | null
  authorProfileUrl?: string | null
  authorIsChannelOwner?: boolean
  body: string
  commentUrl?: string | null
  providerCreatedAt?: string | null
  providerUpdatedAt?: string | null
  capturedAt?: string | null
  status?: SocialCommentStatus
  classificationStatus?: SocialCommentClassificationStatus
  classificationReason?: string | null
  sentiment?: SocialCommentSentiment
  priority?: SocialCommentPriority
  responseApprovalState?: SocialCommentResponseApprovalState
  replySubmissionState?: SocialCommentReplySubmissionState
  proposedReplyText?: string | null
  approvedReplyText?: string | null
  replyProviderCommentId?: string | null
  replySubmittedAt?: string | null
  providerCapability?: SocialCommentProviderCapabilitySnapshot | null
  ingestionRunId?: string | null
  rawPayload?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type SocialCommentUpsertPayload = {
  publish_id: string
  content_id: string
  platform: SocialPlatform
  provider: string
  provider_comment_id: string
  provider_parent_comment_id: string | null
  parent_comment_id: string | null
  thread_id: string | null
  record_type: SocialCommentRecordType
  author_public_handle: string | null
  author_display_name: string | null
  author_profile_url: string | null
  author_is_channel_owner: boolean
  body: string
  comment_url: string | null
  provider_created_at: string | null
  provider_updated_at: string | null
  captured_at: string
  status: SocialCommentStatus
  classification_status: SocialCommentClassificationStatus
  classification_reason: string | null
  sentiment: SocialCommentSentiment
  priority: SocialCommentPriority
  response_approval_state: SocialCommentResponseApprovalState
  reply_submission_state: SocialCommentReplySubmissionState
  proposed_reply_text: string | null
  approved_reply_text: string | null
  reply_provider_comment_id: string | null
  reply_submitted_at: string | null
  provider_capability: SocialCommentProviderCapabilitySnapshot
  ingestion_run_id: string | null
  raw_payload: Record<string, unknown>
  metadata: Record<string, unknown>
}

export type SocialCommentIngestionRunInsert = {
  provider: string
  platform: SocialPlatform
  publish_id: string | null
  content_id: string | null
  status: SocialCommentIngestionRunStatus
  cursor_metadata: Record<string, unknown>
  window_start_at: string | null
  window_end_at: string | null
  fetched_count: number
  inserted_count: number
  updated_count: number
  skipped_count: number
  error_count: number
  errors: Array<Record<string, unknown>>
  metadata: Record<string, unknown>
}

type SupabaseCommentClientLike = {
  from: (table: 'social_content_comments') => any
}

type SocialCommentIdentityRow = {
  publish_id: string
  provider: string
  provider_comment_id: string
}

type SocialCommentPreparedRecord = {
  input: NormalizedSocialCommentInput
  row: SocialCommentUpsertPayload
}

type SocialCommentProviderOwnedUpdatePayload = Partial<Pick<
  SocialCommentUpsertPayload,
  | 'content_id'
  | 'platform'
  | 'provider_parent_comment_id'
  | 'thread_id'
  | 'record_type'
  | 'author_public_handle'
  | 'author_display_name'
  | 'author_profile_url'
  | 'author_is_channel_owner'
  | 'body'
  | 'comment_url'
  | 'provider_created_at'
  | 'provider_updated_at'
  | 'captured_at'
  | 'provider_capability'
  | 'ingestion_run_id'
  | 'raw_payload'
>>

export type CommentInboxProviderAdapter = {
  capability: SocialCommentProviderCapability
  fetchComments: () => Promise<never>
  submitReply: () => Promise<never>
}

export function getCommentProviderCapability(platform: SocialPlatform) {
  return COMMENT_INBOX_PLATFORM_CAPABILITIES[platform]
}

export function serializeCommentProviderCapability(capability: SocialCommentProviderCapability): SocialCommentProviderCapabilitySnapshot {
  return {
    capability_status: capability.capabilityStatus,
    supports_comment_ingestion: capability.supportsCommentIngestion,
    supports_reply_draft: capability.supportsReplyDraft,
    supports_reply_submission: capability.supportsReplySubmission,
    supports_permalink: capability.supportsPermalink,
    supports_author_profile: capability.supportsAuthorProfile,
    supports_threading: capability.supportsThreading,
    supports_cursor: capability.supportsCursor,
    external_submission_enabled: false,
    gate_notes: capability.gateNotes,
  }
}

export function createBlockedCommentProviderAdapter(platform: SocialPlatform): CommentInboxProviderAdapter {
  const capability = getCommentProviderCapability(platform)
  const blockedMessage = `${platform} comment provider is ${capability.capabilityStatus}; live comment ingestion and reply submission are not enabled in this lane.`
  return {
    capability,
    fetchComments: async () => {
      throw new Error(blockedMessage)
    },
    submitReply: async () => {
      throw new Error(blockedMessage)
    },
  }
}

function requiredTrimmed(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required`)
  return trimmed
}

function optionalTrimmed(value: string | null | undefined) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

export function buildSocialCommentIdempotencyKey(input: {
  publishId: string
  provider?: string | null
  platform: SocialPlatform
  providerCommentId: string
}) {
  const provider = optionalTrimmed(input.provider) ?? getCommentProviderCapability(input.platform).provider
  return [
    requiredTrimmed(input.publishId, 'publishId'),
    provider,
    requiredTrimmed(input.providerCommentId, 'providerCommentId'),
  ].join(':')
}

export function buildSocialCommentUpsertPayload(input: NormalizedSocialCommentInput): SocialCommentUpsertPayload {
  const capability = getCommentProviderCapability(input.platform)
  const provider = optionalTrimmed(input.provider) ?? capability.provider

  return {
    publish_id: requiredTrimmed(input.publishId, 'publishId'),
    content_id: requiredTrimmed(input.contentId, 'contentId'),
    platform: input.platform,
    provider,
    provider_comment_id: requiredTrimmed(input.providerCommentId, 'providerCommentId'),
    provider_parent_comment_id: optionalTrimmed(input.providerParentCommentId),
    parent_comment_id: optionalTrimmed(input.parentCommentId),
    thread_id: optionalTrimmed(input.threadId),
    record_type: input.recordType ?? 'comment',
    author_public_handle: optionalTrimmed(input.authorPublicHandle),
    author_display_name: optionalTrimmed(input.authorDisplayName),
    author_profile_url: optionalTrimmed(input.authorProfileUrl),
    author_is_channel_owner: input.authorIsChannelOwner ?? false,
    body: requiredTrimmed(input.body, 'body'),
    comment_url: optionalTrimmed(input.commentUrl),
    provider_created_at: optionalTrimmed(input.providerCreatedAt),
    provider_updated_at: optionalTrimmed(input.providerUpdatedAt),
    captured_at: optionalTrimmed(input.capturedAt) ?? new Date().toISOString(),
    status: input.status ?? 'visible',
    classification_status: input.classificationStatus ?? 'unreviewed',
    classification_reason: optionalTrimmed(input.classificationReason),
    sentiment: input.sentiment ?? 'unknown',
    priority: input.priority ?? 'normal',
    response_approval_state: input.responseApprovalState ?? 'not_required',
    reply_submission_state: input.replySubmissionState ?? 'not_applicable',
    proposed_reply_text: optionalTrimmed(input.proposedReplyText),
    approved_reply_text: optionalTrimmed(input.approvedReplyText),
    reply_provider_comment_id: optionalTrimmed(input.replyProviderCommentId),
    reply_submitted_at: optionalTrimmed(input.replySubmittedAt),
    provider_capability: input.providerCapability ?? serializeCommentProviderCapability(capability),
    ingestion_run_id: optionalTrimmed(input.ingestionRunId),
    raw_payload: input.rawPayload ?? {},
    metadata: input.metadata ?? {},
  }
}

export function prepareSocialCommentUpserts(inputs: NormalizedSocialCommentInput[]) {
  return prepareSocialCommentRecords(inputs).map(({ row }) => row)
}

function prepareSocialCommentRecords(inputs: NormalizedSocialCommentInput[]): SocialCommentPreparedRecord[] {
  const byIdentity = new Map<string, SocialCommentUpsertPayload>()
  const byIdentityInput = new Map<string, NormalizedSocialCommentInput>()
  for (const input of inputs) {
    const payload = buildSocialCommentUpsertPayload(input)
    const key = buildSocialCommentIdempotencyKey({
      publishId: payload.publish_id,
      provider: payload.provider,
      platform: payload.platform,
      providerCommentId: payload.provider_comment_id,
    })
    byIdentity.set(key, payload)
    byIdentityInput.set(key, input)
  }
  return [...byIdentity].map(([key, row]) => ({
    input: byIdentityInput.get(key) as NormalizedSocialCommentInput,
    row,
  }))
}

function commentIdentityKey(row: Pick<SocialCommentUpsertPayload, 'publish_id' | 'provider' | 'provider_comment_id'>) {
  return `${row.publish_id}:${row.provider}:${row.provider_comment_id}`
}

function provided<T extends keyof NormalizedSocialCommentInput>(
  input: NormalizedSocialCommentInput,
  key: T,
) {
  return input[key] !== undefined
}

function setIfProvided<T extends keyof SocialCommentProviderOwnedUpdatePayload>(
  patch: SocialCommentProviderOwnedUpdatePayload,
  key: T,
  value: SocialCommentProviderOwnedUpdatePayload[T] | undefined,
) {
  if (value !== undefined) {
    patch[key] = value
  }
}

function buildProviderOwnedCommentUpdate(record: SocialCommentPreparedRecord): SocialCommentProviderOwnedUpdatePayload {
  const { input, row } = record
  const patch: SocialCommentProviderOwnedUpdatePayload = {
    content_id: row.content_id,
    platform: row.platform,
    body: row.body,
    captured_at: row.captured_at,
    provider_capability: row.provider_capability,
  }

  setIfProvided(patch, 'provider_parent_comment_id', provided(input, 'providerParentCommentId') ? row.provider_parent_comment_id : undefined)
  setIfProvided(patch, 'thread_id', provided(input, 'threadId') ? row.thread_id : undefined)
  setIfProvided(patch, 'record_type', provided(input, 'recordType') ? row.record_type : undefined)
  setIfProvided(patch, 'author_public_handle', provided(input, 'authorPublicHandle') ? row.author_public_handle : undefined)
  setIfProvided(patch, 'author_display_name', provided(input, 'authorDisplayName') ? row.author_display_name : undefined)
  setIfProvided(patch, 'author_profile_url', provided(input, 'authorProfileUrl') ? row.author_profile_url : undefined)
  setIfProvided(patch, 'author_is_channel_owner', provided(input, 'authorIsChannelOwner') ? row.author_is_channel_owner : undefined)
  setIfProvided(patch, 'comment_url', provided(input, 'commentUrl') ? row.comment_url : undefined)
  setIfProvided(patch, 'provider_created_at', provided(input, 'providerCreatedAt') ? row.provider_created_at : undefined)
  setIfProvided(patch, 'provider_updated_at', provided(input, 'providerUpdatedAt') ? row.provider_updated_at : undefined)
  setIfProvided(patch, 'ingestion_run_id', provided(input, 'ingestionRunId') ? row.ingestion_run_id : undefined)
  setIfProvided(patch, 'raw_payload', provided(input, 'rawPayload') ? row.raw_payload : undefined)

  return patch
}

export function buildSocialCommentIngestionRunInsert(input: {
  platform: SocialPlatform
  provider?: string | null
  publishId?: string | null
  contentId?: string | null
  status?: SocialCommentIngestionRunStatus
  cursorMetadata?: Record<string, unknown>
  windowStartAt?: string | null
  windowEndAt?: string | null
  counts?: Partial<Pick<
    SocialCommentIngestionRunInsert,
    'fetched_count' | 'inserted_count' | 'updated_count' | 'skipped_count' | 'error_count'
  >>
  errors?: Array<Record<string, unknown>>
  metadata?: Record<string, unknown>
}): SocialCommentIngestionRunInsert {
  const capability = getCommentProviderCapability(input.platform)
  const errors = input.errors ?? []
  return {
    provider: optionalTrimmed(input.provider) ?? capability.provider,
    platform: input.platform,
    publish_id: optionalTrimmed(input.publishId),
    content_id: optionalTrimmed(input.contentId),
    status: input.status ?? (capability.supportsCommentIngestion ? 'pending' : 'manual_blocked'),
    cursor_metadata: input.cursorMetadata ?? {},
    window_start_at: optionalTrimmed(input.windowStartAt),
    window_end_at: optionalTrimmed(input.windowEndAt),
    fetched_count: input.counts?.fetched_count ?? 0,
    inserted_count: input.counts?.inserted_count ?? 0,
    updated_count: input.counts?.updated_count ?? 0,
    skipped_count: input.counts?.skipped_count ?? 0,
    error_count: input.counts?.error_count ?? errors.length,
    errors,
    metadata: input.metadata ?? {},
  }
}

export async function upsertSocialContentComments(input: {
  db: SupabaseCommentClientLike
  comments: NormalizedSocialCommentInput[]
}) {
  const records = prepareSocialCommentRecords(input.comments)
  const rows = records.map(({ row }) => row)
  if (!rows.length) return { data: [], upserted: 0 }

  const insertResult = await input.db
    .from('social_content_comments')
    .upsert(rows, {
      onConflict: 'publish_id,provider,provider_comment_id',
      ignoreDuplicates: true,
    })
    .select('*')

  if (insertResult.error) throw new Error(insertResult.error.message)

  const insertedKeys = new Set(
    ((insertResult.data ?? []) as SocialCommentIdentityRow[]).map(commentIdentityKey),
  )
  const data: unknown[] = []
  data.push(...(insertResult.data ?? []))

  for (const record of records) {
    const row = record.row
    const updateResult = await input.db
      .from('social_content_comments')
      .update(buildProviderOwnedCommentUpdate(record))
      .eq('publish_id', row.publish_id)
      .eq('provider', row.provider)
      .eq('provider_comment_id', row.provider_comment_id)
      .select('*')

    if (updateResult.error) throw new Error(updateResult.error.message)
    if (!insertedKeys.has(commentIdentityKey(row))) {
      data.push(...(updateResult.data ?? []))
    }
  }

  return { data, upserted: rows.length }
}
