import { NextRequest, NextResponse } from 'next/server'
import { GET as getRelationshipPacket } from '../relationship-packet/route'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  buildWarmSmsTelnyxNoSendCanaryResult,
  type WarmSmsProviderTransportConfigInput,
} from '@/lib/warm-outreach-sms-provider-readiness'
import type { WarmSmsReadiness } from '@/lib/warm-outreach-sms-readiness'

export const dynamic = 'force-dynamic'

type RelationshipPacketBody = {
  error?: string
  smsReadiness?: WarmSmsReadiness
}

const SMS_ENV_KEYS = [
  'SMS_PROVIDER_ADAPTER',
  'SMS_PROVIDER_CREDENTIAL_REFERENCE',
  'SMS_PROVIDER_SENDER_REFERENCE',
  'SMS_PROVIDER_DELIVERY_CALLBACK',
  'SMS_PROVIDER_OPT_OUT_CALLBACK',
  'WARM_SMS_MESSAGE_VERSION_KEY',
  'WARM_SMS_IDEMPOTENCY_NAMESPACE',
  'WARM_SMS_AUDIT_KEY',
  'WARM_SMS_DELIVERY_CONFIRMATION_STORE',
  'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
  'SMS_PROVIDER_UNAVAILABLE_REASON',
] as const

function smsTransportConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WarmSmsProviderTransportConfigInput {
  return SMS_ENV_KEYS.reduce<WarmSmsProviderTransportConfigInput>((config, key) => {
    const value = env[key]
    if (value != null) config[key] = value
    return config
  }, {})
}

function failClosedBoundary() {
  return {
    noSendCanary: true,
    providerCallsEnabled: false,
    smsDeliveryEnabled: false,
    providerActivationEnabled: false,
    featureFlagEnabled: false,
    externalRequests: [],
    executionBoundary: {
      localRowsOnly: true,
      noSendAuditOnly: true,
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      providerActivationEnabled: false,
      featureFlagEnabled: false,
      telnyxApiCalled: false,
      rawCredentialsReturned: false,
      rawPhoneReturned: false,
      rawMessageBodyReturned: false,
      credentialsRead: false,
      secretManagerMutated: false,
      environmentVariablesChanged: false,
      databaseWritesEnabled: false,
      slackDispatchEnabled: false,
      gmailActionEnabled: false,
      n8nDispatchEnabled: false,
      externalRequests: [],
    },
  }
}

/**
 * POST /api/admin/outreach/leads/[id]/sms-telnyx-no-send-canary
 *
 * Verifies Telnyx warm SMS routing prerequisites using redacted env/config
 * presence only. This route never calls Telnyx, never sends SMS, never reads
 * raw credentials, and never writes delivery/provider records.
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

  const { id: idParam } = await params
  const contactId = parseInt(idParam, 10)
  if (Number.isNaN(contactId) || contactId < 1) {
    return NextResponse.json(
      {
        error: 'Invalid lead ID',
        ...failClosedBoundary(),
      },
      { status: 400 },
    )
  }

  const relationshipResponse = await getRelationshipPacket(request, {
    params: Promise.resolve({ id: idParam }),
  })
  const relationshipBody = (await relationshipResponse.json().catch(() => ({}))) as RelationshipPacketBody

  if (!relationshipResponse.ok) {
    return NextResponse.json(
      {
        error: relationshipBody.error ?? 'SMS no-send canary could not load relationship readiness.',
        ...failClosedBoundary(),
      },
      { status: relationshipResponse.status },
    )
  }

  if (!relationshipBody.smsReadiness?.providerReadiness) {
    return NextResponse.json(
      {
        error: 'No SMS provider readiness is available for this contact.',
        ...failClosedBoundary(),
      },
      { status: 400 },
    )
  }

  const result = buildWarmSmsTelnyxNoSendCanaryResult({
    contactId,
    providerReadiness: relationshipBody.smsReadiness.providerReadiness,
    transportConfig: smsTransportConfigFromEnv(),
  })

  return NextResponse.json(result)
}
