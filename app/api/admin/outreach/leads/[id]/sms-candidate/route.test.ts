import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

import {
  buildWarmSmsCandidateReview,
  warmSmsCandidateMetadata,
  warmSmsMessageVersionKey,
  type WarmSmsCandidateQueueRow,
} from '@/lib/warm-outreach-sms-candidate'
import type { WarmSmsReadiness } from '@/lib/warm-outreach-sms-readiness'

const mocks = vi.hoisted(() => ({
  getRelationshipPacket: vi.fn(),
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
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

import { POST } from './route'

const CONTACT_ID = 42
const RAW_PHONE = '+15550123456'
const SMS_DRAFT = 'Hi Ada, open to a short check-in this week?'

function request(body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost/api/admin/outreach/leads/${CONTACT_ID}/sms-candidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function params(id = String(CONTACT_ID)) {
  return { params: Promise.resolve({ id }) }
}

function readiness(input: {
  state?: 'blocked' | 'manual_review_required' | 'manual_ready'
  queueRows?: WarmSmsCandidateQueueRow[]
  blockers?: string[]
  phonePresent?: boolean
} = {}) {
  const state = input.state ?? 'manual_review_required'
  const base = {
    version: 'warm-outreach-sms-readiness/v1',
    contactId: String(CONTACT_ID),
    contactName: 'Ada Operator',
    channel: 'phone_contact',
    state,
    phoneReadiness: {
      present: input.phonePresent ?? true,
      source: input.phonePresent === false ? 'missing' : 'contact_submissions.phone_number',
      provenance: input.phonePresent === false
        ? 'Add a phone number to the Portfolio contact record before SMS review.'
        : 'Phone number is present on the Portfolio contact record.',
      rawPhoneReturned: false,
    },
    relationshipRationale: {
      status: 'present',
      basis: 'Existing relationship evidence supports review.',
      sourceCount: 2,
      signalCount: 2,
      detail: 'Local relationship evidence supports manual SMS review.',
    },
    consentAndSuppression: {
      status: state === 'blocked' ? 'blocked' : 'clear_for_manual_review',
      rationale: state === 'blocked'
        ? 'SMS outreach is blocked by suppression state.'
        : 'No suppression blocker is recorded; operator must still confirm appropriateness.',
      blockers: input.blockers ?? (state === 'blocked' ? ['Contact is marked do not contact.'] : []),
      checks: [],
    },
    draft: {
      templateFamily: 'referral_common_connection',
      templateLabel: 'Referral / common connection',
      selectionReason: 'Referral evidence is present.',
      preview: SMS_DRAFT,
      guidance: [],
      maxRecommendedCharacters: 240,
    },
    approval: {
      state: 'not_reviewed',
      recordsManualReadinessOnly: true,
      smsDeliveryEnabled: false,
      providerCallsEnabled: false,
      externalSendEnabled: false,
      genericProceedAccepted: false,
      allowedDecisions: ['approve_manual_ready', 'request_revision', 'reject'],
    },
    operatingLoop: {
      version: 'warm-outreach-sms-manual-loop/v1',
      states: [],
      manualEvidence: {
        requiredFields: ['timestamp', 'channel', 'operator_note'],
        privacyBoundary: 'Record minimal evidence only.',
        channel: 'manual_sms',
        storesRawSmsBody: false,
        storesPhoneNumber: false,
        requiresScreenshot: false,
      },
      responseOutcomes: [],
      externalProviderCallsEnabled: false,
      smsDeliveryEnabled: false,
      genericProceedAccepted: false,
    },
    providerReadiness: {},
    operatorNextAction: 'Review and prepare an SMS candidate.',
    recoveryStep: null,
    executionBoundary: {
      manualOnly: true,
      smsProviderConfigured: false,
      smsProviderCalls: false,
      smsDelivery: false,
      phoneImport: false,
      slackDispatch: false,
      gmailAction: false,
      n8nDispatch: false,
      productionDataMutation: false,
    },
  }
  return {
    ...base,
    candidateReview: buildWarmSmsCandidateReview({
      readiness: base,
      queueRows: input.queueRows,
    }),
  } as unknown as WarmSmsReadiness
}

function smsRow(overrides: Partial<WarmSmsCandidateQueueRow> = {}): WarmSmsCandidateQueueRow {
  const messageVersionKey = warmSmsMessageVersionKey(CONTACT_ID, 'referral_common_connection')
  return {
    id: 'sms-queue-42',
    contact_submission_id: CONTACT_ID,
    channel: 'sms',
    status: 'draft',
    subject: 'Warm SMS candidate',
    sequence_step: 1,
    thread_id: null,
    message_id: null,
    sent_at: null,
    replied_at: null,
    generation_inputs: warmSmsCandidateMetadata({
      contactId: CONTACT_ID,
      contactName: 'Ada Operator',
      messageVersionKey,
      smsSendIdempotencyKey: `warm-sms-send:v1:sms-queue-42:${CONTACT_ID}:${messageVersionKey}`,
      submittedEvidenceKey: `warm-sms-audit:v1:submitted:sms-queue-42:${CONTACT_ID}:${messageVersionKey}`,
      templateFamily: 'referral_common_connection',
      templateLabel: 'Referral / common connection',
      preparedBy: 'admin-user',
      preparedAt: '2026-08-30T17:00:00.000Z',
    }),
    created_at: '2026-08-30T17:00:00.000Z',
    ...overrides,
  }
}

function listQuery(data: WarmSmsCandidateQueueRow[], error: { message: string } | null = null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue({ data, error }),
  }
  return query
}

function setupSupabase(input: {
  existingRows?: WarmSmsCandidateQueueRow[]
  insertError?: { message: string } | null
} = {}) {
  const insertPayloads: Record<string, unknown>[] = []
  const list = listQuery(input.existingRows ?? [])
  const insertSingle = vi.fn(async () => {
    const payload = insertPayloads[0]
    return {
      data: input.insertError ? null : {
        id: 'sms-queue-created',
        created_at: '2026-08-30T17:10:00.000Z',
        ...payload,
      },
      error: input.insertError ?? null,
    }
  })
  const insertSelect = vi.fn(() => ({ single: insertSingle }))
  const insert = vi.fn((payload: Record<string, unknown>) => {
    insertPayloads.push(payload)
    return { select: insertSelect }
  })

  mocks.from.mockImplementation((table: string) => {
    if (table !== 'outreach_queue') throw new Error(`Unexpected table: ${table}`)
    return {
      select: list.select,
      insert,
    }
  })

  return {
    insert,
    insertPayloads,
  }
}

describe('POST /api/admin/outreach/leads/[id]/sms-candidate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns an existing SMS candidate without creating a duplicate or sending SMS', async () => {
    const existing = smsRow()
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json({ smsReadiness: readiness({ queueRows: [existing] }) }),
    )
    const { insert } = setupSupabase()

    const response = await POST(request({ messageText: SMS_DRAFT }), params())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      outcome: 'existing',
      candidate: {
        id: 'sms-queue-42',
        channel: 'sms',
        status: 'draft',
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
      },
      executionBoundary: {
        createsQueueArtifact: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        telnyxApiCalled: false,
        externalRequests: [],
      },
    })
    expect(insert).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(JSON.stringify(json)).not.toContain(RAW_PHONE)
    expect(JSON.stringify(json)).not.toContain(SMS_DRAFT)
  })

  it('blocks candidate creation when phone or suppression prerequisites fail', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json({
        smsReadiness: readiness({
          state: 'blocked',
          phonePresent: false,
          blockers: ['No phone number is present in the Portfolio contact record.'],
        }),
      }),
    )
    const { insert } = setupSupabase()

    const response = await POST(request({ messageText: SMS_DRAFT }), params())
    const json = await response.json()

    expect(response.status).toBe(409)
    expect(json).toMatchObject({
      outcome: 'blocked',
      candidateReview: {
        state: 'blocked_missing_prerequisites',
      },
      executionBoundary: {
        createsQueueArtifact: false,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        telnyxApiCalled: false,
      },
    })
    expect(json.blockers.join(' ')).toMatch(/Phone number is missing|No phone number/)
    expect(insert).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('creates a draft SMS queue artifact only and returns redacted evidence', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json({ smsReadiness: readiness() }),
    )
    const { insertPayloads } = setupSupabase()

    const response = await POST(request({ messageText: SMS_DRAFT }), params())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      outcome: 'created',
      message: 'SMS candidate queue row prepared for review. No SMS was sent and no Telnyx call was made.',
      candidate: {
        id: 'sms-queue-created',
        channel: 'sms',
        status: 'draft',
        approvalState: 'missing',
        submittedEvidenceRecorded: false,
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
      },
      candidateReview: {
        state: 'candidate_exists',
      },
      executionBoundary: {
        createsQueueArtifact: true,
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        telnyxApiCalled: false,
        slackDispatchEnabled: false,
        gmailActionEnabled: false,
        n8nDispatchEnabled: false,
        rawPhoneReturned: false,
        rawMessageBodyReturned: false,
        externalRequests: [],
      },
    })
    expect(insertPayloads[0]).toMatchObject({
      contact_submission_id: CONTACT_ID,
      channel: 'sms',
      subject: 'Warm SMS candidate',
      body: SMS_DRAFT,
      sequence_step: 1,
      status: 'draft',
      generation_model: 'warm_sms_candidate_review/v1',
      generation_inputs: {
        template_key: 'warm_sms_candidate_review',
        channel: 'sms',
        warm_sms_candidate: {
          status: 'prepared_for_review',
          provider_calls_enabled: false,
          sms_delivery_enabled: false,
          telnyx_api_called: false,
          raw_phone_returned: false,
          raw_message_body_returned: false,
        },
        execution_boundary: {
          external_requests: [],
        },
      },
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(JSON.stringify(json)).not.toContain(RAW_PHONE)
    expect(JSON.stringify(json)).not.toContain(SMS_DRAFT)
  })

  it('reports the SMS channel schema blocker without falling through to provider execution', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json({ smsReadiness: readiness() }),
    )
    setupSupabase({
      insertError: { message: 'new row for relation "outreach_queue" violates check constraint "outreach_queue_channel_check"' },
    })

    const response = await POST(request({ messageText: SMS_DRAFT }), params())
    const json = await response.json()

    expect(response.status).toBe(503)
    expect(json).toMatchObject({
      outcome: 'blocked',
      blockers: ['Database channel constraint does not allow SMS queue rows yet.'],
      executionBoundary: {
        providerCallsEnabled: false,
        smsDeliveryEnabled: false,
        telnyxApiCalled: false,
      },
    })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
