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

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/admin/video-generation/meetings${query}`)
}

function meetingQuery(result: { data: unknown; error: unknown; count?: number | null }) {
  const query: {
    select: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    range: ReturnType<typeof vi.fn>
    gte: ReturnType<typeof vi.fn>
    lte: ReturnType<typeof vi.fn>
    or: ReturnType<typeof vi.fn>
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {
    select: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.range.mockReturnValue(query)
  query.gte.mockReturnValue(query)
  query.lte.mockReturnValue(query)
  query.or.mockReturnValue(query)
  return query
}

function lookup(rows: unknown[]) {
  const inFilter = vi.fn().mockResolvedValue({ data: rows, error: null })
  return {
    inFilter,
    builder: {
      select: vi.fn(() => ({ in: inFilter })),
    },
  }
}

describe('GET /api/admin/video-generation/meetings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('requires admin auth before querying meetings', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Authentication required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('caps the page at 50 and applies date bounds without a text search', async () => {
    const query = meetingQuery({ data: [], error: null, count: 0 })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest('?limit=80&offset=10&from=2026-09-01&to=2026-09-27&q=   '))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ meetings: [], total: 0 })
    expect(query.range).toHaveBeenCalledWith(10, 59)
    expect(query.gte).toHaveBeenCalledWith('meeting_date', '2026-09-01')
    expect(query.lte).toHaveBeenCalledWith('meeting_date', '2026-09-27')
    expect(query.or).not.toHaveBeenCalled()
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('uses the default page size and interpolates the raw search text', async () => {
    const query = meetingQuery({ data: [], error: null, count: null })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest('?q=%20store_%20'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ meetings: [], total: 0 })
    expect(query.range).toHaveBeenCalledWith(0, 19)
    expect(query.or).toHaveBeenCalledWith('meeting_type.ilike.%store_%,transcript.ilike.%store_%')
  })

  it('prefers the project identity, truncates long summaries, and filters by exact client email', async () => {
    const summary = `${'a'.repeat(120)}b`
    const query = meetingQuery({
      data: [
        {
          id: 'meet-1',
          meeting_type: 'discovery',
          meeting_date: '2026-09-20',
          duration_minutes: 30,
          contact_submission_id: 7,
          client_project_id: 'project-1',
          structured_notes: { summary, highlights: 'ignored highlight' },
          key_decisions: ['ship', 'wait'],
          transcript: 'hello',
        },
        {
          id: 'meet-2',
          meeting_type: 'kickoff',
          meeting_date: '2026-09-18',
          duration_minutes: 15,
          contact_submission_id: 8,
          client_project_id: null,
          structured_notes: { highlights: 'Short highlight' },
          key_decisions: { note: 'not an array' },
          transcript: '',
        },
      ],
      error: null,
      count: 9,
    })
    const contacts = lookup([
      { id: 7, name: 'Contact Name', email: 'contact@example.com', company: 'Contact Co' },
      { id: 8, name: 'Other Person', email: 'other@example.com', company: 'Other Co' },
    ])
    const projects = lookup([
      {
        id: 'project-1',
        client_name: 'Project Client',
        client_email: 'Client@Example.com',
        client_company: 'Project Co',
      },
    ])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'meeting_records') return query
      if (table === 'contact_submissions') return contacts.builder
      if (table === 'client_projects') return projects.builder
      throw new Error(`unexpected table ${table}`)
    })

    const response = await GET(makeRequest('?client=%20CLIENT@example.com%20'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.total).toBe(1)
    expect(body.meetings).toEqual([
      {
        id: 'meet-1',
        meeting_type: 'discovery',
        meeting_date: '2026-09-20',
        duration_minutes: 30,
        summary: `${'a'.repeat(120)}...`,
        client_name: 'Project Client',
        client_company: 'Project Co',
        client_email: 'Client@Example.com',
        has_transcript: true,
        key_decisions_count: 2,
      },
    ])
    expect(contacts.inFilter).toHaveBeenCalledWith('id', [7, 8])
    expect(projects.inFilter).toHaveBeenCalledWith('id', ['project-1'])
  })

  it('keeps the database count when no client email filter is applied', async () => {
    const query = meetingQuery({
      data: [
        {
          id: 'meet-2',
          meeting_type: 'kickoff',
          meeting_date: '2026-09-18',
          duration_minutes: null,
          contact_submission_id: null,
          client_project_id: null,
          structured_notes: null,
          key_decisions: null,
          transcript: null,
        },
      ],
      error: null,
      count: 4,
    })
    mocks.from.mockReturnValue(query)

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(body.total).toBe(4)
    expect(body.meetings[0]).toMatchObject({
      summary: null,
      client_name: null,
      client_email: null,
      has_transcript: false,
      key_decisions_count: 0,
    })
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it('returns a generic fetch error and a generic thrown error', async () => {
    const failed = meetingQuery({ data: null, error: { message: 'timeout' }, count: null })
    mocks.from.mockReturnValueOnce(failed)

    const queryError = await GET(makeRequest())
    expect(queryError.status).toBe(500)
    await expect(queryError.json()).resolves.toEqual({ error: 'Failed to fetch meetings' })

    mocks.from.mockImplementation(() => {
      throw new Error('connection reset')
    })
    const thrown = await GET(makeRequest())
    expect(thrown.status).toBe(500)
    await expect(thrown.json()).resolves.toEqual({ error: 'Something went wrong' })
  })
})
