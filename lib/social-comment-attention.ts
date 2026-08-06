import { supabaseAdmin } from '@/lib/supabase'
import type { SocialPlatform } from '@/lib/social-content'

export type SocialCommentAttentionRow = {
  id: string
  content_id: string | null
  platform: SocialPlatform | string | null
  platform_post_url?: string | null
  post_title?: string | null
  author_display_name?: string | null
  comment_text?: string | null
  classification?: string | null
  priority?: string | null
  status?: string | null
  received_at?: string | null
  updated_at?: string | null
  reply_draft?: string | null
  reply_status?: string | null
  reply_hold_until?: string | null
  policy_eligibility?: string | boolean | null
  provider_capability?: string | boolean | null
  provider_verified?: boolean | null
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

const LOW_RISK_POLICY_VALUES = new Set(['low_risk', 'slack_approvable', 'auto_reply_low_risk', 'approved'])
const PREPARED_REPLY_STATUSES = new Set(['prepared', 'drafted', 'pending_approval', 'ready_for_approval'])
const ATTENTION_STATUSES = new Set(['new', 'unresolved', 'needs_attention', 'reply_drafted', 'pending_approval'])
const RESOLVED_STATUSES = new Set(['resolved', 'closed', 'hidden', 'spam', 'ignored'])
const HIGH_ATTENTION_CLASSIFICATIONS = new Set([
  'complaint',
  'question',
  'support_request',
  'lead_opportunity',
  'high_intent',
  'safety',
  'reputation_risk',
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

function providerReplySupported(row: SocialCommentAttentionRow) {
  return row.provider_capability === true
    || ['reply', 'thread_reply', 'auto_reply', 'automatic_reply'].includes(normalized(row.provider_capability))
    || booleanSetting(record(row.metadata)?.provider_reply_supported)
}

function providerVerified(row: SocialCommentAttentionRow) {
  return row.provider_verified === true || booleanSetting(record(row.metadata)?.provider_verified)
}

export function socialCommentDeepLink(row: Pick<SocialCommentAttentionRow, 'id' | 'content_id'>) {
  const base = row.content_id
    ? `/admin/social-content/${row.content_id}`
    : '/admin/social-content/comments'
  return `${base}?comment=${encodeURIComponent(row.id)}`
}

export function socialCommentPostTitle(row: SocialCommentAttentionRow) {
  return row.post_title?.trim()
    || metadataString(row, ['post_title', 'social_content_title', 'title'])
    || row.content_id
    || 'Unknown post'
}

export function socialCommentDraftState(row: SocialCommentAttentionRow) {
  const replyStatus = row.reply_status?.trim() || metadataString(row, ['reply_status', 'draft_state'])
  if (replyStatus) return replyStatus
  return row.reply_draft?.trim() ? 'drafted' : 'no draft'
}

export function needsCommentAttention(row: SocialCommentAttentionRow) {
  if (RESOLVED_STATUSES.has(normalized(row.status))) return false
  if (['urgent', 'high'].includes(normalized(row.priority))) return true
  if (HIGH_ATTENTION_CLASSIFICATIONS.has(normalized(row.classification))) return true
  if (ATTENTION_STATUSES.has(normalized(row.status))) return true
  return Boolean(row.reply_draft?.trim() && PREPARED_REPLY_STATUSES.has(normalized(row.reply_status)))
}

export function canSlackDecideCommentReply(row: SocialCommentAttentionRow) {
  const policyValue = row.policy_eligibility === true
    ? 'approved'
    : normalized(row.policy_eligibility || record(row.metadata)?.policy_eligibility)
  const replyPrepared = Boolean(row.reply_draft?.trim()) && PREPARED_REPLY_STATUSES.has(normalized(row.reply_status))
  return replyPrepared
    && LOW_RISK_POLICY_VALUES.has(policyValue)
    && providerReplySupported(row)
    && providerVerified(row)
}

export function commentReplyHoldUntil(now = new Date(), holdMinutes = 15) {
  return new Date(now.getTime() + holdMinutes * 60 * 1000).toISOString()
}

export function evaluateCommentReplyHold(row: SocialCommentAttentionRow, now = new Date()): CommentReplyHoldEvaluation {
  const holdUntil = row.reply_hold_until ?? metadataString(row, ['reply_hold_until'])
  const holdTime = holdUntil ? new Date(holdUntil).getTime() : Number.NaN
  const remainingMs = Number.isFinite(holdTime) ? Math.max(0, holdTime - now.getTime()) : 0

  if (normalized(row.reply_status) !== 'approved') {
    return {
      state: 'not_ready',
      reason: 'Reply is not approved for the hold queue.',
      holdUntil: holdUntil ?? null,
      remainingMs: 0,
      externalSubmissionAllowed: false,
    }
  }
  if (!row.reply_draft?.trim()) {
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
  if (!providerReplySupported(row) || !providerVerified(row)) {
    return {
      state: 'manual_required',
      reason: 'Provider reply capability is unsupported or unverified; keep the reply in Portfolio for manual handling.',
      holdUntil: holdUntil ?? null,
      remainingMs: 0,
      externalSubmissionAllowed: false,
    }
  }
  if (!canSlackDecideCommentReply({ ...row, reply_status: 'prepared' })) {
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
    .select('id, content_id, platform, platform_post_url, post_title, author_display_name, comment_text, classification, priority, status, received_at, updated_at, reply_draft, reply_status, reply_hold_until, policy_eligibility, provider_capability, provider_verified, metadata')
    .in('status', ['new', 'unresolved', 'needs_attention', 'reply_drafted', 'pending_approval'])
    .order('received_at', { ascending: false })
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
    .select('id, content_id, platform, reply_draft, reply_status, reply_hold_until, policy_eligibility, provider_capability, provider_verified, metadata')
    .eq('reply_status', 'approved')
    .order('reply_hold_until', { ascending: true })
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
    ? 'ready_to_send'
    : evaluation.state

  await supabaseAdmin
    .from('social_content_comments')
    .update({
      reply_status: replyStatus,
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
    .select('id, content_id, platform, reply_draft, reply_status, policy_eligibility, provider_capability, provider_verified, metadata')
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

  const { error: updateError } = await supabaseAdmin
    .from('social_content_comments')
    .update({
      reply_status: input.status,
      reply_hold_until: holdUntil,
      metadata: {
        ...metadata,
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
