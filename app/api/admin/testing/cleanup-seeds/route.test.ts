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

import { GET, POST } from './route'

function jsonRequest(url: string, body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function thenableQuery(result: { data?: unknown; error?: unknown; count?: number } = { data: [], error: null, count: 0 }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    contains: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    contains: vi.fn(),
    delete: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.in.mockReturnValue(query)
  query.contains.mockReturnValue(query)
  query.delete.mockReturnValue(query)
  return query
}

const FLAGGED_TABLES = [
  'pain_point_evidence',
  'market_intelligence',
  'cost_events',
  'outreach_queue',
  'social_content_queue',
  'meeting_records',
  'sales_sessions',
  'client_projects',
  'contact_submissions',
] as const

describe('/api/admin/testing/cleanup-seeds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') {
        return thenableQuery({ data: [{ id: 11 }], error: null, count: 1 })
      }
      return thenableQuery({ data: [{ id: `${table}-1` }], error: null, count: 1 })
    })
  })

  it('requires admin auth for GET and POST', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const getResponse = await GET(jsonRequest('http://localhost/api/admin/testing/cleanup-seeds'))
    const postResponse = await POST(jsonRequest('http://localhost/api/admin/testing/cleanup-seeds', { mode: 'flag_only' }))

    expect(getResponse.status).toBe(401)
    expect(postResponse.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an unsupported preview mode', async () => {
    const response = await GET(jsonRequest('http://localhost/api/admin/testing/cleanup-seeds?mode=email_only'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unsupported mode' })
  })

  it('previews flagged test rows and calendar fixtures by default', async () => {
    const response = await GET(jsonRequest('http://localhost/api/admin/testing/cleanup-seeds'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.mode).toBe('flag_only')
    expect(body.tablesScanned).toBe(FLAGGED_TABLES.length)
    expect(body.counts.social_content_calendar_fixture).toBe(2)
    expect(body.total).toBe(FLAGGED_TABLES.length + 2)
    expect(mocks.from).toHaveBeenCalledWith('social_content_calendar_items')
    expect(mocks.from).toHaveBeenCalledWith('attraction_campaigns')
    expect(mocks.from).not.toHaveBeenCalledWith('diagnostic_audits')
    expect(mocks.from).not.toHaveBeenCalledWith('proposals')
  })

  it('includes known test-email rows when previewing mode=all', async () => {
    const response = await GET(jsonRequest('http://localhost/api/admin/testing/cleanup-seeds?mode=all'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.mode).toBe('all')
    expect(body.flagPhase.total).toBe(FLAGGED_TABLES.length + 2)
    expect(body.emailPhase.total).toBe(6)
    expect(body.total).toBe(FLAGGED_TABLES.length + 2 + 6)
    expect(mocks.from).toHaveBeenCalledWith('diagnostic_audits')
    expect(mocks.from).toHaveBeenCalledWith('chat_sessions')
    expect(mocks.from).toHaveBeenCalledWith('proposals')
  })

  it('deletes only flagged rows and fixtures in flag_only mode', async () => {
    const response = await POST(jsonRequest('http://localhost/api/admin/testing/cleanup-seeds', { mode: 'flag_only' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.details.contact_submissions_flagged).toBe(1)
    expect(body.details.social_content_calendar_fixture).toBe(1)
    expect(body.details.attraction_campaigns_fixture).toBe(1)
    expect(body.details.contact_submissions_email).toBeUndefined()
    expect(body.details.proposals).toBeUndefined()
    expect(body.totalDeleted).toBe(FLAGGED_TABLES.length + 2)
  })

  it('deletes only known test emails in email_only mode', async () => {
    const response = await POST(jsonRequest('http://localhost/api/admin/testing/cleanup-seeds', { mode: 'email_only' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.details.contact_submissions_email).toBe(1)
    expect(body.details.proposals).toBe(1)
    expect(body.details.client_projects_email).toBe(1)
    expect(body.details.contact_submissions_flagged).toBeUndefined()
    expect(body.totalDeleted).toBe(3)
  })

  it('defaults POST to all and combines flagged plus email deletes', async () => {
    const response = await POST(jsonRequest('http://localhost/api/admin/testing/cleanup-seeds', {}))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.details.contact_submissions_flagged).toBe(1)
    expect(body.details.contact_submissions_email).toBe(1)
    expect(body.details.proposals).toBe(1)
    expect(body.totalDeleted).toBe(FLAGGED_TABLES.length + 2 + 3)
  })
})
