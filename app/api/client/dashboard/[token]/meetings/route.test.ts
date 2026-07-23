import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    vi.clearAllMocks()
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
    expect(mocks.from).toHaveBeenCalledWith('meeting_records')
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('structured_notes'))
    expect(query.eq).toHaveBeenCalledWith('client_project_id', 'project-1')
    expect(query.order).toHaveBeenCalledWith('meeting_date', { ascending: false })
    expect(query.limit).toHaveBeenCalledWith(50)
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
