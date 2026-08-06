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
    body: 'Can this help a small nonprofit?',
    classification_status: 'needs_response',
    priority: 'high',
    status: 'visible',
    response_approval_state: 'pending',
    reply_submission_state: 'draft',
    proposed_reply_text: 'Yes. Start with the intake map.',
    provider_capability: {
      supports_reply_submission: true,
      external_submission_enabled: true,
    },
    metadata: {
      policy_decision: {
        classification: 'low_risk_acknowledgement',
        humanQaRequired: false,
        autoSend: { eligible: true, canSendNow: true },
      },
    },
    ...overrides,
  }
}

describe('Social comment attention plumbing', () => {
  it('identifies high-priority unresolved comments as attention candidates', () => {
    expect(needsCommentAttention(row())).toBe(true)
    expect(needsCommentAttention(row({ classification_status: 'answered', priority: 'high' }))).toBe(false)
  })

  it('allows Slack decisions only for prepared low-risk verified provider replies', () => {
    expect(canSlackDecideCommentReply(row())).toBe(true)
    expect(canSlackDecideCommentReply(row({ proposed_reply_text: null }))).toBe(false)
    expect(canSlackDecideCommentReply(row({
      metadata: {
        policy_decision: {
          classification: 'buying_lead_intent',
          humanQaRequired: true,
          autoSend: { eligible: false },
        },
      },
    }))).toBe(false)
    expect(canSlackDecideCommentReply(row({
      provider_capability: {
        supports_reply_submission: true,
        external_submission_enabled: false,
      },
    }))).toBe(false)
  })

  it('keeps approved replies inside the 15-minute hold before provider eligibility', () => {
    const now = new Date('2026-08-06T14:00:00.000Z')
    const holdUntil = commentReplyHoldUntil(now)
    const evaluation = evaluateCommentReplyHold(row({
      response_approval_state: 'approved',
      reply_submission_state: 'approved',
      metadata: {
        policy_decision: {
          classification: 'low_risk_acknowledgement',
          humanQaRequired: false,
          autoSend: { eligible: true, canSendNow: true },
        },
        reply_hold_until: holdUntil,
      },
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
      response_approval_state: 'approved',
      reply_submission_state: 'approved',
      metadata: {
        policy_decision: {
          classification: 'low_risk_acknowledgement',
          humanQaRequired: false,
          autoSend: { eligible: true, canSendNow: true },
        },
        reply_hold_until: '2026-08-06T14:15:00.000Z',
      },
    }), new Date('2026-08-06T14:16:00.000Z'))

    expect(evaluation).toMatchObject({
      state: 'ready_for_provider_send',
      externalSubmissionAllowed: false,
      reason: expect.stringContaining('stops before any external provider write'),
    })
  })

  it('routes elapsed holds to manual when provider capability is unsupported', () => {
    const evaluation = evaluateCommentReplyHold(row({
      response_approval_state: 'approved',
      reply_submission_state: 'approved',
      provider_capability: {
        supports_reply_submission: false,
        external_submission_enabled: false,
      },
      metadata: {
        policy_decision: {
          classification: 'low_risk_acknowledgement',
          humanQaRequired: false,
          autoSend: { eligible: true, canSendNow: true },
        },
        reply_hold_until: '2026-08-06T14:15:00.000Z',
      },
    }), new Date('2026-08-06T14:16:00.000Z'))

    expect(evaluation).toMatchObject({
      state: 'manual_required',
      externalSubmissionAllowed: false,
    })
  })
})
