import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

import { decodeSlackActionValue, type SlackBlock, type SlackButtonElement } from '@/lib/agent-slack-blocks'
import type { WarmOutreachEmailSendLifecycle } from '@/lib/warm-outreach-response-monitoring'
import {
  buildWarmGmailSendApprovalSlackPayload,
  decideWarmGmailSendAuthorizationFromSlack,
  warmGmailSendAuthorizationDecisionKey,
} from '@/lib/warm-outreach-slack-send-approval'

function queryResult(result: unknown) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return query
}

function actionButtons(blocks: SlackBlock[]) {
  const actions = blocks.find((block) => block.type === 'actions')
  return actions?.type === 'actions' ? actions.elements : []
}

function button(blocks: SlackBlock[], actionId: string): SlackButtonElement {
  const found = actionButtons(blocks).find((entry) => entry.action_id === actionId)
  if (!found) throw new Error(`Expected ${actionId}`)
  return found
}

function lifecycle(overrides: Partial<WarmOutreachEmailSendLifecycle> = {}) {
  return {
    version: 'warm-outreach-email-send-lifecycle/v1',
    contactId: 42,
    mode: 'warm_1_to_1',
    channel: 'email',
    label: 'Email is first candidate, provider/send activation blocked',
    state: 'blocked_before_provider_activation',
    firstCandidateChannel: true,
    sendReady: false,
    providerExecutionEnabled: false,
    externalSendEnabled: false,
    gmailDraftCreationEnabled: false,
    schedulingEnabled: false,
    messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
    sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
    providerCapabilitySmokeKey: 'warm-outreach:gmail-capability-smoke:v1:message-1',
    gmailDraftCreationGateKey: 'warm-outreach:gmail-draft-creation-gate:v1:message-1',
    submittedEvidenceKey: 'warm-outreach:email-submitted-evidence:v1:message-1',
    gmailDraftHandoffPacket: {} as WarmOutreachEmailSendLifecycle['gmailDraftHandoffPacket'],
    providerCapabilitySmoke: {} as WarmOutreachEmailSendLifecycle['providerCapabilitySmoke'],
    gmailDraftCreationGate: {} as WarmOutreachEmailSendLifecycle['gmailDraftCreationGate'],
    gmailProviderActivationReadiness: {} as WarmOutreachEmailSendLifecycle['gmailProviderActivationReadiness'],
    externalSendReadiness: {
      version: 'warm-outreach-external-send-readiness/v1',
      state: 'blocked_pending_authority',
      label: 'External Gmail send authority blocked',
      senderIdentity: {
        state: 'verified_for_draft_only',
        requiredSender: 'vambah@amadutown.com',
        connectedAs: 'vambah@amadutown.com',
        detail: 'Sender verified for draft only.',
      },
      recipientApproval: {
        state: 'required',
        contactId: 42,
        approved: false,
        detail: 'No per-recipient external-send approval is recorded.',
      },
      draftEvidence: {
        state: 'tracked',
        gmailDraftExists: true,
        draftId: 'r123',
        threadId: 'thread-1',
        messageId: 'message-1',
        sourceIds: ['queue-1'],
        detail: 'A Gmail draft exists as tracking evidence only.',
      },
      suppressionConsent: {
        state: 'clear',
        reasons: [],
        detail: 'No suppression blocker is recorded.',
      },
      idempotency: {
        messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
        sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
        submittedEvidenceKey: 'warm-outreach:email-submitted-evidence:v1:message-1',
        duplicateDetected: false,
        detail: 'Reuse stable keys.',
      },
      externalSend: {
        enabled: false,
        approved: false,
        blocked: true,
        detail: 'Gmail send is blocked.',
        nextStep: 'Record explicit authorization first.',
      },
    },
    duplicatePrevention: {} as WarmOutreachEmailSendLifecycle['duplicatePrevention'],
    suppressionCheck: { status: 'clear', reasons: [] },
    relationshipProvenance: {
      status: 'present',
      sourceCount: 1,
      signalCount: 1,
      relationshipEventId: 'meeting-1',
      detail: 'Portfolio-local relationship provenance is attached.',
    },
    personalizationProvenance: {} as WarmOutreachEmailSendLifecycle['personalizationProvenance'],
    auditState: { status: 'scaffold_only', notes: [] },
    stages: [],
    ...overrides,
  } as WarmOutreachEmailSendLifecycle
}

function slackApprovalRequest(overrides: Record<string, unknown> = {}) {
  return {
    version: 'warm-outreach-slack-gmail-send-approval-request/v1',
    status: 'pending',
    request_key: 'warm-outreach:slack-gmail-send-card:v1:message-1',
    contact_submission_id: 42,
    outreach_queue_id: 'queue-1',
    message_version_key: 'warm-outreach:email-message-version:v1:message-1',
    send_queue_idempotency_key: 'warm-outreach:email-send-queue:v1:message-1',
    records_authorization_intent_only: true,
    gmail_send_called: false,
    external_send_performed: false,
    ...overrides,
  }
}

describe('warm Gmail send Slack approval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds a one-recipient Slack card with explicit no-send boundaries', () => {
    const payload = buildWarmGmailSendApprovalSlackPayload({
      contactId: 42,
      outreachQueueId: 'queue-1',
      recipientLabel: 'Amina Example',
      recipientEmail: 'amina@example.com',
      relationshipBasisSummary: 'Prior meeting context supports a warm follow-up.',
      proposedSubject: 'Quick follow-up',
      proposedMessage: 'Wanted to follow up on the operations conversation.',
      portfolioUrl: 'https://amadutown.test/admin/outreach?contactId=42',
      gmailDraftUrl: 'https://mail.google.com/mail/u/0/#drafts/r123',
      lifecycle: lifecycle(),
    })

    expect(payload.text).toContain('Amina Example')
    expect(payload.dedupeKey).toMatch(/^warm-outreach:slack-gmail-send-card:v1:/)
    expect(payload.executionBoundary).toEqual({
      portfolioCanonicalAudit: true,
      slackAttentionSurfaceOnly: true,
      gmailSendCalled: false,
      externalSendEnabled: false,
      providerExecutionEnabled: false,
    })
    expect(JSON.stringify(payload.blocks)).toContain('Approve Send records explicit external-send authorization')
    expect(JSON.stringify(payload.blocks)).toContain('r123')
    expect(JSON.stringify(payload.blocks)).toContain('warm-outreach:email-send-queue:v1:message-1')

    const approve = decodeSlackActionValue(button(payload.blocks, 'warm_gmail_send.approve').value)
    expect(approve).toMatchObject({
      action: 'warm_gmail_send.approve',
      contactId: 42,
      outreachQueueId: 'queue-1',
      messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
      sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
    })
    expect(button(payload.blocks, 'warm_gmail_send.approve').confirm?.text.text).toContain(
      'Gmail send execution remains disabled',
    )
  })

  it('dedupes Slack cards by exact queue row, recipient, channel, and message version', () => {
    const first = buildWarmGmailSendApprovalSlackPayload({
      contactId: 42,
      outreachQueueId: 'queue-1',
      recipientLabel: 'Amina Example',
      relationshipBasisSummary: 'Prior meeting.',
      proposedMessage: 'First wording.',
      lifecycle: lifecycle(),
    })
    const replay = buildWarmGmailSendApprovalSlackPayload({
      contactId: 42,
      outreachQueueId: 'queue-replayed',
      recipientLabel: 'Amina Example',
      relationshipBasisSummary: 'Prior meeting with more words.',
      proposedMessage: 'Second wording.',
      lifecycle: lifecycle(),
    })
    const nextVersion = buildWarmGmailSendApprovalSlackPayload({
      contactId: 42,
      outreachQueueId: 'queue-1',
      recipientLabel: 'Amina Example',
      relationshipBasisSummary: 'Prior meeting.',
      proposedMessage: 'Revised wording.',
      lifecycle: lifecycle({
        messageVersionKey: 'warm-outreach:email-message-version:v1:message-2',
      }),
    })

    expect(replay.dedupeKey).not.toBe(first.dedupeKey)
    expect(nextVersion.dedupeKey).not.toBe(first.dedupeKey)
  })

  it('records Slack approval intent in Portfolio without calling Gmail send', async () => {
    const updateQuery = queryResult({ error: null })
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'queue-1',
          contact_submission_id: 42,
          channel: 'email',
          status: 'draft',
          generation_inputs: {
            gmail_draft_creation: {
              draft_id: 'r123',
              external_send_blocked: true,
            },
            warm_gmail_send_slack_approval_request: slackApprovalRequest(),
          },
        },
        error: null,
      }))
      .mockReturnValueOnce(updateQuery)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await decideWarmGmailSendAuthorizationFromSlack({
      contactId: 42,
      outreachQueueId: 'queue-1',
      messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
      sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
      status: 'approved',
      actorLabel: 'vambah',
      slackUserId: 'U123',
      decisionNotes: 'Approved from Slack.',
      idempotencyKey: 'slack-agent-action:U123:ts:warm_gmail_send.approve:warm-outreach:email-send-queue:v1:message-1',
    })

    expect(result).toContain('approval intent recorded')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.from).toHaveBeenCalledWith('outreach_queue')
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      generation_inputs: expect.objectContaining({
        gmail_draft_creation: expect.objectContaining({
          external_send_blocked: true,
        }),
        warm_gmail_send_authorization: expect.objectContaining({
          status: 'approved',
          approval_intent_recorded: true,
          external_send_authorization_intent: true,
          external_send_enabled: false,
          provider_execution_enabled: false,
          gmail_send_called: false,
          external_send_performed: false,
        }),
        warm_gmail_send_slack_approval_request: expect.objectContaining({
          status: 'approved',
          decision_key: expect.stringMatching(/^warm-outreach:slack-gmail-send-decision:v1:/),
          gmail_send_called: false,
          external_send_performed: false,
        }),
      }),
    }))
  })

  it.each([
    ['rejected', 'rejected'],
    ['revision_requested', 'revision requested'],
  ] as const)('records Slack %s decisions without approval intent', async (status, label) => {
    const updateQuery = queryResult({ error: null })
    mocks.from
      .mockReturnValueOnce(queryResult({
        data: {
          id: 'queue-1',
          contact_submission_id: 42,
          channel: 'email',
          status: 'draft',
          generation_inputs: {
            warm_gmail_send_slack_approval_request: slackApprovalRequest(),
          },
        },
        error: null,
      }))
      .mockReturnValueOnce(updateQuery)

    const result = await decideWarmGmailSendAuthorizationFromSlack({
      contactId: 42,
      outreachQueueId: 'queue-1',
      messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
      sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
      status,
      actorLabel: 'vambah',
      slackUserId: 'U123',
      decisionNotes: `${label} from Slack.`,
      idempotencyKey: `slack-action-${status}`,
    })

    expect(result).toContain(label)
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      generation_inputs: expect.objectContaining({
        warm_gmail_send_authorization: expect.objectContaining({
          status,
          approval_intent_recorded: false,
          external_send_authorization_intent: false,
          gmail_send_called: false,
          external_send_performed: false,
        }),
        warm_gmail_send_slack_approval_request: expect.objectContaining({
          status,
          gmail_send_called: false,
          external_send_performed: false,
        }),
      }),
    }))
  })

  it('does not rewrite duplicate approval decisions for the same recipient and message version', async () => {
    const decisionKey = warmGmailSendAuthorizationDecisionKey({
      contactId: 42,
      messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
    })
    mocks.from.mockReturnValueOnce(queryResult({
      data: {
        id: 'queue-1',
        contact_submission_id: 42,
        channel: 'email',
        status: 'draft',
        generation_inputs: {
          warm_gmail_send_authorization: {
            decision_key: decisionKey,
            status: 'approved',
            gmail_send_called: false,
          },
        },
      },
      error: null,
    }))

    const result = await decideWarmGmailSendAuthorizationFromSlack({
      contactId: 42,
      outreachQueueId: 'queue-1',
      messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
      sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
      status: 'approved',
      actorLabel: 'vambah',
      slackUserId: 'U123',
      decisionNotes: 'Replay.',
      idempotencyKey: 'slack-action-replay',
    })

    expect(result).toContain('already recorded')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('refuses Slack decisions when the stored approval request has a mismatched message version', async () => {
    mocks.from.mockReturnValueOnce(queryResult({
      data: {
        id: 'queue-1',
        contact_submission_id: 42,
        channel: 'email',
        status: 'draft',
        generation_inputs: {
          warm_gmail_send_slack_approval_request: slackApprovalRequest({
            message_version_key: 'warm-outreach:email-message-version:v1:old-message',
          }),
        },
      },
      error: null,
    }))

    await expect(decideWarmGmailSendAuthorizationFromSlack({
      contactId: 42,
      outreachQueueId: 'queue-1',
      messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
      sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
      status: 'approved',
      actorLabel: 'vambah',
      slackUserId: 'U123',
      decisionNotes: 'Approved from stale Slack card.',
      idempotencyKey: 'slack-action-stale',
    })).rejects.toThrow('message version is stale or mismatched')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('refuses Slack decisions when the target contact does not match the queue row', async () => {
    mocks.from.mockReturnValueOnce(queryResult({
      data: {
        id: 'queue-1',
        contact_submission_id: 99,
        channel: 'email',
        status: 'draft',
        generation_inputs: {
          warm_gmail_send_slack_approval_request: slackApprovalRequest(),
        },
      },
      error: null,
    }))

    await expect(decideWarmGmailSendAuthorizationFromSlack({
      contactId: 42,
      outreachQueueId: 'queue-1',
      messageVersionKey: 'warm-outreach:email-message-version:v1:message-1',
      sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:message-1',
      status: 'approved',
      actorLabel: 'vambah',
      slackUserId: 'U123',
      decisionNotes: 'Approved from copied Slack card.',
      idempotencyKey: 'slack-action-contact-mismatch',
    })).rejects.toThrow('target does not match the recipient')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})
