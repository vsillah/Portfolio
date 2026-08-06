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

export const dynamic = 'force-dynamic'

const COMMENT_SELECT = [
  'id',
  'content_id',
  'platform',
  'provider',
  'provider_comment_id',
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
  'provider_capability',
  'captured_at',
  'updated_at',
  'metadata',
].join(', ')

const POST_SELECT = 'id, platform, post_text, cta_text, youtube_title, rag_context'

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
    const { comments } = await fetchComments(params.id, post)
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
    const policyInput = buildCommentInboxPolicyInputFromSocialComment(comment as SocialCommentPolicyRecord, {
      confidence: 0.5,
      draft: {
        text: draftReply,
        confidence: 0.5,
        tone: 'neutral',
      },
    })
    const policyDecision = evaluateCommentInboxPolicy(policyInput)
    const submitBlocker = currentItem.providerCapability.blocker
      || policyDecision.autoSend.blockedReasons.join(', ')
      || 'Provider reply submission is blocked until capability and human gate checks pass.'

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

  const { error: updateError } = await supabaseAdmin
    .from('social_content_comments')
    .update(patch)
    .eq('id', commentId)
    .eq('content_id', params.id)
    .select(COMMENT_SELECT)
    .single()

  if (updateError) {
    return NextResponse.json({ error: 'Failed to record comment inbox action' }, { status: 500 })
  }

  const { comments } = await fetchComments(params.id, post)

  return NextResponse.json({
    ok,
    blocked,
    message,
    comments,
    integration_note: 'No external comment reply was submitted. Provider submission remains guarded by capability and human-gate checks.',
  }, { status })
}
