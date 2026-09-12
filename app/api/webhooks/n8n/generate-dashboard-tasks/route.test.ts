import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

const BASE_ENV = { ...process.env }
const SECRET = 'ingest-secret'

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function makeRequest(
  body: unknown,
  headers: Record<string, string> = { authorization: `Bearer ${SECRET}` },
) {
  return new NextRequest('http://localhost/api/webhooks/n8n/generate-dashboard-tasks', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/webhooks/n8n/generate-dashboard-tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = SECRET
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    restoreEnv()
    vi.restoreAllMocks()
  })

  it('returns 401 when the bearer token is missing or invalid', async () => {
    const missing = await POST(makeRequest({ client_project_id: 'p1', tasks: [] }, {}))
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({ error: 'Unauthorized' })

    delete process.env.N8N_INGEST_SECRET
    const unset = await POST(
      makeRequest({ client_project_id: 'p1', tasks: [] }),
    )
    expect(unset.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON or a missing tasks array', async () => {
    const invalid = await POST(makeRequest('{not-json', { authorization: `Bearer ${SECRET}` }))
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Invalid JSON body' })

    const missingTasks = await POST(makeRequest({ client_project_id: 'p1' }))
    expect(missingTasks.status).toBe(400)
    expect(await missingTasks.json()).toEqual({
      error: 'client_project_id and tasks array are required',
    })
  })

  it('returns 404 when the client project is missing', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } })
    const eq = vi.fn().mockReturnValue({ single })
    const select = vi.fn().mockReturnValue({ eq })
    mocks.from.mockReturnValue({ select })

    const response = await POST(
      makeRequest({
        client_project_id: 'missing',
        tasks: [{ category: 'ops', title: 'Stand up CRM' }],
      }),
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Project not found' })
  })

  it('assigns sequential display_order after the current max', async () => {
    const projectSingle = vi.fn().mockResolvedValue({ data: { id: 'proj-1' }, error: null })
    const maxSingle = vi.fn().mockResolvedValue({
      data: { display_order: 4 },
      error: null,
    })
    const insertSelect = vi.fn().mockResolvedValue({
      data: [{ id: 't1' }, { id: 't2' }],
      error: null,
    })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: projectSingle }),
          }),
        }
      }
      if (table === 'dashboard_tasks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ single: maxSingle }),
              }),
            }),
          }),
          insert,
        }
      }
      return {}
    })

    const response = await POST(
      makeRequest({
        client_project_id: 'proj-1',
        tasks: [
          { category: 'ops', title: 'Stand up CRM' },
          { category: 'ops', title: 'Document SOP', priority: 'high', impact_score: 8 },
        ],
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, tasks_created: 2 })
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        client_project_id: 'proj-1',
        title: 'Stand up CRM',
        priority: 'medium',
        impact_score: 0,
        display_order: 5,
      }),
      expect.objectContaining({
        title: 'Document SOP',
        priority: 'high',
        impact_score: 8,
        display_order: 6,
      }),
    ])
  })

  it('starts display_order at 0 when no tasks exist yet', async () => {
    const projectSingle = vi.fn().mockResolvedValue({ data: { id: 'proj-1' }, error: null })
    const maxSingle = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 't1' }], error: null })
    const insert = vi.fn().mockReturnValue({ select: insertSelect })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: projectSingle }),
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({ single: maxSingle }),
            }),
          }),
        }),
        insert,
      }
    })

    const response = await POST(
      makeRequest({
        client_project_id: 'proj-1',
        tasks: [{ category: 'ops', title: 'First task' }],
      }),
    )

    expect(response.status).toBe(200)
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ display_order: 0, title: 'First task' }),
    ])
  })
})
