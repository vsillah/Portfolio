import { NextRequest, NextResponse } from 'next/server'
import { GET as getRelationshipPacket } from '../relationship-packet/route'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isGmailUserOAuthClientConfigured,
} from '@/lib/gmail-user-api'
import { isGmailUserOauthSecretConfigured } from '@/lib/gmail-user-oauth-secret'
import { resolveBusinessEmailConfig } from '@/lib/business-email-config'
import {
  buildWarmOutreachGmailProviderActivationReadiness,
  type WarmOutreachGmailProviderActivationReadiness,
  type WarmOutreachEmailSendLifecycle,
  type WarmOutreachResponseMonitoring,
} from '@/lib/warm-outreach-response-monitoring'

export const dynamic = 'force-dynamic'

type RelationshipPacketBody = {
  error?: string
  responseMonitoring?: WarmOutreachResponseMonitoring
}

function activationBoundary() {
  return {
    localRowsOnly: true,
    providerCallsEnabled: false,
    draftCreationEnabled: false,
    externalSendEnabled: false,
    schedulingEnabled: false,
    slackActionEnabled: false,
  }
}

function resultBody(args: {
  status: 'passed_no_send' | 'blocked_no_send'
  message: string
  lifecycle: WarmOutreachEmailSendLifecycle
  activationReadiness: WarmOutreachGmailProviderActivationReadiness
}) {
  return {
    version: 'warm-outreach-gmail-draft-creation-canary/v1',
    status: args.status,
    message: args.message,
    contactId: args.lifecycle.contactId,
    noSendCanary: true,
    draftCreationEnabled: false,
    providerCallsEnabled: false,
    externalSendEnabled: false,
    gmailDraftCreated: false,
    trackingPersisted: false,
    readiness: {
      internalHandoffReady: args.lifecycle.gmailDraftHandoffPacket.internalHandoffReady,
      providerSmokeStatus: args.lifecycle.providerCapabilitySmoke.status,
      draftCreationGateStatus: args.lifecycle.gmailDraftCreationGate.status,
      duplicateDetected: args.lifecycle.duplicatePrevention.duplicateDetected,
      suppressionStatus: args.lifecycle.suppressionCheck.status,
    },
    activationReadiness: args.activationReadiness,
    idempotency: {
      messageVersionKey: args.lifecycle.messageVersionKey,
      gmailDraftHandoffKey: args.lifecycle.gmailDraftHandoffPacket.idempotencyKey,
      providerCapabilitySmokeKey: args.lifecycle.providerCapabilitySmokeKey,
      gmailDraftCreationGateKey: args.lifecycle.gmailDraftCreationGateKey,
      sendQueueIdempotencyKey: args.lifecycle.sendQueueIdempotencyKey,
      submittedEvidenceKey: args.lifecycle.submittedEvidenceKey,
    },
    executionBoundary: activationBoundary(),
  }
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
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    )
  }

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
        executionBoundary: activationBoundary(),
      },
      { status: 400 },
    )
  }

  const requiredSender = resolveBusinessEmailConfig().fromEmail.toLowerCase()
  let connectedSender: WarmOutreachGmailProviderActivationReadiness['connectedSenderReadiness']
  if (!isGmailUserOAuthClientConfigured() || !isGmailUserOauthSecretConfigured()) {
    connectedSender = {
      state: 'blocked',
      label: 'Gmail OAuth server configuration missing',
      requiredSender,
      connectedAs: null,
      recoveryAction: 'Configure Gmail OAuth and user-token encryption before requesting a live draft canary.',
    }
  } else if (!supabaseAdmin) {
    connectedSender = {
      state: 'blocked',
      label: 'Database unavailable for sender check',
      requiredSender,
      connectedAs: null,
      recoveryAction: 'Restore Portfolio database access before checking connected Gmail sender readiness.',
    }
  } else {
    const { data: creds, error: credsError } = await supabaseAdmin
      .from('admin_gmail_user_credentials')
      .select('google_email')
      .eq('user_id', authResult.user.id)
      .maybeSingle()

    const connectedAs = typeof creds?.google_email === 'string' ? creds.google_email.trim().toLowerCase() : null
    if (credsError || !connectedAs) {
      connectedSender = {
        state: 'blocked',
        label: 'Connected Gmail sender missing',
        requiredSender,
        connectedAs,
        recoveryAction: 'Open Admin Credentials and connect the AmaduTown Gmail profile before live draft canary review.',
      }
    } else if (connectedAs !== requiredSender) {
      connectedSender = {
        state: 'blocked',
        label: 'Connected Gmail sender mismatch',
        requiredSender,
        connectedAs,
        recoveryAction: `Reconnect Gmail as ${requiredSender} before live draft canary review.`,
      }
    } else {
      connectedSender = {
        state: 'ready',
        label: 'Connected sender verified',
        requiredSender,
        connectedAs,
        recoveryAction: 'No sender recovery needed. Live draft canary still requires separate captain authorization.',
      }
    }
  }

  const blockedReason = [
    lifecycle.gmailProviderActivationReadiness.localDraftReadiness.state === 'ready'
      ? null
      : lifecycle.gmailProviderActivationReadiness.localDraftReadiness.detail,
    connectedSender.state === 'ready' ? null : connectedSender.recoveryAction,
    lifecycle.gmailProviderActivationReadiness.duplicateDraftEvidence.createdOnce
      ? lifecycle.gmailProviderActivationReadiness.duplicateDraftEvidence.detail
      : null,
  ].filter(Boolean)[0]

  const canaryPassed = !blockedReason
  const activationReadiness = buildWarmOutreachGmailProviderActivationReadiness({
    handoff: lifecycle.gmailDraftHandoffPacket,
    providerSmoke: lifecycle.providerCapabilitySmoke,
    draftCreationGate: lifecycle.gmailDraftCreationGate,
    duplicateDraftEvidence: lifecycle.gmailProviderActivationReadiness.duplicateDraftEvidence,
    connectedSender,
    canaryState: canaryPassed ? 'passed_no_send' : 'blocked_no_send',
    canaryDetail: canaryPassed
      ? 'No-send canary verified local draft readiness and connected sender readiness without Gmail calls, draft creation, tracking writes, or sends.'
      : blockedReason,
  })

  return NextResponse.json(resultBody({
    status: canaryPassed ? 'passed_no_send' : 'blocked_no_send',
    message: canaryPassed
      ? 'No-send Gmail draft creation canary passed. No Gmail draft was created, no tracking was written, and no email was sent.'
      : `No-send Gmail draft creation canary blocked. ${blockedReason}`,
    lifecycle,
    activationReadiness,
  }))
}
