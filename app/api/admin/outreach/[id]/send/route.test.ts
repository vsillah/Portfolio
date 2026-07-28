import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  n8nWebhookUrl: vi.fn(),
  isN8nOutboundDisabled: vi.fn(),
  logCommunication: vi.fn(),
  fetch: vi.fn(),
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

vi.mock('@/lib/n8n', () => ({
  n8nWebhookUrl: mocks.n8nWebhookUrl,
  isN8nOutboundDisabled: mocks.isN8nOutboundDisabled,
}))

vi.mock('@/lib/communications', () => ({
  logCommunication: mocks.logCommunication,
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }

type OutreachQueueRow = {
  id: string
  contact_submission_id: number
  status: string
  channel: string
  subject: string | null
  body: string | null
  sequence_step: number
  contact_submissions: {
    id: number
    name: string
    email: string
    company: string | null
    linkedin_url: string | null
    lead_score: number | null
    qualification_status: string | null
  } | null
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/outreach/queue-1/send', {
    method: 'POST',
  })
}

function params(id = 'queue-1') {
  return { params: Promise.resolve({ id }) }
}

function outreachRow(overrides: Partial<OutreachQueueRow> = {}): OutreachQueueRow {
  return {
    id: 'queue-1',
    contact_submission_id: 123,
    status: 'approved',
    channel: 'email',
    subject: 'Hello',
    body: 'Body text',
    sequence_step: 1,
    contact_submissions: {
      id: 123,
      name: 'Alice Lead',
      email: 'alice@example.com',
      company: 'Acme',
      linkedin_url: null,
      lead_score: 80,
      qualification_status: 'qualified',
    },
    ...overrides,
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
  return { select, eq }
}

describe('POST /api/admin/outreach/[id]/send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    delete process.env.N8N_CLG003_WEBHOOK_URL
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isN8nOutboundDisabled.mockReturnValue(false)
    mocks.n8nWebhookUrl.mockReturnValue('https://n8n.example/webhook/clg-send')
    mocks.logCommunication.mockResolvedValue(undefined)
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
    })
    vi.stubGlobal('fetch', mocks.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    restoreEnv()
  })

  it('rejects unauthenticated requests before loading outreach rows', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('returns 404 when the outreach item does not exist', async () => {
    mockOutreachItem(null)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: 'Outreach item not found',
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('blocks draft items from triggering a customer-facing send', async () => {
    mockOutreachItem(outreachRow({ status: 'draft' }))

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Item must be approved before sending. Current status: draft',
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('skips the webhook when n8n outbound is disabled', async () => {
    mockOutreachItem(outreachRow())
    mocks.isN8nOutboundDisabled.mockReturnValue(true)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Send workflow skipped (N8N_DISABLE_OUTBOUND)',
      outreach_id: 'queue-1',
      channel: 'email',
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('returns 502 when the send webhook responds with an error status', async () => {
    mockOutreachItem(outreachRow())
    mocks.fetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'upstream failed',
    })

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to trigger send workflow',
    })
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })

  it('triggers the webhook and logs a queued communication for approved items', async () => {
    process.env.N8N_CLG003_WEBHOOK_URL = 'https://n8n.example/webhook/custom-clg003'
    const item = outreachRow()
    mockOutreachItem(item)

    const response = await POST(makeRequest(), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: 'Send workflow triggered',
      outreach_id: 'queue-1',
      channel: 'email',
    })
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://n8n.example/webhook/custom-clg003',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outreach_id: item.id,
          contact_submission_id: item.contact_submission_id,
          channel: item.channel,
          subject: item.subject,
          body: item.body,
          sequence_step: item.sequence_step,
          contact: item.contact_submissions,
        }),
      }),
    )
    expect(mocks.logCommunication).toHaveBeenCalledWith(
      expect.objectContaining({
        contactSubmissionId: 123,
        channel: 'email',
        direction: 'outbound',
        messageType: 'cold_outreach',
        status: 'queued',
        sentBy: 'admin-user-1',
        recipientEmail: 'alice@example.com',
        emailTransport: 'n8n',
        metadata: expect.objectContaining({
          sequence_step: 1,
          outreach_queue_id: 'queue-1',
        }),
      }),
    )
  })
})
