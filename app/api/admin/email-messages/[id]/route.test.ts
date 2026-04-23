import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  supabaseAdminRef: { current: null as null | { from: ReturnType<typeof vi.fn> } },
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return mocks.supabaseAdminRef.current
  },
}))

import { GET } from './route'

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/email-messages/msg-1', {
    method: 'GET',
    headers: { authorization: 'Bearer test-token' },
  })
}

function makeMaybeSingleBuilder(result: { data: unknown; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, maybeSingle }
}

describe('GET /api/admin/email-messages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ id: 'admin-1' })
    mocks.isAuthError.mockReturnValue(false)
    mocks.supabaseAdminRef.current = { from: mocks.from }
  })

  it('returns auth error when verifyAdmin fails', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest(), { params: { id: 'msg-1' } })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when message does not exist', async () => {
    const first = makeMaybeSingleBuilder({ data: null, error: null })
    mocks.from.mockReturnValue(first)

    const response = await GET(makeRequest(), { params: { id: 'msg-1' } })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Email not found' })
    expect(mocks.from).toHaveBeenCalledWith('email_messages')
  })

  it('prefers contact_communications body when available', async () => {
    const row = {
      id: 'msg-1',
      body_preview: 'preview',
      contact_communication_id: 'cc-1',
      source_system: 'outreach_queue',
      source_id: 'oq-1',
      contact_submission_id: 42,
    }

    const first = makeMaybeSingleBuilder({ data: row, error: null })
    const second = makeMaybeSingleBuilder({ data: { body: 'Full CC body' }, error: null })
    const third = makeMaybeSingleBuilder({
      data: { id: 42, name: 'Lead Name', email: 'lead@example.com', company: 'Acme' },
      error: null,
    })
    const queue = [first, second, third]
    mocks.from.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from() call')
      return next
    })

    const response = await GET(makeRequest(), { params: { id: 'msg-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: row,
      full_body: 'Full CC body',
      full_body_source: 'contact_communications',
      contact: { id: 42, name: 'Lead Name', email: 'lead@example.com', company: 'Acme' },
    })
    expect(mocks.from.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'email_messages',
      'contact_communications',
      'contact_submissions',
    ])
  })

  it('falls back to outreach_queue body when contact_communications body is missing', async () => {
    const row = {
      id: 'msg-2',
      body_preview: 'preview',
      contact_communication_id: 'cc-2',
      source_system: 'outreach_queue',
      source_id: 'oq-2',
      contact_submission_id: null,
    }

    const first = makeMaybeSingleBuilder({ data: row, error: null })
    const second = makeMaybeSingleBuilder({ data: null, error: null })
    const third = makeMaybeSingleBuilder({ data: { body: 'Full OQ body', subject: 'S' }, error: null })
    const queue = [first, second, third]
    mocks.from.mockImplementation(() => {
      const next = queue.shift()
      if (!next) throw new Error('Unexpected supabaseAdmin.from() call')
      return next
    })

    const response = await GET(makeRequest(), { params: { id: 'msg-2' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      message: row,
      full_body: 'Full OQ body',
      full_body_source: 'outreach_queue',
      contact: null,
    })
    expect(mocks.from.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'email_messages',
      'contact_communications',
      'outreach_queue',
    ])
  })
})
