import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  suggestEmailTemplate: vi.fn(),
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

vi.mock('@/lib/delivery-email', () => ({
  suggestEmailTemplate: mocks.suggestEmailTemplate,
}))

import { GET } from './route'

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/admin/contacts/${id}`)
}

function query(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.eq = vi.fn(self)
  api.is = vi.fn(self)
  api.order = vi.fn(self)
  api.limit = vi.fn(self)
  api.single = vi.fn(async () => result)
  api.then = (onFulfilled: (value: typeof result) => unknown, onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return api as {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
  }
}

describe('GET /api/admin/contacts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.suggestEmailTemplate.mockReturnValue('email_follow_up')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('rejects unauthenticated callers before querying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('7'), { params: { id: '7' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric contact id', async () => {
    const response = await GET(makeRequest('nope'), { params: { id: 'nope' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid contact ID' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the contact row is missing', async () => {
    const contactQuery = query({ data: null, error: { message: 'missing', code: 'PGRST116' } })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return contactQuery
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(makeRequest('7'), { params: { id: '7' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Contact not found' })
    expect(contactQuery.eq).toHaveBeenCalledWith('id', 7)
    expect(contactQuery.single).toHaveBeenCalled()
  })

  it('aggregates related rows, newest-first timeline, dashboard access, and suggested template', async () => {
    const contact = {
      id: 7,
      name: 'Ada',
      email: 'ada@example.com',
      company: 'Acme',
      industry: 'saas',
      lead_source: 'warm_facebook_friends',
      lead_score: 80,
      outreach_status: 'contacted',
      created_at: '2026-01-01T00:00:00.000Z',
      employee_count: 12,
    }

    const tables: Record<string, ReturnType<typeof query>> = {
      contact_submissions: query({ data: contact, error: null }),
      gamma_reports: query({
        data: [{ id: 'g1', report_type: 'deck', title: 'ROI Deck', gamma_url: 'https://g', status: 'ready', error_message: null, created_at: '2026-02-01T00:00:00.000Z' }],
        error: null,
      }),
      video_generation_jobs: query({
        data: [{ id: 'v1', script_source: 's', heygen_status: 'completed', video_url: 'https://v', thumbnail_url: null, channel: 'youtube', aspect_ratio: '16:9', gamma_report_id: null, created_at: '2026-03-01T00:00:00.000Z', deleted_at: null }],
        error: null,
      }),
      value_reports: query({ data: [{ id: 'vr1', title: 'Value', report_type: 'industry', industry: 'saas', created_at: '2026-01-15T00:00:00.000Z' }], error: null }),
      diagnostic_audits: query({ data: [{ id: 3, status: 'completed', created_at: '2026-04-01T00:00:00.000Z' }], error: null }),
      outreach_queue: query({ data: [{ id: 'o1', channel: 'email', subject: 'Hello', status: 'draft', sequence_step: 1, created_at: '2026-01-20T00:00:00.000Z' }], error: null }),
      contact_deliveries: query({ data: [{ id: 'd1', subject: 'Assets', recipient_email: 'ada@example.com', asset_ids: [], dashboard_token: 't', sent_at: '2026-05-01T00:00:00.000Z', status: 'sent', error_message: null }], error: null }),
      client_dashboard_access: query({
        data: [{ id: 'dash-1', access_token: 'tok', client_email: 'ada@example.com', is_active: true, diagnostic_audit_id: 3, client_project_id: 'proj-1', created_at: '2026-06-01T00:00:00.000Z' }],
        error: null,
      }),
      sales_sessions: query({ data: [{ id: 's1', created_at: '2026-02-15T00:00:00.000Z' }], error: null }),
      contact_communications: query({ data: [{ id: 'c1', channel: 'email', direction: 'outbound', message_type: 'outreach', subject: 'Hi', body: 'body', source_system: 'app', source_id: null, prompt_key: null, status: 'sent', sent_at: '2026-01-21T00:00:00.000Z', sent_by: 'admin', metadata: {}, created_at: '2026-01-21T00:00:00.000Z' }], error: null }),
      meeting_records: query({ data: [{ id: 'm1', meeting_date: '2026-03-10', meeting_type: 'discovery' }], error: null }),
      client_projects: query({ data: [{ id: 'proj-1', project_name: 'Acme AI', project_status: 'active' }], error: null }),
    }

    mocks.from.mockImplementation((table: string) => {
      const q = tables[table]
      if (!q) throw new Error(`Unexpected table: ${table}`)
      return q
    })

    const response = await GET(makeRequest('7'), { params: { id: '7' } })
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.contact).toEqual(contact)
    expect(body.dashboardAccess).toEqual({
      id: 'dash-1',
      access_token: 'tok',
      client_email: 'ada@example.com',
      is_active: true,
      diagnostic_audit_id: 3,
      client_project_id: 'proj-1',
      created_at: '2026-06-01T00:00:00.000Z',
    })
    expect(body.suggestedTemplate).toBe('email_follow_up')
    expect(body.meetingRecords).toEqual([{ id: 'm1', meeting_date: '2026-03-10', meeting_type: 'discovery' }])
    expect(body.clientProjects).toEqual([{ id: 'proj-1', project_name: 'Acme AI', project_status: 'active' }])
    expect(body.communications).toHaveLength(1)
    expect(body.outreach).toHaveLength(1)

    expect(body.timeline.map((event: { type: string; date: string }) => [event.type, event.date])).toEqual([
      ['delivery', '2026-05-01T00:00:00.000Z'],
      ['audit', '2026-04-01T00:00:00.000Z'],
      ['video', '2026-03-01T00:00:00.000Z'],
      ['sales', '2026-02-15T00:00:00.000Z'],
      ['gamma', '2026-02-01T00:00:00.000Z'],
      ['outreach', '2026-01-20T00:00:00.000Z'],
      ['value_report', '2026-01-15T00:00:00.000Z'],
      ['contact', '2026-01-01T00:00:00.000Z'],
    ])

    expect(tables.video_generation_jobs.is).toHaveBeenCalledWith('deleted_at', null)
    expect(tables.outreach_queue.limit).toHaveBeenCalledWith(10)
    expect(tables.contact_communications.limit).toHaveBeenCalledWith(50)
    expect(tables.meeting_records.limit).toHaveBeenCalledWith(20)
    expect(tables.client_projects.limit).toHaveBeenCalledWith(5)
    expect(tables.client_dashboard_access.eq).toHaveBeenCalledWith('client_email', 'ada@example.com')
    expect(tables.client_dashboard_access.eq).toHaveBeenCalledWith('is_active', true)

    expect(mocks.suggestEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        gammaReports: expect.any(Array),
        videos: expect.any(Array),
        meetingRecords: expect.any(Array),
        clientProjects: expect.any(Array),
      }),
    )
  })
})
