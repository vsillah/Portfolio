import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  isTransactionalMailConfigured: vi.fn(),
  sendEmailWithOutcome: vi.fn(),
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

vi.mock('@/lib/email/deliver-transactional', () => ({
  isTransactionalMailConfigured: mocks.isTransactionalMailConfigured,
}))

vi.mock('@/lib/notifications', () => ({
  sendEmailWithOutcome: mocks.sendEmailWithOutcome,
}))

vi.mock('@/lib/communications', () => ({
  logCommunication: mocks.logCommunication,
}))

import { POST } from './route'

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

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest(
    'http://localhost/api/admin/outreach/queue-1/email-draft-to-inbox',
    {
      method: 'POST',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  )
}

function params(id = 'queue-1') {
  return { params: Promise.resolve({ id }) }
}

function outreachRow(overrides: Partial<OutreachQueueRow> = {}): OutreachQueueRow {
  const { contact_submissions, ...rest } = overrides
  return {
    id: 'queue-1',
    contact_submission_id: 123,
    status: 'draft',
    channel: 'email',
    subject: 'Queue subject',
    body: 'Queue body',
    contact_submissions:
      contact_submissions === undefined
        ? {
            id: 123,
            name: 'Alice <Lead>',
            email: 'alice@example.com',
            company: 'Acme & Co',
          }
        : contact_submissions,
    ...rest,
  }
}

function mockOutreachItem(item: OutreachQueueRow | null) {
  const single = vi.fn().mockResolvedValue({
    data: item,
    error: item ? null : { message: 'not found' },
  })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'outreach_queue') {
      return { select }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
  return { select, eq, single }
}

describe('POST /api/admin/outreach/[id]/email-draft-to-inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({
      user: { id: 'admin-user-1', email: 'admin@amadutown.com' },
    })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isTransactionalMailConfigured.mockReturnValue(true)
    mocks.sendEmailWithOutcome.mockResolvedValue({ ok: true, transport: 'resend' })
    mocks.logCommunication.mockResolvedValue(undefined)
  })

  it('rejects unauthenticated requests before looking up the queue item', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.sendEmailWithOutcome).not.toHaveBeenCalled()
  })

  it('requires an admin account email before sending a copy', async () => {
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1', email: '   ' } })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Your account has no email on file. Add an email to your profile, then try again.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.sendEmailWithOutcome).not.toHaveBeenCalled()
  })

  it('fails closed when transactional mail is not configured', async () => {
    mocks.isTransactionalMailConfigured.mockReturnValue(false)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Email delivery is not configured for this site.',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the outreach item is missing', async () => {
    mockOutreachItem(null)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Outreach item not found.',
    })
    expect(mocks.sendEmailWithOutcome).not.toHaveBeenCalled()
  })

  it('blocks sent or rejected items from being copied to inbox', async () => {
    mockOutreachItem(outreachRow({ status: 'sent' }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Only draft or approved items can be copied to your inbox.',
    })
    expect(mocks.sendEmailWithOutcome).not.toHaveBeenCalled()
  })

  it('rejects oversized body overrides before sending mail', async () => {
    mockOutreachItem(outreachRow())

    const response = await POST(
      makeRequest({ body: 'x'.repeat(500_001) }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error:
        'Message is too long to email. Save a shorter version or copy from the preview.',
    })
    expect(mocks.sendEmailWithOutcome).not.toHaveBeenCalled()
  })

  it('emails an escaped copy with overrides and logs the outbound communication', async () => {
    mockOutreachItem(outreachRow({ status: 'approved' }))

    const response = await POST(
      makeRequest({ subject: 'Override <subject>', body: 'Body with <script>' }),
      params(),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'A copy was sent to your account email.',
    })

    expect(mocks.sendEmailWithOutcome).toHaveBeenCalledTimes(1)
    const mailArgs = mocks.sendEmailWithOutcome.mock.calls[0][0] as {
      to: string
      subject: string
      html: string
      text: string
    }
    expect(mailArgs.to).toBe('admin@amadutown.com')
    expect(mailArgs.subject).toBe(
      '[Email center copy] Override <subject> — Alice <Lead>',
    )
    expect(mailArgs.text).toContain('Override <subject>')
    expect(mailArgs.text).toContain('Body with <script>')
    expect(mailArgs.html).toContain('Alice &lt;Lead&gt;')
    expect(mailArgs.html).toContain('Acme &amp; Co')
    expect(mailArgs.html).toContain('Override &lt;subject&gt;')
    expect(mailArgs.html).toContain('Body with &lt;script&gt;')
    expect(mailArgs.html).not.toContain('<script>')

    expect(mocks.logCommunication).toHaveBeenCalledWith(
      expect.objectContaining({
        contactSubmissionId: 123,
        channel: 'email',
        direction: 'outbound',
        messageType: 'manual',
        status: 'sent',
        sentBy: 'admin-user-1',
        emailTransport: 'resend',
        metadata: expect.objectContaining({
          outreach_queue_id: 'queue-1',
          admin_inbox_copy: true,
        }),
      }),
    )
  })

  it('returns a generic 502 when delivery fails', async () => {
    mockOutreachItem(outreachRow())
    mocks.sendEmailWithOutcome.mockResolvedValue({ ok: false, transport: 'resend' })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Something went wrong sending the email. Please try again.',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })
})
