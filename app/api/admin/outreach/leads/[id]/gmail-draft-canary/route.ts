import { NextRequest, NextResponse } from 'next/server'
import { GET as getRelationshipPacket } from '../relationship-packet/route'
import type { WarmOutreachResponseMonitoring } from '@/lib/warm-outreach-response-monitoring'

export const dynamic = 'force-dynamic'

type RelationshipPacketBody = {
  error?: string
  responseMonitoring?: WarmOutreachResponseMonitoring
}

/**
 * POST /api/admin/outreach/leads/[id]/gmail-draft-canary
 *
 * Verifies the local Gmail draft creation gate wiring for a warm lead without
 * creating a Gmail draft, calling Gmail, sending email, scheduling outreach, or
 * writing tracking rows.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const relationshipResponse = await getRelationshipPacket(request, { params })
  const relationshipBody = (await relationshipResponse.json().catch(() => ({}))) as RelationshipPacketBody

  if (!relationshipResponse.ok) {
    return NextResponse.json(
      { error: relationshipBody.error ?? 'Gmail draft canary could not load relationship readiness.' },
      { status: relationshipResponse.status },
    )
  }

  const lifecycle = relationshipBody.responseMonitoring?.sendReadiness.modes.warm_1_to_1
    .find((item) => item.channel === 'email')?.emailSendLifecycle

  if (!lifecycle) {
    return NextResponse.json(
      {
        error: 'No email lifecycle is available for this contact.',
        executionBoundary: {
          localRowsOnly: true,
          providerCallsEnabled: false,
          draftCreationEnabled: false,
          externalSendEnabled: false,
          schedulingEnabled: false,
          slackActionEnabled: false,
        },
      },
      { status: 400 },
    )
  }

  return NextResponse.json({
    version: 'warm-outreach-gmail-draft-creation-canary/v1',
    status: 'passed_no_send',
    message:
      'No-send Gmail draft creation canary passed. No Gmail draft was created, no tracking was written, and no email was sent.',
    contactId: lifecycle.contactId,
    noSendCanary: true,
    draftCreationEnabled: false,
    providerCallsEnabled: false,
    externalSendEnabled: false,
    gmailDraftCreated: false,
    trackingPersisted: false,
    readiness: {
      internalHandoffReady: lifecycle.gmailDraftHandoffPacket.internalHandoffReady,
      providerSmokeStatus: lifecycle.providerCapabilitySmoke.status,
      draftCreationGateStatus: lifecycle.gmailDraftCreationGate.status,
      duplicateDetected: lifecycle.duplicatePrevention.duplicateDetected,
      suppressionStatus: lifecycle.suppressionCheck.status,
    },
    idempotency: {
      messageVersionKey: lifecycle.messageVersionKey,
      gmailDraftHandoffKey: lifecycle.gmailDraftHandoffPacket.idempotencyKey,
      providerCapabilitySmokeKey: lifecycle.providerCapabilitySmokeKey,
      gmailDraftCreationGateKey: lifecycle.gmailDraftCreationGateKey,
      sendQueueIdempotencyKey: lifecycle.sendQueueIdempotencyKey,
      submittedEvidenceKey: lifecycle.submittedEvidenceKey,
    },
    executionBoundary: {
      localRowsOnly: true,
      providerCallsEnabled: false,
      draftCreationEnabled: false,
      externalSendEnabled: false,
      schedulingEnabled: false,
      slackActionEnabled: false,
    },
  })
}
