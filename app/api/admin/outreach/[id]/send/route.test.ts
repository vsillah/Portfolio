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

  it.each([
    ['draft', 'email', false], ['approved', 'email', false],
    ['approved', 'email', true], ['approved', 'linkedin', false],
    ['approved', 'facebook', false],
  ])('blocks legacy dispatch for %s %s with outbound disabled=%s', async (status, channel, disabled) => {
    mockOutreachItem(outreachRow({ status, channel }))
    mocks.isN8nOutboundDisabled.mockReturnValue(disabled)
    const response = await POST(makeRequest(), params())
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'legacy_outreach_dispatch_blocked', dispatched: false,
      communicationQueued: false, externalSendPerformed: false,
      recovery: {
        gmailReviewedExecutionRoute: '/api/admin/outreach/queue-1/gmail-user-send',
        manualHandoffUrl: '/admin/outreach?tab=leads&filter=warm&id=123&contactId=123&queueId=queue-1#warm-manual-social-handoff',
      },
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.logCommunication).not.toHaveBeenCalled()
  })
})
