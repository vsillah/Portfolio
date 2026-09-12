import { buildWarmGmailActionRequest } from '@/lib/warm-gmail-action-request'
import { warmFinalCopyFingerprint } from '@/lib/warm-outreach-copy-fingerprint'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  decryptRefreshToken: vi.fn(),
  createUserGmailDraft: vi.fn(),
  updateUserGmailDraft: vi.fn(),
  isGmailUserOAuthClientConfigured: vi.fn(),
  isGmailUserOauthSecretConfigured: vi.fn(),
  logCommunication: vi.fn(),
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

vi.mock('@/lib/gmail-user-api', () => ({
  createUserGmailDraft: mocks.createUserGmailDraft,
  updateUserGmailDraft: mocks.updateUserGmailDraft,
  isGmailUserOAuthClientConfigured: mocks.isGmailUserOAuthClientConfigured,
}))

vi.mock('@/lib/gmail-user-oauth-secret', () => ({
  isGmailUserOauthSecretConfigured: mocks.isGmailUserOauthSecretConfigured,
}))

vi.mock('@/lib/communications', () => ({
  logCommunication: mocks.logCommunication,
}))

import { POST } from './route'

type CredentialsRow = {
  refresh_token_cipher: string
  refresh_token_iv: string
  refresh_token_tag: string
  google_email: string
}

type OutreachQueueRow = {
  updated_at: string
  id: string
  contact_submission_id: number
  status: string
  channel: string
  subject: string | null
  body: string | null
  thread_id?: string | null
  message_id?: string | null
  generation_inputs?: Record<string, unknown> | null
  contact_submissions: {
    id: number
    name: string
    email: string
    company: string | null
    lead_source?: string | null
    outreach_status?: string | null
    do_not_contact?: boolean
    removed_at?: string | null
    relationship_strength?: string | null
    warm_source_detail?: string | null
  } | null
}

type CommunicationRow = {
  id: string
  status?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string
}

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest(
    'http://localhost/api/admin/outreach/queue-1/gmail-user-draft',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(overrides),
    },
  )
}

function expectedIdempotencyKey(row = outreachRow()) {
  return `warm-outreach:gmail-draft:v1:${row.id}:${row.contact_submission_id}:${row.channel}`
}

function authorizedPayload(row = outreachRow(), overrides: Record<string, unknown> = {}) {
  return {
    expectedUpdatedAt: row.updated_at,
    finalCopyFingerprint: warmFinalCopyFingerprint(row),
    createGmailDraft: true,
    draftAuthorization: 'create_gmail_draft_for_recipient',
    idempotencyKey: expectedIdempotencyKey(row),
    contactSubmissionId: row.contact_submission_id,
    recipientEmail: row.contact_submissions?.email,
    channel: row.channel,
    ...overrides,
  }
}

function params(id = 'queue-1') {
  return { params: Promise.resolve({ id }) }
}

function mockSupabase({
  credentials,
  outreachItem,
  trackingError = null,
  unmatchedUpdate = 0,
  atomicClaims = false,
  contactCommunications = [
    {
      id: 'comm-relationship-1',
      status: 'sent',
      metadata: { source: 'prior_portfolio_context' },
      created_at: '2026-08-20T00:00:00.000Z',
    },
  ],
  emailMessages = [],
  existingDrafts = [],
  contactCommunicationsError = null,
  emailMessagesError = null,
  existingDraftsError = null,
}: {
  credentials: CredentialsRow | null
  outreachItem?: OutreachQueueRow | null
  trackingError?: { message: string } | null
  unmatchedUpdate?: number
  atomicClaims?: boolean
  contactCommunications?: CommunicationRow[]
  emailMessages?: CommunicationRow[]
  existingDrafts?: CommunicationRow[]
  contactCommunicationsError?: { message: string } | null
  emailMessagesError?: { message: string } | null
  existingDraftsError?: { message: string } | null
}) {
  const credentialsMaybeSingle = vi.fn().mockResolvedValue({
    data: credentials,
    error: credentials ? null : { message: 'missing credentials' },
  })
  const credentialsEq = vi.fn().mockReturnValue({
    maybeSingle: credentialsMaybeSingle,
  })
  const credentialsSelect = vi.fn().mockReturnValue({
    eq: credentialsEq,
  })

  const outreachSingle = vi.fn().mockResolvedValue({
    data: outreachItem ?? null,
    error: outreachItem === undefined || outreachItem === null ? { message: 'missing item' } : null,
  })
  const outreachEq = vi.fn().mockReturnValue({
    single: outreachSingle,
  })
  const outreachSelect = vi.fn().mockReturnValue({
    eq: outreachEq,
  })
  let updateCount = 0
  let persistedVersion = outreachItem?.updated_at
  const outreachUpdateEq = vi.fn()
  const outreachUpdate = vi.fn((payload: Record<string, unknown>) => {
    const call = ++updateCount
    let expectedVersion: unknown
    const mutation = {
      eq: vi.fn((key: string, value: unknown) => { outreachUpdateEq(key, value); if (key === 'updated_at') expectedVersion = value; return mutation }),
      select: vi.fn(() => {
        const matches = unmatchedUpdate !== call && (!atomicClaims || persistedVersion === expectedVersion)
        if (matches) persistedVersion = String(payload.updated_at)
        return Promise.resolve({ data: matches ? [{ id: outreachItem?.id, updated_at: payload.updated_at }] : [], error: call > 1 ? trackingError : null })
      }),
    }
    return mutation
  })

  let contactCommunicationsCall = 0
  const listQuery = (data: CommunicationRow[], error: { message: string } | null) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn().mockResolvedValue({ data, error }),
    }
    return query
  }

  mocks.from.mockImplementation((table: string) => {
    if (table === 'admin_gmail_user_credentials') {
      return {
        select: credentialsSelect,
      }
    }

    if (table === 'outreach_queue') {
      return {
        select: outreachSelect,
        update: outreachUpdate,
      }
    }

    if (table === 'contact_communications') {
      contactCommunicationsCall += 1
      return contactCommunicationsCall === 1
        ? listQuery(contactCommunications, contactCommunicationsError)
        : listQuery(existingDrafts, existingDraftsError)
    }

    if (table === 'email_messages') {
      return listQuery(emailMessages, emailMessagesError)
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    credentialsSelect,
    outreachSelect,
    outreachUpdate,
    outreachUpdateEq,
  }
}

function credentialsRow(googleEmail: string): CredentialsRow {
  return {
    refresh_token_cipher: 'cipher',
    refresh_token_iv: 'iv',
    refresh_token_tag: 'tag',
    google_email: googleEmail,
  }
}

function outreachRow(overrides: Partial<OutreachQueueRow> = {}): OutreachQueueRow {
  return {
    id: 'queue-1',
    contact_submission_id: 123,
    updated_at: '2026-09-08T00:00:00.000Z',
    status: 'approved',
    channel: 'email',
    subject: 'Queue subject',
    body: 'Queue body',
    thread_id: null,
    message_id: null,
    generation_inputs: {},
    contact_submissions: {
      id: 123,
      name: 'Alice Lead',
      email: 'alice@example.com',
      company: 'Acme',
      lead_source: 'warm_google_contacts',
      outreach_status: null,
      do_not_contact: false,
      removed_at: null,
      relationship_strength: 'moderate',
      warm_source_detail: 'Prior Portfolio relationship context',
    },
    ...overrides,
  }
}

describe('POST /api/admin/outreach/[id]/gmail-user-draft', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.BUSINESS_FROM_EMAIL = '"AmaduTown" <vambah@amadutown.com>'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(true)
    mocks.isGmailUserOauthSecretConfigured.mockReturnValue(true)
    mocks.decryptRefreshToken.mockReturnValue('refresh-token')
    mocks.createUserGmailDraft.mockResolvedValue({
      id: 'gmail-draft-1',
      messageId: 'gmail-message-1',
      threadId: 'gmail-thread-1',
    })
    mocks.updateUserGmailDraft.mockResolvedValue({ id: 'gmail-draft-1', messageId: 'updated-message-1', threadId: 'gmail-thread-1' })
    mocks.logCommunication.mockResolvedValue(undefined)
  })

  it('updates the same known draft after revised copy approval, archives prior authority and allows fresh review', async () => {
    const row = outreachRow({ body: 'Approved revised copy', generation_inputs: {
      copy_revision_requires_provider_reconciliation: true,
      gmail_draft_creation: { draft_id: 'gmail-draft-1', thread_id: 'gmail-thread-1', final_copy_fingerprint: 'old-fingerprint' },
      warm_gmail_send_authorization: { status: 'approved', final_copy_fingerprint: 'old-fingerprint' },
      warm_gmail_send_slack_approval_request: { status: 'pending', final_copy_fingerprint: 'old-fingerprint' },
      warm_gmail_review_slack_delivery: { state: 'sent', slack_message_ts: '123.456' },
    } })
    const { outreachUpdate } = mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row })
    const preparation = await POST(makeRequest({ noSendSmoke: true, prepareDraftUpdate: true }), params())
    const readiness = await preparation.json()
    expect(preparation.status).toBe(200)
    expect(outreachUpdate).not.toHaveBeenCalled()
    const payload = buildWarmGmailActionRequest('update', readiness, { ...row, updatedAt: row.updated_at })
    const response = await POST(makeRequest(payload), params())
    expect(response.status).toBe(200)
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
    expect(mocks.updateUserGmailDraft).toHaveBeenCalledWith('refresh-token', 'gmail-draft-1', { to: 'alice@example.com', subject: 'Queue subject', body: 'Approved revised copy' })
    expect(outreachUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ generation_inputs: expect.objectContaining({
      copy_revision_requires_provider_reconciliation: false, warm_gmail_send_authorization: null, warm_gmail_send_slack_approval_request: null, warm_gmail_review_slack_delivery: null,
      gmail_draft_creation: expect.objectContaining({ draft_id: 'gmail-draft-1', message_id: 'updated-message-1', final_copy_fingerprint: warmFinalCopyFingerprint(row) }),
      warm_gmail_mailbox_revision_history: [expect.objectContaining({ authorization: expect.objectContaining({ final_copy_fingerprint: 'old-fingerprint' }) })],
    }) }))
  })

  it('allows only one concurrent update of a known revised draft', async () => {
    const row = outreachRow({ generation_inputs: { copy_revision_requires_provider_reconciliation: true, gmail_draft_creation: { draft_id: 'gmail-draft-1', thread_id: 'gmail-thread-1' } } })
    mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row, atomicClaims: true })
    const readiness = await (await POST(makeRequest({ noSendSmoke: true, prepareDraftUpdate: true }), params())).json()
    const payload = buildWarmGmailActionRequest('update', readiness, { ...row, updatedAt: row.updated_at })
    const responses = await Promise.all([POST(makeRequest(payload), params()), POST(makeRequest(payload), params())])
    expect(responses.map(response => response.status).sort()).toEqual([200, 409])
    expect(mocks.updateUserGmailDraft).toHaveBeenCalledTimes(1)
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('locks an uncertain update and never creates a replacement draft', async () => {
    const row = outreachRow({ generation_inputs: { copy_revision_requires_provider_reconciliation: true, gmail_draft_creation: { draft_id: 'gmail-draft-1', thread_id: 'gmail-thread-1' } } })
    const { outreachUpdate } = mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row })
    mocks.updateUserGmailDraft.mockRejectedValue(new Error('timeout after update'))
    const readiness = await (await POST(makeRequest({ noSendSmoke: true, prepareDraftUpdate: true }), params())).json()
    expect((await POST(makeRequest(buildWarmGmailActionRequest('update', readiness, { ...row, updatedAt: row.updated_at })), params())).status).toBe(502)
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ generation_inputs: expect.objectContaining({ copy_revision_requires_provider_reconciliation: true, warm_gmail_draft_creation_attempt: expect.objectContaining({ status: 'outcome_unknown', action: 'update' }) }) }))
  })

  it('uses the real no-send readiness packet for explicit UI mailbox creation', async () => {
    const row = outreachRow()
    const { outreachUpdate } = mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row })
    const prepared = await POST(makeRequest({ noSendSmoke: true }), params())
    const readiness = await prepared.json()
    expect(outreachUpdate).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
    const payload = buildWarmGmailActionRequest('draft', readiness, { ...row, updatedAt: row.updated_at })
    const response = await POST(makeRequest(payload), params())
    expect(response.status).toBe(200)
    expect(mocks.createUserGmailDraft).toHaveBeenCalledTimes(1)
  })

  it('does not prepare approval for unsaved smoke copy', async () => {
    mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: outreachRow() })
    expect((await POST(makeRequest({ noSendSmoke: true, body: 'Unsaved different copy' }), params())).status).toBe(409)
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('lets only one concurrent claim create a mailbox draft', async () => {
    const row = outreachRow()
    mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row, atomicClaims: true })
    const responses = await Promise.all([POST(makeRequest(authorizedPayload(row)), params()), POST(makeRequest(authorizedPayload(row)), params())])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    expect(mocks.createUserGmailDraft).toHaveBeenCalledTimes(1)
  })

  it.each([1, 2])('fails closed when mutation %s loses its row version', async (unmatchedUpdate) => {
    const row = outreachRow()
    const { outreachUpdateEq } = mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row, unmatchedUpdate })
    const response = await POST(makeRequest(authorizedPayload(row)), params())
    expect(response.status).toBe(unmatchedUpdate === 1 ? 409 : 502)
    const result = await response.json()
    expect(result.actionOutcome).toBe(unmatchedUpdate === 1 ? 'rejected_before_external_action' : undefined)
    expect(mocks.createUserGmailDraft).toHaveBeenCalledTimes(unmatchedUpdate === 1 ? 0 : 1)
    expect(outreachUpdateEq).toHaveBeenCalledWith('updated_at', row.updated_at)
    expect(outreachUpdateEq).toHaveBeenCalledWith('status', row.status)
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it.each(['creating', 'outcome_unknown'])('blocks retry of %s mailbox attempts before provider calls', async status => {
    const row = outreachRow({ generation_inputs: { warm_gmail_draft_creation_attempt: { status } } })
    const { outreachUpdate } = mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row })
    expect((await POST(makeRequest(authorizedPayload(row)), params())).status).toBe(409)
    expect(outreachUpdate).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it.each([{ expectedUpdatedAt: 'stale' }, { finalCopyFingerprint: 'stale' }])('rejects stale reviewed copy authorization: %j', async change => {
    const row = outreachRow()
    const { outreachUpdate } = mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row })
    expect((await POST(makeRequest(authorizedPayload(row, change)), params())).status).toBe(403)
    expect(outreachUpdate).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('requires reconciliation of an old mailbox draft without exact-copy evidence', async () => {
    const row = outreachRow({ thread_id: 'old-thread' })
    mockSupabase({ credentials: credentialsRow('vambah@amadutown.com'), outreachItem: row })
    expect((await POST(makeRequest(authorizedPayload(row)), params())).status).toBe(409)
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated requests before checking credentials or Gmail', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('blocks missing Gmail OAuth server configuration', async () => {
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(false)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Gmail account connection is not configured for this site.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('blocks when the admin has no connected Gmail credential', async () => {
    mockSupabase({
      credentials: null,
      outreachItem: outreachRow(),
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error:
        'Connect your Gmail account first (admin: Google sign-in for Gmail drafts).',
    })
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('blocks a connected Gmail account that is not the configured AmaduTown sender', async () => {
    const { outreachSelect } = mockSupabase({
      credentials: credentialsRow('personal@gmail.com'),
      outreachItem: outreachRow(),
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error:
        'Customer-facing Gmail drafts must be created from vambah@amadutown.com. Reconnect Gmail with that account before saving this draft.',
    })
    expect(outreachSelect).not.toHaveBeenCalled()
    expect(mocks.decryptRefreshToken).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('requires explicit per-recipient authorization before creating a Gmail draft', async () => {
    const { outreachUpdate } = mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: outreachRow(),
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error:
        'Explicit per-recipient Gmail draft authorization is required before creating a provider draft.',
      externalSendBlocked: true,
    })
    expect(mocks.decryptRefreshToken).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).not.toHaveBeenCalled()
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('normalizes the connected Gmail identity before creating and logging the draft', async () => {
    const row = outreachRow()
    mockSupabase({
      credentials: credentialsRow('  VAMBAH@AMADUTOWN.COM  '),
      outreachItem: row,
    })

    const response = await POST(
      makeRequest(authorizedPayload(row)),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      message:
        'Draft saved in Gmail for review. No email was sent; sending remains blocked.',
      draftId: 'gmail-draft-1',
      messageId: 'gmail-message-1',
      threadId: 'gmail-thread-1',
      openGmailUrl: 'https://mail.google.com/mail/#drafts',
      idempotencyKey: expectedIdempotencyKey(row),
      gmailDraftCreated: true,
      externalSendBlocked: true,
      externalSendEnabled: false,
      duplicateDraftEvidence: {
        createdOnce: true,
        duplicatePrevented: false,
        draftId: 'gmail-draft-1',
        messageId: 'gmail-message-1',
        threadId: 'gmail-thread-1',
        communicationId: null,
        idempotencyKey: expectedIdempotencyKey(row),
        noSendStatus: 'no_send',
      },
    })
    expect(mocks.decryptRefreshToken).toHaveBeenCalledWith('cipher', 'iv', 'tag')
    expect(mocks.createUserGmailDraft).toHaveBeenCalledWith('refresh-token', {
      to: 'alice@example.com',
      subject: 'Queue subject',
      body: 'Queue body',
    })
    expect(mocks.logCommunication).toHaveBeenCalledWith(
      expect.objectContaining({
        contactSubmissionId: 123,
        channel: 'email',
        direction: 'outbound',
        subject: 'Queue subject',
        body: 'Queue body',
        sentBy: 'admin-user-1',
        recipientEmail: 'alice@example.com',
        metadata: expect.objectContaining({
          outreach_queue_id: 'queue-1',
          gmail_user_draft_id: 'gmail-draft-1',
          gmail_user_message_id: 'gmail-message-1',
          gmail_user_thread_id: 'gmail-thread-1',
          gmail_connected_as: '  VAMBAH@AMADUTOWN.COM  ',
          gmail_draft_idempotency_key: expectedIdempotencyKey(row),
          external_send_blocked: true,
          warm_outreach_gmail_draft_authorization: expect.objectContaining({
            idempotency_key: expectedIdempotencyKey(row),
            authorization: 'create_gmail_draft_for_recipient',
            contact_submission_id: 123,
            recipient_email: 'alice@example.com',
            channel: 'email',
            authorized_by: 'admin-user-1',
            external_send_blocked: true,
          }),
        }),
      }),
    )
  })

  it('persists Gmail thread tracking before returning the draft as usable', async () => {
    const row = outreachRow()
    const { outreachUpdate, outreachUpdateEq } = mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: row,
    })

    const response = await POST(makeRequest(authorizedPayload(row)), params())

    expect(response.status).toBe(200)
    expect(outreachUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        thread_id: 'gmail-thread-1',
        message_id: 'gmail-message-1',
        generation_inputs: expect.objectContaining({
          gmail_draft_creation: expect.objectContaining({
            provider: 'gmail_user_oauth',
            provider_action: 'drafts.create',
            draft_id: 'gmail-draft-1',
            message_id: 'gmail-message-1',
            thread_id: 'gmail-thread-1',
            idempotency_key: expectedIdempotencyKey(row),
            authorization: 'create_gmail_draft_for_recipient',
            external_send_blocked: true,
          }),
        }),
        updated_at: expect.any(String),
      }),
    )
    expect(outreachUpdateEq).toHaveBeenCalledWith('id', 'queue-1')
  })

  it('runs a no-send smoke without creating a Gmail draft or writing tracking', async () => {
    const { outreachUpdate } = mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: outreachRow(),
    })

    const response = await POST(makeRequest({ noSendSmoke: true }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      message:
        'No-send Gmail draft smoke passed. No Gmail draft was created and no email was sent.',
      reviewedCopy: { queueId: 'queue-1', recipientEmail: 'alice@example.com', subject: 'Queue subject', body: 'Queue body', sender: 'vambah@amadutown.com', updatedAt: outreachRow().updated_at },
      noSendSmoke: true,
      wouldCreateDraft: true,
      queueId: 'queue-1',
      to: 'alice@example.com',
      subject: 'Queue subject',
      bodyChars: 'Queue body'.length,
      requiredSender: 'vambah@amadutown.com',
      connectedAs: 'vambah@amadutown.com',
      expectedAuthorization: {
        expectedUpdatedAt: outreachRow().updated_at,
        finalCopyFingerprint: warmFinalCopyFingerprint(outreachRow()),
        createGmailDraft: true,
        draftAuthorization: 'create_gmail_draft_for_recipient',
        contactSubmissionId: 123,
        recipientEmail: 'alice@example.com',
        channel: 'email',
        idempotencyKey: expectedIdempotencyKey(),
      },
      providerDraftCanaryReadiness: {
        version: 'warm-outreach-provider-gmail-draft-canary-readiness/v1',
        state: 'ready_for_explicit_provider_draft_approval',
        label: 'Provider draft canary ready',
        queueId: 'queue-1',
        contactSubmissionId: 123,
        recipientEmail: 'alice@example.com',
        requiredSender: 'vambah@amadutown.com',
        connectedAs: 'vambah@amadutown.com',
        expectedAuthorization: {
          expectedUpdatedAt: outreachRow().updated_at,
        finalCopyFingerprint: warmFinalCopyFingerprint(outreachRow()),
        createGmailDraft: true,
          draftAuthorization: 'create_gmail_draft_for_recipient',
          contactSubmissionId: 123,
          recipientEmail: 'alice@example.com',
          channel: 'email',
          idempotencyKey: expectedIdempotencyKey(),
        },
        exactApprovalSentence:
          'Create one Gmail provider draft for outreach queue queue-1 and contact 123 using authorization create_gmail_draft_for_recipient. Do not send email.',
        executionBoundary: {
          providerCallsEnabled: false,
          gmailDraftCreated: false,
          trackingPersisted: false,
          externalSendEnabled: false,
          liveProviderCallRequiresSeparateApproval: true,
        },
      },
      externalSendBlocked: true,
    })
    expect(mocks.decryptRefreshToken).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).not.toHaveBeenCalled()
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('keeps sender identity as a no-send smoke gate', async () => {
    const { outreachSelect } = mockSupabase({
      credentials: credentialsRow('personal@gmail.com'),
      outreachItem: outreachRow(),
    })

    const response = await POST(makeRequest({ noSendSmoke: true }), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error:
        'Customer-facing Gmail drafts must be created from vambah@amadutown.com. Reconnect Gmail with that account before saving this draft.',
    })
    expect(outreachSelect).not.toHaveBeenCalled()
    expect(mocks.decryptRefreshToken).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('fails closed when Gmail does not return a thread id for reply tracking', async () => {
    const row = outreachRow()
    mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: row,
    })
    mocks.createUserGmailDraft.mockResolvedValue({
      id: 'gmail-draft-1',
      messageId: 'gmail-message-1',
    })

    const response = await POST(makeRequest(authorizedPayload(row)), params())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      error:
        'Gmail returned incomplete draft evidence. Reconcile the mailbox before retrying; creation outcome is unknown.',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('fails closed when Portfolio cannot persist Gmail thread tracking', async () => {
    const row = outreachRow()
    mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: row,
      trackingError: { message: 'update failed' },
    })

    const response = await POST(makeRequest(authorizedPayload(row)), params())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      error:
        'Gmail created the draft, but Portfolio could not save thread tracking. Do not send this draft from Gmail until tracking is repaired.',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('returns existing draft evidence instead of creating a duplicate Gmail draft', async () => {
    const row = outreachRow({ thread_id: 'gmail-thread-1', message_id: 'gmail-message-1', generation_inputs: { gmail_draft_creation: { final_copy_fingerprint: warmFinalCopyFingerprint(outreachRow()) } } })
    const { outreachUpdate } = mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: row,
      existingDrafts: [
        {
          id: 'comm-1',
          metadata: {
            gmail_user_draft_id: 'gmail-draft-1',
            gmail_user_message_id: 'gmail-message-1',
            gmail_user_thread_id: 'gmail-thread-1',
            gmail_draft_idempotency_key: expectedIdempotencyKey(row),
          },
        },
      ],
    })

    const response = await POST(makeRequest(authorizedPayload(row)), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      message:
        'Gmail draft already exists for this recipient and message. No new draft was created.',
      existingDraft: true,
      duplicatePrevented: true,
      draftId: 'gmail-draft-1',
      threadId: 'gmail-thread-1',
      messageId: 'gmail-message-1',
      communicationId: 'comm-1',
      idempotencyKey: expectedIdempotencyKey(row),
      externalSendBlocked: true,
      externalSendEnabled: false,
      duplicateDraftEvidence: {
        createdOnce: true,
        duplicatePrevented: true,
        draftId: 'gmail-draft-1',
        threadId: 'gmail-thread-1',
        messageId: 'gmail-message-1',
        communicationId: 'comm-1',
        idempotencyKey: expectedIdempotencyKey(row),
        noSendStatus: 'no_send',
      },
    })
    expect(mocks.decryptRefreshToken).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
    expect(outreachUpdate).not.toHaveBeenCalled()
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('fails closed when suppression evidence is present', async () => {
    const row = outreachRow()
    row.contact_submissions!.do_not_contact = true
    mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: row,
    })

    const response = await POST(makeRequest(authorizedPayload(row)), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'This contact is suppressed or blocked from outreach.',
    })
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('fails closed when relationship evidence is missing', async () => {
    const row = outreachRow()
    row.contact_submissions = {
      ...row.contact_submissions!,
      lead_source: 'cold_website',
      relationship_strength: null,
      warm_source_detail: null,
    }
    mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: row,
      contactCommunications: [],
      emailMessages: [],
    })

    const response = await POST(makeRequest(authorizedPayload(row)), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error:
        'Relationship evidence is required before creating a Gmail draft for this warm outreach item.',
    })
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('fails closed when Gmail draft creation fails', async () => {
    const row = outreachRow()
    const { outreachUpdate } = mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: row,
    })
    mocks.createUserGmailDraft.mockRejectedValue(new Error('provider unavailable'))

    const response = await POST(makeRequest(authorizedPayload(row)), params())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      error:
        'Gmail draft outcome is unknown. Reconcile the mailbox before retrying; another draft will not be created automatically.',
    })
    expect(outreachUpdate).toHaveBeenCalledWith(expect.objectContaining({ generation_inputs: expect.objectContaining({ warm_gmail_draft_creation_attempt: expect.objectContaining({ status: 'outcome_unknown' }) }) }))
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })
})
