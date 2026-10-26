import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/meetings${query}`)
}

function chain(result: { data?: unknown; error?: unknown; count?: number } = {}) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = vi.fn(self)
  query.eq = vi.fn(self)
  query.is = vi.fn(self)
  query.or = vi.fn(self)
  query.gte = vi.fn(self)
  query.lte = vi.fn(self)
  query.ilike = vi.fn(self)
  query.in = vi.fn(self)
  query.order = vi.fn(self)
  query.limit = vi.fn(self)
  query.range = vi.fn(self)
  query.then = (
    onFulfilled: (value: { data: unknown; error: unknown; count: number }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({
      data: result.data ?? [],
      error: result.error ?? null,
      count: result.count ?? 0,
    }).then(onFulfilled, onRejected)
  return query as typeof query & {
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    or: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    ilike: ReturnType<typeof vi.fn>
    range: ReturnType<typeof vi.fn>
  }
}

describe('GET /api/admin/meetings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before querying meetings', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('caps the page size at 100 and skips a non-integer contact filter', async () => {
    const list = chain({ data: [], count: 0 })
    const statsAll = chain({ count: 4 })
    const statsUnlinked = chain({ count: 1 })
    let meetingCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'meeting_records') throw new Error(`Unexpected table: ${table}`)
      meetingCalls += 1
      if (meetingCalls === 1) return statsAll
      if (meetingCalls === 2) return statsUnlinked
      return list
    })

    const response = await GET(request('?contact_submission_id=abc&limit=250&offset=10'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      meetings: [],
      total: 0,
      stats: { total: 4, not_attributed: 1, attributed: 3 },
    })
    expect(list.eq).not.toHaveBeenCalled()
    expect(list.range).toHaveBeenCalledWith(10, 109)
  })

  it('applies unlinked, attributed, search, and date filters on the list query', async () => {
    const list = chain({ data: [], count: 0 })
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'meeting_records') throw new Error(`Unexpected table: ${table}`)
      return list
    })

    await GET(request('?unlinked_only=true&q=kickoff&date_from=2026-09-01&date_to=2026-09-12'))
    expect(list.is).toHaveBeenCalledWith('contact_submission_id', null)
    expect(list.is).toHaveBeenCalledWith('client_project_id', null)
    expect(list.or).toHaveBeenCalledWith('meeting_type.ilike.%kickoff%,transcript.ilike.%kickoff%')
    expect(list.gte).toHaveBeenCalledWith('meeting_date', '2026-09-01')
    expect(list.lte).toHaveBeenCalledWith('meeting_date', '2026-09-12')

    const attributed = chain({ data: [], count: 0 })
    mocks.from.mockImplementation(() => attributed)
    await GET(request('?attributed_only=true'))
    expect(attributed.or).toHaveBeenCalledWith(
      'contact_submission_id.not.is.null,client_project_id.not.is.null',
    )

    const byContact = chain({ data: [], count: 0 })
    mocks.from.mockImplementation(() => byContact)
    await GET(request('?contact_submission_id=42'))
    expect(byContact.eq).toHaveBeenCalledWith('contact_submission_id', 42)
  })

  it('truncates transcript previews and joins lead or project labels', async () => {
    const transcript = 'x'.repeat(201)
    const list = chain({
      data: [
        {
          id: 'meet-1',
          meeting_type: 'Discovery',
          meeting_date: '2026-09-10',
          duration_minutes: 30,
          contact_submission_id: 7,
          client_project_id: 'proj-1',
          transcript,
          structured_notes: { summary: 'Need automation' },
          created_at: '2026-09-10T12:00:00Z',
        },
      ],
      count: 1,
    })
    const contacts = chain({ data: [{ id: 7, name: 'Ada', email: 'ada@example.com' }] })
    const projects = chain({ data: [{ id: 'proj-1', project_name: 'KMB', client_name: 'Ada LLC' }] })
    let meetingCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'meeting_records') {
        meetingCalls += 1
        return meetingCalls <= 2 ? chain({ count: 1 }) : list
      }
      if (table === 'contact_submissions') return contacts
      if (table === 'client_projects') return projects
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.meetings).toEqual([
      {
        id: 'meet-1',
        meeting_type: 'Discovery',
        meeting_date: '2026-09-10',
        duration_minutes: 30,
        contact_submission_id: 7,
        client_project_id: 'proj-1',
        transcript_preview: `${'x'.repeat(200)}…`,
        transcript_length: 201,
        summary: 'Need automation',
        lead_name: 'Ada',
        lead_email: 'ada@example.com',
        project_name: 'KMB',
        client_name: 'Ada LLC',
        created_at: '2026-09-10T12:00:00Z',
      },
    ])
    expect(contacts.in).toHaveBeenCalledWith('id', [7])
    expect(projects.in).toHaveBeenCalledWith('id', ['proj-1'])
  })

  it('uses the match_email branch and escapes wildcard characters', async () => {
    const contacts = chain({ data: [{ id: 9 }] })
    const linked = chain({
      data: [
        {
          id: 'linked-1',
          meeting_type: 'Linked',
          meeting_date: '2026-09-11',
          duration_minutes: 15,
          contact_submission_id: 9,
          client_project_id: null,
          transcript: 'short',
          structured_notes: null,
          created_at: '2026-09-11T00:00:00Z',
        },
      ],
    })
    const unlinked = chain({ data: [] })
    let meetingCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'contact_submissions') return contacts
      if (table === 'meeting_records') {
        meetingCalls += 1
        return meetingCalls === 1 ? linked : unlinked
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request('?match_email=foo%_bar@example.com'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.meetings[0].id).toBe('linked-1')
    expect(body.stats).toBeNull()
    expect(contacts.ilike).toHaveBeenCalledWith('email', 'foo%_bar@example.com')
    expect(unlinked.ilike).toHaveBeenCalledWith('transcript', '%foo\\%\\_bar@example.com%')
    expect(unlinked.ilike).toHaveBeenCalledWith('raw_notes', '%foo\\%\\_bar@example.com%')
  })
})
