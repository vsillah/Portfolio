import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  decryptRefreshToken: vi.fn(),
  createUserGmailDraft: vi.fn(),
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
  const outreachUpdateEq = vi.fn().mockResolvedValue({
    data: null,
    error: trackingError,
  })
  const outreachUpdate = vi.fn().mockReturnValue({
    eq: outreachUpdateEq,
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

function outreachRow(): OutreachQueueRow {
  return {
    id: 'queue-1',
    contact_submission_id: 123,
    status: 'draft',
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
    mocks.logCommunication.mockResolvedValue(undefined)
  })

  it('rejects unauthenticated requests before checking credentials or Gmail', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.createUserGmailDraft).not.toHaveBeenCalled()
  })

  it('blocks missing Gmail OAuth server configuration', async () => {
    mocks.isGmailUserOAuthClientConfigured.mockReturnValue(false)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
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
    await expect(response.json()).resolves.toEqual({
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
    await expect(response.json()).resolves.toEqual({
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
    await expect(response.json()).resolves.toEqual({
      message:
        'Draft saved in Gmail for review. No email was sent; sending remains blocked.',
      draftId: 'gmail-draft-1',
      threadId: 'gmail-thread-1',
      openGmailUrl: 'https://mail.google.com/mail/#drafts',
      idempotencyKey: expectedIdempotencyKey(row),
      externalSendBlocked: true,
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
    await expect(response.json()).resolves.toEqual({
      message:
        'No-send Gmail draft smoke passed. No Gmail draft was created and no email was sent.',
      noSendSmoke: true,
      wouldCreateDraft: true,
      queueId: 'queue-1',
      to: 'alice@example.com',
      subject: 'Queue subject',
      bodyChars: 'Queue body'.length,
      requiredSender: 'vambah@amadutown.com',
      connectedAs: 'vambah@amadutown.com',
      expectedAuthorization: {
        createGmailDraft: true,
        draftAuthorization: 'create_gmail_draft_for_recipient',
        contactSubmissionId: 123,
        recipientEmail: 'alice@example.com',
        channel: 'email',
        idempotencyKey: expectedIdempotencyKey(),
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
    await expect(response.json()).resolves.toEqual({
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
    await expect(response.json()).resolves.toEqual({
      error:
        'Gmail created the draft, but did not return a thread id. Reply tracking is not safe for this draft.',
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
    await expect(response.json()).resolves.toEqual({
      error:
        'Gmail created the draft, but Portfolio could not save thread tracking. Do not send this draft from Gmail until tracking is repaired.',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('returns existing draft evidence instead of creating a duplicate Gmail draft', async () => {
    const row = outreachRow({ thread_id: 'gmail-thread-1', message_id: 'gmail-message-1' })
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
    await expect(response.json()).resolves.toEqual({
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
    await expect(response.json()).resolves.toEqual({
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
    await expect(response.json()).resolves.toEqual({
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
    await expect(response.json()).resolves.toEqual({
      error:
        'Gmail could not create the draft. Try reconnecting your Gmail account.',
    })
    expect(outreachUpdate).not.toHaveBeenCalled()
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })
})
