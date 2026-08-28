import { describe, expect, it } from 'vitest'
import {
  buildWarmOutreachResponseIdempotencyKey,
  buildWarmOutreachResponseLifecycleDecision,
  communicationChannelForWarmResponse,
} from './warm-outreach-response-lifecycle'

describe('warm outreach response lifecycle policy', () => {
  it('classifies buying interest and routes it to human QA with a follow-up task', () => {
    const decision = buildWarmOutreachResponseLifecycleDecision({
      contactId: 42,
      contactName: 'Anna',
      channel: 'email',
      responseText: 'This sounds good. Can we schedule a quick demo and talk pricing?',
      provider: 'manual',
      providerThreadId: 'thread-1',
      providerMessageId: 'message-1',
      relationshipContext: {
        safeToMention: ['prior community operations context'],
        summarizeOnly: ['private meeting notes'],
        suggestedNextStep: 'Review a short next-step reply.',
      },
    })

    expect(decision.responseClass).toBe('interested')
    expect(decision.humanQaRequired).toBe(true)
    expect(decision.humanQaReasons).toContain('buying_or_sales_intent_review')
    expect(decision.interpretation.recommendedNextAction).toMatchObject({
      label: 'Review short next-step reply',
      priority: 'high',
      requiresNextTouchDecision: true,
    })
    expect(decision.approvalGate).toMatchObject({
      state: 'pending_human_reply_review',
      humanActionRequired: expect.stringContaining('Review and edit'),
    })
    expect(decision.followUpTaskProposal).toMatchObject({
      priority: 'high',
      taskCategory: 'outreach',
    })
    expect(decision.replyDraft.status).toBe('draft')
    expect(decision.replyDraft.body).toContain('prior community operations context')
    expect(decision.replyDraft.reviewerNotes).toContain('Summarize only: private meeting notes.')
    expect(decision.executionBoundary).toMatchObject({
      providerIngestionEnabled: false,
      replySubmissionEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreationEnabled: false,
      slackActionEnabled: false,
      humanQaRequired: true,
    })
  })

  it('proposes suppression for unsubscribe or do-not-contact replies', () => {
    const decision = buildWarmOutreachResponseLifecycleDecision({
      contactId: 42,
      contactName: 'Anna',
      channel: 'linkedin',
      responseText: 'Please remove me and do not contact me again.',
    })

    expect(decision.responseClass).toBe('unsubscribe_do_not_contact')
    expect(decision.interpretation.classificationLabel).toBe('unsubscribe / do not contact')
    expect(decision.suppressionProposal).toMatchObject({
      action: 'mark_do_not_contact',
      state: 'pending_human_approval',
      requiresHumanApproval: true,
    })
    expect(decision.approvalGate).toMatchObject({
      state: 'blocked_suppression_review',
      recoveryPath: expect.stringContaining('relationship packet suppression state'),
    })
    expect(decision.humanQaReasons).toContain('suppression_update_requires_human_approval')
  })

  it.each([
    ['question', 'How would this work with our current process?'],
    ['objection', 'We already have a tool and this is too expensive.'],
    ['not_now', 'Can you circle back next quarter?'],
    ['referral', 'You should talk to my partner and I can make an intro.'],
    ['negative_sensitive', 'This feels like spam and is inappropriate.'],
    ['ambiguous', 'Okay.'],
  ] as const)('classifies %s responses', (expectedClass, responseText) => {
    const decision = buildWarmOutreachResponseLifecycleDecision({
      contactId: 42,
      contactName: 'Anna',
      channel: 'email',
      responseText,
    })

    expect(decision.responseClass).toBe(expectedClass)
    expect(decision.humanQaRequired).toBe(true)
    expect(decision.interpretation.classificationLabel).toBe(
      expectedClass === 'negative_sensitive' ? 'negative / sensitive' : expectedClass.replace(/_/g, ' '),
    )
  })

  it('fails closed for negative and uncertain responses with in-context recovery paths', () => {
    const negative = buildWarmOutreachResponseLifecycleDecision({
      contactId: 42,
      channel: 'email',
      responseText: 'This is inappropriate and feels like spam.',
    })
    const ambiguous = buildWarmOutreachResponseLifecycleDecision({
      contactId: 42,
      channel: 'email',
      responseText: 'Okay.',
    })

    expect(negative.approvalGate).toMatchObject({
      state: 'blocked_negative_review',
      blockedExternalActions: expect.arrayContaining(['gmail_draft_creation', 'provider_monitoring']),
    })
    expect(ambiguous.approvalGate).toMatchObject({
      state: 'blocked_uncertain_review',
      recoveryPath: expect.stringContaining('relationship packet'),
    })
  })

  it('uses provider message ids when present and hashes manual captures otherwise', () => {
    const providerKey = buildWarmOutreachResponseIdempotencyKey({
      contactId: 42,
      channel: 'email',
      responseText: 'Thanks',
      provider: 'gmail',
      providerThreadId: 'thread-1',
      providerMessageId: 'message-1',
    })
    const manualKey = buildWarmOutreachResponseIdempotencyKey({
      contactId: 42,
      channel: 'email',
      responseText: 'Thanks',
      receivedAt: '2026-08-26T10:00:00.000Z',
    })

    expect(providerKey).toBe('warm-outreach:reply:gmail:thread-1:message-1')
    expect(manualKey).toMatch(/^warm-outreach:reply:manual:[a-f0-9]{16}$/)
  })

  it('uses a stable manual message key when provided instead of timestamp-sensitive capture data', () => {
    const first = buildWarmOutreachResponseIdempotencyKey({
      contactId: 42,
      channel: 'email',
      outreachQueueId: 'queue-1',
      responseText: 'Interested in next week.',
      receivedAt: '2026-08-26T10:00:00.000Z',
      messageKey: 'inbox-thread-77-message-2',
    })
    const second = buildWarmOutreachResponseIdempotencyKey({
      contactId: 42,
      channel: 'email',
      outreachQueueId: 'queue-1',
      responseText: 'Different whitespace or summary should not matter here.',
      receivedAt: '2026-08-28T10:00:00.000Z',
      messageKey: 'inbox-thread-77-message-2',
    })

    expect(first).toBe(second)
    expect(first).toMatch(/^warm-outreach:reply:manual:[a-f0-9]{16}$/)
  })

  it('maps manual Facebook and phone channels into existing communication channels', () => {
    expect(communicationChannelForWarmResponse('facebook')).toBe('chat')
    expect(communicationChannelForWarmResponse('phone_contact')).toBe('voice')
    expect(communicationChannelForWarmResponse('email')).toBe('email')
    expect(communicationChannelForWarmResponse('linkedin')).toBe('linkedin')
  })
})
