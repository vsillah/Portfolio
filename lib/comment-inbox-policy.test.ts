import { describe, expect, it } from 'vitest'
import {
  COMMENT_CLASSIFICATIONS,
  buildCommentLeadWorkItemProposal,
  buildCommentInboxPolicyInputFromSocialComment,
  evaluateCommentInboxPolicy,
  type CommentInboxPolicyInput,
} from './comment-inbox-policy'

const baseComment = {
  id: 'comment-1',
  text: 'Great point.',
  platform: 'linkedin',
  provider: 'linkedin',
  providerCommentId: 'provider-comment-1',
  threadId: 'thread-1',
  authorId: 'author-1',
  authorHandle: 'operator_one',
  postId: 'post-1',
  postLabel: 'AI operations post',
  createdAt: '2026-08-06T12:00:00.000Z',
}

function policyInput(overrides: Partial<CommentInboxPolicyInput> = {}): CommentInboxPolicyInput {
  return {
    comment: { ...baseComment },
    confidence: 0.92,
    now: '2026-08-06T12:30:00.000Z',
    ...overrides,
  }
}

describe('comment inbox policy', () => {
  it.each([
    ['low_risk_acknowledgement', 'Appreciate this. Great point.', 0.92, undefined],
    ['substantive_question', 'How would this work for a nonprofit team?', 0.92, undefined],
    ['buying_lead_intent', 'Can you build this for my organization? What would it cost?', 0.92, undefined],
    ['partnership_intent', 'Would you be open to a partnership or collaboration?', 0.92, undefined],
    ['criticism_negative', 'This is wrong and misleading.', 0.92, undefined],
    ['misinformation_unsupported_claim', 'Source? This claim is not true.', 0.92, undefined],
    ['sensitive_privacy_legal_financial', 'Can you give financial advice if I share private account details?', 0.92, undefined],
    ['spam', 'Buy followers now and click my link.', 0.92, undefined],
    ['low_confidence', 'Could be a real reply, maybe.', 0.3, undefined],
    ['provider_manual_ambiguity', 'Looks manually imported from another tool.', 0.92, { provider: 'manual' }],
  ] as const)('classifies %s comments', (classification, text, confidence, commentOverrides) => {
    const result = evaluateCommentInboxPolicy(policyInput({
      comment: { ...baseComment, ...commentOverrides, text },
      confidence,
    }))

    expect(COMMENT_CLASSIFICATIONS).toContain(result.classification)
    expect(result.classification).toBe(classification)
  })

  it('allows only low-risk public-safe replies after the hold window', () => {
    const result = evaluateCommentInboxPolicy(policyInput())

    expect(result.classification).toBe('low_risk_acknowledgement')
    expect(result.humanQaRequired).toBe(false)
    expect(result.autoSend).toMatchObject({
      eligible: true,
      canSendNow: true,
      blockedReasons: [],
      holdReasons: [],
    })
    expect(result.replyDraft).toMatchObject({
      status: 'draft_public_reply',
      preserveVoice: 'vambah_amadutown',
      mustNotQuotePrivateSourceMaterial: true,
    })
    expect(result.workflowUpdateProposal.workflowOwnedPatch).toMatchObject({
      classification_status: 'needs_response',
      sentiment: 'positive',
      priority: 'low',
      response_approval_state: 'not_required',
      reply_submission_state: 'draft',
      proposed_reply_text: result.replyDraft.text,
      approved_reply_text: null,
      reply_provider_comment_id: null,
      reply_submitted_at: null,
    })
    expect(result.workflowUpdateProposal.providerIngestionBoundary).toEqual({
      ingestionEnabled: false,
      replySubmissionEnabled: false,
      externalActionsAllowed: false,
      note: expect.stringContaining('provider ingestion and reply submission remain separate'),
    })
    expect(result.replyDraft.provenanceSummary).toContain('No public source claims')
    expect(result.replyDraft.sourceDistanceNote).toContain('do not quote private')
  })

  it.each([
    ['private_data', { signals: { private_data: true } }],
    ['unsupported_claim', { signals: { unsupported_claim: true } }],
    ['pricing_or_custom_promise', { signals: { pricing_or_custom_promise: true } }],
    ['legal_or_financial_advice', { signals: { legal_or_financial_advice: true } }],
    ['negative_or_conflict_tone', { signals: { negative_or_conflict_tone: true } }],
    ['lead_handoff', { signals: { lead_handoff: true } }],
    ['provider_ambiguity', { signals: { provider_ambiguity: true } }],
    ['external_public_boundary_uncertainty', { signals: { external_boundary_uncertainty: true } }],
  ] as const)('blocks auto-send when %s is present', (reason, overrides) => {
    const result = evaluateCommentInboxPolicy(policyInput(overrides))

    expect(result.autoSend.eligible).toBe(false)
    expect(result.autoSend.canSendNow).toBe(false)
    expect(result.autoSend.blockedReasons).toContain(reason)
    expect(result.humanQaRequired).toBe(true)
  })

  it('blocks auto-send when confidence is below the auto-send threshold', () => {
    const result = evaluateCommentInboxPolicy(policyInput({
      confidence: 0.7,
      options: { classificationConfidenceThreshold: 0.5, autoSendConfidenceThreshold: 0.85 },
    }))

    expect(result.classification).toBe('low_risk_acknowledgement')
    expect(result.autoSend.blockedReasons).toContain('confidence_below_auto_send_threshold')
    expect(result.autoSend.eligible).toBe(false)
  })

  it('holds an otherwise eligible auto reply for 15 minutes', () => {
    const result = evaluateCommentInboxPolicy(policyInput({
      now: '2026-08-06T12:10:00.000Z',
    }))

    expect(result.autoSend.eligible).toBe(true)
    expect(result.autoSend.canSendNow).toBe(false)
    expect(result.autoSend.earliestSendAt).toBe('2026-08-06T12:15:00.000Z')
    expect(result.autoSend.holdReasons).toContain('hold_window_pending')
  })

  it('blocks more than one auto reply per author and thread within 24 hours', () => {
    const result = evaluateCommentInboxPolicy(policyInput({
      previousAutoReplies: [
        {
          authorId: 'author-1',
          threadId: 'thread-1',
          sentAt: '2026-08-06T01:00:00.000Z',
        },
      ],
    }))

    expect(result.autoSend.eligible).toBe(false)
    expect(result.autoSend.blockedReasons).toContain('author_thread_auto_reply_throttle')
  })

  it('does not throttle when the prior auto reply is older than 24 hours', () => {
    const result = evaluateCommentInboxPolicy(policyInput({
      previousAutoReplies: [
        {
          authorId: 'author-1',
          threadId: 'thread-1',
          sentAt: '2026-08-05T11:00:00.000Z',
        },
      ],
    }))

    expect(result.autoSend.eligible).toBe(true)
    expect(result.autoSend.canSendNow).toBe(true)
  })

  it('creates a Behanzin-owned lead work-item proposal for buying intent without auto outreach', () => {
    const result = evaluateCommentInboxPolicy(policyInput({
      comment: {
        ...baseComment,
        id: 'lead-comment-1',
        providerCommentId: 'linkedin-comment-999',
        text: 'Can you build this for our team? I would like pricing.',
      },
      sources: [
        {
          label: 'Public LinkedIn post',
          visibility: 'public',
          usedForPublicClaim: false,
        },
      ],
    }))

    expect(result.classification).toBe('buying_lead_intent')
    expect(result.humanQaRequired).toBe(true)
    expect(result.autoSend.blockedReasons).toContain('lead_handoff')
    expect(result.leadWorkItemProposal).toMatchObject({
      priority: 'high',
      status: 'proposed',
      ownerAgentKey: 'warm-lead-capture',
      ownerRuntime: 'n8n',
      source: {
        type: 'social_comment',
        id: 'linkedin-comment-999',
      },
      idempotencyKey: 'comment-lead:linkedin-comment-999',
    })
    expect(result.leadWorkItemProposal?.metadata).toMatchObject({
      outreach_auto_send_allowed: false,
      human_qa_required: true,
      classification: 'buying_lead_intent',
      workflow_owned_fields_only: true,
      provider_ingestion_enabled: false,
      reply_submission_enabled: false,
      external_actions_allowed: false,
    })
    expect(result.replyDraft.text).toContain('public thread')

    const directProposal = buildCommentLeadWorkItemProposal(policyInput({
      comment: {
        ...baseComment,
        providerCommentId: 'linkedin-comment-999',
        text: 'Can you build this for our team? I would like pricing.',
      },
    }))
    expect(directProposal?.ownerAgentKey).toBe('warm-lead-capture')
  })

  it('blocks public claims derived from private sources', () => {
    const result = evaluateCommentInboxPolicy(policyInput({
      sources: [
        {
          label: 'Private client note',
          visibility: 'private',
          usedForPublicClaim: true,
          supportsPublicClaim: true,
        },
      ],
      draft: {
        text: 'This confirms the client saved six hours a week.',
        confidence: 0.95,
        tone: 'public_safe',
        derivedFromPrivateSource: true,
      },
    }))

    expect(result.autoSend.eligible).toBe(false)
    expect(result.autoSend.blockedReasons).toContain('private_source_public_claim')
    expect(result.humanQaReasons).toContain('private_source_public_claim_boundary')
    expect(result.replyDraft.mustNotQuotePrivateSourceMaterial).toBe(true)
  })

  it('blocks unsupported public claims from source context', () => {
    const result = evaluateCommentInboxPolicy(policyInput({
      sources: [
        {
          label: 'Unverified benchmark comment',
          visibility: 'public',
          usedForPublicClaim: true,
          supportsPublicClaim: false,
        },
      ],
    }))

    expect(result.classification).toBe('misinformation_unsupported_claim')
    expect(result.autoSend.blockedReasons).toContain('unsupported_claim')
    expect(result.humanQaRequired).toBe(true)
  })

  it('maps PR 762 social comment payloads into provider-ambiguous policy input', () => {
    const input = buildCommentInboxPolicyInputFromSocialComment({
      id: 'comment-row-1',
      publish_id: 'publish-1',
      content_id: 'content-1',
      platform: 'linkedin',
      provider: 'linkedin_organization',
      provider_comment_id: 'provider-comment-1',
      provider_parent_comment_id: 'provider-root-1',
      author_public_handle: '@operator',
      author_display_name: 'Operator One',
      body: 'Appreciate this.',
      provider_created_at: '2026-08-06T12:00:00.000Z',
      provider_capability: {
        capability_status: 'manual',
        supports_reply_submission: false,
        external_submission_enabled: false,
      },
    }, {
      confidence: 0.96,
      now: '2026-08-06T12:30:00.000Z',
    })

    expect(input.comment).toMatchObject({
      id: 'comment-row-1',
      text: 'Appreciate this.',
      platform: 'linkedin',
      provider: 'linkedin_organization',
      providerCommentId: 'provider-comment-1',
      threadId: 'provider-root-1',
      authorId: '@operator',
      authorHandle: '@operator',
      postId: 'content-1',
      createdAt: '2026-08-06T12:00:00.000Z',
    })
    expect(input.signals?.provider_ambiguity).toBe(true)

    const result = evaluateCommentInboxPolicy(input)
    expect(result.classification).toBe('provider_manual_ambiguity')
    expect(result.humanQaReasons).toContain('provider_manual_ambiguity_requires_review')
    expect(result.autoSend.blockedReasons).toContain('provider_ambiguity')
    expect(result.workflowUpdateProposal.workflowOwnedPatch).toMatchObject({
      classification_status: 'blocked',
      priority: 'high',
      response_approval_state: 'pending',
      reply_submission_state: 'draft',
    })
  })

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', {}],
  ] as const)('fails closed when provider capability is %s', (_, providerCapability) => {
    const input = buildCommentInboxPolicyInputFromSocialComment({
      id: 'comment-row-1',
      platform: 'linkedin',
      provider: 'linkedin_organization',
      provider_comment_id: 'provider-comment-1',
      author_public_handle: '@operator',
      body: 'Appreciate this.',
      captured_at: '2026-08-06T12:00:00.000Z',
      ...(providerCapability !== undefined ? { provider_capability: providerCapability } : {}),
    }, {
      confidence: 0.96,
      now: '2026-08-06T12:30:00.000Z',
    })

    const result = evaluateCommentInboxPolicy(input)

    expect(input.signals?.provider_ambiguity).toBe(true)
    expect(result.classification).toBe('provider_manual_ambiguity')
    expect(result.humanQaRequired).toBe(true)
    expect(result.humanQaReasons).toContain('provider_manual_ambiguity_requires_review')
    expect(result.autoSend.eligible).toBe(false)
    expect(result.autoSend.blockedReasons).toContain('provider_ambiguity')
  })

  it('clears provider ambiguity only with explicit verified reply-submission capability', () => {
    const input = buildCommentInboxPolicyInputFromSocialComment({
      id: 'comment-row-1',
      platform: 'youtube',
      provider: 'youtube_data_api',
      provider_comment_id: 'comment-1',
      author_public_handle: '@viewer',
      body: 'Appreciate this.',
      captured_at: '2026-08-06T12:00:00.000Z',
      provider_capability: {
        capability_status: 'verified',
        supports_reply_submission: true,
        external_submission_enabled: true,
      },
    }, {
      confidence: 0.96,
      now: '2026-08-06T12:30:00.000Z',
    })

    const result = evaluateCommentInboxPolicy(input)

    expect(input.signals?.provider_ambiguity).toBe(false)
    expect(result.classification).toBe('low_risk_acknowledgement')
    expect(result.humanQaRequired).toBe(false)
    expect(result.autoSend.eligible).toBe(true)
  })

  it('uses provider comment id as the thread fallback for 24-hour throttles', () => {
    const input = buildCommentInboxPolicyInputFromSocialComment({
      platform: 'youtube',
      provider: 'youtube_data_api',
      provider_comment_id: 'comment-1',
      author_public_handle: '@viewer',
      body: 'Appreciate this.',
      captured_at: '2026-08-06T12:00:00.000Z',
      provider_capability: {
        capability_status: 'verified',
        supports_reply_submission: true,
        external_submission_enabled: true,
      },
    }, {
      confidence: 0.96,
      now: '2026-08-06T12:30:00.000Z',
      previousAutoReplies: [
        {
          authorId: '@viewer',
          threadId: 'comment-1',
          sentAt: '2026-08-06T12:20:00.000Z',
        },
      ],
    })

    const result = evaluateCommentInboxPolicy(input)

    expect(input.comment.threadId).toBe('comment-1')
    expect(result.classification).toBe('low_risk_acknowledgement')
    expect(result.autoSend.blockedReasons).toContain('author_thread_auto_reply_throttle')
  })

  it('keeps workflow proposals out of provider-owned ingestion fields', () => {
    const result = evaluateCommentInboxPolicy(policyInput({
      comment: {
        ...baseComment,
        text: 'Can you build this for our team?',
      },
    }))

    const patchKeys = Object.keys(result.workflowUpdateProposal.workflowOwnedPatch)

    expect(patchKeys.sort()).toEqual([
      'approved_reply_text',
      'classification_reason',
      'classification_status',
      'metadata',
      'priority',
      'proposed_reply_text',
      'reply_provider_comment_id',
      'reply_submission_state',
      'reply_submitted_at',
      'response_approval_state',
      'sentiment',
    ].sort())
    expect(result.workflowUpdateProposal.providerOwnedFieldsNotMutated).toEqual(expect.arrayContaining([
      'provider',
      'provider_comment_id',
      'provider_parent_comment_id',
      'parent_comment_id',
      'thread_id',
      'body',
      'provider_capability',
      'ingestion_run_id',
      'raw_payload',
    ]))
    for (const providerOwnedField of result.workflowUpdateProposal.providerOwnedFieldsNotMutated) {
      expect(result.workflowUpdateProposal.workflowOwnedPatch).not.toHaveProperty(providerOwnedField)
    }
    expect(result.workflowUpdateProposal.workflowOwnedPatch.metadata).toMatchObject({
      policy_decision: {
        provider_ingestion_enabled: false,
        reply_submission_enabled: false,
        external_actions_allowed: false,
      },
    })
  })
})
