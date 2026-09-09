import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  promoteActionItems: vi.fn(),
  listTasks: vi.fn(),
  syncTasksToSlack: vi.fn(),
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

vi.mock('@/lib/meeting-action-tasks', () => ({
  promoteActionItems: mocks.promoteActionItems,
  listTasks: mocks.listTasks,
  syncTasksToSlack: mocks.syncTasksToSlack,
}))

import { POST } from './route'

function makeRequest(id: string, body?: unknown, headers?: Record<string, string>) {
  return new NextRequest(`http://localhost/api/meetings/${id}/promote-tasks`, {
    method: 'POST',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/meetings/[id]/promote-tasks', () => {
  const ORIGINAL_SECRET = process.env.N8N_INGEST_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.N8N_INGEST_SECRET = 'n8n-secret'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.promoteActionItems.mockResolvedValue({ created: 2, skipped: 1 })
    mocks.listTasks.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Send recap',
        owner: 'Ada',
        due_date: '2026-07-02',
        status: 'pending',
      },
    ])
    mocks.syncTasksToSlack.mockResolvedValue({ synced: true, message: 'ok' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.N8N_INGEST_SECRET
    } else {
      process.env.N8N_INGEST_SECRET = ORIGINAL_SECRET
    }
  })

  it('rejects callers without admin session or ingest secret', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(makeRequest('m-1', {}), params('m-1'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.promoteActionItems).not.toHaveBeenCalled()
  })

  it('accepts n8n Bearer auth when the admin session is missing', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    mocks.promoteActionItems.mockResolvedValue({ created: 0, skipped: 3 })

    const response = await POST(
      makeRequest('m-1', { sync_slack: false }, { authorization: 'Bearer n8n-secret' }),
      params('m-1'),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      created: 0,
      skipped: 3,
      slack: null,
    })
    expect(mocks.promoteActionItems).toHaveBeenCalledWith('m-1')
    expect(mocks.syncTasksToSlack).not.toHaveBeenCalled()
  })

  it('does not treat a Bearer token as valid when N8N_INGEST_SECRET is unset', async () => {
    delete process.env.N8N_INGEST_SECRET
    mocks.verifyAdmin.mockResolvedValue({ error: 'Authentication required', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(
      makeRequest('m-1', {}, { authorization: 'Bearer n8n-secret' }),
      params('m-1'),
    )

    expect(response.status).toBe(401)
    expect(mocks.promoteActionItems).not.toHaveBeenCalled()
  })

  it('skips Slack when no new tasks were created', async () => {
    mocks.promoteActionItems.mockResolvedValue({ created: 0, skipped: 4 })

    const response = await POST(makeRequest('m-1', {}), params('m-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ created: 0, skipped: 4, slack: null })
    expect(mocks.syncTasksToSlack).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('skips Slack when sync_slack is false even if tasks were created', async () => {
    const response = await POST(makeRequest('m-1', { sync_slack: false }), params('m-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ created: 2, slack: null })
    expect(mocks.listTasks).not.toHaveBeenCalled()
    expect(mocks.syncTasksToSlack).not.toHaveBeenCalled()
  })

  it('syncs created tasks to Slack with meeting and project context by default', async () => {
    const meetingSingle = vi.fn().mockResolvedValue({
      data: { meeting_type: 'kickoff', client_project_id: 'proj-1' },
      error: null,
    })
    const meetingEq = vi.fn().mockReturnValue({ single: meetingSingle })
    const meetingSelect = vi.fn().mockReturnValue({ eq: meetingEq })

    const projectSingle = vi.fn().mockResolvedValue({
      data: { project_name: 'Acme AI', client_name: 'Ada' },
      error: null,
    })
    const projectEq = vi.fn().mockReturnValue({ single: projectSingle })
    const projectSelect = vi.fn().mockReturnValue({ eq: projectEq })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'meeting_records') return { select: meetingSelect }
      if (table === 'client_projects') return { select: projectSelect }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(makeRequest('m-1'), params('m-1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      created: 2,
      skipped: 1,
      slack: { synced: true, message: 'ok' },
    })
    expect(mocks.listTasks).toHaveBeenCalledWith({ meetingRecordId: 'm-1' })
    expect(meetingEq).toHaveBeenCalledWith('id', 'm-1')
    expect(projectEq).toHaveBeenCalledWith('id', 'proj-1')
    expect(mocks.syncTasksToSlack).toHaveBeenCalledWith({
      action: 'create',
      tasks: [
        {
          id: 'task-1',
          title: 'Send recap',
          owner: 'Ada',
          due_date: '2026-07-02',
          status: 'pending',
          meeting_type: 'kickoff',
          project_name: 'Acme AI',
          client_name: 'Ada',
        },
      ],
    })
  })

  it('returns the thrown message on the 500 path', async () => {
    mocks.promoteActionItems.mockRejectedValue(new Error('Meeting record not found: m-missing'))

    const response = await POST(makeRequest('m-missing', {}), params('m-missing'))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Meeting record not found: m-missing' })
  })
})
