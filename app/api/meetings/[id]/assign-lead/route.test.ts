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

import { PATCH } from './route'

function params(id = 'meeting-1') {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(body: unknown, raw?: string) {
  return new NextRequest('http://localhost/api/meetings/meeting-1/assign-lead', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  })
}

function thenable(result: { data: unknown; error: unknown }) {
  const api: Record<string, any> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.update = vi.fn((payload?: unknown) => {
    api._lastUpdate = payload
    return api
  })
  api.eq = vi.fn(self)
  api.is = vi.fn(self)
  api.limit = vi.fn(self)
  api.maybeSingle = vi.fn(async () => result)
  api.single = vi.fn(async () => result)
  api.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return api
}

function setupAssignLead(opts: {
  previous?: { id: string; contact_submission_id: number | null } | null
  previousError?: { message: string } | null
  project?: { id: string } | null
  updated?: {
    id: string
    contact_submission_id: number | null
    client_project_id: string | null
  }
  updateError?: { message: string } | null
}) {
  const previousResult = opts.previousError
    ? { data: null, error: opts.previousError }
    : { data: opts.previous ?? null, error: null }
  const meetingSelect = thenable(previousResult)
  const meetingUpdate = thenable(
    opts.updateError
      ? { data: null, error: opts.updateError }
      : {
          data:
            opts.updated ?? {
              id: 'meeting-1',
              contact_submission_id: 12,
              client_project_id: null,
            },
          error: null,
        },
  )
  const projects = thenable({ data: opts.project ?? null, error: null })
  const tasks = thenable({ data: null, error: null })

  mocks.from.mockImplementation((table: string) => {
    if (table === 'meeting_records') {
      return {
        select: meetingSelect.select,
        update: (payload: unknown) => meetingUpdate.update(payload),
      }
    }
    if (table === 'client_projects') return projects
    if (table === 'meeting_action_tasks') return tasks
    throw new Error(`Unexpected table: ${table}`)
  })

  return { meetingSelect, meetingUpdate, projects, tasks }
}

describe('PATCH /api/meetings/[id]/assign-lead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('rejects non-admin callers before reading the meeting', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await PATCH(makeRequest({ contact_submission_id: 12 }), params())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('rejects a non-numeric contact_submission_id', async () => {
    const response = await PATCH(
      makeRequest({ contact_submission_id: '12' }),
      params(),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'contact_submission_id must be a number or null',
    })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 404 when the meeting does not exist', async () => {
    setupAssignLead({ previous: null })

    const response = await PATCH(makeRequest({ contact_submission_id: 12 }), params())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Meeting not found' })
  })

  it('backfills only unattributed tasks when linking a meeting that had no lead (case A)', async () => {
    const { meetingUpdate, tasks } = setupAssignLead({
      previous: { id: 'meeting-1', contact_submission_id: null },
      project: null,
      updated: {
        id: 'meeting-1',
        contact_submission_id: 12,
        client_project_id: null,
      },
    })

    const response = await PATCH(makeRequest({ contact_submission_id: 12 }), params())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      meeting: {
        id: 'meeting-1',
        contact_submission_id: 12,
        client_project_id: null,
      },
    })
    expect(meetingUpdate.update).toHaveBeenCalledWith({ contact_submission_id: 12 })
    expect(tasks.update).toHaveBeenCalledTimes(1)
    expect(tasks.update).toHaveBeenCalledWith({ contact_submission_id: 12 })
    expect(tasks.eq).toHaveBeenCalledWith('meeting_record_id', 'meeting-1')
    expect(tasks.is).toHaveBeenCalledWith('contact_submission_id', null)
  })

  it('reattributes only tasks that still match the previous lead (case B)', async () => {
    const { meetingUpdate, tasks } = setupAssignLead({
      previous: { id: 'meeting-1', contact_submission_id: 5 },
      project: null,
      updated: {
        id: 'meeting-1',
        contact_submission_id: 12,
        client_project_id: null,
      },
    })

    const response = await PATCH(makeRequest({ contact_submission_id: 12 }), params())

    expect(response.status).toBe(200)
    expect(meetingUpdate.update).toHaveBeenCalledWith({ contact_submission_id: 12 })
    expect(tasks.update).toHaveBeenCalledTimes(1)
    expect(tasks.update).toHaveBeenCalledWith({ contact_submission_id: 12 })
    expect(tasks.eq).toHaveBeenNthCalledWith(1, 'meeting_record_id', 'meeting-1')
    expect(tasks.eq).toHaveBeenNthCalledWith(2, 'contact_submission_id', 5)
    expect(tasks.is).not.toHaveBeenCalled()
  })

  it('unlinks the project and only clears tasks that still match the previous lead (case C)', async () => {
    const { meetingUpdate, tasks } = setupAssignLead({
      previous: { id: 'meeting-1', contact_submission_id: 5 },
      updated: {
        id: 'meeting-1',
        contact_submission_id: null,
        client_project_id: null,
      },
    })

    const response = await PATCH(makeRequest({ contact_submission_id: null }), params())

    expect(response.status).toBe(200)
    expect(meetingUpdate.update).toHaveBeenCalledWith({
      contact_submission_id: null,
      client_project_id: null,
    })
    expect(mocks.from).not.toHaveBeenCalledWith('client_projects')
    expect(tasks.update).toHaveBeenCalledTimes(1)
    expect(tasks.update).toHaveBeenCalledWith({ contact_submission_id: null })
    expect(tasks.eq).toHaveBeenNthCalledWith(1, 'meeting_record_id', 'meeting-1')
    expect(tasks.eq).toHaveBeenNthCalledWith(2, 'contact_submission_id', 5)
  })

  it('does not cascade tasks when the lead is unchanged', async () => {
    const { meetingUpdate, tasks } = setupAssignLead({
      previous: { id: 'meeting-1', contact_submission_id: 12 },
      project: null,
      updated: {
        id: 'meeting-1',
        contact_submission_id: 12,
        client_project_id: null,
      },
    })

    const response = await PATCH(makeRequest({ contact_submission_id: 12 }), params())

    expect(response.status).toBe(200)
    expect(meetingUpdate.update).toHaveBeenCalledWith({ contact_submission_id: 12 })
    expect(tasks.update).not.toHaveBeenCalled()
  })

  it('copies the lead project onto the meeting and null-project tasks', async () => {
    const { meetingUpdate, tasks } = setupAssignLead({
      previous: { id: 'meeting-1', contact_submission_id: null },
      project: { id: 'project-9' },
      updated: {
        id: 'meeting-1',
        contact_submission_id: 12,
        client_project_id: 'project-9',
      },
    })

    const response = await PATCH(makeRequest({ contact_submission_id: 12 }), params())

    expect(response.status).toBe(200)
    expect(meetingUpdate.update).toHaveBeenCalledWith({
      contact_submission_id: 12,
      client_project_id: 'project-9',
    })
    expect(tasks.update).toHaveBeenNthCalledWith(1, { client_project_id: 'project-9' })
    expect(tasks.is).toHaveBeenCalledWith('client_project_id', null)
    expect(tasks.update).toHaveBeenNthCalledWith(2, { contact_submission_id: 12 })
    expect(tasks.is).toHaveBeenCalledWith('contact_submission_id', null)
  })
})
