import { supabaseAdmin } from '@/lib/supabase'
import type { SocialPlatform } from '@/lib/social-content'

export type SocialCommentAttentionRow = {
  id: string
  content_id: string | null
  platform: SocialPlatform | string | null
  publish_id?: string | null
  provider?: string | null
  provider_comment_id?: string | null
  comment_url?: string | null
  author_display_name?: string | null
  body?: string | null
  classification_status?: string | null
  classification_reason?: string | null
  sentiment?: string | null
  priority?: string | null
  status?: string | null
  response_approval_state?: string | null
  reply_submission_state?: string | null
  proposed_reply_text?: string | null
  approved_reply_text?: string | null
  provider_capability?: Record<string, unknown> | null
  captured_at?: string | null
  updated_at?: string | null
  metadata?: Record<string, unknown> | null
}

export type SocialCommentAttentionReadResult = {
  rows: SocialCommentAttentionRow[]
  dataSurfaceReady: boolean
  reason?: string
}

export type CommentReplyHoldEvaluation = {
  state: 'not_ready' | 'waiting_hold' | 'ready_for_provider_send' | 'manual_required' | 'blocked'
  reason: string
  holdUntil: string | null
  remainingMs: number
  externalSubmissionAllowed: false
}

export type SocialCommentAttentionCronResult = {
  ok: boolean
  checkedCount: number
  readyForProviderSendCount: number
  manualRequiredCount: number
  blockedCount: number
  waitingHoldCount: number
  dataSurfaceReady: boolean
  reason?: string
  evaluations: Array<{
    commentId: string
    contentId: string | null
    platform: string | null
    state: CommentReplyHoldEvaluation['state']
    reason: string
    holdUntil: string | null
  }>
}

const POLICY_LOW_RISK_CLASSIFICATIONS = new Set(['low_risk_acknowledgement'])
const ATTENTION_CLASSIFICATION_STATUSES = new Set(['unreviewed', 'needs_response'])
const ATTENTION_REPLY_STATES = new Set(['draft', 'failed', 'blocked'])
const RESOLVED_CLASSIFICATION_STATUSES = new Set(['answered', 'spam', 'blocked', 'ignored'])
const RESOLVED_VISIBILITY_STATUSES = new Set(['hidden', 'deleted', 'blocked'])
const HIGH_ATTENTION_CLASSIFICATIONS = new Set([
  'substantive_question',
  'buying_lead_intent',
  'partnership_intent',
  'criticism_negative',
  'misinformation_unsupported_claim',
  'sensitive_privacy_legal_financial',
  'provider_manual_ambiguity',
])

function isMissingCommentSurfaceError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return error.code === '42P01'
    || error.code === '42703'
    || message.includes('does not exist')
    || message.includes('schema cache')
    || message.includes('could not find')
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function metadataString(row: SocialCommentAttentionRow, keys: string[]) {
  const metadata = record(row.metadata)
  for (const key of keys) {
    const value = metadata?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalized(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function booleanSetting(value: unknown) {
  if (value === true) return true
  if (typeof value !== 'string') return false
  return ['true', 'yes', 'enabled', 'supported', 'verified', 'ready'].includes(value.trim().toLowerCase())
}

function policyDecision(row: SocialCommentAttentionRow) {
  const metadata = record(row.metadata)
  return record(metadata?.policy_decision)
    ?? record(metadata?.comment_policy_decision)
    ?? record(metadata?.policyDecision)
}

function autoSendDecision(row: SocialCommentAttentionRow) {
  return record(policyDecision(row)?.autoSend)
}

function policyClassification(row: SocialCommentAttentionRow) {
  const decision = policyDecision(row)
  const value = decision?.classification
  return typeof value === 'string' ? value : null
}

function isPolicyLowRisk(row: SocialCommentAttentionRow) {
  const decision = policyDecision(row)
  const classification = policyClassification(row)
  const humanQaRequired = decision?.humanQaRequired === true
  const autoSend = autoSendDecision(row)
  return Boolean(
    classification
    && POLICY_LOW_RISK_CLASSIFICATIONS.has(classification)
    && !humanQaRequired
    && autoSend?.eligible === true,
  )
}

function providerReplySupported(row: SocialCommentAttentionRow) {
  const capability = record(row.provider_capability)
  return capability?.supports_reply_submission === true || booleanSetting(record(row.metadata)?.provider_reply_supported)
}

function providerExternalSubmissionEnabled(row: SocialCommentAttentionRow) {
  const capability = record(row.provider_capability)
  return capability?.external_submission_enabled === true || booleanSetting(record(row.metadata)?.external_submission_enabled)
}

export function socialCommentDeepLink(row: Pick<SocialCommentAttentionRow, 'id' | 'content_id'>) {
  const base = row.content_id
    ? `/admin/social-content/${row.content_id}`
    : '/admin/social-content/comments'
  return `${base}?comment=${encodeURIComponent(row.id)}`
}

export function socialCommentPostTitle(row: SocialCommentAttentionRow) {
  return metadataString(row, ['post_title', 'social_content_title', 'title', 'post_label'])
    || row.content_id
    || 'Unknown post'
}

export function socialCommentDraftState(row: SocialCommentAttentionRow) {
  const state = row.reply_submission_state?.trim() || metadataString(row, ['reply_submission_state', 'draft_state'])
  if (state) return state
  return row.proposed_reply_text?.trim() || row.approved_reply_text?.trim() ? 'draft' : 'no draft'
}

function replyText(row: SocialCommentAttentionRow) {
  return row.approved_reply_text?.trim() || row.proposed_reply_text?.trim() || ''
}

export function needsCommentAttention(row: SocialCommentAttentionRow) {
  if (RESOLVED_VISIBILITY_STATUSES.has(normalized(row.status))) return false
  if (RESOLVED_CLASSIFICATION_STATUSES.has(normalized(row.classification_status))) return false
  if (['urgent', 'high'].includes(normalized(row.priority))) return true
  if (HIGH_ATTENTION_CLASSIFICATIONS.has(normalized(policyClassification(row)))) return true
  if (ATTENTION_CLASSIFICATION_STATUSES.has(normalized(row.classification_status))) return true
  if (ATTENTION_REPLY_STATES.has(normalized(row.reply_submission_state))) return true
  return Boolean(replyText(row) && row.response_approval_state === 'pending')
}

export function canSlackDecideCommentReply(row: SocialCommentAttentionRow) {
  const replyPrepared = Boolean(replyText(row))
    && row.response_approval_state === 'pending'
    && row.reply_submission_state === 'draft'
  return replyPrepared
    && isPolicyLowRisk(row)
    && providerReplySupported(row)
    && providerExternalSubmissionEnabled(row)
}

export function commentReplyHoldUntil(now = new Date(), holdMinutes = 15) {
  return new Date(now.getTime() + holdMinutes * 60 * 1000).toISOString()
}

export function evaluateCommentReplyHold(row: SocialCommentAttentionRow, now = new Date()): CommentReplyHoldEvaluation {
  const slackDecision = record(record(row.metadata)?.slack_reply_decision)
  const holdUntil = metadataString(row, ['reply_hold_until']) ?? (
    typeof slackDecision?.hold_until === 'string' ? slackDecision.hold_until : null
  )
  const holdTime = holdUntil ? new Date(holdUntil).getTime() : Number.NaN
  const remainingMs = Number.isFinite(holdTime) ? Math.max(0, holdTime - now.getTime()) : 0

  if (normalized(row.response_approval_state) !== 'approved' || normalized(row.reply_submission_state) !== 'approved') {
    return {
      state: 'not_ready',
      reason: 'Reply is not approved for the hold queue.',
      holdUntil: holdUntil ?? null,
      remainingMs: 0,
      externalSubmissionAllowed: false,
    }
  }
  if (!replyText(row)) {
    return {
      state: 'blocked',
      reason: 'Approved comment has no prepared reply draft.',
      holdUntil: holdUntil ?? null,
      remainingMs: 0,
      externalSubmissionAllowed: false,
    }
  }
  if (remainingMs > 0) {
    return {
      state: 'waiting_hold',
      reason: '15-minute auto-send hold is still active.',
      holdUntil,
      remainingMs,
      externalSubmissionAllowed: false,
    }
  }
  if (!providerReplySupported(row) || !providerExternalSubmissionEnabled(row)) {
    return {
      state: 'manual_required',
      reason: 'Provider reply capability is unsupported or unverified; keep the reply in Portfolio for manual handling.',
      holdUntil: holdUntil ?? null,
      remainingMs: 0,
      externalSubmissionAllowed: false,
    }
  }
  if (!isPolicyLowRisk(row)) {
    return {
      state: 'blocked',
      reason: 'Policy or data state no longer qualifies the reply for low-risk send evaluation.',
      holdUntil: holdUntil ?? null,
      remainingMs: 0,
      externalSubmissionAllowed: false,
    }
  }
  return {
    state: 'ready_for_provider_send',
    reason: 'Hold elapsed and all known gates are satisfied. Scheduled evaluation stops before any external provider write.',
    holdUntil: holdUntil ?? null,
    remainingMs: 0,
    externalSubmissionAllowed: false,
  }
}

export async function listSocialCommentAttentionRows(limit = 10): Promise<SocialCommentAttentionReadResult> {
  if (!supabaseAdmin) return { rows: [], dataSurfaceReady: false, reason: 'Database not available' }

  const { data, error } = await supabaseAdmin
    .from('social_content_comments')
    .select('id, publish_id, content_id, platform, provider, provider_comment_id, comment_url, author_display_name, body, classification_status, classification_reason, sentiment, priority, status, response_approval_state, reply_submission_state, proposed_reply_text, approved_reply_text, provider_capability, captured_at, updated_at, metadata')
    .in('classification_status', ['unreviewed', 'needs_response'])
    .order('captured_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingCommentSurfaceError(error)) {
      return {
        rows: [],
        dataSurfaceReady: false,
        reason: 'Comment inbox data surface is not available yet; provider ingestion remains manual.',
      }
    }
    throw new Error(`Failed to read Social Content comment attention rows: ${error.message}`)
  }

  return {
    rows: ((data ?? []) as SocialCommentAttentionRow[]).filter(needsCommentAttention),
    dataSurfaceReady: true,
  }
}

async function listApprovedHoldRows(limit = 25): Promise<SocialCommentAttentionReadResult> {
  if (!supabaseAdmin) return { rows: [], dataSurfaceReady: false, reason: 'Database not available' }

  const { data, error } = await supabaseAdmin
    .from('social_content_comments')
    .select('id, publish_id, content_id, platform, provider, provider_comment_id, response_approval_state, reply_submission_state, proposed_reply_text, approved_reply_text, provider_capability, metadata')
    .eq('response_approval_state', 'approved')
    .eq('reply_submission_state', 'approved')
    .order('updated_at', { ascending: true })
    .limit(limit)

  if (error) {
    if (isMissingCommentSurfaceError(error)) {
      return {
        rows: [],
        dataSurfaceReady: false,
        reason: 'Comment inbox data surface is not available yet; 15-minute hold evaluation is pending the data lane.',
      }
    }
    throw new Error(`Failed to read Social Content comment reply holds: ${error.message}`)
  }

  return { rows: (data ?? []) as SocialCommentAttentionRow[], dataSurfaceReady: true }
}

async function updateCommentHoldEvaluation(row: SocialCommentAttentionRow, evaluation: CommentReplyHoldEvaluation) {
  if (!supabaseAdmin || evaluation.state === 'waiting_hold' || evaluation.state === 'not_ready') return
  const metadata = record(row.metadata) ?? {}
  const replyStatus = evaluation.state === 'ready_for_provider_send'
    ? 'approved'
    : 'blocked'

  await supabaseAdmin
    .from('social_content_comments')
    .update({
      reply_submission_state: replyStatus,
      metadata: {
        ...metadata,
        auto_send_hold_evaluation: {
          evaluated_at: new Date().toISOString(),
          state: evaluation.state,
          reason: evaluation.reason,
          external_submission_performed: false,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
}

export async function evaluateSocialCommentReplyHolds(limit = 25, now = new Date()): Promise<SocialCommentAttentionCronResult> {
  const read = await listApprovedHoldRows(limit)
  const evaluations: SocialCommentAttentionCronResult['evaluations'] = []
  let readyForProviderSendCount = 0
  let manualRequiredCount = 0
  let blockedCount = 0
  let waitingHoldCount = 0

  for (const row of read.rows) {
    const evaluation = evaluateCommentReplyHold(row, now)
    if (evaluation.state === 'ready_for_provider_send') readyForProviderSendCount += 1
    if (evaluation.state === 'manual_required') manualRequiredCount += 1
    if (evaluation.state === 'blocked') blockedCount += 1
    if (evaluation.state === 'waiting_hold') waitingHoldCount += 1
    await updateCommentHoldEvaluation(row, evaluation)
    evaluations.push({
      commentId: row.id,
      contentId: row.content_id,
      platform: row.platform,
      state: evaluation.state,
      reason: evaluation.reason,
      holdUntil: evaluation.holdUntil,
    })
  }

  return {
    ok: true,
    checkedCount: read.rows.length,
    readyForProviderSendCount,
    manualRequiredCount,
    blockedCount,
    waitingHoldCount,
    dataSurfaceReady: read.dataSurfaceReady,
    reason: read.reason,
    evaluations,
  }
}

export async function decideSocialCommentReplyFromSlack(input: {
  commentId: string
  status: 'approved' | 'rejected'
  actorLabel: string
  slackUserId: string
  decisionNotes: string
  idempotencyKey: string
}) {
  if (!supabaseAdmin) throw new Error('Database not available')

  const { data, error } = await supabaseAdmin
    .from('social_content_comments')
    .select('id, publish_id, content_id, platform, provider, provider_comment_id, response_approval_state, reply_submission_state, proposed_reply_text, approved_reply_text, provider_capability, metadata')
    .eq('id', input.commentId)
    .maybeSingle()

  if (error || !data?.id) throw new Error('Comment not found')
  const row = data as SocialCommentAttentionRow
  if (!canSlackDecideCommentReply(row)) {
    return `Portfolio review required for this comment reply. Open: ${socialCommentDeepLink(row)}`
  }

  const metadata = record(row.metadata) ?? {}
  const decidedAt = new Date().toISOString()
  const holdUntil = input.status === 'approved' ? commentReplyHoldUntil(new Date(decidedAt)) : null
  const update = input.status === 'approved'
    ? {
        response_approval_state: 'approved',
        reply_submission_state: 'approved',
        approved_reply_text: row.approved_reply_text || row.proposed_reply_text || null,
      }
    : {
        response_approval_state: 'rejected',
        reply_submission_state: 'blocked',
      }

  const { error: updateError } = await supabaseAdmin
    .from('social_content_comments')
    .update({
      ...update,
      metadata: {
        ...metadata,
        reply_hold_until: holdUntil,
        slack_reply_decision: {
          status: input.status,
          decision_notes: input.decisionNotes,
          decided_by_slack_user_id: input.slackUserId,
          decided_by_label: input.actorLabel,
          decided_at: decidedAt,
          hold_until: holdUntil,
          idempotency_key: input.idempotencyKey,
          external_submission_performed: false,
        },
      },
      updated_at: decidedAt,
    })
    .eq('id', row.id)

  if (updateError) throw new Error(`Failed to update comment reply decision: ${updateError.message}`)

  return input.status === 'approved'
    ? `Reply approved from Slack. It is held for 15 minutes before any provider-send eligibility check. Portfolio: ${socialCommentDeepLink(row)}`
    : `Reply rejected from Slack. Portfolio: ${socialCommentDeepLink(row)}`
}
