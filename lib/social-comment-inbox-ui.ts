import type { SocialPlatform } from '@/lib/social-content'
import {
  getCommentProviderCapability,
  serializeCommentProviderCapability,
  type SocialCommentClassificationStatus,
  type SocialCommentPriority,
  type SocialCommentProviderCapabilitySnapshot,
  type SocialCommentReplySubmissionState,
  type SocialCommentResponseApprovalState,
} from '@/lib/social-comment-inbox'

// TODO(comment-inbox-integration): Keep this as a UI-only projection over the
// canonical #762 social_content_comments contract. Remove it once shared view
// models are promoted by the data/provider lane.
export type SocialCommentStatus =
  | 'new'
  | 'needs_qa'
  | 'auto_send_pending'
  | 'lead'
  | 'escalated'
  | 'responded'
  | 'ignored'

export type SocialCommentAction =
  | 'refresh_request'
  | 'draft_response'
  | 'approve'
  | 'reject'
  | 'return_to_review'
  | 'ignore'
  | 'submit'

export interface SocialCommentProviderCapabilityUi {
  provider: string
  automaticReply: boolean
  verified: boolean
  humanGateSatisfied: boolean
  blocker: string | null
  recoveryPath: string
}

export interface SocialCommentActionHistoryItem {
  action: SocialCommentAction | 'submit_blocked'
  at: string
  by: string | null
  note: string | null
}

export interface SocialCommentInboxItem {
  id: string
  socialContentId: string
  platform: SocialPlatform
  providerCommentId: string | null
  providerPermalink: string | null
  authorDisplayName: string
  body: string
  status: SocialCommentStatus
  classification: {
    label: string
    priority: 'low' | 'medium' | 'high'
    reason: string | null
  }
  draftReply: string
  approvalState: 'not_started' | 'drafted' | 'approved' | 'rejected'
  providerCapability: SocialCommentProviderCapabilityUi
  actionHistory: SocialCommentActionHistoryItem[]
  createdAt: string | null
  updatedAt: string | null
  campaignId: string | null
  campaignLabel: string | null
  postLabel: string
  postExcerpt: string
}

export interface SocialCommentInboxSummary {
  total: number
  new: number
  needs_qa: number
  auto_send_pending: number
  lead: number
  escalated: number
  responded: number
  ignored: number
}

export interface SocialCommentInboxFilters {
  status?: SocialCommentStatus | 'all'
  platform?: SocialPlatform | 'all'
  campaign?: string | 'all'
  post?: string | 'all'
}

export type SocialCommentCanonicalRow = {
  id?: unknown
  content_id?: unknown
  platform?: unknown
  provider?: unknown
  provider_comment_id?: unknown
  author_display_name?: unknown
  author_public_handle?: unknown
  body?: unknown
  comment_url?: unknown
  classification_status?: unknown
  classification_reason?: unknown
  priority?: unknown
  response_approval_state?: unknown
  reply_submission_state?: unknown
  proposed_reply_text?: unknown
  approved_reply_text?: unknown
  reply_provider_comment_id?: unknown
  reply_submitted_at?: unknown
  provider_capability?: unknown
  captured_at?: unknown
  updated_at?: unknown
  metadata?: unknown
}

export type SocialCommentPostProjection = {
  id?: unknown
  platform?: unknown
  post_text?: unknown
  cta_text?: unknown
  youtube_title?: unknown
  rag_context?: unknown
}

export const SOCIAL_COMMENT_STATUSES: Array<{ value: SocialCommentStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'needs_qa', label: 'Needs QA' },
  { value: 'auto_send_pending', label: 'Auto-send pending' },
  { value: 'lead', label: 'Lead' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'responded', label: 'Responded' },
  { value: 'ignored', label: 'Ignored' },
]

const SUPPORTED_PLATFORMS = new Set<SocialPlatform>(['linkedin', 'instagram', 'facebook', 'youtube', 'tiktok', 'x'])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringOrNull(value: unknown): string | null {
  const text = asString(value)
  return text || null
}

function asBoolean(value: unknown) {
  return value === true
}

function asPlatform(value: unknown, fallback: SocialPlatform = 'linkedin'): SocialPlatform {
  return typeof value === 'string' && SUPPORTED_PLATFORMS.has(value as SocialPlatform)
    ? value as SocialPlatform
    : fallback
}

function asClassificationStatus(value: unknown): SocialCommentClassificationStatus {
  const raw = asString(value)
  if (['unreviewed', 'needs_response', 'answered', 'spam', 'blocked', 'ignored'].includes(raw)) {
    return raw as SocialCommentClassificationStatus
  }
  return 'unreviewed'
}

function asReplyState(value: unknown): SocialCommentReplySubmissionState {
  const raw = asString(value)
  if (['not_applicable', 'draft', 'approved', 'submitted', 'failed', 'blocked'].includes(raw)) {
    return raw as SocialCommentReplySubmissionState
  }
  return 'not_applicable'
}

function asApprovalState(value: unknown): SocialCommentResponseApprovalState {
  const raw = asString(value)
  if (['not_required', 'pending', 'approved', 'rejected', 'blocked'].includes(raw)) {
    return raw as SocialCommentResponseApprovalState
  }
  return 'not_required'
}

function asPriority(value: unknown): SocialCommentPriority {
  const raw = asString(value)
  if (['low', 'normal', 'high', 'urgent'].includes(raw)) return raw as SocialCommentPriority
  return 'normal'
}

function uiPriority(priority: SocialCommentPriority): SocialCommentInboxItem['classification']['priority'] {
  if (priority === 'urgent' || priority === 'high') return 'high'
  if (priority === 'normal') return 'medium'
  return 'low'
}

function classificationLabel(status: SocialCommentClassificationStatus, metadata: Record<string, unknown>) {
  const policyDecision = asRecord(metadata.policy_decision)
  const classification = asString(policyDecision.classification)
  if (classification) return classification.replace(/_/g, ' ')
  return status.replace(/_/g, ' ')
}

function actionHistoryFromMetadata(metadata: Record<string, unknown>): SocialCommentActionHistoryItem[] {
  const rawHistory = Array.isArray(metadata.ui_action_history)
    ? metadata.ui_action_history
    : Array.isArray(metadata.action_history)
      ? metadata.action_history
      : []

  return rawHistory.map((entry) => {
    const record = asRecord(entry)
    const action = asString(record.action) || 'refresh_request'
    return {
      action: action as SocialCommentActionHistoryItem['action'],
      at: asString(record.at) || new Date(0).toISOString(),
      by: asStringOrNull(record.by),
      note: asStringOrNull(record.note),
    }
  })
}

function normalizeCapability(row: SocialCommentCanonicalRow, platform: SocialPlatform, approvalState: SocialCommentResponseApprovalState) {
  const fallback = serializeCommentProviderCapability(getCommentProviderCapability(platform))
  const snapshot = {
    ...fallback,
    ...asRecord(row.provider_capability),
  } as SocialCommentProviderCapabilitySnapshot
  const verified = snapshot.capability_status === 'verified'
  const automaticReply = Boolean(
    verified
    && snapshot.supports_reply_submission
    && snapshot.external_submission_enabled,
  )
  const provider = asString(row.provider) || getCommentProviderCapability(platform).provider
  const humanGateSatisfied = approvalState === 'approved'
  const blocker = automaticReply && humanGateSatisfied
    ? null
    : [
      !verified ? `Provider capability is ${snapshot.capability_status || 'unverified'}.` : null,
      !snapshot.supports_reply_submission ? 'Reply submission is not enabled for this provider.' : null,
      !snapshot.external_submission_enabled ? 'External submission is disabled by the provider/data contract.' : null,
      !humanGateSatisfied ? 'Human approval is required before any reply can be submitted.' : null,
    ].filter(Boolean).join(' ')

  return {
    provider,
    automaticReply,
    verified,
    humanGateSatisfied,
    blocker,
    recoveryPath: snapshot.gate_notes || 'Use the provider permalink to handle this comment manually, then return here to record the local decision.',
  }
}

function uiApprovalState(
  approvalState: SocialCommentResponseApprovalState,
  replyState: SocialCommentReplySubmissionState,
): SocialCommentInboxItem['approvalState'] {
  if (approvalState === 'approved') return 'approved'
  if (approvalState === 'rejected' || approvalState === 'blocked') return 'rejected'
  if (replyState === 'draft' || approvalState === 'pending') return 'drafted'
  return 'not_started'
}

function uiStatus(input: {
  classificationStatus: SocialCommentClassificationStatus
  approvalState: SocialCommentResponseApprovalState
  replyState: SocialCommentReplySubmissionState
  hasSubmittedEvidence: boolean
  priority: SocialCommentPriority
  metadata: Record<string, unknown>
}) {
  const policyDecision = asRecord(input.metadata.policy_decision)
  const classification = asString(policyDecision.classification)
  const humanQaReasons = Array.isArray(policyDecision.human_qa_reasons)
    ? policyDecision.human_qa_reasons.map(String)
    : []

  if (input.replyState === 'submitted' || input.hasSubmittedEvidence) return 'responded'
  if (input.classificationStatus === 'ignored' || input.classificationStatus === 'spam') return 'ignored'
  if (input.classificationStatus === 'answered') return 'responded'
  if (
    input.classificationStatus === 'blocked'
    || input.approvalState === 'blocked'
    || input.priority === 'urgent'
    || classification === 'provider_manual_ambiguity'
    || humanQaReasons.some((reason) => reason.includes('provider_ambiguity') || reason.includes('privacy') || reason.includes('legal'))
  ) {
    return 'escalated'
  }
  if (classification === 'buying_lead_intent' || classification === 'partnership_intent') return 'lead'
  if (input.replyState === 'approved') return 'auto_send_pending'
  if (
    input.classificationStatus === 'needs_response'
    || input.replyState === 'draft'
    || input.replyState === 'failed'
    || input.replyState === 'blocked'
    || input.approvalState === 'pending'
    || input.approvalState === 'rejected'
  ) {
    return 'needs_qa'
  }
  return 'new'
}

function postProjection(post: SocialCommentPostProjection | undefined, contentId: string) {
  const rag = asRecord(post?.rag_context)
  const campaignId = asStringOrNull(rag.campaign_id)
  const campaignLabel = asStringOrNull(rag.campaign_label) || asStringOrNull(rag.campaign_name)
  const label = asString(rag.planned_angle) || asString(post?.youtube_title) || `Post ${contentId.slice(0, 8)}`
  const excerpt = (asString(post?.post_text) || asString(post?.cta_text) || 'No post copy available.').slice(0, 220)
  return { campaignId, campaignLabel, label, excerpt }
}

export function getSocialCommentInboxItem(
  row: SocialCommentCanonicalRow,
  post?: SocialCommentPostProjection,
): SocialCommentInboxItem {
  const platform = asPlatform(row.platform, asPlatform(post?.platform))
  const metadata = asRecord(row.metadata)
  const classificationStatus = asClassificationStatus(row.classification_status)
  const replyState = asReplyState(row.reply_submission_state)
  const approvalState = asApprovalState(row.response_approval_state)
  const priority = asPriority(row.priority)
  const socialContentId = asString(row.content_id) || asString(post?.id)
  const postInfo = postProjection(post, socialContentId || 'unknown')
  const hasSubmittedEvidence = Boolean(
    asString(row.reply_provider_comment_id)
    || asString(row.reply_submitted_at)
  )

  return {
    id: asString(row.id) || asString(row.provider_comment_id) || `${socialContentId || platform}-comment`,
    socialContentId,
    platform,
    providerCommentId: asStringOrNull(row.provider_comment_id),
    providerPermalink: asStringOrNull(row.comment_url),
    authorDisplayName: asString(row.author_display_name) || asString(row.author_public_handle) || 'Unknown commenter',
    body: asString(row.body) || 'No comment text imported.',
    status: uiStatus({ classificationStatus, approvalState, replyState, hasSubmittedEvidence, priority, metadata }),
    classification: {
      label: classificationLabel(classificationStatus, metadata),
      priority: uiPriority(priority),
      reason: asStringOrNull(row.classification_reason),
    },
    draftReply: asString(row.proposed_reply_text) || asString(row.approved_reply_text),
    approvalState: uiApprovalState(approvalState, replyState),
    providerCapability: normalizeCapability(row, platform, approvalState),
    actionHistory: actionHistoryFromMetadata(metadata),
    createdAt: asStringOrNull(row.captured_at),
    updatedAt: asStringOrNull(row.updated_at),
    campaignId: postInfo.campaignId,
    campaignLabel: postInfo.campaignLabel,
    postLabel: postInfo.label,
    postExcerpt: postInfo.excerpt,
  }
}

export function getSocialCommentInboxItems(
  rows: SocialCommentCanonicalRow[],
  postsByContentId: Map<string, SocialCommentPostProjection> = new Map(),
): SocialCommentInboxItem[] {
  return rows.map((row) => getSocialCommentInboxItem(row, postsByContentId.get(asString(row.content_id))))
}

export function summarizeSocialCommentInbox(items: SocialCommentInboxItem[]): SocialCommentInboxSummary {
  const summary: SocialCommentInboxSummary = {
    total: items.length,
    new: 0,
    needs_qa: 0,
    auto_send_pending: 0,
    lead: 0,
    escalated: 0,
    responded: 0,
    ignored: 0,
  }
  for (const item of items) {
    summary[item.status] += 1
  }
  return summary
}

export function filterSocialCommentInboxItems(
  items: SocialCommentInboxItem[],
  filters: SocialCommentInboxFilters,
) {
  return items.filter((item) => {
    // filter === 'all' → no restriction on status
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false
    // filter === 'all' → no restriction on platform
    if (filters.platform && filters.platform !== 'all' && item.platform !== filters.platform) return false
    // filter === 'all' → no restriction on campaign
    if (filters.campaign && filters.campaign !== 'all') {
      const campaignNeedle = filters.campaign.toLowerCase()
      if (![item.campaignId, item.campaignLabel].filter(Boolean).some((value) => value?.toLowerCase().includes(campaignNeedle))) {
        return false
      }
    }
    if (filters.post && filters.post !== 'all') {
      // filter === 'all' → no restriction on post
      const postNeedle = filters.post.toLowerCase()
      if (![item.socialContentId, item.postLabel, item.postExcerpt].some((value) => value.toLowerCase().includes(postNeedle))) {
        return false
      }
    }
    return true
  })
}
