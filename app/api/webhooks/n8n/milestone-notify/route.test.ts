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
  return new NextRequest('http://localhost/api/webhooks/n8n/milestone-notify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function projectChain(data: unknown) {
  const single = vi.fn().mockResolvedValue({ data, error: data ? null : { message: 'missing' } })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return { select }
}

function thenableQuery(data: unknown) {
  const resolved = { data, error: null }
  return {
    then(
      resolve: (value: typeof resolved) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(resolved).then(resolve, reject)
    },
    single: () => Promise.resolve(resolved),
  }
}

function snapshotChain(data: unknown) {
  return {
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: () => thenableQuery(data),
        }),
      }),
    }),
  }
}

function tasksChain(data: unknown) {
  const eq = vi.fn().mockResolvedValue({ data, error: null })
  const select = vi.fn().mockReturnValue({ eq })
  return { select }
}

function accessChain(data: unknown) {
  const single = vi.fn().mockResolvedValue({ data, error: null })
  const limit = vi.fn().mockReturnValue({ single })
  const eqActive = vi.fn().mockReturnValue({ limit })
  const eqProject = vi.fn().mockReturnValue({ eq: eqActive })
  const select = vi.fn().mockReturnValue({ eq: eqProject })
  return { select }
}

describe('POST /api/webhooks/n8n/milestone-notify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv()
    process.env.N8N_INGEST_SECRET = SECRET
  })

  afterEach(() => {
    restoreEnv()
  })

  it('returns 401 when the bearer token is missing, wrong, or unset', async () => {
    const missing = await POST(makeRequest({ client_project_id: 'p1' }, {}))
    expect(missing.status).toBe(401)

    const wrong = await POST(
      makeRequest({ client_project_id: 'p1' }, { authorization: 'Bearer nope' }),
    )
    expect(wrong.status).toBe(401)

    delete process.env.N8N_INGEST_SECRET
    const unset = await POST(makeRequest({ client_project_id: 'p1' }))
    expect(unset.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid JSON or a missing client_project_id', async () => {
    const invalid = await POST(makeRequest('{', { authorization: `Bearer ${SECRET}` }))
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toEqual({ error: 'Invalid JSON body' })

    const missingId = await POST(makeRequest({}))
    expect(missingId.status).toBe(400)
    expect(await missingId.json()).toEqual({ error: 'client_project_id is required' })
  })

  it('returns 404 when the client project does not exist', async () => {
    mocks.from.mockReturnValue(projectChain(null))

    const response = await POST(makeRequest({ client_project_id: 'missing' }))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Project not found' })
    expect(mocks.from).toHaveBeenCalledWith('client_projects')
  })

  it('reports newly crossed score thresholds using prior snapshot rows', async () => {
    const snapshotResults = [
      {
        overall_score: 80,
        category_scores: {},
        snapshot_date: '2026-08-20',
      },
      [{ overall_score: 80 }, { overall_score: 40 }],
    ]
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return projectChain({
          id: 'proj-1',
          client_name: 'Neil',
          client_email: 'neil@example.com',
          client_company: 'KMB',
          onboarding_plan_id: 'plan-1',
        })
      }
      if (table === 'score_snapshots') {
        return snapshotChain(snapshotResults.shift() ?? null)
      }
      if (table === 'dashboard_tasks') {
        return tasksChain([
          { status: 'complete' },
          { status: 'complete' },
          { status: 'open' },
        ])
      }
      if (table === 'client_dashboard_access') {
        return accessChain({ access_token: 'dash-token' })
      }
      return {}
    })

    const response = await POST(makeRequest({ client_project_id: 'proj-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      client_name: 'Neil',
      client_email: 'neil@example.com',
      current_score: 80,
      previous_score: 40,
      score_change: 40,
      completion_rate: 67,
      tasks_completed: 2,
      tasks_total: 3,
      new_milestones: [50, 75],
      has_new_milestones: true,
      dashboard_url: '/client/dashboard/dash-token',
    })
  })

  it('treats a single prior snapshot object as previous_score 0', async () => {
    let snapshotCalls = 0
    mocks.from.mockImplementation((table: string) => {
      if (table === 'client_projects') {
        return projectChain({
          id: 'proj-1',
          client_name: 'Neil',
          client_email: 'neil@example.com',
          client_company: 'KMB',
          onboarding_plan_id: null,
        })
      }
      if (table === 'score_snapshots') {
        snapshotCalls += 1
        if (snapshotCalls === 1) {
          return snapshotChain({
            overall_score: 25,
            category_scores: {},
            snapshot_date: '2026-08-20',
          })
        }
        return snapshotChain({ overall_score: 25 })
      }
      if (table === 'dashboard_tasks') return tasksChain([])
      if (table === 'client_dashboard_access') return accessChain(null)
      return {}
    })

    const response = await POST(makeRequest({ client_project_id: 'proj-1' }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      current_score: 25,
      previous_score: 0,
      new_milestones: [25],
      has_new_milestones: true,
      dashboard_url: null,
      completion_rate: 0,
    })
  })
})
