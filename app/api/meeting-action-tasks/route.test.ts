import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  listTasks: vi.fn(),
  updateTask: vi.fn(),
  syncTasksToSlack: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/meeting-action-tasks', () => ({
  TASK_CATEGORIES: ['internal', 'outreach'],
  listTasks: mocks.listTasks,
  updateTask: mocks.updateTask,
  syncTasksToSlack: mocks.syncTasksToSlack,
}))

import { GET, PATCH } from './route'

function getRequest(query = '') {
  return new NextRequest(`http://localhost/api/meeting-action-tasks${query}`)
}

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/meeting-action-tasks', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function inQuery(rows: unknown[]) {
  return {
    select: vi.fn(() => ({
      in: vi.fn().mockResolvedValue({ data: rows, error: null }),
    })),
  }
}

describe('GET /api/meeting-action-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.listTasks.mockResolvedValue([])
  })

  it('returns the admin auth error before listing tasks', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(getRequest())

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.listTasks).not.toHaveBeenCalled()
  })

  it('applies no contact restriction when contact_submission_id is omitted or all', async () => {
    // filter === 'all' → no restriction on contact_submission_id
    await GET(getRequest())
    await GET(getRequest('?contact_submission_id=all'))

    expect(mocks.listTasks).toHaveBeenNthCalledWith(1, expect.objectContaining({
      contactSubmissionId: undefined,
    }))
    expect(mocks.listTasks).toHaveBeenNthCalledWith(2, expect.objectContaining({
      contactSubmissionId: undefined,
    }))
  })

  it('rejects a non-integer contact_submission_id', async () => {
    const response = await GET(getRequest('?contact_submission_id=lead-1'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'contact_submission_id must be an integer or "all"',
    })
    expect(mocks.listTasks).not.toHaveBeenCalled()
  })

  it('applies no category restriction when task_category is omitted or all', async () => {
    // filter === 'all' → no restriction on task_category
    await GET(getRequest('?task_category=all'))

    expect(mocks.listTasks).toHaveBeenCalledWith(expect.objectContaining({
      taskCategory: undefined,
    }))
  })

  it('rejects unknown task_category values', async () => {
    const response = await GET(getRequest('?task_category=internal,secret'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid task_category value(s): secret. Allowed: internal, outreach',
    })
    expect(mocks.listTasks).not.toHaveBeenCalled()
  })

  it('rejects unknown status values including literal all', async () => {
    const response = await GET(getRequest('?status=all'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid status value(s): all. Allowed: pending, in_progress, complete, cancelled',
    })
    expect(mocks.listTasks).not.toHaveBeenCalled()
  })

  it('forwards comma-separated statuses and a numeric contact id', async () => {
    await GET(getRequest('?status=pending,complete&contact_submission_id=42&task_category=outreach'))

    expect(mocks.listTasks).toHaveBeenCalledWith({
      meetingRecordId: undefined,
      clientProjectId: undefined,
      contactSubmissionId: 42,
      taskCategory: ['outreach'],
      status: ['pending', 'complete'],
    })
  })

  it('prefers the task contact id over the meeting contact when enriching leads', async () => {
    mocks.listTasks.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Call Jordan',
        client_project_id: 'proj-1',
        meeting_record_id: 'meet-1',
        contact_submission_id: 7,
      },
    ])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return inQuery([{ id: 'proj-1', project_name: 'Ops', client_name: 'Acme' }])
      }
      if (table === 'meeting_records') {
        return inQuery([{
          id: 'meet-1',
          meeting_type: 'discovery',
          meeting_date: '2026-09-01T00:00:00.000Z',
          contact_submission_id: 99,
        }])
      }
      if (table === 'contact_submissions') {
        return inQuery([{ id: 7, name: 'Jordan', email: 'jordan@example.com' }])
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(getRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tasks).toEqual([
      expect.objectContaining({
        id: 'task-1',
        project_name: 'Ops',
        client_name: 'Acme',
        meeting_type: 'discovery',
        contact_submission_id: 7,
        lead_name: 'Jordan',
        lead_email: 'jordan@example.com',
      }),
    ])
  })

  it('falls back to the meeting contact when the task has no contact_submission_id', async () => {
    mocks.listTasks.mockResolvedValue([
      {
        id: 'task-2',
        title: 'Backfill later',
        client_project_id: null,
        meeting_record_id: 'meet-2',
        contact_submission_id: null,
      },
    ])
    mocks.from.mockImplementation((table: string) => {
      if (table === 'meeting_records') {
        return inQuery([{
          id: 'meet-2',
          meeting_type: 'follow-up',
          meeting_date: null,
          contact_submission_id: 11,
        }])
      }
      if (table === 'contact_submissions') {
        return inQuery([{ id: 11, name: 'Pat', email: 'pat@example.com' }])
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(getRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.tasks[0]).toMatchObject({
      contact_submission_id: 11,
      lead_name: 'Pat',
      project_name: null,
    })
  })
})

describe('PATCH /api/meeting-action-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.updateTask.mockImplementation(async (id: string, fields: Record<string, unknown>) => ({
      id,
      title: 'Task',
      meeting_record_id: null,
      ...fields,
    }))
    mocks.syncTasksToSlack.mockResolvedValue({ synced: true, message: 'ok' })
  })

  it('requires a non-empty updates array', async () => {
    const response = await PATCH(patchRequest({ updates: [] }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'updates array is required' })
    expect(mocks.updateTask).not.toHaveBeenCalled()
  })

  it('rejects an invalid task_category on any update', async () => {
    const response = await PATCH(patchRequest({
      updates: [{ id: 'task-1', task_category: 'secret' }],
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid task_category: secret. Allowed: internal, outreach',
    })
    expect(mocks.updateTask).not.toHaveBeenCalled()
  })

  it('rejects a non-integer contact_submission_id', async () => {
    const response = await PATCH(patchRequest({
      updates: [{ id: 'task-1', contact_submission_id: '42' }],
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'contact_submission_id must be an integer or null',
    })
    expect(mocks.updateTask).not.toHaveBeenCalled()
  })

  it('skips rows without id and does not sync Slack when nothing was updated', async () => {
    const response = await PATCH(patchRequest({
      updates: [{ title: 'orphan' }],
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true, updated: [] })
    expect(mocks.updateTask).not.toHaveBeenCalled()
    expect(mocks.syncTasksToSlack).not.toHaveBeenCalled()
  })

  it('skips Slack when sync_slack is false', async () => {
    const response = await PATCH(patchRequest({
      updates: [{ id: 'task-1', status: 'complete' }],
      sync_slack: false,
    }))

    expect(response.status).toBe(200)
    expect(mocks.updateTask).toHaveBeenCalledWith(
      'task-1',
      { status: 'complete' },
      'admin-user',
    )
    expect(mocks.syncTasksToSlack).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('syncs Slack by default after a successful update', async () => {
    mocks.updateTask.mockResolvedValue({
      id: 'task-1',
      title: 'Ship notes',
      owner: 'rep',
      due_date: null,
      status: 'in_progress',
      meeting_record_id: null,
    })

    const response = await PATCH(patchRequest({
      updates: [{ id: 'task-1', status: 'in_progress' }],
    }))

    expect(response.status).toBe(200)
    expect(mocks.syncTasksToSlack).toHaveBeenCalledWith({
      action: 'update_status',
      tasks: [{
        id: 'task-1',
        title: 'Ship notes',
        owner: 'rep',
        due_date: null,
        status: 'in_progress',
        meeting_type: null,
        project_name: null,
        client_name: null,
      }],
    })
  })
})
