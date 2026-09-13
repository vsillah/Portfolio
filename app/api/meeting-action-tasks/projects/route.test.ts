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

function request() {
  return new NextRequest('http://localhost/api/meeting-action-tasks/projects')
}

describe('GET /api/meeting-action-tasks/projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user' } })
    mocks.isAuthError.mockReturnValue(false)
  })

  it('returns the admin auth error before querying projects', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Forbidden', status: 403 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await GET(request())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns an empty list when no tasks are attributed to a project', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn(() => ({
        not: vi.fn().mockResolvedValue({ data: [{ client_project_id: null }], error: null }),
      })),
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ projects: [] })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.from).toHaveBeenCalledWith('meeting_action_tasks')
  })

  it('dedupes project ids and returns client/project names', async () => {
    const inFn = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 'proj-1', project_name: 'Ops', client_name: 'Acme' },
          { id: 'proj-2', project_name: null, client_name: 'Beta' },
        ],
        error: null,
      }),
    }))
    const taskQuery = {
      select: vi.fn(() => ({
        not: vi.fn().mockResolvedValue({
          data: [
            { client_project_id: 'proj-1' },
            { client_project_id: 'proj-1' },
            { client_project_id: 'proj-2' },
          ],
          error: null,
        }),
      })),
    }
    const projectQuery = {
      select: vi.fn(() => ({ in: inFn })),
    }
    mocks.from.mockImplementation((table: string) => {
      if (table === 'meeting_action_tasks') return taskQuery
      if (table === 'client_projects') return projectQuery
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await GET(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      projects: [
        { id: 'proj-1', project_name: 'Ops', client_name: 'Acme' },
        { id: 'proj-2', project_name: null, client_name: 'Beta' },
      ],
    })
    expect(inFn).toHaveBeenCalledWith('id', ['proj-1', 'proj-2'])
  })
})
