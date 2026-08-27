import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  getRelationshipPacket: vi.fn(),
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  decryptRefreshToken: vi.fn(),
  isGmailUserOAuthClientConfigured: vi.fn(),
  isGmailUserOauthSecretConfigured: vi.fn(),
  sendUserGmailDraft: vi.fn(),
  logCommunication: vi.fn(),
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

vi.mock('@/lib/gmail-user-oauth-crypto', () => ({
  decryptRefreshToken: mocks.decryptRefreshToken,
}))

vi.mock('@/lib/gmail-user-oauth-secret', () => ({
  isGmailUserOauthSecretConfigured: mocks.isGmailUserOauthSecretConfigured,
}))

vi.mock('@/lib/gmail-user-api', () => ({
  isGmailUserOAuthClientConfigured: mocks.isGmailUserOAuthClientConfigured,
  sendUserGmailDraft: mocks.sendUserGmailDraft,
}))

vi.mock('@/lib/communications', () => ({
  logCommunication: mocks.logCommunication,
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }
const MESSAGE_VERSION_KEY = 'warm-outreach:email-message-version:v1:abc'
const SEND_QUEUE_KEY = 'warm-outreach:email-send-queue:v1:abc'
const SUBMITTED_EVIDENCE_KEY = 'warm-outreach:email-submitted-evidence:v1:abc'
const DRAFT_ID = 'gmail-draft-1'

type OutreachQueueRow = {
  id: string
  contact_submission_id: number
  status: string
  channel: string
  subject: string | null
  body: string | null
  thread_id: string | null
  message_id: string | null
  sent_at?: string | null
  generation_inputs?: Record<string, unknown> | null
  contact_submissions: {
    id: number
    name: string
    email: string
    company: string | null
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

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/admin/outreach/queue-1/gmail-user-send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function params(id = 'queue-1') {
  return { params: Promise.resolve({ id }) }
}

function executionPayload(row = outreachRow(), overrides: Record<string, unknown> = {}) {
  return {
    executeGmailSend: true,
    sendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient',
    idempotencyKey: SEND_QUEUE_KEY,
    submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
    messageVersionKey: MESSAGE_VERSION_KEY,
    contactSubmissionId: row.contact_submission_id,
    recipientEmail: row.contact_submissions?.email,
    gmailDraftId: DRAFT_ID,
    channel: 'email',
    ...overrides,
  }
}

function authorization(overrides: Record<string, unknown> = {}) {
  return {
    version: 'warm-outreach-slack-gmail-send-authorization/v1',
    decision_key: 'warm-outreach:slack-gmail-send-decision:v1:abc',
    status: 'approved',
    contact_submission_id: 123,
    outreach_queue_id: 'queue-1',
    message_version_key: MESSAGE_VERSION_KEY,
    send_queue_idempotency_key: SEND_QUEUE_KEY,
    approval_intent_recorded: true,
    external_send_authorization_intent: true,
    gmail_send_called: false,
    external_send_performed: false,
    ...overrides,
  }
}

function draftEvidence(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'gmail_user_oauth',
    provider_action: 'drafts.create',
    draft_id: DRAFT_ID,
    message_id: 'gmail-message-1',
    thread_id: 'gmail-thread-1',
    connected_as: 'vambah@amadutown.com',
    required_sender: 'vambah@amadutown.com',
    recipient_email: 'alice@example.com',
    idempotency_key: 'warm-outreach:gmail-draft:v1:queue-1:123:email',
    external_send_blocked: true,
    ...overrides,
  }
}

function outreachRow(overrides: Partial<OutreachQueueRow> = {}): OutreachQueueRow {
  return {
    id: 'queue-1',
    contact_submission_id: 123,
    status: 'approved',
    channel: 'email',
    subject: 'Hello',
    body: 'Body text',
    thread_id: 'gmail-thread-1',
    message_id: 'gmail-message-1',
    sent_at: null,
    generation_inputs: {
      gmail_draft_creation: draftEvidence(),
      warm_gmail_send_authorization: authorization(),
    },
    contact_submissions: {
      id: 123,
      name: 'Alice Lead',
      email: 'alice@example.com',
      company: 'Acme',
      outreach_status: 'not_contacted',
      do_not_contact: false,
      removed_at: null,
    },
    ...overrides,
  }
}

function lifecycle(overrides: Record<string, unknown> = {}) {
  return {
    contactId: 123,
    messageVersionKey: MESSAGE_VERSION_KEY,
    sendQueueIdempotencyKey: SEND_QUEUE_KEY,
    submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
    externalSendReadiness: {
      suppressionConsent: {
        state: 'clear',
        reasons: [],
        detail: 'No suppression blocker is recorded.',
      },
    },
    suppressionCheck: {
      status: 'clear',
      reasons: [],
    },
    ...overrides,
  }
}

function relationshipBody(lifecycleOverrides: Record<string, unknown> = {}) {
  return {
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
  emailMessages = [],
  credentials = {
    refresh_token_cipher: 'cipher',
    refresh_token_iv: 'iv',
    refresh_token_tag: 'tag',
    google_email: 'vambah@amadutown.com',
  },
  claimResult = { data: { id: 'queue-1' }, error: null },
  finalResult = { data: { id: 'queue-1' }, error: null },
}: {
  outreachItem?: OutreachQueueRow | null
  contactCommunications?: EvidenceRow[]
  emailMessages?: EvidenceRow[]
  credentials?: Record<string, unknown> | null
  claimResult?: { data: Record<string, unknown> | null; error: { message: string } | null }
  finalResult?: { data: Record<string, unknown> | null; error: { message: string } | null }
} = {}) {
  const updatePayloads: Record<string, unknown>[] = []
  let updateCall = 0
  const outreachSingle = vi.fn().mockResolvedValue({
    data: outreachItem,
    error: outreachItem ? null : { message: 'missing item' },
  })
  const outreachSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ single: outreachSingle }),
  })
  const outreachUpdate = vi.fn((payload: Record<string, unknown>) => {
    updatePayloads.push(payload)
    updateCall += 1
    return updateQuery(updateCall === 1 ? claimResult : finalResult)
  })
  const credentialsMaybeSingle = vi.fn().mockResolvedValue({
    data: credentials,
    error: credentials ? null : { message: 'missing credentials' },
  })
  const credentialsSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({ maybeSingle: credentialsMaybeSingle }),
  })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'outreach_queue') {
      return {
        select: outreachSelect,
        update: outreachUpdate,
      }
    }
    if (table === 'admin_gmail_user_credentials') {
      return { select: credentialsSelect }
    }
    if (table === 'contact_communications') {
      return listQuery(contactCommunications)
    }
    if (table === 'email_messages') {
      return listQuery(emailMessages)
    }
    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    outreachUpdate,
    updatePayloads,
  }
}

describe('POST /api/admin/outreach/[id]/gmail-user-send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.BUSINESS_FROM_EMAIL = '"AmaduTown" <vambah@amadutown.com>'
    delete process.env.ENABLE_WARM_GMAIL_SEND_EXECUTION
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getRelationshipPacket.mockResolvedValue(NextResponse.json(relationshipBody()))
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(true)
    mocks.isGmailUserOauthSecretConfigured.mockReturnValue(true)
    mocks.decryptRefreshToken.mockReturnValue('refresh-token')
    mocks.sendUserGmailDraft.mockResolvedValue({
      id: 'sent-message-1',
      threadId: 'gmail-thread-1',
      labelIds: ['SENT'],
    })
    mocks.logCommunication.mockResolvedValue({ id: 'comm-sent-1' })
  })

  it('records an eligible execution state by default without calling Gmail', async () => {
    const { outreachUpdate, updatePayloads } = mockSupabase()

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      version: 'warm-outreach-gmail-send-execution/v1',
      status: 'eligible_for_execution',
      gmailSendCalled: false,
      externalSendPerformed: false,
      preparedExecutionEvidence: expect.objectContaining({
        status: 'eligible_for_execution',
        outreach_queue_id: 'queue-1',
        contact_submission_id: 123,
        message_version_key: MESSAGE_VERSION_KEY,
        send_queue_idempotency_key: SEND_QUEUE_KEY,
        submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
        gmail_send_called: false,
        external_send_performed: false,
      }),
      expectedAuthorization: {
        executeGmailSend: true,
        sendAuthorization: 'execute_warm_gmail_send_for_authorized_recipient',
        idempotencyKey: SEND_QUEUE_KEY,
        submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
        messageVersionKey: MESSAGE_VERSION_KEY,
        contactSubmissionId: 123,
        recipientEmail: 'alice@example.com',
        gmailDraftId: DRAFT_ID,
        channel: 'email',
      },
      executionBoundary: {
        providerCallsEnabled: false,
        gmailSendEnabled: false,
        externalSendEnabled: false,
      },
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).toHaveBeenCalledTimes(1)
    expect(updatePayloads[0]).toMatchObject({
      generation_inputs: {
        warm_gmail_send_execution: expect.objectContaining({
          status: 'eligible_for_execution',
          gmail_send_called: false,
          external_send_performed: false,
        }),
      },
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('sends one approved Gmail draft when the enable flag and exact execution scope are present', async () => {
    process.env.ENABLE_WARM_GMAIL_SEND_EXECUTION = 'true'
    const { updatePayloads } = mockSupabase()

    const response = await POST(makeRequest(executionPayload()), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'sent',
      message: 'Authorized warm Gmail draft sent and Portfolio sent evidence was recorded.',
      gmailDraftId: DRAFT_ID,
      messageId: 'sent-message-1',
      threadId: 'gmail-thread-1',
      gmailSendCalled: true,
      externalSendPerformed: true,
      communicationLog: {
        status: 'recorded',
        communicationId: 'comm-sent-1',
      },
      idempotency: {
        messageVersionKey: MESSAGE_VERSION_KEY,
        sendQueueIdempotencyKey: SEND_QUEUE_KEY,
        submittedEvidenceKey: SUBMITTED_EVIDENCE_KEY,
      },
    })
    expect(updatePayloads[0]).toMatchObject({
      generation_inputs: {
        warm_gmail_send_execution: expect.objectContaining({
          status: 'sending',
          gmail_send_called: false,
          idempotency_key: SEND_QUEUE_KEY,
          submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
        }),
      },
    })
    expect(mocks.decryptRefreshToken).toHaveBeenCalledWith('cipher', 'iv', 'tag')
    expect(mocks.sendUserGmailDraft).toHaveBeenCalledWith('refresh-token', DRAFT_ID)
    expect(updatePayloads[1]).toMatchObject({
      status: 'sent',
      sent_at: expect.any(String),
      generation_inputs: {
        warm_gmail_send_execution: expect.objectContaining({
          status: 'sent',
          gmail_send_called: true,
          external_send_performed: true,
          gmail_message_id: 'sent-message-1',
          submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
        }),
      },
    })
    expect(mocks.logCommunication).toHaveBeenCalledWith(
      expect.objectContaining({
        contactSubmissionId: 123,
        channel: 'email',
        direction: 'outbound',
        status: 'sent',
        sentBy: 'admin-user-1',
        recipientEmail: 'alice@example.com',
        emailTransport: 'gmail_smtp',
        metadata: expect.objectContaining({
          gmail_send_idempotency_key: SEND_QUEUE_KEY,
          submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
        }),
      }),
    )
  })

  it('reports secondary communication-log repair without implying the Gmail send failed', async () => {
    process.env.ENABLE_WARM_GMAIL_SEND_EXECUTION = 'true'
    const { updatePayloads } = mockSupabase()
    mocks.logCommunication.mockRejectedValue(new Error('timeline insert failed'))

    const response = await POST(makeRequest(executionPayload()), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'sent_secondary_log_repair_required',
      message:
        'Gmail send succeeded and Portfolio queue evidence was recorded, but the secondary communication timeline log failed. Repair the communication log from queue evidence; do not send this Gmail draft again.',
      gmailDraftId: DRAFT_ID,
      messageId: 'sent-message-1',
      threadId: 'gmail-thread-1',
      gmailSendCalled: true,
      externalSendPerformed: true,
      sentEvidence: expect.objectContaining({
        status: 'sent',
        gmail_send_called: true,
        external_send_performed: true,
        submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
      }),
      communicationLog: {
        status: 'repair_required',
        communicationId: null,
        error: 'timeline insert failed',
      },
    })
    expect(mocks.sendUserGmailDraft).toHaveBeenCalledTimes(1)
    expect(updatePayloads[1]).toMatchObject({
      status: 'sent',
      generation_inputs: {
        warm_gmail_send_execution: expect.objectContaining({
          status: 'sent',
          gmail_send_called: true,
          external_send_performed: true,
        }),
      },
    })
  })

  it('blocks when Portfolio authorization is missing', async () => {
    const row = outreachRow({
      generation_inputs: {
        gmail_draft_creation: draftEvidence(),
      },
    })
    const { outreachUpdate } = mockSupabase({ outreachItem: row })

    const response = await POST(makeRequest(executionPayload(row)), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      blockers: expect.arrayContaining([
        'Portfolio warm Gmail send authorization is missing or not approved.',
      ]),
      gmailSendCalled: false,
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('blocks when Portfolio authorization intent is not approved for external send', async () => {
    const row = outreachRow({
      generation_inputs: {
        gmail_draft_creation: draftEvidence(),
        warm_gmail_send_authorization: authorization({
          approval_intent_recorded: false,
          external_send_authorization_intent: false,
        }),
      },
    })
    const { outreachUpdate } = mockSupabase({ outreachItem: row })

    const response = await POST(makeRequest(executionPayload(row)), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      blockers: expect.arrayContaining([
        'Portfolio authorization must record approval intent for this exact recipient and message version.',
        'Portfolio authorization must record external send authorization intent for this exact recipient and message version.',
      ]),
      gmailSendCalled: false,
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).not.toHaveBeenCalled()
  })

  it('blocks revoked Portfolio authorization evidence', async () => {
    const row = outreachRow({
      generation_inputs: {
        gmail_draft_creation: draftEvidence(),
        warm_gmail_send_authorization: authorization({
          status: 'revoked',
        }),
      },
    })
    mockSupabase({ outreachItem: row })

    const response = await POST(makeRequest(executionPayload(row)), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      blockers: expect.arrayContaining([
        'Portfolio warm Gmail send authorization is missing or not approved.',
        'Portfolio warm Gmail send authorization was revoked.',
      ]),
      gmailSendCalled: false,
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
  })

  it('blocks stale authorization when the message version no longer matches lifecycle evidence', async () => {
    const row = outreachRow({
      generation_inputs: {
        gmail_draft_creation: draftEvidence(),
        warm_gmail_send_authorization: authorization({
          message_version_key: 'warm-outreach:email-message-version:v1:old',
        }),
      },
    })
    mockSupabase({ outreachItem: row })

    const response = await POST(makeRequest(executionPayload(row)), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      blockers: expect.arrayContaining([
        'Authorization message version is stale or mismatched.',
      ]),
      gmailSendCalled: false,
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
  })

  it('blocks when suppression or consent evidence is not clear', async () => {
    mocks.getRelationshipPacket.mockResolvedValue(
      NextResponse.json(
        relationshipBody({
          externalSendReadiness: {
            suppressionConsent: {
              state: 'blocked',
              reasons: ['Contact opted out.'],
              detail: 'Contact opted out.',
            },
          },
          suppressionCheck: {
            status: 'blocked',
            reasons: ['Contact opted out.'],
          },
        }),
      ),
    )
    mockSupabase()

    const response = await POST(makeRequest(executionPayload()), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      blockers: expect.arrayContaining(['Contact opted out.']),
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
  })

  it('blocks when tracked Gmail draft evidence is missing', async () => {
    const row = outreachRow({
      thread_id: null,
      message_id: null,
      generation_inputs: {
        warm_gmail_send_authorization: authorization(),
      },
    })
    mockSupabase({ outreachItem: row })

    const response = await POST(makeRequest(executionPayload(row)), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      status: 'blocked_no_send',
      blockers: expect.arrayContaining([
        'Tracked Gmail draft evidence is missing.',
        'Tracked Gmail draft thread evidence is missing.',
      ]),
      gmailSendCalled: false,
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
  })

  it('keeps an explicit execution request no-send when the enable flag is absent', async () => {
    const { outreachUpdate } = mockSupabase()

    const response = await POST(makeRequest(executionPayload()), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'eligible_for_execution',
      gmailSendCalled: false,
      externalSendPerformed: false,
    })
    expect(mocks.decryptRefreshToken).not.toHaveBeenCalled()
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).toHaveBeenCalledTimes(1)
  })

  it('prevents duplicate replay when submitted send evidence already exists', async () => {
    mockSupabase({
      contactCommunications: [
        {
          id: 'comm-sent-1',
          status: 'sent',
          metadata: {
            gmail_send_idempotency_key: SEND_QUEUE_KEY,
            submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
            gmail_user_sent_message_id: 'sent-message-1',
            gmail_user_thread_id: 'gmail-thread-1',
          },
        },
      ],
    })

    const response = await POST(makeRequest(executionPayload()), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'duplicate_prevented',
      duplicatePrevented: true,
      gmailSendCalled: false,
      externalSendPerformed: false,
      sentEvidence: {
        source_id: 'comm-sent-1',
        idempotency_key: SEND_QUEUE_KEY,
        submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
      },
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
  })

  it('prevents duplicate eligible execution evidence for repeat no-send submits', async () => {
    const row = outreachRow({
      generation_inputs: {
        gmail_draft_creation: draftEvidence(),
        warm_gmail_send_authorization: authorization(),
        warm_gmail_send_execution: {
          status: 'eligible_for_execution',
          contact_submission_id: 123,
          outreach_queue_id: 'queue-1',
          message_version_key: MESSAGE_VERSION_KEY,
          send_queue_idempotency_key: SEND_QUEUE_KEY,
          submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
          gmail_send_called: false,
          external_send_performed: false,
        },
      },
    })
    const { outreachUpdate } = mockSupabase({ outreachItem: row })

    const response = await POST(makeRequest(executionPayload(row)), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'eligible_for_execution',
      duplicatePrevented: true,
      gmailSendCalled: false,
      externalSendPerformed: false,
      preparedExecutionEvidence: expect.objectContaining({
        status: 'eligible_for_execution',
        submitted_evidence_key: SUBMITTED_EVIDENCE_KEY,
      }),
    })
    expect(outreachUpdate).not.toHaveBeenCalled()
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
  })

  it('keeps dry-run mode no-send even when live execution is enabled', async () => {
    process.env.ENABLE_WARM_GMAIL_SEND_EXECUTION = 'true'
    const { outreachUpdate } = mockSupabase()

    const response = await POST(makeRequest({ ...executionPayload(), dryRun: true }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'eligible_for_execution',
      gmailSendCalled: false,
      externalSendPerformed: false,
    })
    expect(mocks.sendUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).toHaveBeenCalledTimes(1)
  })
})
