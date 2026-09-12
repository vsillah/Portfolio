import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  getRelationshipPacket: vi.fn(),
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  isGmailUserOAuthClientConfigured: vi.fn(),
  isGmailUserOauthSecretConfigured: vi.fn(),
}))

vi.mock('../relationship-packet/route', () => ({
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

vi.mock('@/lib/gmail-user-api', () => ({
  isGmailUserOAuthClientConfigured: mocks.isGmailUserOAuthClientConfigured,
}))

vi.mock('@/lib/gmail-user-oauth-secret', () => ({
  isGmailUserOauthSecretConfigured: mocks.isGmailUserOauthSecretConfigured,
}))

import { POST } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/gmail-draft-canary', {
    method: 'POST',
  })
}

function params(id = '42') {
  return { params: Promise.resolve({ id }) }
}

function activationReadiness(overrides: Record<string, unknown> = {}) {
  return {
    version: 'warm-outreach-gmail-provider-activation-readiness/v1',
    localDraftReadiness: {
      state: 'ready',
      label: 'Local draft handoff ready',
      detail: 'Operator can review the internal Gmail draft handoff packet; Gmail draft creation and send stay blocked.',
      idempotencyKey: 'warm-outreach:gmail-draft-handoff:v1:abc',
    },
    connectedSenderReadiness: {
      state: 'requires_no_send_canary',
      label: 'Connected sender not checked in relationship packet',
      requiredSender: null,
      connectedAs: null,
      recoveryAction: 'Run the no-send canary.',
    },
    liveDraftCanaryReadiness: {
      state: 'ready_for_no_send_canary',
      label: 'Ready for no-send canary',
      detail: 'The operator may run the no-send canary.',
      providerCallsEnabled: false,
      gmailDraftCreated: false,
      trackingPersisted: false,
      externalSendEnabled: false,
    },
    duplicateDraftEvidence: {
      createdOnce: false,
      duplicatePrevented: false,
      draftId: null,
      threadId: null,
      messageId: null,
      sourceIds: [],
      noSendStatus: 'no_send',
      detail: 'No prior Gmail draft metadata was found.',
    },
    externalSendBoundary: {
      blocked: true,
      label: 'External send blocked',
      detail: 'Drafts are not sends.',
    },
    remainingHumanGates: [
      'review_local_draft_handoff_packet',
      'verify_connected_sender_identity',
      'captain_authorize_specific_live_draft_canary',
      'explicit_per_recipient_gmail_draft_authorization',
      'separate_external_send_authority',
    ],
    ...overrides,
  }
}

function relationshipBody(overrides: Record<string, unknown> = {}) {
  const baseActivationReadiness = activationReadiness(overrides.activationReadiness as Record<string, unknown> | undefined)
  return {
    responseMonitoring: {
      sendReadiness: {
        modes: {
          warm_1_to_1: [
            {
              channel: 'email',
              emailSendLifecycle: {
                contactId: 42,
                messageVersionKey: 'warm-outreach:email-message-version:v1:abc',
                providerCapabilitySmokeKey: 'warm-outreach:gmail-capability-smoke:v1:abc',
                gmailDraftCreationGateKey: 'warm-outreach:gmail-draft-creation-gate:v1:abc',
                sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:abc',
                submittedEvidenceKey: 'warm-outreach:email-submitted-evidence:v1:abc',
                gmailDraftHandoffPacket: {
                  internalHandoffReady: true,
                  idempotencyKey: 'warm-outreach:gmail-draft-handoff:v1:abc',
                },
                providerCapabilitySmoke: {
                  status: 'smoke_passed',
                },
                gmailDraftCreationGate: {
                  status: 'draft_creation_authority_required',
                },
                duplicatePrevention: {
                  duplicateDetected: false,
                },
                suppressionCheck: {
                  status: 'clear',
                },
                gmailProviderActivationReadiness: baseActivationReadiness,
              },
            },
          ],
        },
      },
    },
  }
}

describe('POST /api/admin/outreach/leads/[id]/gmail-draft-canary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BUSINESS_FROM_EMAIL = '"AmaduTown" <vambah@amadutown.com>'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(true)
    mocks.isGmailUserOauthSecretConfigured.mockReturnValue(true)
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { google_email: 'vambah@amadutown.com' },
            error: null,
          }),
        }),
      }),
    })
  })

  it('returns local gate evidence without creating a Gmail draft or enabling sends', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody()))

    const response = await POST(request(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      version: 'warm-outreach-gmail-draft-creation-canary/v1',
      status: 'passed_no_send',
      noSendCanary: true,
      draftCreationEnabled: false,
      providerCallsEnabled: false,
      externalSendEnabled: false,
      gmailDraftCreated: false,
      trackingPersisted: false,
      readiness: {
        internalHandoffReady: true,
        providerSmokeStatus: 'smoke_passed',
        draftCreationGateStatus: 'draft_creation_authority_required',
        duplicateDetected: false,
        suppressionStatus: 'clear',
      },
      executionBoundary: {
        localRowsOnly: true,
        providerCallsEnabled: false,
        draftCreationEnabled: false,
        externalSendEnabled: false,
        schedulingEnabled: false,
        slackActionEnabled: false,
      },
      idempotency: {
        messageVersionKey: 'warm-outreach:email-message-version:v1:abc',
        gmailDraftHandoffKey: 'warm-outreach:gmail-draft-handoff:v1:abc',
        providerCapabilitySmokeKey: 'warm-outreach:gmail-capability-smoke:v1:abc',
        gmailDraftCreationGateKey: 'warm-outreach:gmail-draft-creation-gate:v1:abc',
        sendQueueIdempotencyKey: 'warm-outreach:email-send-queue:v1:abc',
        submittedEvidenceKey: 'warm-outreach:email-submitted-evidence:v1:abc',
      },
      activationReadiness: {
        connectedSenderReadiness: {
          state: 'ready',
          requiredSender: 'vambah@amadutown.com',
          connectedAs: 'vambah@amadutown.com',
        },
        liveDraftCanaryReadiness: {
          state: 'passed_no_send',
          providerCallsEnabled: false,
          gmailDraftCreated: false,
          trackingPersisted: false,
          externalSendEnabled: false,
        },
        externalSendBoundary: {
          blocked: true,
        },
      },
    })
    expect(mocks.getRelationshipPacket).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ params: expect.any(Promise) }),
    )
  })

  it('passes through relationship packet errors before exposing canary state', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json({ error: 'Lead not found' }, { status: 404 }),
    )

    const response = await POST(request(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Lead not found' })
  })

  it('blocks the no-send canary when Gmail OAuth server configuration is missing', async () => {
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(false)
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody()))

    const response = await POST(request(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      draftCreationEnabled: false,
      providerCallsEnabled: false,
      externalSendEnabled: false,
      activationReadiness: {
        connectedSenderReadiness: {
          state: 'blocked',
          label: 'Gmail OAuth server configuration missing',
        },
        liveDraftCanaryReadiness: {
          state: 'blocked_no_send',
        },
      },
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('blocks the no-send canary when the connected sender is missing or mismatched', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody()))
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { google_email: 'personal@gmail.com' },
            error: null,
          }),
        }),
      }),
    })

    const response = await POST(request(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      message:
        'No-send Gmail draft creation canary blocked. Reconnect Gmail as vambah@amadutown.com before live draft canary review.',
      activationReadiness: {
        connectedSenderReadiness: {
          state: 'blocked',
          label: 'Connected Gmail sender mismatch',
          requiredSender: 'vambah@amadutown.com',
          connectedAs: 'personal@gmail.com',
        },
        liveDraftCanaryReadiness: {
          state: 'blocked_no_send',
          providerCallsEnabled: false,
          gmailDraftCreated: false,
          trackingPersisted: false,
          externalSendEnabled: false,
        },
      },
    })
  })

  it('blocks the no-send canary when duplicate Gmail draft evidence already exists', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json(
        relationshipBody({
          activationReadiness: {
            duplicateDraftEvidence: {
              createdOnce: true,
              duplicatePrevented: true,
              draftId: 'gmail-draft-1',
              threadId: 'gmail-thread-1',
              messageId: 'gmail-message-1',
              sourceIds: ['comm-1'],
              noSendStatus: 'no_send',
              detail: 'Existing Gmail draft metadata is present.',
            },
          },
        }),
      ),
    )

    const response = await POST(request(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      activationReadiness: {
        duplicateDraftEvidence: {
          createdOnce: true,
          duplicatePrevented: true,
          draftId: 'gmail-draft-1',
          threadId: 'gmail-thread-1',
          messageId: 'gmail-message-1',
          noSendStatus: 'no_send',
        },
        liveDraftCanaryReadiness: {
          state: 'blocked_no_send',
        },
      },
    })
  })

  it('fails closed when no email lifecycle exists', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json({
        responseMonitoring: {
          sendReadiness: {
            modes: {
              warm_1_to_1: [],
            },
          },
        },
      }),
    )

    const response = await POST(request(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: 'No email lifecycle is available for this contact.',
      executionBoundary: {
        localRowsOnly: true,
        providerCallsEnabled: false,
        draftCreationEnabled: false,
        externalSendEnabled: false,
      },
    })
  })
})
