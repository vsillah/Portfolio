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
    })

    expect(decision.responseClass).toBe('interested')
    expect(decision.humanQaRequired).toBe(true)
    expect(decision.humanQaReasons).toContain('buying_or_sales_intent_review')
    expect(decision.followUpTaskProposal).toMatchObject({
      priority: 'high',
      taskCategory: 'outreach',
    })
    expect(decision.replyDraft.status).toBe('draft')
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

    expect(decision.responseClass).toBe('unsubscribe_or_do_not_contact')
    expect(decision.suppressionProposal).toMatchObject({
      action: 'mark_do_not_contact',
      requiresHumanApproval: true,
    })
    expect(decision.humanQaReasons).toContain('suppression_update_requires_human_approval')
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

  it('maps manual Facebook and phone channels into existing communication channels', () => {
    expect(communicationChannelForWarmResponse('facebook')).toBe('chat')
    expect(communicationChannelForWarmResponse('phone_contact')).toBe('voice')
    expect(communicationChannelForWarmResponse('email')).toBe('email')
    expect(communicationChannelForWarmResponse('linkedin')).toBe('linkedin')
  })
})
