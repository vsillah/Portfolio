import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  logCommunication: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/communications', () => ({
  logCommunication: mocks.logCommunication,
}))

import { POST } from './route'

function request(body?: unknown, raw?: string) {
  return new NextRequest('http://localhost/api/admin/communications/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body ?? {}),
  })
}

const validBody = {
  contactSubmissionId: 42,
  channel: 'email',
  direction: 'outbound',
  messageType: 'proposal',
  body: 'Proposal sent',
  sourceSystem: 'proposal',
}

describe('POST /api/admin/communications/log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.logCommunication.mockResolvedValue({ id: 'comm-1' })
  })

  it('requires admin authentication', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(validBody))

    expect(response.status).toBe(401)
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('rejects invalid JSON', async () => {
    const response = await POST(request(undefined, '{not-json'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON body' })
  })

  it('requires the core identity fields', async () => {
    const response = await POST(request({ channel: 'email', body: 'hi' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required fields: contactSubmissionId, channel, direction, messageType, body, sourceSystem',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('rejects unknown enum values before logging', async () => {
    const channel = await POST(request({ ...validBody, channel: 'fax' }))
    expect(channel.status).toBe(400)
    await expect(channel.json()).resolves.toEqual({
      error: 'Invalid channel. Must be one of: email, linkedin, sms, chat, voice',
    })

    const status = await POST(request({ ...validBody, status: 'delivered' }))
    expect(status.status).toBe(400)
    await expect(status.json()).resolves.toEqual({
      error: 'Invalid status. Must be one of: draft, queued, sent, failed, bounced, replied',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('defaults optional fields and stamps the authenticated sender', async () => {
    const response = await POST(request(validBody))

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ id: 'comm-1' })
    expect(mocks.logCommunication).toHaveBeenCalledWith({
      contactSubmissionId: 42,
      channel: 'email',
      direction: 'outbound',
      messageType: 'proposal',
      subject: null,
      body: 'Proposal sent',
      sourceSystem: 'proposal',
      sourceId: null,
      promptKey: null,
      status: 'sent',
      sentAt: null,
      sentBy: 'admin-1',
      metadata: {},
    })
  })

  it('forwards explicit status, subject, and metadata', async () => {
    await POST(request({
      ...validBody,
      subject: 'Follow up',
      sourceId: 'prop-1',
      promptKey: 'proposal_email',
      status: 'queued',
      sentAt: '2026-09-21T10:00:00.000Z',
      metadata: { recipient_email: 'a@example.com' },
    }))

    expect(mocks.logCommunication).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Follow up',
      sourceId: 'prop-1',
      promptKey: 'proposal_email',
      status: 'queued',
      sentAt: '2026-09-21T10:00:00.000Z',
      metadata: { recipient_email: 'a@example.com' },
    }))
  })

  it('returns 500 when the logger fails', async () => {
    mocks.logCommunication.mockResolvedValue(null)

    const response = await POST(request(validBody))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to log communication' })
  })
})
