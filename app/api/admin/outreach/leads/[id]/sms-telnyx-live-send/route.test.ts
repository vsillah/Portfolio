import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { buildWarmSmsProviderReadiness } from '@/lib/warm-outreach-sms-provider-readiness'
import {
  WARM_SMS_SEND_AUTHORIZATION,
  setWarmSmsTelnyxSenderForTesting,
} from '@/lib/warm-outreach-sms-live-execution'

const mocks = vi.hoisted(() => ({
  getRelationshipPacket: vi.fn(),
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  logCommunication: vi.fn(),
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

vi.mock('@/lib/communications', () => ({
  logCommunication: mocks.logCommunication,
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }
const CONTACT_ID = 42
const QUEUE_ID = 'sms-queue-42'
const MESSAGE_VERSION_KEY = 'warm-sms-message:v1:qa'
const SMS_SEND_IDEMPOTENCY_KEY = 'warm-sms-send:v1:sms-queue-42:42'
const SUBMITTED_EVIDENCE_KEY = 'warm-sms-audit:v1:submitted:sms-queue-42'
const RAW_PHONE = '+15550123456'
const RAW_MESSAGE = 'Hi Alice, open to a short check-in this week?'

type OutreachQueueRow = {
  id: string
  contact_submission_id: number
  status: string | null
  channel: string | null
  subject: string | null
  body: string | null
  thread_id: string | null
  message_id: string | null
  sent_at?: string | null
  generation_inputs?: Record<string, unknown> | null
  contact_submissions: {
    id: number
    name: string
    phone_number: string | null
    outreach_status?: string | null
    do_not_contact?: boolean | null
    removed_at?: string | null
  } | null
}

type EvidenceRow = {
  id: string
  status?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function setSmsEnv(overrides: Record<string, string | undefined> = {}) {
  const env = {
    SMS_PROVIDER_ADAPTER: 'telnyx_messaging',
    SMS_PROVIDER_CREDENTIAL_REFERENCE: 'op://Portfolio/Warm SMS Telnyx/credential',
    SMS_PROVIDER_SENDER_REFERENCE: 'op://Portfolio/Warm SMS Telnyx/sender',
    SMS_PROVIDER_DELIVERY_CALLBACK: 'https://amadutown.com/api/provider/sms/delivery',
    SMS_PROVIDER_OPT_OUT_CALLBACK: 'https://amadutown.com/api/provider/sms/stop',
    WARM_SMS_MESSAGE_VERSION_KEY: MESSAGE_VERSION_KEY,
    WARM_SMS_IDEMPOTENCY_NAMESPACE: 'warm-sms-send:v1',
    WARM_SMS_AUDIT_KEY: 'warm-sms-audit:v1',
    WARM_SMS_DELIVERY_CONFIRMATION_STORE: 'warm_sms_delivery_confirmations',
    ENABLE_WARM_SMS_PROVIDER_EXECUTION: 'true',
    WARM_SMS_TELNYX_RUNTIME_CREDENTIAL_READY: 'true',
    WARM_SMS_TELNYX_FROM_NUMBER: '+15550000000',
    ...overrides,
  }

  for (const [key, value] of Object.entries(env)) {
    if (value == null) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function authorization(overrides: Record<string, unknown> = {}) {
  return {
    version: 'warm-outreach-sms-send-authorization/v1',
    status: 'approved',
    send_authorization: WARM_SMS_SEND_AUTHORIZATION,
    contact_submission_id: CONTACT_ID,
    outreach_queue_id: QUEUE_ID,
    channel: 'sms',
    provider: 'telnyx_messaging',
    message_version_key: MESSAGE_VERSION_KEY,
    sms_send_idempotency_key: SMS_SEND_IDEMPOTENCY_KEY,
    submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
    approval_intent_recorded: true,
    external_send_authorization_intent: true,
    no_send_canary_passed: true,
    telnyx_api_called: false,
    external_send_performed: false,
    ...overrides,
  }
}

function outreachRow(overrides: Partial<OutreachQueueRow> = {}): OutreachQueueRow {
  return {
    id: QUEUE_ID,
    contact_submission_id: CONTACT_ID,
    status: 'approved',
    channel: 'sms',
    subject: 'SMS follow-up',
    body: RAW_MESSAGE,
    thread_id: null,
    message_id: null,
    sent_at: null,
    generation_inputs: {
      warm_sms_message_version_key: MESSAGE_VERSION_KEY,
      warm_sms_send_authorization: authorization(),
    },
    contact_submissions: {
      id: CONTACT_ID,
      name: 'Alice Lead',
      phone_number: RAW_PHONE,
      outreach_status: 'approved',
      do_not_contact: false,
      removed_at: null,
    },
    ...overrides,
  }
}

function providerReadiness(overrides: {
  optOutStop?: boolean
  missingCapability?: boolean
} = {}) {
  const verified = {
    status: 'verified' as const,
    evidence: 'Synthetic Telnyx route-test evidence.',
  }
  return buildWarmSmsProviderReadiness({
    provider: {
      name: 'Telnyx Messaging',
      configured: true,
      enabled: true,
    },
    consent: {
      knownRelationshipBasis: true,
      relationshipBasisNote: 'Synthetic relationship evidence supports a one-recipient SMS test.',
      phoneProvenance: 'known',
      phoneProvenanceNote: 'Synthetic phone source is recorded for route-test review.',
      permissionStatus: 'documented',
      permissionNote: 'Synthetic consent note allows this route test only.',
      optOutStop: overrides.optOutStop ?? false,
      wrongNumber: false,
      doNotContact: false,
      lastContactAt: '2026-08-10T12:00:00.000Z',
      cooldownDays: 7,
      auditedAt: '2026-08-29T12:00:00.000Z',
    },
    draftApproval: {
      approvedForProviderDraftCreation: true,
    },
    activation: {
      providerSelectionStatus: 'selected',
      providerSelectionNote: 'Telnyx selected for guarded route test.',
      providerSetupCandidate: 'telnyx_messaging',
      configurationStatus: 'verified_disabled',
      configurationNote: 'Disabled configuration reviewed without provider calls.',
      capabilityEvidence: overrides.missingCapability
        ? {}
        : {
            outbound_message_submission: verified,
            delivery_status_callbacks: verified,
            inbound_opt_out_ingestion: verified,
            sender_identity_compliance: verified,
            idempotent_submission: verified,
            sandbox_or_no_send_test: verified,
          },
      reviewedAt: '2026-08-29T12:30:00.000Z',
    },
    transportConfig: {
      SMS_PROVIDER_ADAPTER: 'telnyx_messaging',
      SMS_PROVIDER_CREDENTIAL_REFERENCE: 'redacted-secret-reference',
      SMS_PROVIDER_SENDER_REFERENCE: 'redacted-sender-reference',
      SMS_PROVIDER_DELIVERY_CALLBACK: 'delivery-callback-reference',
      SMS_PROVIDER_OPT_OUT_CALLBACK: 'opt-out-callback-reference',
      WARM_SMS_DELIVERY_CONFIRMATION_STORE: 'delivery-confirmation-store',
      WARM_SMS_MESSAGE_VERSION_KEY: MESSAGE_VERSION_KEY,
      WARM_SMS_IDEMPOTENCY_NAMESPACE: 'warm-sms-send:v1',
      WARM_SMS_AUDIT_KEY: 'warm-sms-audit:v1',
      ENABLE_WARM_SMS_PROVIDER_EXECUTION: false,
    },
    now: '2026-08-29T13:00:00.000Z',
  })
}

function relationshipBody(readiness = providerReadiness()) {
  return {
    smsReadiness: {
      relationshipRationale: {
        status: 'present',
        basis: 'Synthetic relationship evidence supports this one-recipient SMS test.',
      },
      phoneReadiness: {
        present: true,
        provenance: 'Synthetic phone source is recorded for route-test review.',
      },
      providerReadiness: readiness,
    },
  }
}

function manualRelationshipBody() {
  return relationshipBody(
    buildWarmSmsProviderReadiness({
      provider: {
        name: null,
        configured: false,
        enabled: false,
      },
      consent: {
        knownRelationshipBasis: true,
        relationshipBasisNote:
          'Synthetic relationship evidence supports this one-recipient SMS test.',
        phoneProvenance: 'unverified',
        phoneProvenanceNote:
          'Synthetic phone source is recorded for route-test review.',
        permissionStatus: 'relationship_basis_only',
        permissionNote: null,
        optOutStop: false,
        wrongNumber: false,
        doNotContact: false,
        lastContactAt: null,
        cooldownDays: 7,
        auditedAt: null,
      },
      draftApproval: {
        approvedForProviderDraftCreation: false,
      },
      now: '2026-08-29T13:00:00.000Z',
    }),
  )
}

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost/api/admin/outreach/leads/${CONTACT_ID}/sms-telnyx-live-send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function params(id = String(CONTACT_ID)) {
  return { params: Promise.resolve({ id }) }
}

function executionPayload(row = outreachRow(), overrides: Record<string, unknown> = {}) {
  return {
    executeSmsSend: true,
    sendAuthorization: WARM_SMS_SEND_AUTHORIZATION,
    contactSubmissionId: row.contact_submission_id,
    outreachQueueId: row.id,
    messageVersionKey: MESSAGE_VERSION_KEY,
    idempotencyKey: SMS_SEND_IDEMPOTENCY_KEY,
    submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
    channel: 'sms',
    provider: 'telnyx_messaging',
    ...overrides,
  }
}

function listQuery(data: EvidenceRow[], error: { message: string } | null = null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue({ data, error }),
  }
  return query
}

function updateQuery(result: { data: Record<string, unknown> | null; error: { message: string } | null }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ single })
  const query = {
    eq: vi.fn(() => query),
    select,
  }
  return query
}

function mockSupabase({
  outreachItem = outreachRow(),
  contactCommunications = [],
  claimResult = { data: { id: QUEUE_ID }, error: null },
  finalResult = { data: { id: QUEUE_ID }, error: null },
}: {
  outreachItem?: OutreachQueueRow | null
  contactCommunications?: EvidenceRow[]
  claimResult?: { data: Record<string, unknown> | null; error: { message: string } | null }
  finalResult?: { data: Record<string, unknown> | null; error: { message: string } | null }
} = {}) {
  const updatePayloads: Record<string, unknown>[] = []
  let updateCall = 0
  const outreachSingle = vi.fn().mockResolvedValue({
    data: outreachItem,
    error: outreachItem ? null : { message: 'missing item' },
  })
  const outreachSelect = vi.fn(() => {
    const query = {
      eq: vi.fn(() => query),
      single: outreachSingle,
    }
    return query
  })
  const outreachUpdate = vi.fn((payload: Record<string, unknown>) => {
    updatePayloads.push(payload)
    updateCall += 1
    return updateQuery(updateCall === 1 ? claimResult : finalResult)
  })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'outreach_queue') {
      return {
        select: outreachSelect,
        update: outreachUpdate,
      }
    }
    if (table === 'contact_communications') {
      return listQuery(contactCommunications)
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    outreachUpdate,
    updatePayloads,
  }
}

describe('POST /api/admin/outreach/leads/[id]/sms-telnyx-live-send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    setSmsEnv()
    setWarmSmsTelnyxSenderForTesting(null)
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody()))
    mocks.logCommunication.mockResolvedValue({ id: 'comm-sms-1' })
  })

  it('blocks by default when the SMS provider execution flag is disabled', async () => {
    setSmsEnv({ ENABLE_WARM_SMS_PROVIDER_EXECUTION: 'false' })
    const { outreachUpdate } = mockSupabase()

    const response = await POST(makeRequest({ outreachQueueId: QUEUE_ID }), params())
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json).toMatchObject({
      status: 'blocked_no_send',
      telnyxApiCalled: false,
      externalSendPerformed: false,
      executionBoundary: {
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        genericProceedAccepted: false,
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
        rawCredentialsReturned: false,
      },
      liveSendReadiness: {
        state: 'env_disabled',
        label: 'Live SMS execution blocked by default',
        executionBoundary: {
          featureFlag: 'ENABLE_WARM_SMS_PROVIDER_EXECUTION',
          featureFlagEnabled: false,
          genericProceedAccepted: false,
          externalRequests: [],
        },
      },
    })
    expect(JSON.stringify(json)).not.toContain(RAW_PHONE)
    expect(JSON.stringify(json)).not.toContain(RAW_MESSAGE)
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('blocks when the Telnyx runtime credential is missing', async () => {
    setSmsEnv({
      WARM_SMS_TELNYX_RUNTIME_CREDENTIAL_READY: undefined,
      TELNYX_API_KEY: undefined,
      TELNYX_MESSAGING_API_KEY: undefined,
    })
    const { outreachUpdate } = mockSupabase()

    const response = await POST(makeRequest({ outreachQueueId: QUEUE_ID }), params())
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.liveSendReadiness).toMatchObject({
      state: 'credential_missing',
      providerSmoke: {
        credentialReferenceRecorded: true,
        runtimeCredentialAvailable: false,
        rawCredentialsReturned: false,
      },
    })
    expect(json.blockers.join(' ')).toMatch(/Telnyx credential/)
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('blocks when the Telnyx sender/profile reference is missing', async () => {
    setSmsEnv({ SMS_PROVIDER_SENDER_REFERENCE: undefined })
    const { outreachUpdate } = mockSupabase()

    const response = await POST(makeRequest({ outreachQueueId: QUEUE_ID }), params())
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.liveSendReadiness).toMatchObject({
      state: 'sender_profile_missing',
      providerSmoke: {
        senderReferenceRecorded: false,
      },
    })
    expect(json.blockers.join(' ')).toMatch(/sender/)
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('blocks when per-recipient approval evidence is absent', async () => {
    const row = outreachRow({
      generation_inputs: {
        warm_sms_message_version_key: MESSAGE_VERSION_KEY,
        warm_sms_telnyx_no_send_canary: { status: 'passed_no_send' },
      },
    })
    const { outreachUpdate } = mockSupabase({ outreachItem: row })

    const response = await POST(makeRequest({
      outreachQueueId: QUEUE_ID,
      messageVersionKey: MESSAGE_VERSION_KEY,
      idempotencyKey: SMS_SEND_IDEMPOTENCY_KEY,
      submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
    }), params())
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.liveSendReadiness).toMatchObject({
      state: 'per_recipient_approval_required',
      expectedAuthorization: {
        sendAuthorization: WARM_SMS_SEND_AUTHORIZATION,
        contactId: String(CONTACT_ID),
        outreachQueueId: QUEUE_ID,
        messageVersionKey: MESSAGE_VERSION_KEY,
        idempotencyKey: SMS_SEND_IDEMPOTENCY_KEY,
        submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
      },
    })
    expect(json.blockers.join(' ')).toMatch(/approval/)
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('does not treat generic proceed as live SMS send authorization', async () => {
    const { outreachUpdate } = mockSupabase()

    const response = await POST(makeRequest(executionPayload(outreachRow(), {
      sendAuthorization: 'proceed',
    })), params())
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json).toMatchObject({
      status: 'blocked_no_send',
      telnyxApiCalled: false,
      externalSendPerformed: false,
      blockers: [
        `sendAuthorization must be ${WARM_SMS_SEND_AUTHORIZATION}.`,
      ],
    })
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('prevents duplicate idempotency keys without calling Telnyx', async () => {
    setWarmSmsTelnyxSenderForTesting(vi.fn())
    const { outreachUpdate } = mockSupabase({
      contactCommunications: [
        {
          id: 'comm-existing',
          status: 'sent',
          metadata: {
            sms_send_idempotency_key: SMS_SEND_IDEMPOTENCY_KEY,
            submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
            telnyx_message_id: 'telnyx-existing',
          },
        },
      ],
    })

    const response = await POST(makeRequest(executionPayload()), params())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'duplicate_prevented',
      duplicatePrevented: true,
      telnyxApiCalled: false,
      externalSendPerformed: false,
      sentEvidence: {
        status: 'sent',
        providerMessageId: 'telnyx-existing',
        idempotencyKey: SMS_SEND_IDEMPOTENCY_KEY,
        submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
      },
      liveSendReadiness: {
        state: 'duplicate_idempotency_blocked',
      },
    })
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('blocks consent and suppression failures before any provider call', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json(relationshipBody(providerReadiness({ optOutStop: true }))),
    )
    const { outreachUpdate } = mockSupabase()

    const response = await POST(makeRequest({ outreachQueueId: QUEUE_ID }), params())
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json.liveSendReadiness).toMatchObject({
      state: 'consent_or_suppression_blocked',
    })
    expect(json.blockers.join(' ')).toMatch(/opt-out|suppression/i)
    expect(json.telnyxApiCalled).toBe(false)
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('sends through a mocked Telnyx adapter when every live gate matches', async () => {
    const sender = vi.fn().mockResolvedValue({
      ok: true,
      providerMessageId: 'telnyx-message-1',
      deliveryStatus: 'accepted',
    })
    setWarmSmsTelnyxSenderForTesting(sender)
    const { updatePayloads } = mockSupabase()

    const response = await POST(makeRequest(executionPayload()), params())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'sent',
      contactId: CONTACT_ID,
      outreachQueueId: QUEUE_ID,
      providerMessageId: 'telnyx-message-1',
      deliveryStatus: 'accepted',
      telnyxApiCalled: true,
      externalSendPerformed: true,
      idempotency: {
        messageVersionKey: MESSAGE_VERSION_KEY,
        smsSendIdempotencyKey: SMS_SEND_IDEMPOTENCY_KEY,
        submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
      },
      executionBoundary: {
        providerCallsEnabled: true,
        smsDeliveryEnabled: true,
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
        rawCredentialsReturned: false,
      },
      liveSendReadiness: {
        state: 'ready_for_live_one_recipient_execution',
      },
    })
    expect(sender).toHaveBeenCalledWith({
      toPhone: RAW_PHONE,
      fromPhone: '+15550000000',
      messageBody: RAW_MESSAGE,
      idempotencyKey: SMS_SEND_IDEMPOTENCY_KEY,
    })
    expect(updatePayloads[0]).toMatchObject({
      generation_inputs: {
        warm_sms_telnyx_execution: expect.objectContaining({
          status: 'sending',
          telnyx_api_called: false,
          external_send_performed: false,
          recipient_phone_reference: 'contact_submissions.phone_number',
        }),
      },
    })
    expect(updatePayloads[1]).toMatchObject({
      status: 'sent',
      message_id: 'telnyx-message-1',
      generation_inputs: {
        warm_sms_telnyx_execution: expect.objectContaining({
          status: 'sent',
          provider_message_id: 'telnyx-message-1',
          telnyx_api_called: true,
          external_send_performed: true,
          submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
        }),
      },
    })
    expect(mocks.logCommunication).toHaveBeenCalledWith(
      expect.objectContaining({
        contactSubmissionId: CONTACT_ID,
        channel: 'sms',
        direction: 'outbound',
        status: 'sent',
        sentBy: 'admin-user-1',
        metadata: expect.objectContaining({
          sms_send_idempotency_key: SMS_SEND_IDEMPOTENCY_KEY,
          submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
          raw_phone_returned: false,
          raw_message_body_returned: false,
        }),
      }),
    )
    expect(JSON.stringify(json)).not.toContain(RAW_PHONE)
    expect(JSON.stringify(json)).not.toContain(RAW_MESSAGE)
    expect(JSON.stringify(json)).not.toContain('op://Portfolio/Warm SMS Telnyx/credential')
  })

  it('uses exact queue approval and no-send evidence to satisfy production live-send readiness overlay', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(manualRelationshipBody()))
    const sender = vi.fn().mockResolvedValue({
      ok: true,
      providerMessageId: 'telnyx-message-production-shape',
      deliveryStatus: 'accepted',
    })
    setWarmSmsTelnyxSenderForTesting(sender)
    const { updatePayloads } = mockSupabase()

    const response = await POST(makeRequest(executionPayload()), params())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'sent',
      telnyxApiCalled: true,
      externalSendPerformed: true,
      liveSendReadiness: {
        state: 'ready_for_live_one_recipient_execution',
        providerSmoke: {
          provider: 'telnyx_messaging',
          available: true,
          capabilityVerified: true,
          selectedProviderVerified: true,
        },
        executionBoundary: {
          genericProceedAccepted: false,
          providerCallsEnabled: true,
          smsDeliveryEnabled: true,
        },
      },
    })
    expect(sender).toHaveBeenCalledTimes(1)
    expect(updatePayloads[1]).toMatchObject({
      status: 'sent',
      message_id: 'telnyx-message-production-shape',
    })
    expect(JSON.stringify(json)).not.toContain(RAW_PHONE)
    expect(JSON.stringify(json)).not.toContain(RAW_MESSAGE)
  })

  it('records a mocked Telnyx failure without exposing raw phone or message content', async () => {
    setWarmSmsTelnyxSenderForTesting(vi.fn().mockResolvedValue({
      ok: false,
      error: 'Synthetic Telnyx adapter failure.',
      deliveryStatus: 'failed',
    }))
    const { updatePayloads } = mockSupabase()

    const response = await POST(makeRequest(executionPayload()), params())
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(json).toMatchObject({
      status: 'blocked_no_send',
      telnyxApiCalled: false,
      externalSendPerformed: false,
      blockers: ['Synthetic Telnyx adapter failure.'],
      executionBoundary: {
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
      },
    })
    expect(updatePayloads[1]).toMatchObject({
      status: 'approved',
      generation_inputs: {
        warm_sms_telnyx_execution: expect.objectContaining({
          status: 'failed_provider_call',
          failure_reason: 'Synthetic Telnyx adapter failure.',
        }),
      },
    })
    expect(JSON.stringify(json)).not.toContain(RAW_PHONE)
    expect(JSON.stringify(json)).not.toContain(RAW_MESSAGE)
  })
})
