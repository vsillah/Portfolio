import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  isReadAiConfigured: vi.fn(),
  searchMeetingsByAttendeeEmail: vi.fn(),
  getMeetingDetail: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/read-ai', () => ({
  isReadAiConfigured: mocks.isReadAiConfigured,
  searchMeetingsByAttendeeEmail: mocks.searchMeetingsByAttendeeEmail,
  getMeetingDetail: mocks.getMeetingDetail,
}))

import { GET as listMeetings } from './route'
import { GET as getMeeting } from './[id]/route'

const NOW = new Date('2026-09-28T10:00:00.000Z')
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function makeList(email?: string) {
  const url = new URL('http://localhost/api/admin/read-ai/meetings')
  if (email !== undefined) url.searchParams.set('email', email)
  return new NextRequest(url)
}

function makeDetail() {
  return new NextRequest('http://localhost/api/admin/read-ai/meetings/meet-1')
}

describe('Read.ai meeting routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.isReadAiConfigured.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires admin auth before searching meetings', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await listMeetings(makeList('ada@example.com'))

    expect(response.status).toBe(401)
    expect(mocks.isReadAiConfigured).not.toHaveBeenCalled()
    expect(mocks.searchMeetingsByAttendeeEmail).not.toHaveBeenCalled()
  })

  it('rejects a missing email and an unconfigured integration', async () => {
    const missing = await listMeetings(makeList())
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'email query parameter is required' })
    expect(mocks.isReadAiConfigured).not.toHaveBeenCalled()

    mocks.isReadAiConfigured.mockResolvedValue(false)
    const unconfigured = await listMeetings(makeList('ada@example.com'))
    expect(unconfigured.status).toBe(503)
    expect(await unconfigured.json()).toEqual({ error: 'Read.ai integration is not configured' })
    expect(mocks.searchMeetingsByAttendeeEmail).not.toHaveBeenCalled()
  })

  it('searches the last 30 days and omits transcript fields', async () => {
    mocks.searchMeetingsByAttendeeEmail.mockResolvedValue([
      {
        id: 'meet-1',
        title: 'Kickoff',
        start_time_ms: 10,
        end_time_ms: 20,
        participants: ['ada@example.com'],
        platform: 'zoom',
        report_url: 'https://read.ai/meet-1',
        summary: null,
        action_items: undefined,
        transcript: 'secret transcript',
      },
    ])

    const response = await listMeetings(makeList('  ada@example.com  '))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.searchMeetingsByAttendeeEmail).toHaveBeenCalledWith('  ada@example.com  ', {
      maxPages: 5,
      afterMs: NOW.getTime() - THIRTY_DAYS_MS,
    })
    expect(body.count).toBe(1)
    expect(body.meetings).toEqual([
      {
        id: 'meet-1',
        title: 'Kickoff',
        start_time_ms: 10,
        end_time_ms: 20,
        participants: ['ada@example.com'],
        platform: 'zoom',
        report_url: 'https://read.ai/meet-1',
        summary: null,
        action_items: null,
      },
    ])
    expect(JSON.stringify(body)).not.toContain('secret transcript')
  })

  it('hides a thrown search string behind the generic fetch error', async () => {
    mocks.searchMeetingsByAttendeeEmail.mockRejectedValue('token leaked')

    const response = await listMeetings(makeList('ada@example.com'))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Failed to fetch meetings' })
  })

  it('returns an Error message from search at 502', async () => {
    mocks.searchMeetingsByAttendeeEmail.mockRejectedValue(new Error('Read.ai 429'))

    const response = await listMeetings(makeList('ada@example.com'))

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Read.ai 429' })
  })

  it('requires admin auth and configuration before loading a transcript', async () => {
    mocks.verifyAdmin.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValueOnce(true)
    const unauthorized = await getMeeting(makeDetail(), { params: { id: 'meet-1' } })
    expect(unauthorized.status).toBe(401)
    expect(mocks.isReadAiConfigured).not.toHaveBeenCalled()

    mocks.isReadAiConfigured.mockResolvedValueOnce(false)
    const unconfigured = await getMeeting(makeDetail(), { params: { id: 'meet-1' } })
    expect(unconfigured.status).toBe(503)
    expect(mocks.getMeetingDetail).not.toHaveBeenCalled()
  })

  it('returns the full meeting detail, including the transcript', async () => {
    const meeting = { id: 'meet-1', transcript: 'full transcript', summary: 'sum' }
    mocks.getMeetingDetail.mockResolvedValue(meeting)

    const response = await getMeeting(makeDetail(), { params: { id: 'meet-1' } })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ meeting })
    expect(mocks.getMeetingDetail).toHaveBeenCalledWith('meet-1')
  })

  it('hides a thrown detail string and returns an Error message', async () => {
    mocks.getMeetingDetail.mockRejectedValueOnce('raw failure')
    const hidden = await getMeeting(makeDetail(), { params: { id: 'meet-1' } })
    expect(hidden.status).toBe(502)
    expect(await hidden.json()).toEqual({ error: 'Failed to fetch meeting' })

    mocks.getMeetingDetail.mockRejectedValueOnce(new Error('meeting expired'))
    const exposed = await getMeeting(makeDetail(), { params: { id: 'meet-9' } })
    expect(exposed.status).toBe(502)
    expect(await exposed.json()).toEqual({ error: 'meeting expired' })
  })
})
