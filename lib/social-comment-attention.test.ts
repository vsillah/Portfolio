import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))
import {
  canSlackDecideCommentReply,
  commentReplyHoldUntil,
  evaluateCommentReplyHold,
  needsCommentAttention,
  type SocialCommentAttentionRow,
} from '@/lib/social-comment-attention'

function row(overrides: Partial<SocialCommentAttentionRow> = {}): SocialCommentAttentionRow {
  return {
    id: 'comment-1',
    content_id: 'social-post-1',
    platform: 'linkedin',
    comment_text: 'Can this help a small nonprofit?',
    classification: 'question',
    priority: 'high',
    status: 'needs_attention',
    reply_draft: 'Yes. Start with the intake map.',
    reply_status: 'prepared',
    policy_eligibility: 'low_risk',
    provider_capability: 'thread_reply',
    provider_verified: true,
    metadata: {},
    ...overrides,
  }
}

describe('Social comment attention plumbing', () => {
  it('identifies high-priority unresolved comments as attention candidates', () => {
    expect(needsCommentAttention(row())).toBe(true)
    expect(needsCommentAttention(row({ status: 'resolved', priority: 'high' }))).toBe(false)
  })

  it('allows Slack decisions only for prepared low-risk verified provider replies', () => {
    expect(canSlackDecideCommentReply(row())).toBe(true)
    expect(canSlackDecideCommentReply(row({ reply_draft: null }))).toBe(false)
    expect(canSlackDecideCommentReply(row({ policy_eligibility: 'manual_review' }))).toBe(false)
    expect(canSlackDecideCommentReply(row({ provider_verified: false }))).toBe(false)
  })

  it('keeps approved replies inside the 15-minute hold before provider eligibility', () => {
    const now = new Date('2026-08-06T14:00:00.000Z')
    const holdUntil = commentReplyHoldUntil(now)
    const evaluation = evaluateCommentReplyHold(row({
      reply_status: 'approved',
      reply_hold_until: holdUntil,
    }), new Date('2026-08-06T14:05:00.000Z'))

    expect(evaluation).toMatchObject({
      state: 'waiting_hold',
      holdUntil,
      externalSubmissionAllowed: false,
    })
    expect(evaluation.remainingMs).toBe(10 * 60 * 1000)
  })

  it('marks elapsed holds as ready without permitting external submission', () => {
    const evaluation = evaluateCommentReplyHold(row({
      reply_status: 'approved',
      reply_hold_until: '2026-08-06T14:15:00.000Z',
    }), new Date('2026-08-06T14:16:00.000Z'))

    expect(evaluation).toMatchObject({
      state: 'ready_for_provider_send',
      externalSubmissionAllowed: false,
      reason: expect.stringContaining('stops before any external provider write'),
    })
  })

  it('routes elapsed holds to manual when provider capability is unsupported', () => {
    const evaluation = evaluateCommentReplyHold(row({
      reply_status: 'approved',
      reply_hold_until: '2026-08-06T14:15:00.000Z',
      provider_capability: false,
      provider_verified: false,
    }), new Date('2026-08-06T14:16:00.000Z'))

    expect(evaluation).toMatchObject({
      state: 'manual_required',
      externalSubmissionAllowed: false,
    })
  })
})
