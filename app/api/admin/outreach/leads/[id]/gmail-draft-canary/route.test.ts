import { describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  getRelationshipPacket: vi.fn(),
}))

vi.mock('../relationship-packet/route', () => ({
  GET: mocks.getRelationshipPacket,
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

function relationshipBody() {
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
              },
            },
          ],
        },
      },
    },
  }
}

describe('POST /api/admin/outreach/leads/[id]/gmail-draft-canary', () => {
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
