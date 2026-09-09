import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function makeRequest(id: string, detail = false) {
  const url = new URL(`http://localhost/api/admin/meetings/${id}`)
  if (detail) url.searchParams.set('detail', 'true')
  return new NextRequest(url)
}

function meetingQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select, eq, single }
}

const ENRICH_COLS = 'id, meeting_type, meeting_date, transcript, structured_notes, action_items, key_decisions'
const DETAIL_COLS =
  'id, meeting_type, meeting_date, duration_minutes, transcript, structured_notes, action_items, key_decisions, open_questions, risks_identified, attendees, recording_url, contact_submission_id, client_project_id, created_at'

describe('GET /api/admin/meetings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects unauthenticated callers before querying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(makeRequest('m-1'), { params: { id: 'm-1' } })

    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a missing meeting id', async () => {
    const response = await GET(makeRequest(''), { params: { id: '' } })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Meeting id is required' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the meeting row is missing', async () => {
    const q = meetingQuery({ data: null, error: { message: 'missing' } })
    mocks.from.mockReturnValue(q)

    const response = await GET(makeRequest('m-missing'), { params: { id: 'm-missing' } })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Meeting record not found' })
  })

  it('returns the enrich-modal shape by default with notes summary and action parts', async () => {
    const q = meetingQuery({
      data: {
        id: 'm-1',
        meeting_type: 'discovery_call',
        meeting_date: '2026-06-03T14:00:00.000Z',
        transcript: 'Long transcript that should not win over notes.',
        structured_notes: { summary: '  Notes win.  ', highlights: 'ignored' },
        action_items: [{ text: 'Send recap' }, { title: 'Book follow-up' }],
        key_decisions: ['Should not appear in enrich payload'],
      },
      error: null,
    })
    mocks.from.mockReturnValue(q)

    const response = await GET(makeRequest('m-1'), { params: { id: 'm-1' } })

    expect(response.status).toBe(200)
    expect(q.select).toHaveBeenCalledWith(ENRICH_COLS)
    expect(await response.json()).toEqual({
      meeting: {
        id: 'm-1',
        title: 'discovery call',
        start_time_ms: Date.parse('2026-06-03T14:00:00.000Z'),
        end_time_ms: null,
        participants: [],
        platform: 'record',
        report_url: '',
        summary: 'Notes win.',
        action_items: [{ text: 'Send recap' }, { text: 'Book follow-up' }],
      },
    })
  })

  it('falls back to transcript when notes have no summary or highlights', async () => {
    const transcript = 'T'.repeat(4010)
    const q = meetingQuery({
      data: {
        id: 'm-2',
        meeting_type: '   ',
        meeting_date: 'not-a-date',
        transcript,
        structured_notes: { summary: '  ', highlights: '' },
        action_items: [],
        key_decisions: [],
      },
      error: null,
    })
    mocks.from.mockReturnValue(q)
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)

    const response = await GET(makeRequest('m-2'), { params: { id: 'm-2' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.meeting.title).toBe('Meeting')
    expect(body.meeting.summary).toBe('T'.repeat(4000))
    expect(body.meeting.start_time_ms).toBe(1_700_000_000_000)
    expect(body.meeting.action_items).toBeNull()
  })

  it('returns the full detail payload when detail=true', async () => {
    const q = meetingQuery({
      data: {
        id: 'm-3',
        meeting_type: 'kickoff',
        meeting_date: '2026-07-01T10:00:00.000Z',
        duration_minutes: 45,
        transcript: 'Kickoff transcript',
        structured_notes: { highlights: 'Highlight summary' },
        action_items: ['Ship SOP'],
        key_decisions: ['Go live Friday', { text: 'Keep Slack channel' }, { text: '' }],
        open_questions: ['Who owns billing?'],
        risks_identified: [{ text: 'Scope creep' }],
        attendees: [{ name: 'Ada', email: 'ada@example.com' }],
        recording_url: 'https://record.example/m-3',
        contact_submission_id: 42,
        client_project_id: 'proj-1',
        created_at: '2026-07-01T11:00:00.000Z',
      },
      error: null,
    })
    mocks.from.mockReturnValue(q)

    const response = await GET(makeRequest('m-3', true), { params: { id: 'm-3' } })

    expect(response.status).toBe(200)
    expect(q.select).toHaveBeenCalledWith(DETAIL_COLS)
    expect(await response.json()).toEqual({
      meeting: {
        id: 'm-3',
        title: 'kickoff',
        meeting_type: 'kickoff',
        meeting_date: '2026-07-01T10:00:00.000Z',
        duration_minutes: 45,
        start_time_ms: Date.parse('2026-07-01T10:00:00.000Z'),
        summary: 'Highlight summary',
        transcript: 'Kickoff transcript',
        action_items: [{ text: 'Ship SOP' }],
        key_decisions: ['Go live Friday', 'Keep Slack channel'],
        open_questions: ['Who owns billing?'],
        risks_identified: ['Scope creep'],
        attendees: [{ name: 'Ada', email: 'ada@example.com' }],
        recording_url: 'https://record.example/m-3',
        contact_submission_id: 42,
        client_project_id: 'proj-1',
        structured_notes: { highlights: 'Highlight summary' },
      },
    })
  })
})
