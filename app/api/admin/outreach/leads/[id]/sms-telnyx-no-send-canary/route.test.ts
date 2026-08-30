import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { buildWarmSmsProviderReadiness } from '@/lib/warm-outreach-sms-provider-readiness'

const mocks = vi.hoisted(() => ({
  getRelationshipPacket: vi.fn(),
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
}))

vi.mock('../relationship-packet/route', () => ({
  GET: mocks.getRelationshipPacket,
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

import { POST } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/outreach/leads/42/sms-telnyx-no-send-canary', {
    method: 'POST',
  })
}

function params(id = '42') {
  return { params: Promise.resolve({ id }) }
}

function setTelnyxEnv(overrides: Record<string, string> = {}) {
  vi.stubEnv('SMS_PROVIDER_ADAPTER', overrides.SMS_PROVIDER_ADAPTER ?? 'telnyx_messaging')
  vi.stubEnv('SMS_PROVIDER_CREDENTIAL_REFERENCE', overrides.SMS_PROVIDER_CREDENTIAL_REFERENCE ?? 'op://Portfolio/Warm SMS Telnyx/credential')
  vi.stubEnv('SMS_PROVIDER_SENDER_REFERENCE', overrides.SMS_PROVIDER_SENDER_REFERENCE ?? 'op://Portfolio/Warm SMS Telnyx/sender')
  vi.stubEnv('SMS_PROVIDER_DELIVERY_CALLBACK', overrides.SMS_PROVIDER_DELIVERY_CALLBACK ?? 'https://amadutown.com/api/provider/sms/delivery')
  vi.stubEnv('SMS_PROVIDER_OPT_OUT_CALLBACK', overrides.SMS_PROVIDER_OPT_OUT_CALLBACK ?? 'https://amadutown.com/api/provider/sms/stop')
  vi.stubEnv('WARM_SMS_MESSAGE_VERSION_KEY', overrides.WARM_SMS_MESSAGE_VERSION_KEY ?? 'warm-sms-message:v1')
  vi.stubEnv('WARM_SMS_IDEMPOTENCY_NAMESPACE', overrides.WARM_SMS_IDEMPOTENCY_NAMESPACE ?? 'warm-sms-send:v1')
  vi.stubEnv('WARM_SMS_AUDIT_KEY', overrides.WARM_SMS_AUDIT_KEY ?? 'warm-sms-audit:v1')
  vi.stubEnv('WARM_SMS_DELIVERY_CONFIRMATION_STORE', overrides.WARM_SMS_DELIVERY_CONFIRMATION_STORE ?? 'warm_sms_delivery_confirmations')
  vi.stubEnv('ENABLE_WARM_SMS_PROVIDER_EXECUTION', overrides.ENABLE_WARM_SMS_PROVIDER_EXECUTION ?? 'false')
}

function relationshipBody(overrides: {
  optOutStop?: boolean
  providerEnabled?: boolean
  capabilityEvidenceComplete?: boolean
} = {}) {
  const verified = {
    status: 'verified' as const,
    evidence: 'Synthetic route-test evidence.',
  }
  const capabilityEvidence = overrides.capabilityEvidenceComplete === false
    ? {}
    : {
        outbound_message_submission: verified,
        delivery_status_callbacks: verified,
        inbound_opt_out_ingestion: verified,
        sender_identity_compliance: verified,
        idempotent_submission: verified,
        sandbox_or_no_send_test: verified,
      }
  const providerReadiness = buildWarmSmsProviderReadiness({
    provider: {
      name: 'Synthetic SMS provider',
      configured: true,
      enabled: overrides.providerEnabled ?? false,
    },
    consent: {
      knownRelationshipBasis: true,
      relationshipBasisNote: 'Synthetic relationship evidence supports route-test SMS review.',
      phoneProvenance: 'known',
      phoneProvenanceNote: 'Synthetic phone source is recorded for route-test review.',
      permissionStatus: 'documented',
      permissionNote: 'Synthetic consent note allows this no-send route test only.',
      optOutStop: overrides.optOutStop ?? false,
      wrongNumber: false,
      doNotContact: false,
      lastContactAt: '2026-08-10T12:00:00.000Z',
      cooldownDays: 7,
      auditedAt: '2026-08-29T12:00:00.000Z',
    },
    draftApproval: {
      approvedForProviderDraftCreation: false,
    },
    activation: {
      providerSelectionStatus: 'selected',
      providerSelectionNote: 'Telnyx selected for no-send route test.',
      providerSetupCandidate: 'telnyx_messaging',
      configurationStatus: 'verified_disabled',
      configurationNote: 'Disabled configuration is reviewed without provider calls.',
      capabilityEvidence,
      reviewedAt: '2026-08-29T12:00:00.000Z',
    },
    transportConfig: {
      SMS_PROVIDER_ADAPTER: 'telnyx_messaging',
      SMS_PROVIDER_CREDENTIAL_REFERENCE: 'redacted-secret-reference',
      SMS_PROVIDER_SENDER_REFERENCE: 'redacted-sender-reference',
      SMS_PROVIDER_DELIVERY_CALLBACK: 'delivery-callback-reference',
      SMS_PROVIDER_OPT_OUT_CALLBACK: 'opt-out-callback-reference',
      WARM_SMS_DELIVERY_CONFIRMATION_STORE: 'delivery-confirmation-store',
      WARM_SMS_MESSAGE_VERSION_KEY: 'message-v1',
      WARM_SMS_IDEMPOTENCY_NAMESPACE: 'warm-sms-send:v1',
      WARM_SMS_AUDIT_KEY: 'audit-v1',
      ENABLE_WARM_SMS_PROVIDER_EXECUTION: false,
    },
    now: '2026-08-29T13:00:00.000Z',
  })

  return {
    smsReadiness: {
      providerReadiness,
    },
  }
}

describe('POST /api/admin/outreach/leads/[id]/sms-telnyx-no-send-canary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    setTelnyxEnv()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getRelationshipPacket.mockImplementation(() => NextResponse.json(relationshipBody()))
  })

  it('returns a passed no-send result without Telnyx calls, SMS delivery, or raw values', async () => {
    const response = await POST(request(), params())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      version: 'warm-outreach-sms-telnyx-no-send-canary/v1',
      status: 'passed_no_send',
      noSendCanary: true,
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      providerActivationEnabled: false,
      featureFlagEnabled: false,
      externalRequests: [],
      readiness: {
        envSetupPresent: true,
        selectedProviderAdapter: 'passed',
        disabledExecutionFlag: 'passed',
        consentSuppressionPrerequisites: 'passed',
        messageVersion: 'passed',
        idempotencyNamespace: 'passed',
        auditKey: 'passed',
        credentialReference: 'passed',
        senderReference: 'passed',
        deliveryCallbackReference: 'passed',
        optOutCallbackReference: 'passed',
        deliveryConfirmationStore: 'passed',
        providerCapabilityEvidence: 'passed',
        liveSmsUnavailable: true,
        providerActivationStillDisabled: true,
        perRecipientSendStillSeparate: true,
      },
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
        databaseWritesEnabled: false,
        slackDispatchEnabled: false,
        gmailActionEnabled: false,
        n8nDispatchEnabled: false,
        externalRequests: [],
      },
    })
    expect(json.idempotency.canaryIdempotencyKey).toMatch(/^warm-sms-send:v1:canary:no-send:/)
    expect(JSON.stringify(json)).not.toContain('op://Portfolio/Warm SMS Telnyx/credential')
    expect(JSON.stringify(json)).not.toContain('op://Portfolio/Warm SMS Telnyx/sender')
    expect(JSON.stringify(json)).not.toContain('https://amadutown.com/api/provider/sms/delivery')
    expect(JSON.stringify(json)).not.toContain('https://amadutown.com/api/provider/sms/stop')
    expect(mocks.getRelationshipPacket).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({ params: expect.any(Promise) }),
    )
  })

  it('returns the same idempotent no-send evidence on repeat calls', async () => {
    const first = await POST(request(), params())
    const second = await POST(request(), params())
    const firstJson = await first.json()
    const secondJson = await second.json()

    expect(secondJson.status).toBe('passed_no_send')
    expect(secondJson.idempotency.canaryIdempotencyKey).toBe(firstJson.idempotency.canaryIdempotencyKey)
    expect(secondJson.idempotency.auditEvidenceKey).toBe(firstJson.idempotency.auditEvidenceKey)
    expect(secondJson.idempotency.duplicatePolicy).toBe('return_existing_no_send_evidence_without_provider_call')
  })

  it('blocks fail-closed when the execution flag is enabled', async () => {
    setTelnyxEnv({ ENABLE_WARM_SMS_PROVIDER_EXECUTION: 'true' })

    const response = await POST(request(), params())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'blocked_no_send',
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      providerActivationEnabled: false,
      featureFlagEnabled: false,
      readiness: {
        disabledExecutionFlag: 'blocked',
      },
      executionBoundary: {
        telnyxApiCalled: false,
        databaseWritesEnabled: false,
        externalRequests: [],
      },
    })
    expect(json.blockedReasons).toContain('ENABLE_WARM_SMS_PROVIDER_EXECUTION must remain disabled.')
  })

  it('blocks fail-closed when consent or suppression prerequisites fail', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json(relationshipBody({ optOutStop: true })),
    )

    const response = await POST(request(), params())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'blocked_no_send',
      readiness: {
        consentSuppressionPrerequisites: 'blocked',
      },
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      providerActivationEnabled: false,
      featureFlagEnabled: false,
    })
    expect(json.blockedReasons).toContain('Stop or opt-out evidence suppresses SMS.')
  })

  it('passes through relationship packet errors with the no-send boundary intact', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json({ error: 'Lead not found' }, { status: 404 }),
    )

    const response = await POST(request(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Lead not found',
      noSendCanary: true,
      providerCallsEnabled: false,
      smsDeliveryEnabled: false,
      providerActivationEnabled: false,
      featureFlagEnabled: false,
      externalRequests: [],
      executionBoundary: {
        telnyxApiCalled: false,
        databaseWritesEnabled: false,
        externalRequests: [],
      },
    })
  })
})
