import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildCommentInboxPolicyInputFromSocialComment,
  evaluateCommentInboxPolicy,
  type SocialCommentPolicyRecord,
} from '@/lib/comment-inbox-policy'
import {
  getSocialCommentInboxItem,
  getSocialCommentInboxItems,
  type SocialCommentAction,
  type SocialCommentCanonicalRow,
  type SocialCommentPostProjection,
} from '@/lib/social-comment-inbox-ui'
import {
  evaluateYouTubeReplyReadiness,
  refreshYouTubeReplyConfigIfNeeded,
  YOUTUBE_REPLY_PROVIDER,
  type YouTubeReplyCanonicalCapability,
  type YouTubeReplyConfig,
  type YouTubeReplyCredentials,
} from '@/lib/youtube-comment-reply-readiness'
import {
  submitCommentProviderReply,
  type CommentReplySubmissionResult,
} from '@/lib/social-comment-reply-submission'
import { refreshPublishedXComments } from '@/lib/x-comment-ingestion'

export const dynamic = 'force-dynamic'

const COMMENT_SELECT = [
  'id',
  'publish_id',
  'content_id',
  'platform',
  'provider',
  'provider_comment_id',
  'provider_parent_comment_id',
  'thread_id',
  'record_type',
  'author_display_name',
  'author_public_handle',
  'body',
  'comment_url',
  'classification_status',
  'classification_reason',
  'priority',
  'response_approval_state',
  'reply_submission_state',
  'proposed_reply_text',
  'approved_reply_text',
  'reply_provider_comment_id',
  'reply_submitted_at',
  'provider_capability',
  'captured_at',
  'updated_at',
  'raw_payload',
  'metadata',
].join(', ')

const POST_SELECT = 'id, platform, post_text, cta_text, youtube_title, rag_context'
const COMMENT_INBOX_UNAVAILABLE_MESSAGE = 'Comment inbox storage is not available in this environment.'
const COMMENT_INBOX_UNAVAILABLE_RECOVERY = 'Apply migration 20260806163011 to the bound Supabase project before validating populated comment inbox rows. Do not submit external replies from this UI lane.'

const ACTIONS = new Set<SocialCommentAction>([
  'refresh_request',
  'draft_response',
  'approve',
  'reject',
  'return_to_review',
  'ignore',
  'submit',
])

type SocialCommentSubmissionEvidenceRow = SocialCommentCanonicalRow & {
  reply_provider_comment_id?: unknown
  reply_submitted_at?: unknown
}

function asAction(value: unknown): SocialCommentAction | null {
  return typeof value === 'string' && ACTIONS.has(value as SocialCommentAction)
    ? value as SocialCommentAction
    : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function optionalText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function policyDraftReply(comment: SocialCommentPolicyRecord, now: string) {
  const policyInput = buildCommentInboxPolicyInputFromSocialComment(comment, {
    confidence: 0.72,
    now,
  })
  const decision = evaluateCommentInboxPolicy(policyInput)
  return optionalText(decision.replyDraft.text)
}

function appendActionHistory(
  metadata: unknown,
  event: {
    action: SocialCommentAction | 'submit_blocked'
    at: string
    by: string | null
    note: string | null
  },
) {
  const current = asRecord(metadata)
  const history = Array.isArray(current.ui_action_history) ? current.ui_action_history : []
  return {
    ...current,
    ui_action_history: [event, ...history].slice(0, 25),
  }
}

function isCommentInboxStorageUnavailable(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const code = typeof record.code === 'string' ? record.code : ''
  const text = [record.message, record.details, record.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()

  return code === '42P01'
    || code === 'PGRST205'
    || text.includes('social_content_comments')
    || text.includes('relation') && text.includes('does not exist')
}

function unavailableResponse(status = 200) {
  return NextResponse.json({
    unavailable: true,
    blocked: true,
    comments: [],
    message: COMMENT_INBOX_UNAVAILABLE_MESSAGE,
    recovery: COMMENT_INBOX_UNAVAILABLE_RECOVERY,
    integration_note: 'The canonical comment inbox table is missing from the bound database. No provider ingestion or external comment replies were attempted.',
  }, { status })
}

async function fetchPost(id: string) {
  if (!supabaseAdmin) return { post: null, error: new Error('Server configuration error') }
  const { data, error } = await supabaseAdmin
    .from('social_content_queue')
    .select(POST_SELECT)
    .eq('id', id)
    .single()

  return { post: data as SocialCommentPostProjection | null, error }
}

async function fetchComments(contentId: string, post: SocialCommentPostProjection | null) {
  if (!supabaseAdmin) return { comments: [], error: new Error('Server configuration error') }
  const { data, error } = await supabaseAdmin
    .from('social_content_comments')
    .select(COMMENT_SELECT)
    .eq('content_id', contentId)
    .order('captured_at', { ascending: false })

  return {
    comments: getSocialCommentInboxItems(Array.isArray(data) ? data : [], post ? new Map([[contentId, post]]) : new Map()),
    error,
  }
}

async function fetchComment(contentId: string, commentId: string) {
  if (!supabaseAdmin) return { comment: null, error: new Error('Server configuration error') }
  const { data, error } = await supabaseAdmin
    .from('social_content_comments')
    .select(COMMENT_SELECT)
    .eq('content_id', contentId)
    .eq('id', commentId)
    .single()

  return { comment: data as SocialCommentCanonicalRow | null, error }
}

async function fetchYouTubeConfig() {
  if (!supabaseAdmin) return { config: null, error: new Error('Server configuration error') }
  const { data, error } = await supabaseAdmin
    .from('social_content_config')
    .select('credentials, settings, is_active')
    .eq('platform', 'youtube')
    .maybeSingle()

  return { config: data as YouTubeReplyConfig | null, error }
}

async function persistYouTubeCredentials(credentials: YouTubeReplyCredentials) {
  if (!supabaseAdmin) return { error: new Error('Server configuration error') }
  const { error } = await supabaseAdmin
    .from('social_content_config')
    .update({ credentials })
    .eq('platform', 'youtube')

  return { error }
}

async function fetchYouTubeCanonicalCapability() {
  if (!supabaseAdmin) return { capability: null, error: new Error('Server configuration error') }
  const { data, error } = await supabaseAdmin
    .from('social_comment_provider_capabilities')
    .select('platform, provider, capability_status, supports_reply_submission, external_submission_enabled, gate_notes')
    .eq('platform', 'youtube')
    .maybeSingle()

  return { capability: data as YouTubeReplyCanonicalCapability | null, error }
}

function youtubeReplyMetadata(input: {
  status: CommentReplySubmissionResult['status'] | 'ready' | 'claiming'
  blocked: boolean
  blockerCodes: string[]
  idempotencyKey: string | null
  providerReplyId?: string | null
  providerError?: CommentReplySubmissionResult['error']
  externalSubmissionAttempted: boolean
}) {
  return {
    youtube_reply_readiness: {
      status: input.status,
      blocked: input.blocked,
      blocker_codes: input.blockerCodes,
      idempotency_key: input.idempotencyKey,
      provider_reply_id: input.providerReplyId ?? null,
      provider_error: input.providerError
        ? {
          code: input.providerError.code,
          status: input.providerError.status ?? null,
          reason: input.providerError.reason ?? null,
        }
        : null,
      external_submission_attempted: input.externalSubmissionAttempted,
    },
  }
}

function hasSubmittedYouTubeReplyEvidence(comment: SocialCommentSubmissionEvidenceRow) {
  return comment.reply_submission_state === 'submitted'
    || Boolean(optionalText(comment.reply_provider_comment_id))
    || Boolean(optionalText(comment.reply_submitted_at))
}

function submittedYouTubeReplyAlreadyRecordedResponse(input: {
  post: SocialCommentPostProjection
  contentId: string
}) {
  return responseWithComments({
    post: input.post,
    contentId: input.contentId,
    status: 200,
    ok: true,
    blocked: false,
    message: 'YouTube reply was already submitted and canonical reply evidence is recorded.',
    integrationNote: 'No external YouTube reply was submitted. Existing canonical submitted evidence was treated as an idempotent completed state.',
    extra: {
      already_submitted: true,
    },
  })
}

async function claimYouTubeReplySubmission(input: {
  commentId: string
  contentId: string
  actorId: string
  metadata: Record<string, unknown>
}) {
  if (!supabaseAdmin) return { claimed: false, error: new Error('Server configuration error') }
  const { data, error } = await supabaseAdmin
    .from('social_content_comments')
    .update({
      reply_submission_state: 'blocked',
      updated_by: input.actorId,
      metadata: input.metadata,
    })
    .eq('id', input.commentId)
    .eq('content_id', input.contentId)
    .eq('reply_submission_state', 'approved')
    .is('reply_provider_comment_id', null)
    .is('reply_submitted_at', null)
    .select('id')
    .maybeSingle()

  return { claimed: Boolean(data), error }
}

async function persistClaimedYouTubeReplySubmission(input: {
  commentId: string
  contentId: string
  idempotencyKey: string
  patch: Record<string, unknown>
}) {
  if (!supabaseAdmin) return { persisted: false, error: new Error('Server configuration error') }
  const { data, error } = await supabaseAdmin
    .from('social_content_comments')
    .update(input.patch)
    .eq('id', input.commentId)
    .eq('content_id', input.contentId)
    .eq('reply_submission_state', 'blocked')
    .is('reply_provider_comment_id', null)
    .is('reply_submitted_at', null)
    .contains('metadata', {
      youtube_reply_readiness: {
        status: 'claiming',
        idempotency_key: input.idempotencyKey,
      },
    })
    .select(COMMENT_SELECT)
    .maybeSingle()

  return { persisted: Boolean(data), error }
}

async function responseWithComments(input: {
  post: SocialCommentPostProjection
  contentId: string
  status: number
  ok: boolean
  blocked: boolean
  message: string
  integrationNote: string
  extra?: Record<string, unknown>
}) {
  const { comments, error } = await fetchComments(input.contentId, input.post)
  if (error && isCommentInboxStorageUnavailable(error)) {
    return unavailableResponse(409)
  }

  return NextResponse.json({
    ok: input.ok,
    blocked: input.blocked,
    message: input.message,
    comments,
    integration_note: input.integrationNote,
    ...(input.extra ?? {}),
  }, { status: input.status })
}

/**
 * GET /api/admin/social-content/[id]/engagement/comments
 * Returns the per-post local comment projection for the Social Content detail panel.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const { post, error: postError } = await fetchPost(params.id)
  if (postError || !post) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  const { comments, error } = await fetchComments(params.id, post)
  if (error) {
    if (isCommentInboxStorageUnavailable(error)) {
      return unavailableResponse()
    }

    console.error('Error fetching social content comments:', error)
    return NextResponse.json({ error: 'Failed to fetch social content comments' }, { status: 500 })
  }

  return NextResponse.json({
    comments,
    integration_note: 'Comments are read from the canonical social_content_comments table. No provider ingestion or reply submission is performed by this route.',
  })
}

/**
 * POST /api/admin/social-content/[id]/engagement/comments
 * Records local operator actions. A future fully gated YouTube submit path may
 * call the provider only after canonical capability, environment, human,
 * policy, identity, and idempotency gates pass.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const action = asAction(body.action)
  if (!action) {
    return NextResponse.json({ error: 'Unsupported comment inbox action' }, { status: 400 })
  }

  const { post, error: postError } = await fetchPost(params.id)
  if (postError || !post) {
    return NextResponse.json({ error: 'Content not found' }, { status: 404 })
  }

  if (action === 'refresh_request') {
    const refreshPlatform = optionalText(body.platform) ?? optionalText(body.refresh_platform)
    if (refreshPlatform === 'x') {
      const publishId = optionalText(body.publish_id)
      if (!publishId) {
        return NextResponse.json({
          ok: false,
          blocked: true,
          error: 'publish_id is required for X comment refresh',
          message: 'Select an exact canonical published X row before refreshing comments.',
          integration_note: 'No X provider read or external comment reply was attempted.',
        }, { status: 400 })
      }

      const refresh = await refreshPublishedXComments({
        db: supabaseAdmin,
        publishId,
        contentId: params.id,
      })
      const { comments, error } = await fetchComments(params.id, post)
      if (error && isCommentInboxStorageUnavailable(error)) {
        return unavailableResponse()
      }

      const blocked = refresh.status === 'manual_blocked' || refresh.status === 'failed'
      return NextResponse.json({
        ok: refresh.status === 'succeeded' || refresh.status === 'partial',
        blocked,
        message: blocked
          ? refresh.blockedReason ?? 'X comment refresh is blocked; review provider evidence and recovery details.'
          : 'X comments refreshed into the canonical Comment Inbox.',
        comments,
        x_refresh: refresh,
        integration_note: 'X comment refresh uses read-only recent-search GET requests only. No external comment reply, post, schedule, or provider write was attempted.',
      }, { status: refresh.status === 'failed' ? 502 : 200 })
    }

    const { comments, error } = await fetchComments(params.id, post)
    if (error && isCommentInboxStorageUnavailable(error)) {
      return unavailableResponse()
    }

    return NextResponse.json({
      ok: true,
      blocked: false,
      message: 'Refresh request noted. Provider ingestion remains owned by the engagement ingestion lane.',
      comments,
      integration_note: 'No provider refresh or external comment reply was submitted.',
    })
  }

  const commentId = optionalText(body.comment_id)
  if (!commentId) {
    return NextResponse.json({ error: 'comment_id is required for this action' }, { status: 400 })
  }

  const { comment, error: commentError } = await fetchComment(params.id, commentId)
  if (commentError && isCommentInboxStorageUnavailable(commentError)) {
    return unavailableResponse(409)
  }

  if (commentError || !comment) {
    return NextResponse.json({ error: 'Comment not found in the canonical inbox table' }, { status: 404 })
  }

  const nowDate = new Date()
  const now = nowDate.toISOString()
  const actorId = auth.user.id
  const draftReply = optionalText(body.draft_reply) ?? optionalText(comment.proposed_reply_text)
  const currentItem = getSocialCommentInboxItem(comment, post)
  const historyEvent = {
    action,
    at: now,
    by: actorId,
    note: optionalText(body.note),
  }
  const metadata = appendActionHistory(comment.metadata, historyEvent)
  const hasSubmittedEvidence = hasSubmittedYouTubeReplyEvidence(comment)
  let patch: Record<string, unknown> = {
    updated_by: actorId,
    metadata,
  }
  let status = 200
  let ok = true
  let blocked = false
  let message = 'Comment inbox action recorded.'
  let integrationNote = 'No external comment reply was submitted. This action only updated canonical local workflow state.'

  if (hasSubmittedEvidence && action !== 'submit') {
    patch = {
      updated_by: actorId,
      metadata: appendActionHistory(comment.metadata, {
        ...historyEvent,
        note: historyEvent.note
          || 'Reply already has submitted provider evidence; local review action was recorded without changing submitted state.',
      }),
    }
    message = 'Reply already has submitted provider evidence. The local action was recorded without changing submitted state.'
    integrationNote = 'No external comment reply was submitted. Existing provider reply evidence remains authoritative.'
    const { error: updateError } = await supabaseAdmin
      .from('social_content_comments')
      .update(patch)
      .eq('id', commentId)
      .eq('content_id', params.id)
      .select(COMMENT_SELECT)
      .single()

    if (updateError) {
      if (isCommentInboxStorageUnavailable(updateError)) {
        return unavailableResponse(409)
      }

      return NextResponse.json({ error: 'Failed to record comment inbox action' }, { status: 500 })
    }

    const { comments, error } = await fetchComments(params.id, post)
    if (error && isCommentInboxStorageUnavailable(error)) {
      return unavailableResponse(409)
    }

    return NextResponse.json({
      ok,
      blocked,
      already_submitted: true,
      message,
      comments,
      integration_note: integrationNote,
    })
  }

  if (
    currentItem.approvalState === 'rejected'
    && (action === 'approve' || action === 'reject')
  ) {
    return responseWithComments({
      post,
      contentId: params.id,
      status: 409,
      ok: false,
      blocked: true,
      message: 'Reply review is rejected. Revise the reply and return it to review before approving or rejecting again.',
      integrationNote: 'No external comment reply was submitted. Rejected reply review remains locked until the explicit recovery action runs.',
    })
  }

  if (action === 'draft_response') {
    const generatedDraftReply = draftReply ?? policyDraftReply(comment as SocialCommentPolicyRecord, now)
    patch = {
      ...patch,
      proposed_reply_text: generatedDraftReply,
      response_approval_state: 'pending',
      reply_submission_state: generatedDraftReply ? 'draft' : 'not_applicable',
    }
  }

  if (action === 'approve') {
    if (!draftReply) {
      return NextResponse.json({ error: 'Draft reply is required before approval' }, { status: 400 })
    }
    patch = {
      ...patch,
      proposed_reply_text: draftReply,
      approved_reply_text: draftReply,
      response_approval_state: 'approved',
      reply_submission_state: 'approved',
    }
  }

  if (action === 'reject') {
    patch = {
      ...patch,
      response_approval_state: 'rejected',
      reply_submission_state: draftReply ? 'draft' : 'not_applicable',
    }
  }

  if (action === 'return_to_review') {
    if (!draftReply) {
      return NextResponse.json({ error: 'Draft reply is required before returning to review' }, { status: 400 })
    }
    patch = {
      ...patch,
      proposed_reply_text: draftReply,
      approved_reply_text: null,
      response_approval_state: 'pending',
      reply_submission_state: 'draft',
    }
    message = 'Revised reply saved and returned to review. Approval is required before any provider submission.'
  }

  if (action === 'ignore') {
    patch = {
      ...patch,
      classification_status: 'ignored',
      response_approval_state: 'not_required',
      reply_submission_state: 'not_applicable',
    }
  }

  if (action === 'submit') {
    const isYouTubeProvider = comment.platform === 'youtube' && comment.provider === YOUTUBE_REPLY_PROVIDER
    let submitBlocker = currentItem.providerCapability.blocker
      || 'Provider reply submission is blocked until capability and human gate checks pass.'

    if (isYouTubeProvider) {
      if (hasSubmittedYouTubeReplyEvidence(comment)) {
        return submittedYouTubeReplyAlreadyRecordedResponse({ post, contentId: params.id })
      }
      const { config, error: configError } = await fetchYouTubeConfig()
      if (configError) {
        console.error('Error fetching YouTube comment reply config:', configError)
        return NextResponse.json({ error: 'Failed to verify YouTube reply readiness' }, { status: 500 })
      }
      const { capability: canonicalCapability, error: capabilityError } = await fetchYouTubeCanonicalCapability()
      if (capabilityError) {
        console.error('Error fetching canonical YouTube comment capability:', capabilityError)
        return NextResponse.json({ error: 'Failed to verify YouTube reply capability' }, { status: 500 })
      }

      let refreshedConfig = config
      const tokenRefresh = await refreshYouTubeReplyConfigIfNeeded({
        config,
        fetchImpl: fetch,
        now: nowDate,
      })
      if (tokenRefresh.blocker) {
        ok = false
        blocked = true
        status = 409
        message = `${tokenRefresh.blocker.message} Recovery: ${tokenRefresh.blocker.recoveryAction}`
        integrationNote = 'No external YouTube reply was submitted. Token refresh blockers stopped the request before any provider reply call.'
        patch = {
          ...patch,
          reply_submission_state: 'blocked',
          metadata: appendActionHistory({
            ...asRecord(comment.metadata),
            ...youtubeReplyMetadata({
              status: 'blocked',
              blocked: true,
              blockerCodes: [tokenRefresh.blocker.code],
              idempotencyKey: null,
              externalSubmissionAttempted: false,
            }),
          }, {
            action: 'submit_blocked',
            at: now,
            by: actorId,
            note: message,
          }),
        }
      } else {
        refreshedConfig = tokenRefresh.config
        if (tokenRefresh.refreshed && refreshedConfig?.credentials) {
          const persistRefresh = await persistYouTubeCredentials(refreshedConfig.credentials)
          if (persistRefresh.error) {
            console.error('Error persisting refreshed YouTube credentials:', persistRefresh.error instanceof Error ? persistRefresh.error.name : 'Error')
            ok = false
            blocked = true
            status = 409
            message = 'YouTube token refresh succeeded but Portfolio could not persist freshness metadata. Recovery: retry after credential storage is healthy; do not submit until freshness is recorded.'
            integrationNote = 'No external YouTube reply was submitted. Refreshed token metadata could not be persisted, so the request stopped before any provider reply call.'
            patch = {
              ...patch,
              reply_submission_state: 'blocked',
              metadata: appendActionHistory({
                ...asRecord(comment.metadata),
                ...youtubeReplyMetadata({
                  status: 'blocked',
                  blocked: true,
                  blockerCodes: ['youtube_token_refresh_failed'],
                  idempotencyKey: null,
                  externalSubmissionAttempted: false,
                }),
              }, {
                action: 'submit_blocked',
                at: now,
                by: actorId,
                note: message,
              }),
            }
          }
        }
      }

      if (!blocked) {
        const readiness = evaluateYouTubeReplyReadiness({
          comment,
          config: refreshedConfig,
          canonicalCapability,
        })

        if (!readiness.ready) {
          submitBlocker = readiness.blockers
            .map((blocker) => `${blocker.message} Recovery: ${blocker.recoveryAction}`)
            .join(' ')
            || submitBlocker
          ok = false
          blocked = true
          status = 409
          message = submitBlocker
          integrationNote = 'No external YouTube reply was submitted. Readiness blockers stopped the request before any provider call.'
          patch = {
            ...patch,
            reply_submission_state: 'blocked',
            metadata: appendActionHistory({
              ...asRecord(comment.metadata),
              ...youtubeReplyMetadata({
                status: 'blocked',
                blocked: true,
                blockerCodes: readiness.blockers.map((blocker) => blocker.code),
                idempotencyKey: readiness.idempotencyKey,
                externalSubmissionAttempted: false,
              }),
            }, {
              action: 'submit_blocked',
              at: now,
              by: actorId,
              note: submitBlocker,
            }),
          }
        } else {
          const idempotencyKey = readiness.idempotencyKey
          if (!idempotencyKey) {
            return NextResponse.json({ error: 'Failed to build YouTube reply idempotency evidence' }, { status: 500 })
          }
          const claimMetadata = {
            ...asRecord(metadata),
            ...youtubeReplyMetadata({
              status: 'claiming',
              blocked: false,
              blockerCodes: [],
              idempotencyKey,
              externalSubmissionAttempted: false,
            }),
          }
          const claim = await claimYouTubeReplySubmission({
            commentId,
            contentId: params.id,
            actorId,
            metadata: claimMetadata,
          })
          if (claim.error) {
            console.error('Error claiming YouTube comment reply submission:', claim.error)
            return NextResponse.json({ error: 'Failed to claim YouTube reply submission' }, { status: 500 })
          }
          if (!claim.claimed) {
            const { comment: latestComment, error: latestCommentError } = await fetchComment(params.id, commentId)
            if (!latestCommentError && latestComment && hasSubmittedYouTubeReplyEvidence(latestComment)) {
              return submittedYouTubeReplyAlreadyRecordedResponse({ post, contentId: params.id })
            }
            submitBlocker = 'This canonical comment already has reply submission evidence or is no longer approved for submission. Recovery: review the existing reply evidence before attempting another public reply.'
            return responseWithComments({
              post,
              contentId: params.id,
              status: 409,
              ok: false,
              blocked: true,
              message: submitBlocker,
              integrationNote: 'No external YouTube reply was submitted. The canonical claim failed, so this request did not mutate reply evidence.',
            })
          }

          let submission: CommentReplySubmissionResult
          try {
            submission = await submitCommentProviderReply({
              comment,
              youtube: {
                config: refreshedConfig,
                canonicalCapability,
              },
            })
          } catch (error) {
            console.error('YouTube comment reply submission failed unexpectedly:', error instanceof Error ? error.name : 'Error')
            submission = {
              ok: false,
              blocked: false,
              status: 'failed',
              providerReplyId: null,
              submittedAt: null,
              blockers: [],
              error: {
                code: 'provider_failure',
                message: 'YouTube comment reply submission failed unexpectedly.',
              },
              request: readiness.request,
            }
          }

          const submissionMetadata = youtubeReplyMetadata({
            status: submission.status,
            blocked: submission.blocked,
            blockerCodes: submission.blockers.map((blocker) => blocker.code),
            idempotencyKey: submission.request?.idempotencyKey ?? idempotencyKey,
            providerReplyId: submission.providerReplyId,
            providerError: submission.error,
            externalSubmissionAttempted: submission.request !== null && !submission.blocked,
          })

          if (submission.ok) {
            const persistence = await persistClaimedYouTubeReplySubmission({
              commentId,
              contentId: params.id,
              idempotencyKey,
              patch: {
                updated_by: actorId,
                reply_submission_state: 'submitted',
                reply_provider_comment_id: submission.providerReplyId,
                reply_submitted_at: submission.submittedAt,
                metadata: {
                  ...asRecord(metadata),
                  ...submissionMetadata,
                },
              },
            })
            if (persistence.error || !persistence.persisted) {
              if (persistence.error) {
                console.error('Error persisting submitted YouTube reply evidence:', persistence.error)
              }
              return responseWithComments({
                post,
                contentId: params.id,
                status: 409,
                ok: false,
                blocked: true,
                message: 'YouTube reply submission may have succeeded; reconcile canonical reply evidence before retry.',
                integrationNote: 'A YouTube reply request may have succeeded, but Portfolio could not persist submitted evidence. The canonical row remains fail-closed; reconcile manually before any retry.',
                extra: {
                  submission_may_have_succeeded: true,
                  provider_reply_id: submission.providerReplyId,
                },
              })
            }
            return responseWithComments({
              post,
              contentId: params.id,
              status: 200,
              ok: true,
              blocked: false,
              message: 'YouTube reply submitted and recorded in the canonical comment inbox.',
              integrationNote: 'A gated YouTube reply was submitted and canonical submitted evidence was recorded.',
            })
          }

          if (submission.error) {
            const persistence = await persistClaimedYouTubeReplySubmission({
              commentId,
              contentId: params.id,
              idempotencyKey,
              patch: {
                updated_by: actorId,
                reply_submission_state: 'failed',
                metadata: {
                  ...asRecord(metadata),
                  ...submissionMetadata,
                },
              },
            })
            if (persistence.error) {
              console.error('Error persisting failed YouTube reply evidence:', persistence.error)
            }
            return responseWithComments({
              post,
              contentId: params.id,
              status: 502,
              ok: false,
              blocked: false,
              message: 'YouTube provider rejected or failed the reply request.',
              integrationNote: persistence.persisted
                ? 'A gated YouTube reply request was attempted, the provider failed it, and canonical failed evidence was recorded.'
                : 'A gated YouTube reply request was attempted and failed, but Portfolio could not persist failed evidence. Review before retry.',
            })
          }

          submitBlocker = submission.blockers
            .map((blocker) => `${blocker.message} Recovery: ${blocker.recoveryAction}`)
            .join(' ')
            || submitBlocker
          await persistClaimedYouTubeReplySubmission({
            commentId,
            contentId: params.id,
            idempotencyKey,
            patch: {
              updated_by: actorId,
              reply_submission_state: 'blocked',
              metadata: appendActionHistory({
                ...asRecord(comment.metadata),
                ...submissionMetadata,
              }, {
                action: 'submit_blocked',
                at: now,
                by: actorId,
                note: submitBlocker,
              }),
            },
          })
          return responseWithComments({
            post,
            contentId: params.id,
            status: 409,
            ok: false,
            blocked: true,
            message: submitBlocker,
            integrationNote: 'No external YouTube reply was submitted. Readiness became blocked after the claim.',
          })
        }
      }
    } else {
      const providerSubmission = await submitCommentProviderReply({ comment })
      const providerSubmissionBlocker = providerSubmission.blockers
        .map((blocker) => `${blocker.message} Recovery: ${blocker.recoveryAction}`)
        .join(' ')
      const policyInput = buildCommentInboxPolicyInputFromSocialComment(comment as SocialCommentPolicyRecord, {
        confidence: 0.5,
        draft: {
          text: draftReply,
          confidence: 0.5,
          tone: 'neutral',
        },
      })
      const policyDecision = evaluateCommentInboxPolicy(policyInput)
      submitBlocker = currentItem.providerCapability.blocker
        || policyDecision.autoSend.blockedReasons.join(', ')
        || providerSubmissionBlocker
        || submitBlocker

      ok = false
      blocked = true
      status = 409
      message = submitBlocker
      integrationNote = 'No external comment reply was submitted. Provider submission remains blocked by capability and human-gate checks.'
      patch = {
        ...patch,
        reply_submission_state: 'blocked',
        metadata: appendActionHistory(comment.metadata, {
          action: 'submit_blocked',
          at: now,
          by: actorId,
          note: submitBlocker,
        }),
      }
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('social_content_comments')
    .update(patch)
    .eq('id', commentId)
    .eq('content_id', params.id)
    .select(COMMENT_SELECT)
    .single()

  if (updateError) {
    if (isCommentInboxStorageUnavailable(updateError)) {
      return unavailableResponse(409)
    }

    return NextResponse.json({ error: 'Failed to record comment inbox action' }, { status: 500 })
  }

  const { comments, error } = await fetchComments(params.id, post)
  if (error && isCommentInboxStorageUnavailable(error)) {
    return unavailableResponse(409)
  }

  return NextResponse.json({
    ok,
    blocked,
    message,
    comments,
    integration_note: integrationNote,
  }, { status })
}
