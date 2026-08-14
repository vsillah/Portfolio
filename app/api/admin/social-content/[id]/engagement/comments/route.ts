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
  submitYouTubeCommentReply,
  YOUTUBE_REPLY_PROVIDER,
  type YouTubeReplyConfig,
  type YouTubeReplySubmitResult,
} from '@/lib/youtube-comment-reply-readiness'

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
  'ignore',
  'submit',
])

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

function youtubeReplyMetadata(input: {
  status: YouTubeReplySubmitResult['status'] | 'ready' | 'claiming'
  blocked: boolean
  blockerCodes: string[]
  idempotencyKey: string | null
  providerReplyId?: string | null
  providerError?: YouTubeReplySubmitResult['error']
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
 * Records local operator actions. It never calls an external provider.
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

  const now = new Date().toISOString()
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
  let patch: Record<string, unknown> = {
    updated_by: actorId,
    metadata,
  }
  let status = 200
  let ok = true
  let blocked = false
  let message = 'Comment inbox action recorded.'

  if (action === 'draft_response') {
    patch = {
      ...patch,
      proposed_reply_text: draftReply,
      response_approval_state: 'pending',
      reply_submission_state: draftReply ? 'draft' : 'not_applicable',
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
      const { config, error: configError } = await fetchYouTubeConfig()
      if (configError) {
        console.error('Error fetching YouTube comment reply config:', configError)
        return NextResponse.json({ error: 'Failed to verify YouTube reply readiness' }, { status: 500 })
      }

      const readiness = evaluateYouTubeReplyReadiness({
        comment,
        config,
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
        const claimMetadata = {
          ...asRecord(metadata),
          ...youtubeReplyMetadata({
            status: 'claiming',
            blocked: false,
            blockerCodes: [],
            idempotencyKey: readiness.idempotencyKey,
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
          submitBlocker = 'This canonical comment already has reply submission evidence or is no longer approved for submission. Recovery: review the existing reply evidence before attempting another public reply.'
          ok = false
          blocked = true
          status = 409
          message = submitBlocker
          patch = {
            ...patch,
            reply_submission_state: 'blocked',
            metadata: appendActionHistory({
              ...asRecord(comment.metadata),
              ...youtubeReplyMetadata({
                status: 'blocked',
                blocked: true,
                blockerCodes: ['reply_already_submitted'],
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
          let submission: YouTubeReplySubmitResult
          try {
            submission = await submitYouTubeCommentReply({
              comment,
              config,
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
            idempotencyKey: submission.request?.idempotencyKey ?? readiness.idempotencyKey,
            providerReplyId: submission.providerReplyId,
            providerError: submission.error,
            externalSubmissionAttempted: submission.request !== null && !submission.blocked,
          })

          if (submission.ok) {
            ok = true
            blocked = false
            status = 200
            message = 'YouTube reply submitted and recorded in the canonical comment inbox.'
            patch = {
              ...patch,
              reply_submission_state: 'submitted',
              reply_provider_comment_id: submission.providerReplyId,
              reply_submitted_at: submission.submittedAt,
              metadata: {
                ...asRecord(metadata),
                ...submissionMetadata,
              },
            }
          } else if (submission.error) {
            ok = false
            blocked = false
            status = 502
            message = 'YouTube provider rejected or failed the reply request.'
            patch = {
              ...patch,
              reply_submission_state: 'failed',
              metadata: {
                ...asRecord(metadata),
                ...submissionMetadata,
              },
            }
          } else {
            submitBlocker = submission.blockers
              .map((blocker) => `${blocker.message} Recovery: ${blocker.recoveryAction}`)
              .join(' ')
              || submitBlocker
            ok = false
            blocked = true
            status = 409
            message = submitBlocker
            patch = {
              ...patch,
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
            }
          }
        }
      }
    } else {
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
        || submitBlocker

      ok = false
      blocked = true
      status = 409
      message = submitBlocker
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
    integration_note: 'No external comment reply was submitted. Provider submission remains guarded by capability and human-gate checks.',
  }, { status })
}
