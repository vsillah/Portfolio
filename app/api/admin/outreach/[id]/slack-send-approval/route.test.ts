import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  getRelationshipPacket: vi.fn(),
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/app/api/admin/outreach/leads/[id]/relationship-packet/route', () => ({
  GET: mocks.getRelationshipPacket,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'
import { warmGmailSendApprovalDedupeKey } from '@/lib/warm-outreach-slack-send-approval'

const MESSAGE_VERSION_KEY = 'warm-outreach:email-message-version:v1:message-1'
const SEND_QUEUE_KEY = 'warm-outreach:email-send-queue:v1:message-1'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/outreach/queue-1/slack-send-approval', {
    method: 'POST',
  })
}

function params(id = 'queue-1') {
  return { params: Promise.resolve({ id }) }
}

function outreachRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'queue-1',
    contact_submission_id: 42,
    channel: 'email',
    status: 'draft',
    subject: 'Warm follow-up',
    body: 'Following up on the operations conversation.',
    thread_id: 'gmail-thread-1',
    message_id: 'gmail-message-1',
    sent_at: null,
    generation_inputs: {
      gmail_draft_creation: {
        draft_id: 'gmail-draft-1',
        message_id: 'gmail-message-1',
        thread_id: 'gmail-thread-1',
        connected_as: 'vambah@amadutown.com',
        required_sender: 'vambah@amadutown.com',
        external_send_blocked: true,
      },
    },
    contact_submissions: {
      id: 42,
      name: 'Amina Example',
      email: 'amina@example.com',
    },
    ...overrides,
  }
}

function lifecycle(overrides: Record<string, unknown> = {}) {
  return {
    messageVersionKey: MESSAGE_VERSION_KEY,
    sendQueueIdempotencyKey: SEND_QUEUE_KEY,
    relationshipProvenance: {
      detail: 'Portfolio-local relationship provenance is attached.',
    },
    externalSendReadiness: {
      senderIdentity: {
        requiredSender: 'vambah@amadutown.com',
        connectedAs: 'vambah@amadutown.com',
      },
      suppressionConsent: {
        state: 'clear',
        reasons: [],
        detail: 'No suppression blocker is recorded.',
      },
      draftEvidence: {
        gmailDraftExists: true,
        draftId: 'gmail-draft-1',
        detail: 'Tracked Gmail draft evidence is present.',
      },
    },
    realRecipientRolloutReadiness: {
      canBuildSlackApprovalPayload: true,
    },
    ...overrides,
  }
}

function relationshipBody(lifecycleOverrides: Record<string, unknown> = {}) {
  return {
    contextSummary: {
      relationship_basis: 'Prior meeting context supports this warm follow-up.',
    },
    responseMonitoring: {
      sendReadiness: {
        modes: {
          warm_1_to_1: [
            {
              channel: 'email',
              emailSendLifecycle: lifecycle(lifecycleOverrides),
            },
          ],
        },
      },
    },
  }
}

function mockSupabase(row = outreachRow(), updateError: { message: string } | null = null) {
  const updatePayloads: Record<string, unknown>[] = []
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null })
  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ maybeSingle }),
  })
  const update = vi.fn((payload: Record<string, unknown>) => {
    updatePayloads.push(payload)
    return {
      eq: vi.fn().mockResolvedValue({ error: updateError }),
    }
  })
  mocks.from.mockReturnValue({ select, update })
  return { update, updatePayloads }
}

describe('POST /api/admin/outreach/[id]/slack-send-approval', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody()))
  })

  it('builds the real-recipient Slack approval payload and records a pending local request only', async () => {
    const { update, updatePayloads } = mockSupabase()

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      card: {
        text: 'Warm Gmail send approval needed: Amina Example',
        actionScope: {
          contactId: 42,
          outreachQueueId: 'queue-1',
          messageVersionKey: MESSAGE_VERSION_KEY,
          sendQueueIdempotencyKey: SEND_QUEUE_KEY,
        },
        executionBoundary: {
          slackAttentionSurfaceOnly: true,
          gmailSendCalled: false,
          externalSendEnabled: false,
          providerExecutionEnabled: false,
        },
      },
      approvalRequest: {
        status: 'pending',
        contact_submission_id: 42,
        outreach_queue_id: 'queue-1',
        message_version_key: MESSAGE_VERSION_KEY,
        send_queue_idempotency_key: SEND_QUEUE_KEY,
        slack_dispatch_enabled: false,
        slack_dispatch_status: 'not_sent',
        records_authorization_intent_only: true,
        gmail_send_called: false,
        external_send_performed: false,
      },
      slackDispatch: {
        requested: true,
        sent: false,
      },
      approvalRecovery: {
        status: 'portfolio_request_recorded_slack_dispatch_disabled',
        label: 'Portfolio recovery path',
      },
      executionBoundary: {
        gmailSendCalled: false,
        externalSendEnabled: false,
        providerExecutionEnabled: false,
      },
    })
    expect(JSON.stringify(body.card.blocks)).toContain(
      '/admin/outreach?tab=leads&id=42&contactId=42&queueId=queue-1',
    )
    expect(update).toHaveBeenCalledTimes(1)
    expect(updatePayloads[0]).toMatchObject({
      generation_inputs: {
        gmail_draft_creation: expect.objectContaining({
          draft_id: 'gmail-draft-1',
          external_send_blocked: true,
        }),
        warm_gmail_send_slack_approval_request: expect.objectContaining({
          request_key: warmGmailSendApprovalDedupeKey({
            contactId: 42,
            outreachQueueId: 'queue-1',
            channel: 'email',
            messageVersionKey: MESSAGE_VERSION_KEY,
          }),
          status: 'pending',
          gmail_send_called: false,
          external_send_performed: false,
        }),
      },
    })
  })

  it('dedupes repeated approval requests for the same queue row without adding history', async () => {
    const requestKey = warmGmailSendApprovalDedupeKey({
      contactId: 42,
      outreachQueueId: 'queue-1',
      channel: 'email',
      messageVersionKey: MESSAGE_VERSION_KEY,
    })
    const existingRequest = {
      status: 'pending',
      request_key: requestKey,
      payload_dedupe_key: requestKey,
      requested_at: '2026-08-27T12:00:00.000Z',
    }
    const { updatePayloads } = mockSupabase(outreachRow({
      generation_inputs: {
        gmail_draft_creation: {
          draft_id: 'gmail-draft-1',
          message_id: 'gmail-message-1',
          thread_id: 'gmail-thread-1',
          connected_as: 'vambah@amadutown.com',
          required_sender: 'vambah@amadutown.com',
          external_send_blocked: true,
        },
        warm_gmail_send_slack_approval_request: existingRequest,
        warm_gmail_send_slack_approval_request_history: [existingRequest],
      },
    }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.approvalRequest).toMatchObject({
      status: 'pending',
      request_key: requestKey,
      requested_at: '2026-08-27T12:00:00.000Z',
      gmail_send_called: false,
      external_send_performed: false,
    })
    expect(updatePayloads[0]).toMatchObject({
      generation_inputs: {
        warm_gmail_send_slack_approval_request_history: [existingRequest],
      },
    })
  })

  it('dedupes camelCase pending approval requests without appending history', async () => {
    const requestKey = warmGmailSendApprovalDedupeKey({
      contactId: 42,
      outreachQueueId: 'queue-1',
      channel: 'email',
      messageVersionKey: MESSAGE_VERSION_KEY,
    })
    const existingRequest = {
      status: 'pending',
      requestKey,
      payloadDedupeKey: requestKey,
      requestedAt: '2026-08-27T12:00:00.000Z',
    }
    const { updatePayloads } = mockSupabase(outreachRow({
      generation_inputs: {
        gmailDraftCreation: {
          draftId: 'gmail-draft-1',
          messageId: 'gmail-message-1',
          threadId: 'gmail-thread-1',
          connectedAs: 'vambah@amadutown.com',
          requiredSender: 'vambah@amadutown.com',
          externalSendBlocked: true,
        },
        warmGmailSendSlackApprovalRequest: existingRequest,
        warmGmailSendSlackApprovalRequestHistory: [existingRequest],
      },
    }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.approvalRequest).toMatchObject({
      status: 'pending',
      request_key: requestKey,
      payload_dedupe_key: requestKey,
      requested_at: '2026-08-27T12:00:00.000Z',
      gmail_send_called: false,
      external_send_performed: false,
    })
    expect(updatePayloads[0]).toMatchObject({
      generation_inputs: {
        warm_gmail_send_slack_approval_request: expect.objectContaining({
          request_key: requestKey,
          requested_at: '2026-08-27T12:00:00.000Z',
        }),
        warm_gmail_send_slack_approval_request_history: [existingRequest],
      },
    })
  })

  it('refuses to build a Slack approval request while readiness blockers remain', async () => {
    const { update } = mockSupabase()
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody({
      realRecipientRolloutReadiness: {
        canBuildSlackApprovalPayload: false,
        blockers: ['Tracked Gmail draft evidence is required.'],
      },
    })))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Warm Gmail send approval cannot be requested until the real-recipient readiness blockers are resolved.',
      executionBoundary: {
        gmailSendCalled: false,
        externalSendEnabled: false,
        providerExecutionEnabled: false,
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('blocks suppressed recipients before recording an approval request', async () => {
    const { update } = mockSupabase()
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody({
      realRecipientRolloutReadiness: {
        canBuildSlackApprovalPayload: false,
        blockers: ['Contact is suppressed for outreach.'],
      },
    })))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Warm Gmail send approval cannot be requested until the real-recipient readiness blockers are resolved.',
      readiness: {
        blockers: ['Contact is suppressed for outreach.'],
      },
      executionBoundary: {
        gmailSendCalled: false,
        externalSendEnabled: false,
        providerExecutionEnabled: false,
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('blocks missing Gmail draft evidence before recording an approval request', async () => {
    const { update } = mockSupabase()
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody({
      externalSendReadiness: {
        ...lifecycle().externalSendReadiness,
        draftEvidence: {
          gmailDraftExists: false,
          draftId: null,
          detail: 'Tracked Gmail draft evidence is required.',
        },
      },
      realRecipientRolloutReadiness: {
        canBuildSlackApprovalPayload: false,
        blockers: ['Tracked Gmail draft evidence is required before a real-recipient send request.'],
      },
    })))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Warm Gmail send approval cannot be requested until the real-recipient readiness blockers are resolved.',
      readiness: {
        blockers: ['Tracked Gmail draft evidence is required before a real-recipient send request.'],
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('blocks stale rows with existing submitted send evidence even if readiness says requestable', async () => {
    const { update } = mockSupabase(outreachRow({
      status: 'sent',
      generation_inputs: {
        gmail_draft_creation: {
          draft_id: 'gmail-draft-1',
          message_id: 'gmail-message-1',
          thread_id: 'gmail-thread-1',
          connected_as: 'vambah@amadutown.com',
          required_sender: 'vambah@amadutown.com',
          external_send_blocked: true,
        },
        warm_gmail_send_execution: {
          status: 'sent',
          gmail_send_called: true,
          external_send_performed: true,
        },
      },
    }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Warm Gmail send approval request is blocked because submitted/send evidence already exists (sent). Do not request or send a duplicate.',
      executionBoundary: {
        gmailSendCalled: false,
        externalSendEnabled: false,
        providerExecutionEnabled: false,
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('blocks stale rows with sent_at evidence even if readiness says requestable', async () => {
    const { update } = mockSupabase(outreachRow({
      sent_at: '2026-08-28T12:00:00.000Z',
      generation_inputs: {
        gmail_draft_creation: {
          draft_id: 'gmail-draft-1',
          message_id: 'gmail-message-1',
          thread_id: 'gmail-thread-1',
          connected_as: 'vambah@amadutown.com',
          required_sender: 'vambah@amadutown.com',
          external_send_blocked: true,
        },
      },
    }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Warm Gmail send approval request is blocked because submitted/send evidence already exists (sent at). Do not request or send a duplicate.',
      executionBoundary: {
        gmailSendCalled: false,
        externalSendEnabled: false,
        providerExecutionEnabled: false,
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('blocks stale rows with existing send authorization even if readiness says requestable', async () => {
    const { update } = mockSupabase(outreachRow({
      generation_inputs: {
        gmail_draft_creation: {
          draft_id: 'gmail-draft-1',
          message_id: 'gmail-message-1',
          thread_id: 'gmail-thread-1',
          connected_as: 'vambah@amadutown.com',
          required_sender: 'vambah@amadutown.com',
          external_send_blocked: true,
        },
        warm_gmail_send_authorization: {
          status: 'approved',
          decision_key: 'warm-outreach:slack-gmail-send-decision:v1:approved',
          external_send_authorization_intent: true,
          gmail_send_called: false,
          external_send_performed: false,
        },
      },
    }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Warm Gmail send approval request is superseded by existing approved authorization evidence. No duplicate request was recorded.',
      executionBoundary: {
        gmailSendCalled: false,
        externalSendEnabled: false,
        providerExecutionEnabled: false,
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('blocks camelCase send authorization evidence before recording a duplicate request', async () => {
    const { update } = mockSupabase(outreachRow({
      generation_inputs: {
        gmailDraftCreation: {
          draftId: 'gmail-draft-1',
          messageId: 'gmail-message-1',
          threadId: 'gmail-thread-1',
          connectedAs: 'vambah@amadutown.com',
          requiredSender: 'vambah@amadutown.com',
          externalSendBlocked: true,
        },
        warmGmailSendAuthorization: {
          status: 'rejected',
          decisionKey: 'warm-outreach:slack-gmail-send-decision:v1:rejected',
          externalSendAuthorizationIntent: true,
          gmailSendCalled: false,
          externalSendPerformed: false,
        },
      },
    }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Warm Gmail send approval request is superseded by existing rejected authorization evidence. No duplicate request was recorded.',
      executionBoundary: {
        gmailSendCalled: false,
        externalSendEnabled: false,
        providerExecutionEnabled: false,
      },
    })
    expect(update).not.toHaveBeenCalled()
  })
})
