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
            messageVersionKey: MESSAGE_VERSION_KEY,
          }),
          status: 'pending',
          gmail_send_called: false,
          external_send_performed: false,
        }),
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
})
