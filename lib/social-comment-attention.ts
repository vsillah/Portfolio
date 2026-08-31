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
  reply_provider_comment_id?: string | null
  reply_submitted_at?: string | null
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

export type SocialCommentAlertReliabilityState =
  | 'disabled'
  | 'dry_run'
  | 'deduped'
  | 'skipped'
  | 'no_eligible_items'
  | 'sent'
  | 'errored'
  | 'ready'

export type SocialCommentAlertReliabilityStatus = {
  generatedAt: string
  state: SocialCommentAlertReliabilityState
  label: string
  summary: string
  deliveryMode: 'disabled' | 'dry_run' | 'live'
  activation: {
    enabled: boolean
    reason: string
  }
  counts: {
    itemCount: number
    sent: number
    deduped: number
    skipped: number
    errors: number
  }
  reasons: string[]
  lastActionableNextStep: string
  nextStep: {
    label: string
    href: string
  }
  lastRun?: {
    id: string
    status: string | null
    at: string | null
    outcome: 'sent' | 'deduped' | 'skipped' | 'errored' | 'unknown'
    reason: string | null
    itemCount?: number
  } | null
}

export type SocialCommentAlertReliabilityInput = {
  activationEnabled: boolean
  activationReason?: string | null
  deliveryDryRun: boolean
  itemCount?: number | null
  sentCount?: number | null
  dedupedCount?: number | null
  skippedCount?: number | null
  errorCount?: number | null
  dataSurfaceReady?: boolean
  dataSurfaceReason?: string | null
  reasons?: Array<string | null | undefined>
  lastRun?: SocialCommentAlertReliabilityStatus['lastRun']
}

const POLICY_LOW_RISK_CLASSIFICATIONS = new Set(['low_risk_acknowledgement'])
const ATTENTION_CLASSIFICATION_STATUSES = new Set(['unreviewed', 'needs_response', 'blocked'])
const ATTENTION_REPLY_STATES = new Set(['draft', 'failed', 'blocked'])
const RESOLVED_CLASSIFICATION_STATUSES = new Set(['answered', 'spam', 'ignored'])
const RESOLVED_VISIBILITY_STATUSES = new Set(['hidden', 'deleted'])
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

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function uniqueReasons(reasons: Array<string | null | undefined>) {
  return [...new Set(reasons.map((reason) => reason?.trim()).filter((reason): reason is string => Boolean(reason)))]
}

export function buildSocialCommentAlertReliabilityStatus(
  input: SocialCommentAlertReliabilityInput,
): SocialCommentAlertReliabilityStatus {
  const counts = {
    itemCount: numberOrZero(input.itemCount),
    sent: numberOrZero(input.sentCount),
    deduped: numberOrZero(input.dedupedCount),
    skipped: numberOrZero(input.skippedCount),
    errors: numberOrZero(input.errorCount),
  }
  const deliveryMode = input.activationEnabled
    ? input.deliveryDryRun ? 'dry_run' : 'live'
    : 'disabled'
  const reasons = uniqueReasons([
    input.activationReason,
    input.dataSurfaceReady === false ? input.dataSurfaceReason || 'Comment inbox data surface is not available.' : null,
    ...(input.reasons ?? []),
  ])

  let state: SocialCommentAlertReliabilityState = 'ready'
  if (counts.errors > 0 || input.lastRun?.outcome === 'errored') state = 'errored'
  else if (counts.sent > 0 || input.lastRun?.outcome === 'sent') state = 'sent'
  else if (counts.deduped > 0 || input.lastRun?.outcome === 'deduped') state = 'deduped'
  else if (!input.activationEnabled) state = 'disabled'
  else if (input.deliveryDryRun) state = 'dry_run'
  else if (counts.itemCount === 0) state = 'no_eligible_items'
  else if (counts.skipped > 0 || input.lastRun?.outcome === 'skipped') state = 'skipped'

  const copy: Record<SocialCommentAlertReliabilityState, {
    label: string
    summary: string
    next: string
    nextLabel: string
    href: string
  }> = {
    disabled: {
      label: 'Alerts disabled',
      summary: 'Slack alert delivery is default-off. The inbox remains the recovery surface.',
      next: 'Review eligible comments in the Engagement Inbox or run an authorized dry-run cron check.',
      nextLabel: 'Open inbox',
      href: '/admin/social-content/engagement-inbox',
    },
    dry_run: {
      label: 'Dry run',
      summary: 'The sweep evaluated attention items without sending Slack.',
      next: 'Use the cron response for operator review before enabling Slack delivery.',
      nextLabel: 'Cron path',
      href: '/api/cron/social-content-comment-attention?dry_run=1',
    },
    deduped: {
      label: 'Deduped',
      summary: 'A matching Slack alert was already prepared inside the dedupe window.',
      next: 'Open the inbox and continue review from the canonical comment queue.',
      nextLabel: 'Open inbox',
      href: '/admin/social-content/engagement-inbox',
    },
    skipped: {
      label: 'Skipped',
      summary: 'The sweep skipped Slack delivery without creating an external send.',
      next: 'Refresh visible posts or inspect the cron response reason before retrying.',
      nextLabel: 'Open inbox',
      href: '/admin/social-content/engagement-inbox',
    },
    no_eligible_items: {
      label: 'No eligible items',
      summary: 'No unresolved comments currently qualify for Slack attention.',
      next: 'Refresh the visible post set if provider ingestion is expected to add comments.',
      nextLabel: 'Open inbox',
      href: '/admin/social-content/engagement-inbox',
    },
    sent: {
      label: 'Alert sent',
      summary: 'Slack reported a sent alert for the comment attention sweep.',
      next: 'Use the inbox as the canonical review and approval surface.',
      nextLabel: 'Open inbox',
      href: '/admin/social-content/engagement-inbox',
    },
    errored: {
      label: 'Alert error',
      summary: 'The alert sweep hit an error before a reliable notification state could be established.',
      next: 'Run the authorized cron check and inspect the structured error counts and reasons.',
      nextLabel: 'Cron path',
      href: '/api/cron/social-content-comment-attention?dry_run=1',
    },
    ready: {
      label: 'Ready',
      summary: 'Eligible comments exist and Slack delivery is gated by the current activation mode.',
      next: 'Run an authorized cron check when operator review is needed.',
      nextLabel: 'Cron path',
      href: '/api/cron/social-content-comment-attention?dry_run=1',
    },
  }

  return {
    generatedAt: new Date().toISOString(),
    state,
    label: copy[state].label,
    summary: copy[state].summary,
    deliveryMode,
    activation: {
      enabled: input.activationEnabled,
      reason: input.activationReason || (input.activationEnabled ? 'enabled' : 'activation_disabled_default_off'),
    },
    counts,
    reasons,
    lastActionableNextStep: copy[state].next,
    nextStep: {
      label: copy[state].nextLabel,
      href: copy[state].href,
    },
    lastRun: input.lastRun ?? null,
  }
}

function policyDecision(row: SocialCommentAttentionRow) {
  const metadata = record(row.metadata)
  return record(metadata?.policy_decision)
    ?? record(metadata?.comment_policy_decision)
    ?? record(metadata?.policyDecision)
}

function autoSendDecision(row: SocialCommentAttentionRow) {
  const decision = policyDecision(row)
  return record(decision?.auto_send) ?? record(decision?.autoSend)
}

function policyClassification(row: SocialCommentAttentionRow) {
  const decision = policyDecision(row)
  const value = decision?.classification
  return typeof value === 'string' ? value : null
}

function isPolicyLowRisk(row: SocialCommentAttentionRow) {
  const decision = policyDecision(row)
  const classification = policyClassification(row)
  const humanQaRequired = decision?.human_qa_required === true || decision?.humanQaRequired === true
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
  return capability?.supports_reply_submission === true
}

function providerExternalSubmissionEnabled(row: SocialCommentAttentionRow) {
  const capability = record(row.provider_capability)
  return capability?.external_submission_enabled === true
}

export function socialCommentDeepLink(row: Pick<SocialCommentAttentionRow, 'id' | 'content_id'>) {
  const params = new URLSearchParams({ comment: row.id })
  if (row.content_id) params.set('post', row.content_id)
  return `/admin/social-content/engagement-inbox?${params.toString()}#social-comment-review-gate`
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

function hasSubmittedReplyEvidence(row: SocialCommentAttentionRow) {
  return normalized(row.reply_submission_state) === 'submitted'
    || Boolean(row.reply_provider_comment_id?.trim())
    || Boolean(row.reply_submitted_at?.trim())
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
  if (!holdUntil) {
    return {
      state: 'not_ready',
      reason: 'No 15-minute hold marker is recorded for this approved reply.',
      holdUntil: null,
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
    .in('classification_status', ['unreviewed', 'needs_response', 'blocked'])
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
    .select('id, publish_id, content_id, platform, provider, provider_comment_id, response_approval_state, reply_submission_state, proposed_reply_text, approved_reply_text, reply_provider_comment_id, reply_submitted_at, provider_capability, metadata')
    .eq('id', input.commentId)
    .maybeSingle()

  if (error || !data?.id) throw new Error('Comment not found')
  const row = data as SocialCommentAttentionRow
  const metadata = record(row.metadata) ?? {}
  const existingSlackDecision = record(metadata.slack_reply_decision)
  if (existingSlackDecision?.idempotency_key === input.idempotencyKey) {
    return `Already handled this Slack comment reply action. Portfolio: ${socialCommentDeepLink(row)}`
  }
  if (hasSubmittedReplyEvidence(row)) {
    const decidedAt = new Date().toISOString()
    const { error: submittedUpdateError } = await supabaseAdmin
      .from('social_content_comments')
      .update({
        metadata: {
          ...metadata,
          ui_action_history: [
            {
              action: input.status === 'approved' ? 'approve' : 'reject',
              at: decidedAt,
              by: `slack:${input.slackUserId}`,
              note: `${input.decisionNotes} Existing provider reply evidence remained authoritative.`,
            },
            ...(Array.isArray(metadata.ui_action_history) ? metadata.ui_action_history : []),
          ].slice(0, 25),
          slack_reply_decision: {
            status: input.status,
            decision_notes: input.decisionNotes,
            decided_by_slack_user_id: input.slackUserId,
            decided_by_label: input.actorLabel,
            decided_at: decidedAt,
            idempotency_key: input.idempotencyKey,
            existing_submission_preserved: true,
            external_submission_performed: false,
          },
        },
        updated_at: decidedAt,
      })
      .eq('id', row.id)
    if (submittedUpdateError) {
      throw new Error(`Failed to record submitted comment reply Slack decision: ${submittedUpdateError.message}`)
    }
    return `Reply already has submitted provider evidence. Slack action was recorded without changing submitted state. Portfolio: ${socialCommentDeepLink(row)}`
  }
  if (!canSlackDecideCommentReply(row)) {
    return `Portfolio review required for this comment reply. Open: ${socialCommentDeepLink(row)}`
  }

  const decidedAt = new Date().toISOString()
  const holdUntil = input.status === 'approved' ? commentReplyHoldUntil(new Date(decidedAt)) : null
  const reply = replyText(row)
  const update = input.status === 'approved'
    ? {
        response_approval_state: 'approved',
        reply_submission_state: 'approved',
        approved_reply_text: reply || null,
      }
    : {
        response_approval_state: 'rejected',
        reply_submission_state: reply ? 'draft' : 'not_applicable',
      }

  const { error: updateError } = await supabaseAdmin
    .from('social_content_comments')
    .update({
      ...update,
      metadata: {
        ...metadata,
        reply_hold_until: holdUntil,
        ui_action_history: [
          {
            action: input.status === 'approved' ? 'approve' : 'reject',
            at: decidedAt,
            by: `slack:${input.slackUserId}`,
            note: input.decisionNotes,
          },
          ...(Array.isArray(metadata.ui_action_history) ? metadata.ui_action_history : []),
        ].slice(0, 25),
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
