import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  validateDashboardToken: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/client-dashboard', () => ({
  validateDashboardToken: mocks.validateDashboardToken,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { GET } from './route'

function request(token: string) {
  return new NextRequest(`http://localhost/api/client/dashboard/${token}/meetings`)
}

function installMeetingQuery(result: {
  data: Array<Record<string, unknown>> | null
  error: Record<string, unknown> | null
}) {
  const limit = vi.fn().mockResolvedValue(result)
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))

  mocks.from.mockReturnValue({ select })

  return { select, eq, order, limit }
}

describe('GET /api/client/dashboard/[token]/meetings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects tokens without a client project before querying meeting data', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: null,
      error: null,
    })

    const response = await GET(request('lead-dashboard-token'), {
      params: Promise.resolve({ token: 'lead-dashboard-token' }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid dashboard link',
    })
    expect(mocks.validateDashboardToken).toHaveBeenCalledOnce()
    expect(mocks.validateDashboardToken).toHaveBeenCalledWith('lead-dashboard-token')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects an expired dashboard token before querying meeting data', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: null,
      error: 'Invalid or expired dashboard link',
    })

    const response = await GET(request('expired-dashboard-token'), {
      params: Promise.resolve({ token: 'expired-dashboard-token' }),
    })

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid or expired dashboard link',
    })
    expect(mocks.validateDashboardToken).toHaveBeenCalledWith('expired-dashboard-token')
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('scopes meeting history to the project linked to the dashboard token', async () => {
    const meetings = [
      {
        id: 'meeting-1',
        meeting_type: 'progress_checkin',
        meeting_date: '2026-07-20T12:00:00.000Z',
      },
    ]
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    const query = installMeetingQuery({ data: meetings, error: null })

    const response = await GET(request('valid-dashboard-token'), {
      params: Promise.resolve({ token: 'valid-dashboard-token' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ meetings })
    expect(mocks.validateDashboardToken).toHaveBeenCalledWith('valid-dashboard-token')
    expect(mocks.from).toHaveBeenCalledWith('meeting_records')
    const projection = query.select.mock.calls[0]?.[0] as string
    const selectedFields = projection.split(',').map((field) => field.trim()).sort()
    expect(selectedFields).toEqual([
      'action_items',
      'duration_minutes',
      'id',
      'key_decisions',
      'meeting_date',
      'meeting_type',
      'open_questions',
      'recording_url',
      'structured_notes',
    ])
    expect(projection).not.toMatch(/transcript|\*/)
    expect(query.eq).toHaveBeenCalledWith('client_project_id', 'project-1')
    expect(query.order).toHaveBeenCalledWith('meeting_date', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(50)
  })

  it('normalizes an empty successful query to an empty meeting list', async () => {
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    installMeetingQuery({ data: null, error: null })

    const response = await GET(request('valid-dashboard-token'), {
      params: Promise.resolve({ token: 'valid-dashboard-token' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ meetings: [] })
  })

  it('returns a generic error when the meeting query fails', async () => {
    const databaseError = { message: 'connection details must stay server-side' }
    mocks.validateDashboardToken.mockResolvedValue({
      projectId: 'project-1',
      error: null,
    })
    installMeetingQuery({ data: null, error: databaseError })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await GET(request('valid-dashboard-token'), {
      params: Promise.resolve({ token: 'valid-dashboard-token' }),
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch meetings',
    })
    expect(consoleError).toHaveBeenCalledWith('Error fetching meetings:', databaseError)
  })
})
