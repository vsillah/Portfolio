import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
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

import { GET } from './route'

type MaybeSingleResult = {
  data: Record<string, unknown> | null
  error: { message: string } | null
}

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/email-messages/msg-1')
}

function createMaybeSingleBuilder(result: MaybeSingleResult) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.maybeSingle = vi.fn().mockResolvedValue(result)
  return builder
}

describe('GET /api/admin/email-messages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ id: 'admin-user' })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before reading email details', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest(), { params: { id: 'msg-1' } })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('resolves the full body from contact_communications before outreach_queue', async () => {
    const emailRow = {
      id: 'msg-1',
      contact_submission_id: 42,
      contact_communication_id: 'comm-1',
      source_system: 'outreach_queue',
      source_id: 'oq-1',
      subject: 'Follow up',
      body_preview: 'Preview body',
    }
    const emailBuilder = createMaybeSingleBuilder({ data: emailRow, error: null })
    const communicationBuilder = createMaybeSingleBuilder({
      data: { body: 'Full body from contact communication' },
      error: null,
    })
    const contactBuilder = createMaybeSingleBuilder({
      data: { id: 42, name: 'Ada', email: 'ada@example.com', company: 'Analytical Engines' },
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'email_messages') return emailBuilder
      if (table === 'contact_communications') return communicationBuilder
      if (table === 'contact_submissions') return contactBuilder
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest(), { params: { id: 'msg-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      message: emailRow,
      full_body: 'Full body from contact communication',
      full_body_source: 'contact_communications',
      contact: { id: 42, name: 'Ada', email: 'ada@example.com', company: 'Analytical Engines' },
    })
    expect(mocks.from.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'email_messages',
      'contact_communications',
      'contact_submissions',
    ])
    expect(communicationBuilder.eq).toHaveBeenCalledWith('id', 'comm-1')
  })

  it('falls back to outreach_queue body for indexed draft messages', async () => {
    const emailRow = {
      id: 'msg-1',
      contact_submission_id: null,
      contact_communication_id: null,
      source_system: 'outreach_queue',
      source_id: 'oq-1',
      subject: 'Cold intro',
      body_preview: 'Short preview',
    }
    const emailBuilder = createMaybeSingleBuilder({ data: emailRow, error: null })
    const outreachBuilder = createMaybeSingleBuilder({
      data: { body: 'Full body from outreach queue', subject: 'Cold intro' },
      error: null,
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'email_messages') return emailBuilder
      if (table === 'outreach_queue') return outreachBuilder
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest(), { params: { id: 'msg-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      message: emailRow,
      full_body: 'Full body from outreach queue',
      full_body_source: 'outreach_queue',
      contact: null,
    })
    expect(mocks.from.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'email_messages',
      'outreach_queue',
    ])
    expect(outreachBuilder.eq).toHaveBeenCalledWith('id', 'oq-1')
  })

  it('returns not found without resolving related tables when the message is missing', async () => {
    const emailBuilder = createMaybeSingleBuilder({ data: null, error: null })
    mocks.from.mockReturnValue(emailBuilder)

    const response = await GET(makeRequest(), { params: { id: 'missing' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Email not found' })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
})
