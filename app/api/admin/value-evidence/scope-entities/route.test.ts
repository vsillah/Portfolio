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
  supabaseAdmin: { from: mocks.from },
}))

import { GET } from './route'

function request(query: string) {
  return new NextRequest(`http://localhost/api/admin/value-evidence/scope-entities${query}`)
}

function chain(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    in: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  query.select.mockReturnValue(query)
  query.not.mockReturnValue(query)
  query.order.mockReturnValue(query)
  query.limit.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.or.mockReturnValue(query)
  query.in.mockReturnValue(query)
  return query
}

function meetingWhen(iso: string | null) {
  if (!iso) return 'Unknown date'
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return 'Unknown date'
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

describe('GET /api/admin/value-evidence/scope-entities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockImplementation(
      (result: { error?: string } | null) => Boolean(result) && typeof result === 'object' && 'error' in result
    )
  })

  it('rejects a missing or unknown type before querying', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    const denied = await GET(request('?type=meeting'))
    expect(denied.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()

    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    const missing = await GET(request(''))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'type must be one of: meeting, assessment, lead' })

    const wrongCase = await GET(request('?type=Meeting'))
    expect(wrongCase.status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('builds meeting labels from notes, contacts, and duration, and escapes nothing in search', async () => {
    const longBlurb = `${'a'.repeat(80)}b`
    const meetings = chain({
      data: [
        {
          id: 'abcdefghijk',
          meeting_type: 'discovery_call',
          meeting_date: '2026-01-15T15:04:00.000Z',
          structured_notes: { summary: '  Short summary  ', title: 'Ignored title' },
          contact_submission_id: 7,
          transcript: 'hello',
          duration_minutes: 45,
        },
        {
          id: 'zzzzzzzzzz',
          meeting_type: null,
          meeting_date: null,
          structured_notes: { summary: longBlurb },
          contact_submission_id: '3',
          transcript: '',
          duration_minutes: 0,
        },
      ],
      error: null,
    })
    const contacts = chain({
      data: [{ id: 7, name: 'Ada', company: 'Acme' }],
      error: null,
    })
    mocks.from.mockImplementation((table: string) => (table === 'meeting_records' ? meetings : contacts))

    const response = await GET(request('?type=meeting&q=%20a,b%20&contact_submission_id=7'))
    const body = await response.json()

    expect(meetings.not).toHaveBeenCalledWith('transcript', 'is', null)
    expect(meetings.limit).toHaveBeenCalledWith(20)
    expect(meetings.eq).toHaveBeenCalledWith('contact_submission_id', '7')
    expect(meetings.or).toHaveBeenCalledWith('meeting_type.ilike.%a,b%,transcript.ilike.%a,b%')
    expect(contacts.in).toHaveBeenCalledWith('id', [7])
    expect(body.entities[0]).toEqual({
      id: 'abcdefghijk',
      label: 'Short summary',
      subtitle: `${meetingWhen('2026-01-15T15:04:00.000Z')} · Acme · Ada · 45 min · #abcdefgh`,
      hasTranscript: true,
      contactSubmissionId: 7,
    })
    expect(body.entities[1]).toEqual({
      id: 'zzzzzzzzzz',
      label: `${'a'.repeat(80)}…`,
      subtitle: `${meetingWhen(null)} · #zzzzzzzz`,
      hasTranscript: false,
      contactSubmissionId: '3',
    })
  })

  it('falls back to the meeting type when notes have no summary or title', async () => {
    const meetings = chain({
      data: [
        {
          id: '123456789',
          meeting_type: 'follow_up',
          meeting_date: 'not-a-date',
          structured_notes: { summary: '   ', title: '' },
          contact_submission_id: null,
          transcript: 'yes',
          duration_minutes: null,
        },
      ],
      error: null,
    })
    mocks.from.mockReturnValue(meetings)

    const response = await GET(request('?type=meeting&q=%20%20'))
    const body = await response.json()

    expect(meetings.or).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalledWith('contact_submissions')
    expect(body.entities[0].label).toBe('follow up — Unknown date')
    expect(body.entities[0].subtitle).toBe('#12345678')
  })

  it('truncates assessment summaries with three dots and ignores lead contact filters', async () => {
    const summary = `${'s'.repeat(81)}`
    const audits = chain({
      data: [
        {
          id: 'audit-1',
          audit_type: 'ai_readiness',
          created_at: '2026-03-01T00:00:00.000Z',
          diagnostic_summary: summary,
          contact_submission_id: 4,
          status: 'completed',
        },
        {
          id: 'audit-2',
          audit_type: null,
          created_at: null,
          diagnostic_summary: '',
          contact_submission_id: null,
          status: null,
        },
      ],
      error: null,
    })
    mocks.from.mockReturnValue(audits)

    const assessments = await GET(request('?type=assessment&q=readiness'))
    const assessmentBody = await assessments.json()

    expect(audits.or).toHaveBeenCalledWith('audit_type.ilike.%readiness%,diagnostic_summary.ilike.%readiness%')
    expect(assessmentBody.entities[0].label).toBe(`${'s'.repeat(80)}...`)
    expect(assessmentBody.entities[1].label).toBe('Assessment — Unknown date')
    expect(assessmentBody.entities[1].subtitle).toBeNull()

    const leads = chain({
      data: [
        { id: 9, name: 'Ada', company: null, industry: null, rep_pain_points: '', company_domain: null },
        { id: 10, name: null, company: null, industry: 'Retail', rep_pain_points: 'slow quotes', company_domain: null },
      ],
      error: null,
    })
    mocks.from.mockReturnValue(leads)
    const leadResponse = await GET(request('?type=lead&contact_submission_id=9&q=ada'))
    const leadBody = await leadResponse.json()

    expect(leads.eq).not.toHaveBeenCalled()
    expect(leads.or).toHaveBeenCalledWith('name.ilike.%ada%,company.ilike.%ada%,industry.ilike.%ada%')
    expect(leadBody.entities).toEqual([
      { id: 9, label: 'Ada', subtitle: 'Ada', hasPainPoints: false },
      { id: 10, label: 'Lead #10', subtitle: 'Retail', hasPainPoints: true },
    ])
  })

  it('hides database errors behind a generic response', async () => {
    mocks.from.mockReturnValue(chain({ data: null, error: { message: 'permission denied for meeting_records' } }))

    const response = await GET(request('?type=meeting'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to fetch entities' })
  })
})
