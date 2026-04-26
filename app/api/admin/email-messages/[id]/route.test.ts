import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fromMock, verifyAdminMock, isAuthErrorMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  verifyAdminMock: vi.fn(),
  isAuthErrorMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: fromMock },
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: verifyAdminMock,
  isAuthError: isAuthErrorMock,
}))

import { GET } from './route'

type DbResult = { data?: unknown; error?: { message: string } | null }

function createMaybeSingleBuilder(result: DbResult) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.maybeSingle = vi.fn().mockResolvedValue(result)
  return builder
}

function makeRequest() {
  return new Request('http://localhost/api/admin/email-messages/msg-1')
}

describe('GET /api/admin/email-messages/[id]', () => {
  beforeEach(() => {
    fromMock.mockReset()
    verifyAdminMock.mockResolvedValue({ user: { id: 'admin-user' } })
    isAuthErrorMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('requires admin authentication before querying email data', async () => {
    verifyAdminMock.mockResolvedValue({ error: 'Forbidden', status: 403 })
    isAuthErrorMock.mockReturnValue(true)

    const response = await GET(makeRequest() as any, { params: { id: 'msg-1' } })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns the full body from contact_communications before falling back to other sources', async () => {
    const messageBuilder = createMaybeSingleBuilder({
      data: {
        id: 'msg-1',
        email_kind: 'outreach',
        channel: 'email',
        contact_submission_id: 42,
        contact_communication_id: 'comm-1',
        recipient_email: 'lead@example.com',
        subject: 'Hello',
        body_preview: 'Preview',
        direction: 'outbound',
        status: 'draft',
        transport: 'gmail',
        source_system: 'outreach_queue',
        source_id: 'queue-1',
        external_id: null,
        sent_at: null,
        created_at: '2026-04-24T10:00:00.000Z',
        metadata: {},
        context_json: {},
      },
      error: null,
    })
    const communicationBuilder = createMaybeSingleBuilder({
      data: { body: 'Full body from contact communication' },
      error: null,
    })
    const contactBuilder = createMaybeSingleBuilder({
      data: { id: 42, name: 'Lead Name', email: 'lead@example.com', company: 'Acme' },
      error: null,
    })

    const queue = [messageBuilder, communicationBuilder, contactBuilder]
    fromMock.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from() call')
      return next
    })

    const response = await GET(makeRequest() as any, { params: { id: 'msg-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      message: { id: 'msg-1', contact_communication_id: 'comm-1' },
      full_body: 'Full body from contact communication',
      full_body_source: 'contact_communications',
      contact: { id: 42, name: 'Lead Name', email: 'lead@example.com', company: 'Acme' },
    })
    expect(fromMock).toHaveBeenNthCalledWith(1, 'email_messages')
    expect(fromMock).toHaveBeenNthCalledWith(2, 'contact_communications')
    expect(fromMock).toHaveBeenNthCalledWith(3, 'contact_submissions')
  })

  it('falls back to outreach_queue body when no contact communication body exists', async () => {
    const messageBuilder = createMaybeSingleBuilder({
      data: {
        id: 'msg-2',
        contact_submission_id: null,
        contact_communication_id: null,
        source_system: 'outreach_queue',
        source_id: 'queue-2',
      },
      error: null,
    })
    const outreachQueueBuilder = createMaybeSingleBuilder({
      data: { body: 'Full body from outreach queue', subject: 'Generated draft' },
      error: null,
    })

    const queue = [messageBuilder, outreachQueueBuilder]
    fromMock.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from() call')
      return next
    })

    const response = await GET(makeRequest() as any, { params: { id: 'msg-2' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      message: { id: 'msg-2', source_system: 'outreach_queue', source_id: 'queue-2' },
      full_body: 'Full body from outreach queue',
      full_body_source: 'outreach_queue',
      contact: null,
    })
    expect(fromMock).toHaveBeenNthCalledWith(1, 'email_messages')
    expect(fromMock).toHaveBeenNthCalledWith(2, 'outreach_queue')
  })

  it('returns a 404 when the email message does not exist', async () => {
    fromMock.mockReturnValue(createMaybeSingleBuilder({ data: null, error: null }))

    const response = await GET(makeRequest() as any, { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Email not found' })
  })
})
