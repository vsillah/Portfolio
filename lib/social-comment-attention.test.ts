import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: null,
}))
import {
  buildSocialCommentAlertReliabilityStatus,
  canSlackDecideCommentReply,
  commentReplyHoldUntil,
  evaluateCommentReplyHold,
  needsCommentAttention,
  socialCommentDeepLink,
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
        human_qa_required: false,
        auto_send: { eligible: true, can_send_now: true },
      },
    },
    ...overrides,
  }
}

describe('Social comment attention plumbing', () => {
  it('summarizes default-off alert reliability without enabling Slack delivery', () => {
    const status = buildSocialCommentAlertReliabilityStatus({
      activationEnabled: false,
      activationReason: 'activation_disabled_default_off',
      deliveryDryRun: true,
      itemCount: 2,
      skippedCount: 1,
      reasons: ['Dry run only.'],
    })

    expect(status).toMatchObject({
      state: 'disabled',
      deliveryMode: 'disabled',
      activation: {
        enabled: false,
        reason: 'activation_disabled_default_off',
      },
      counts: {
        itemCount: 2,
        sent: 0,
        deduped: 0,
        skipped: 1,
        errors: 0,
      },
      nextStep: {
        href: '/admin/social-content/engagement-inbox',
      },
    })
  })

  it('summarizes dry-run alert reliability as evaluation-only', () => {
    const status = buildSocialCommentAlertReliabilityStatus({
      activationEnabled: true,
      activationReason: 'manual_dry_run',
      deliveryDryRun: true,
      itemCount: 1,
      skippedCount: 1,
      reasons: ['Dry run only.'],
    })

    expect(status).toMatchObject({
      state: 'dry_run',
      deliveryMode: 'dry_run',
      label: 'Dry run',
      counts: {
        itemCount: 1,
        skipped: 1,
      },
    })
    expect(status.lastActionableNextStep).toContain('cron response')
  })

  it('prioritizes deduped, sent, skipped, error, and no-item alert states', () => {
    expect(buildSocialCommentAlertReliabilityStatus({
      activationEnabled: true,
      deliveryDryRun: false,
      itemCount: 2,
      dedupedCount: 1,
    }).state).toBe('deduped')

    expect(buildSocialCommentAlertReliabilityStatus({
      activationEnabled: true,
      deliveryDryRun: false,
      itemCount: 2,
      sentCount: 1,
    }).state).toBe('sent')

    expect(buildSocialCommentAlertReliabilityStatus({
      activationEnabled: true,
      deliveryDryRun: false,
      itemCount: 2,
      skippedCount: 1,
      reasons: ['Slack bot channel and webhook are not configured.'],
    }).state).toBe('skipped')

    expect(buildSocialCommentAlertReliabilityStatus({
      activationEnabled: true,
      deliveryDryRun: false,
      itemCount: 2,
      errorCount: 1,
      reasons: ['database unavailable'],
    }).state).toBe('errored')

    expect(buildSocialCommentAlertReliabilityStatus({
      activationEnabled: true,
      deliveryDryRun: false,
      itemCount: 0,
    }).state).toBe('no_eligible_items')
  })

  it('identifies high-priority unresolved comments as attention candidates', () => {
    expect(needsCommentAttention(row())).toBe(true)
    expect(needsCommentAttention(row({ classification_status: 'answered', priority: 'high' }))).toBe(false)
  })

  it('keeps canonical blocked/manual comment states in the attention queue', () => {
    expect(needsCommentAttention(row({
      classification_status: 'blocked',
      priority: 'normal',
      metadata: {
        policy_decision: {
          classification: 'provider_manual_ambiguity',
          human_qa_required: true,
          auto_send: { eligible: false },
        },
      },
    }))).toBe(true)
  })

  it('links Slack review actions to the Engagement Inbox route', () => {
    expect(socialCommentDeepLink(row())).toBe(
      '/admin/social-content/engagement-inbox?comment=comment-1&post=social-post-1',
    )
  })

  it('allows Slack decisions only for prepared low-risk verified provider replies', () => {
    expect(canSlackDecideCommentReply(row())).toBe(true)
    expect(canSlackDecideCommentReply(row({ proposed_reply_text: null }))).toBe(false)
    expect(canSlackDecideCommentReply(row({
      metadata: {
        policy_decision: {
          classification: 'buying_lead_intent',
          human_qa_required: true,
          auto_send: { eligible: false },
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
          human_qa_required: false,
          auto_send: { eligible: true, can_send_now: true },
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
          human_qa_required: false,
          auto_send: { eligible: true, can_send_now: true },
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
          human_qa_required: false,
          auto_send: { eligible: true, can_send_now: true },
        },
        reply_hold_until: '2026-08-06T14:15:00.000Z',
      },
    }), new Date('2026-08-06T14:16:00.000Z'))

    expect(evaluation).toMatchObject({
      state: 'manual_required',
      externalSubmissionAllowed: false,
    })
  })

  it('does not evaluate approved replies that were not placed into the Slack hold queue', () => {
    const evaluation = evaluateCommentReplyHold(row({
      response_approval_state: 'approved',
      reply_submission_state: 'approved',
      metadata: {
        policy_decision: {
          classification: 'low_risk_acknowledgement',
          human_qa_required: false,
          auto_send: { eligible: true, can_send_now: true },
        },
      },
    }), new Date('2026-08-06T14:16:00.000Z'))

    expect(evaluation).toMatchObject({
      state: 'not_ready',
      reason: 'No 15-minute hold marker is recorded for this approved reply.',
      externalSubmissionAllowed: false,
    })
  })
})
