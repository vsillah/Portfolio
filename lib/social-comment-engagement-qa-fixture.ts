import {
  filterSocialCommentInboxItems,
  summarizeSocialCommentInbox,
  type SocialCommentAction,
  type SocialCommentInboxFilters,
  type SocialCommentInboxItem,
} from '@/lib/social-comment-inbox-ui'

export const ENGAGEMENT_INBOX_QA_CONTENT_ID = 'social-qa-locked'
export const ENGAGEMENT_INBOX_QA_LOCKED_COMMENT_ID = 'comment-qa-locked'
export const ENGAGEMENT_INBOX_QA_RECOVERABLE_COMMENT_ID = 'comment-qa-recoverable'

const qaTimestamp = '2026-09-01T12:08:00.000Z'

export function engagementInboxQaFixtureEnabled() {
  return process.env.SOCIAL_COMMENT_ENGAGEMENT_QA_FIXTURE === 'true'
    || process.env.VERCEL_ENV === 'preview'
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test'
}

export function explicitEngagementInboxQaFixtureEnabled() {
  return process.env.SOCIAL_COMMENT_ENGAGEMENT_QA_FIXTURE === 'true'
}

export function isEngagementInboxQaFixtureContentId(contentId: string | null | undefined) {
  return engagementInboxQaFixtureEnabled() && contentId === ENGAGEMENT_INBOX_QA_CONTENT_ID
}

export function isEngagementInboxQaFixtureListRequest(input: {
  post?: string | null
  comment?: string | null
}) {
  if (!engagementInboxQaFixtureEnabled()) return false
  return input.post === ENGAGEMENT_INBOX_QA_CONTENT_ID
    || input.comment === ENGAGEMENT_INBOX_QA_LOCKED_COMMENT_ID
    || input.comment === ENGAGEMENT_INBOX_QA_RECOVERABLE_COMMENT_ID
}

function recoverableRejectedComment(): SocialCommentInboxItem {
  return {
    id: ENGAGEMENT_INBOX_QA_RECOVERABLE_COMMENT_ID,
    socialContentId: ENGAGEMENT_INBOX_QA_CONTENT_ID,
    platform: 'youtube',
    providerCommentId: 'youtube-comment-qa-recoverable',
    providerPermalink: 'https://youtube.example.test/comment/qa-recoverable',
    authorDisplayName: 'Synthetic Reviewer',
    body: 'Can this reply explain the approval boundary clearly?',
    status: 'needs_qa',
    classification: {
      label: 'buying lead intent',
      priority: 'high',
      reason: 'Synthetic service question for reject-state QA.',
    },
    draftReply: 'Original rejected reply: yes, this workflow can help.',
    approvalState: 'rejected',
    submittedReplyLocked: false,
    submittedReplyLockReason: null,
    providerCapability: {
      provider: 'youtube_data_api',
      automaticReply: true,
      verified: true,
      humanGateSatisfied: false,
      blocker: 'Human approval is required before any reply can be submitted.',
      recoveryPath: 'Reply manually from the provider permalink after a separate provider gate.',
    },
    actionHistory: [{
      action: 'reject',
      at: '2026-09-01T12:00:00.000Z',
      by: 'qa-admin-user',
      note: 'Synthetic QA feedback: make the approval boundary explicit before review.',
    }],
    createdAt: '2026-09-01T11:50:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    campaignId: 'campaign-qa',
    campaignLabel: 'Synthetic Engagement QA',
    postLabel: 'Synthetic comment reply review',
    postExcerpt: 'Synthetic Portfolio QA post. No external publishing or provider submission is represented.',
  }
}

function submittedLockedComment(): SocialCommentInboxItem {
  return {
    id: ENGAGEMENT_INBOX_QA_LOCKED_COMMENT_ID,
    socialContentId: ENGAGEMENT_INBOX_QA_CONTENT_ID,
    platform: 'youtube',
    providerCommentId: 'youtube-comment-submitted-1',
    providerPermalink: 'https://youtube.example.test/comment/submitted-1',
    authorDisplayName: 'Synthetic Submitted Viewer',
    body: 'This reply already has provider evidence. Can I revise it?',
    status: 'responded',
    classification: {
      label: 'answered comment',
      priority: 'medium',
      reason: 'Synthetic submitted-evidence boundary case.',
    },
    draftReply: 'This rejected reply was already submitted to the provider.',
    approvalState: 'rejected',
    submittedReplyLocked: true,
    submittedReplyLockReason: 'Reply already has submitted provider evidence. Local revision is locked so Portfolio does not rewrite or obscure the canonical provider record.',
    providerCapability: {
      provider: 'youtube_data_api',
      automaticReply: true,
      verified: true,
      humanGateSatisfied: false,
      blocker: 'Submitted provider evidence is authoritative.',
      recoveryPath: 'Review provider evidence before making any local correction.',
    },
    actionHistory: [{
      action: 'reject',
      at: qaTimestamp,
      by: 'qa-admin-user',
      note: 'Rejected after provider evidence existed.',
    }],
    createdAt: '2026-09-01T11:55:00.000Z',
    updatedAt: qaTimestamp,
    campaignId: 'campaign-qa',
    campaignLabel: 'Synthetic Engagement QA',
    postLabel: 'Synthetic submitted reply review',
    postExcerpt: 'Synthetic submitted provider evidence case. No external publishing or provider submission is represented.',
  }
}

export function getEngagementInboxQaFixtureItems(input: {
  recoveredDraftReply?: string | null
  actorId?: string | null
} = {}) {
  const recoverable = recoverableRejectedComment()
  if (input.recoveredDraftReply?.trim()) {
    recoverable.draftReply = input.recoveredDraftReply.trim()
    recoverable.approvalState = 'drafted'
    recoverable.status = 'needs_qa'
    recoverable.actionHistory = [{
      action: 'return_to_review',
      at: qaTimestamp,
      by: input.actorId ?? 'qa-admin-user',
      note: 'Synthetic QA local return-to-review state.',
    }, ...recoverable.actionHistory]
    recoverable.updatedAt = qaTimestamp
  }

  return [submittedLockedComment(), recoverable]
}

export function getEngagementInboxQaFixturePayload(filters: SocialCommentInboxFilters) {
  const allItems = getEngagementInboxQaFixtureItems()
  const items = filterSocialCommentInboxItems(allItems, filters)
  return {
    fixture: true,
    items,
    summary: summarizeSocialCommentInbox(allItems),
    filteredSummary: summarizeSocialCommentInbox(items),
    filters,
    alertReliability: {
      state: 'disabled',
      label: 'QA fixture',
      summary: 'Synthetic QA keeps Slack/provider dispatch disabled; the inbox is the local review surface.',
      deliveryMode: 'disabled',
      activation: {
        enabled: false,
        reason: 'qa_fixture_no_external_dispatch',
      },
      counts: {
        itemCount: allItems.length,
        sent: 0,
        deduped: 0,
        skipped: allItems.length,
        errors: 0,
      },
      reasons: ['Synthetic fixture only.'],
      lastActionableNextStep: 'Review eligible comments in the Engagement Inbox.',
      nextStep: {
        label: 'Open inbox',
        href: '/admin/social-content/engagement-inbox',
      },
      lastRun: null,
    },
    integration_note: 'Synthetic engagement reply QA fixture only. No provider, Slack, Gmail, SMS, publish, schedule, upload, or production-row action was attempted.',
  }
}

export function getEngagementInboxQaFixtureCommentsPayload(input: {
  action?: SocialCommentAction
  commentId?: string | null
  draftReply?: string | null
  actorId?: string | null
}) {
  if (input.commentId === ENGAGEMENT_INBOX_QA_LOCKED_COMMENT_ID) {
    return {
      status: 409,
      body: {
        fixture: true,
        ok: false,
        blocked: true,
        already_submitted: true,
        message: 'Reply already has submitted provider evidence. Local review is locked to preserve the canonical provider record.',
        comments: getEngagementInboxQaFixtureItems(),
        integration_note: 'Synthetic QA fixture only. Existing provider reply evidence remains authoritative, and no local no-op review action was recorded.',
      },
    }
  }

  if (
    input.commentId === ENGAGEMENT_INBOX_QA_RECOVERABLE_COMMENT_ID
    && input.action === 'return_to_review'
    && input.draftReply?.trim()
  ) {
    const comments = getEngagementInboxQaFixtureItems({
      recoveredDraftReply: input.draftReply,
      actorId: input.actorId,
    })
    return {
      status: 200,
      body: {
        fixture: true,
        ok: true,
        blocked: false,
        message: 'Revised reply saved and returned to review. Approval is required before any provider submission.',
        comments,
        summary: summarizeSocialCommentInbox(comments),
        filteredSummary: summarizeSocialCommentInbox(comments),
        integration_note: 'Synthetic engagement reply QA fixture only. The return-to-review state was recorded in the preview response without provider calls or production-row mutation.',
      },
    }
  }

  return {
    status: 409,
    body: {
      fixture: true,
      ok: false,
      blocked: true,
      message: 'Synthetic QA blocks this action. Use the recoverable rejected reply path to submit a local revision, or inspect the submitted-evidence lock.',
      comments: getEngagementInboxQaFixtureItems(),
      integration_note: 'Synthetic engagement reply QA fixture only. No provider, Slack, Gmail, SMS, publish, schedule, upload, or production-row action was attempted.',
    },
  }
}
