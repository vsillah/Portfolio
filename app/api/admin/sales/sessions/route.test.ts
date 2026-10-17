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

import { DELETE, GET, POST, PUT } from './route'

function jsonRequest(url: string, method = 'GET', body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function thenableQuery(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    not: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.not.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.insert.mockReturnValue(query)
  query.update.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  return query
}

describe('/api/admin/sales/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth for GET and POST', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getResponse = await GET(jsonRequest('http://localhost/api/admin/sales/sessions'))
    const postResponse = await POST(jsonRequest('http://localhost/api/admin/sales/sessions', 'POST', {
      client_email: 'lead@example.com',
    }))

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('lists sessions and applies filters including follow-up presence', async () => {
    const query = thenableQuery({ data: [{ id: 'sess-1' }], error: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(jsonRequest(
      'http://localhost/api/admin/sales/sessions?audit_id=audit-1&contact_submission_id=42&id=sess-1&outcome=in_progress&has_follow_up=true',
    ))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sessions: [{ id: 'sess-1' }] })
    expect(query.eq).toHaveBeenCalledWith('id', 'sess-1')
    expect(query.eq).toHaveBeenCalledWith('diagnostic_audit_id', 'audit-1')
    expect(query.eq).toHaveBeenCalledWith('contact_submission_id', '42')
    expect(query.eq).toHaveBeenCalledWith('outcome', 'in_progress')
    expect(query.not).toHaveBeenCalledWith('next_follow_up', 'is', null)
  })

  it('requires a lead link, email, or diagnostic audit on create', async () => {
    const response = await POST(jsonRequest('http://localhost/api/admin/sales/sessions', 'POST', {
      client_name: 'Jordan',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Either diagnostic_audit_id, client_email, or contact_submission_id is required',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('reuses an in-progress conversation-only session for the same contact', async () => {
    const existing = { id: 'sess-existing', outcome: 'in_progress', contact_submission_id: 42 }
    const lookup = thenableQuery({ data: existing, error: null })
    mocks.from.mockReturnValue(lookup)

    const response = await POST(jsonRequest('http://localhost/api/admin/sales/sessions', 'POST', {
      contact_submission_id: 42,
      client_name: 'Jordan',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, data: existing })
    expect(lookup.eq).toHaveBeenCalledWith('contact_submission_id', 42)
    expect(lookup.eq).toHaveBeenCalledWith('outcome', 'in_progress')
    expect(lookup.is).toHaveBeenCalledWith('diagnostic_audit_id', null)
    expect(lookup.insert).not.toHaveBeenCalled()
  })

  it('creates a new session and pauses outreach for the linked lead', async () => {
    const created = { id: 'sess-new', contact_submission_id: 42, outcome: 'in_progress' }
    const lookup = thenableQuery({ data: null, error: null })
    const insert = thenableQuery({ data: created, error: null })
    const contactUpdate = thenableQuery({ data: null, error: null })
    mocks.from
      .mockReturnValueOnce(lookup)
      .mockReturnValueOnce(insert)
      .mockReturnValueOnce(contactUpdate)

    const response = await POST(jsonRequest('http://localhost/api/admin/sales/sessions', 'POST', {
      contact_submission_id: 42,
      client_name: 'Jordan',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, data: created })
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({
      contact_submission_id: 42,
      client_name: 'Jordan',
      funnel_stage: 'prospect',
      sales_agent_id: 'admin-1',
      outcome: 'in_progress',
    }))
    expect(contactUpdate.update).toHaveBeenCalledWith({ outreach_status: 'in_conversation' })
    expect(contactUpdate.eq).toHaveBeenCalledWith('id', 42)
  })

  it('requires a session id on PUT and DELETE', async () => {
    const putResponse = await PUT(jsonRequest('http://localhost/api/admin/sales/sessions', 'PUT', { outcome: 'won' }))
    const deleteResponse = await DELETE(jsonRequest('http://localhost/api/admin/sales/sessions', 'DELETE'))

    expect(putResponse.status).toBe(400)
    expect(await putResponse.json()).toEqual({ error: 'Session ID is required' })
    expect(deleteResponse.status).toBe(400)
    expect(await deleteResponse.json()).toEqual({ error: 'Session ID is required' })
  })

  it('appends presented offers and forwards remaining fields on PUT', async () => {
    const current = thenableQuery({ data: { offers_presented: ['audit'] }, error: null })
    const update = thenableQuery({ data: { id: 'sess-1', outcome: 'won' }, error: null })
    mocks.from.mockReturnValueOnce(current).mockReturnValueOnce(update)

    const response = await PUT(jsonRequest('http://localhost/api/admin/sales/sessions', 'PUT', {
      id: 'sess-1',
      add_offer_presented: 'workshop',
      outcome: 'won',
      sales_agent_id: 'other-agent',
    }))

    expect(response.status).toBe(200)
    expect(update.update).toHaveBeenCalledWith({
      outcome: 'won',
      sales_agent_id: 'other-agent',
      offers_presented: ['audit', 'workshop'],
    })
    expect(update.eq).toHaveBeenCalledWith('id', 'sess-1')
  })

  it('deletes a session by id', async () => {
    const query = thenableQuery({ data: null, error: null })
    mocks.from.mockReturnValue(query)

    const response = await DELETE(jsonRequest('http://localhost/api/admin/sales/sessions?id=sess-1', 'DELETE'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(query.delete).toHaveBeenCalled()
    expect(query.eq).toHaveBeenCalledWith('id', 'sess-1')
  })
})
