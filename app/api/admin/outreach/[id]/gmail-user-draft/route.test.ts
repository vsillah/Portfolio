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
  contact_submissions: {
    id: number
    name: string
    email: string
    company: string | null
  } | null
}

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(overrides: Record<string, string> = {}) {
  return new NextRequest(
    'http://localhost/api/admin/outreach/queue-1/gmail-user-draft',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(overrides),
    },
  )
}

function params(id = 'queue-1') {
  return { params: Promise.resolve({ id }) }
}

function mockSupabase({
  credentials,
  outreachItem,
  trackingError = null,
}: {
  credentials: CredentialsRow | null
  outreachItem?: OutreachQueueRow | null
  trackingError?: { message: string } | null
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
    contact_submissions: {
      id: 123,
      name: 'Alice Lead',
      email: 'alice@example.com',
      company: 'Acme',
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

  it('normalizes the connected Gmail identity before creating and logging the draft', async () => {
    mockSupabase({
      credentials: credentialsRow('  VAMBAH@AMADUTOWN.COM  '),
      outreachItem: outreachRow(),
    })

    const response = await POST(
      makeRequest({ subject: 'Override subject', body: 'Override body' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Draft saved in your Gmail. Open Gmail to review and send.',
      draftId: 'gmail-draft-1',
      threadId: 'gmail-thread-1',
      openGmailUrl: 'https://mail.google.com/mail/#drafts',
    })
    expect(mocks.decryptRefreshToken).toHaveBeenCalledWith('cipher', 'iv', 'tag')
    expect(mocks.createUserGmailDraft).toHaveBeenCalledWith('refresh-token', {
      to: 'alice@example.com',
      subject: 'Override subject',
      body: 'Override body',
    })
    expect(mocks.logCommunication).toHaveBeenCalledWith(
      expect.objectContaining({
        contactSubmissionId: 123,
        channel: 'email',
        direction: 'outbound',
        subject: 'Override subject',
        body: 'Override body',
        sentBy: 'admin-user-1',
        metadata: expect.objectContaining({
          outreach_queue_id: 'queue-1',
          gmail_user_draft_id: 'gmail-draft-1',
          gmail_user_message_id: 'gmail-message-1',
          gmail_user_thread_id: 'gmail-thread-1',
          gmail_connected_as: '  VAMBAH@AMADUTOWN.COM  ',
        }),
      }),
    )
  })

  it('persists Gmail thread tracking before returning the draft as usable', async () => {
    const { outreachUpdate, outreachUpdateEq } = mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: outreachRow(),
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    expect(outreachUpdate).toHaveBeenCalledWith({
      thread_id: 'gmail-thread-1',
      message_id: 'gmail-message-1',
      updated_at: expect.any(String),
    })
    expect(outreachUpdateEq).toHaveBeenCalledWith('id', 'queue-1')
  })

  it('fails closed when Gmail does not return a thread id for reply tracking', async () => {
    mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: outreachRow(),
    })
    mocks.createUserGmailDraft.mockResolvedValue({
      id: 'gmail-draft-1',
      messageId: 'gmail-message-1',
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error:
        'Gmail created the draft, but did not return a thread id. Reply tracking is not safe for this draft.',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('fails closed when Portfolio cannot persist Gmail thread tracking', async () => {
    mockSupabase({
      credentials: credentialsRow('vambah@amadutown.com'),
      outreachItem: outreachRow(),
      trackingError: { message: 'update failed' },
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error:
        'Gmail created the draft, but Portfolio could not save thread tracking. Do not send this draft from Gmail until tracking is repaired.',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })
})
