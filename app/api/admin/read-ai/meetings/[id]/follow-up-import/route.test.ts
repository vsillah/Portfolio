import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  importReadAiFollowUp: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: (result: { error?: string }) => Boolean(result && 'error' in result),
}))

vi.mock('@/lib/read-ai-follow-up-import', () => ({
  importReadAiFollowUp: mocks.importReadAiFollowUp,
}))

import { POST } from './route'

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/admin/read-ai/meetings/meet%201/follow-up-import', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/admin/read-ai/meetings/[id]/follow-up-import', () => {
  const originalSecret = process.env.N8N_INGEST_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'test-secret'
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.importReadAiFollowUp.mockResolvedValue({ contactId: 7 })
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.N8N_INGEST_SECRET
    else process.env.N8N_INGEST_SECRET = originalSecret
  })

  it('rejects callers who are neither admin nor the ingest secret', async () => {
    const response = await POST(
      request({ contact_name: 'Ada', contact_email: 'ada@example.com' }, { authorization: 'Bearer wrong' }),
      { params: { id: 'meet 1' } },
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.importReadAiFollowUp).not.toHaveBeenCalled()
  })

  it('accepts the ingest secret without an admin user id', async () => {
    const response = await POST(
      request({
        contactName: ' Ada Lovelace ',
        contactEmail: ' ada@example.com ',
        company: ' Analytical ',
        projectName: ' Engine ',
        draftSubject: ' Follow up ',
        draftBody: ' Thanks for the meeting. ',
        gmailDraftId: ' draft-1 ',
        meeting: { transcript: 'hello' },
      }, { authorization: 'bearer test-secret' }),
      { params: { id: ' meet 1 ' } },
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ success: true, result: { contactId: 7 } })
    expect(mocks.importReadAiFollowUp).toHaveBeenCalledWith(
      {
        readAiMeetingId: ' meet 1 ',
        contactName: 'Ada Lovelace',
        contactEmail: 'ada@example.com',
        company: 'Analytical',
        projectName: 'Engine',
        userId: undefined,
        draft: {
          subject: 'Follow up',
          body: 'Thanks for the meeting.',
          gmailDraftId: 'draft-1',
          gmailThreadId: null,
          gmailMessageId: null,
          sourceEmailThreadId: null,
        },
      },
      { meeting: { transcript: 'hello' } },
    )
  })

  it('stamps the admin user and ignores a non-object meeting payload', async () => {
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })

    const response = await POST(
      request({
        contact_name: 'Ada',
        contact_email: 'ada@example.com',
        meeting: 'not-an-object',
      }),
      { params: { id: 'meet-1' } },
    )

    expect(response.status).toBe(201)
    expect(mocks.importReadAiFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({
        readAiMeetingId: 'meet-1',
        userId: 'admin-1',
        draft: null,
      }),
      undefined,
    )
  })

  it('requires both contact fields and a complete draft pair', async () => {
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    const missingContact = await POST(
      request({ contact_name: '   ', contact_email: 'ada@example.com' }),
      { params: { id: 'meet-1' } },
    )
    expect(missingContact.status).toBe(400)
    expect(await missingContact.json()).toEqual({ error: 'contact_name and contact_email are required' })

    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    const halfDraft = await POST(
      request({
        contact_name: 'Ada',
        contact_email: 'ada@example.com',
        draft_subject: 'Only subject',
      }),
      { params: { id: 'meet-1' } },
    )
    expect(halfDraft.status).toBe(400)
    expect(await halfDraft.json()).toEqual({ error: 'draft_subject and draft_body must be provided together' })
    expect(mocks.importReadAiFollowUp).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON and returns importer error messages', async () => {
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    const invalid = await POST(request('{'), { params: { id: 'meet-1' } })
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Invalid JSON body' })

    mocks.importReadAiFollowUp.mockRejectedValueOnce(new Error('contact conflict'))
    const failed = await POST(
      request({ contact_name: 'Ada', contact_email: 'ada@example.com' }),
      { params: { id: 'meet-1' } },
    )
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'contact conflict' })

    mocks.importReadAiFollowUp.mockRejectedValueOnce('nope')
    const hidden = await POST(
      request({ contact_name: 'Ada', contact_email: 'ada@example.com' }),
      { params: { id: 'meet-1' } },
    )
    expect(hidden.status).toBe(500)
    expect(await hidden.json()).toEqual({ error: 'Failed to import follow-up' })
  })
})
