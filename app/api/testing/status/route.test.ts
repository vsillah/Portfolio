// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

type QueryResult = { data: unknown; error: unknown }
const calls = new Map<string, Array<{ method: string; args: unknown[] }>>()

function queryBuilder(result: QueryResult) {
  const recorded: Array<{ method: string; args: unknown[] }> = []
  const builder: Record<string, unknown> = {}
  const record = (method: string) => (...args: unknown[]) => {
    recorded.push({ method, args })
    return method === 'single' ? Promise.resolve(result) : builder
  }
  for (const method of ['select', 'eq', 'order', 'limit', 'single']) builder[method] = record(method)
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return { builder, recorded }
}

function installDatabase(results: Record<string, QueryResult>, fromImpl?: () => unknown) {
  calls.clear()
  const from = vi.fn((table: string) => {
    if (fromImpl) return fromImpl()
    const query = queryBuilder(results[table] ?? { data: null, error: { message: 'missing table' } })
    calls.set(table, query.recorded)
    return query.builder
  })
  createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
    ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
    : { from })
  return from
}

function statusRequest(query = 'runId=run-1') {
  return new NextRequest(`http://localhost/api/testing/status?${query}`, {
    headers: { Authorization: 'Bearer synthetic-token' },
  })
}

beforeEach(() => {
  vi.resetModules()
  createClient.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.invalid')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-public-key')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-key')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([{ role: 'admin' }]))))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('GET /api/testing/status aggregation', () => {
  it('reconciles a stored completed run to failed and keeps the newest ten sessions', async () => {
    const sessions = [
      { scenario: 'smoke', status: 'completed' },
      { scenario: 'smoke', status: 'failed' },
      { scenario: 'smoke', status: 'running' },
      { scenario: 'smoke', status: 'cancelled' },
      { scenario: 'audit', status: 'completed' },
      ...Array.from({ length: 8 }, (_, index) => ({ scenario: 'filler', status: 'completed', id: `extra-${index}` })),
    ]
    const from = installDatabase({
      test_runs: {
        data: {
          id: 'row-1',
          run_id: 'run-1',
          status: 'completed',
          clients_spawned: 3,
          clients_completed: 1,
          clients_failed: 1,
          started_at: '2026-10-01T10:00:00.000Z',
          completed_at: '2026-10-01T10:00:05.000Z',
          config: { preset: 'smoke' },
        },
        error: null,
      },
      test_client_sessions: { data: sessions, error: null },
      test_errors: { data: [{ error_id: 'e1' }, { error_id: 'e2' }], error: null },
    })
    const { GET } = await import('./route')
    const response = await GET(statusRequest())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      runId: 'run-1',
      status: 'completed',
      displayStatus: 'failed',
      startedAt: '2026-10-01T10:00:00.000Z',
      completedAt: '2026-10-01T10:00:05.000Z',
      duration: 5000,
      config: { preset: 'smoke' },
      stats: {
        clientsSpawned: 3,
        clientsCompleted: 1,
        clientsFailed: 1,
        clientsRunning: 1,
        successRate: 33,
        errorCount: 2,
      },
      scenarioBreakdown: {
        smoke: { total: 4, passed: 1, failed: 1, running: 1 },
        audit: { total: 1, passed: 1, failed: 0, running: 0 },
        filler: { total: 8, passed: 8, failed: 0, running: 0 },
      },
      recentErrors: [{ error_id: 'e1' }, { error_id: 'e2' }],
      sessions: sessions.slice(0, 10),
    })
    expect(calls.get('test_client_sessions')).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'order', args: ['started_at', { ascending: false }] }),
    ]))
    expect(calls.get('test_errors')).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'limit', args: [20] }),
    ]))
    expect(from).toHaveBeenCalledTimes(3)
  })

  it('keeps a running run in progress and measures duration from now', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T10:07:00.000Z'))
    installDatabase({
      test_runs: {
        data: {
          id: 'row-2',
          run_id: 'run-2',
          status: 'running',
          clients_spawned: 2,
          clients_completed: 0,
          clients_failed: 2,
          started_at: '2026-10-01T10:00:00.000Z',
          completed_at: null,
          config: null,
        },
        error: null,
      },
      test_client_sessions: { data: [], error: null },
      test_errors: { data: [], error: null },
    })
    const { GET } = await import('./route')
    const response = await GET(statusRequest('runId=run-2'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'running',
      displayStatus: 'running',
      duration: 420000,
      stats: { successRate: 0, clientsRunning: 0, errorCount: 0 },
      sessions: [],
      recentErrors: [],
    })
  })

  it('treats a missing or blank run id as required and still queries a whitespace id', async () => {
    const from = installDatabase({
      test_runs: { data: null, error: { message: 'missing' } },
    })
    const { GET } = await import('./route')
    expect(await (await GET(statusRequest(''))).json()).toEqual({ error: 'runId is required' })
    expect(await (await GET(statusRequest('runId='))).json()).toEqual({ error: 'runId is required' })
    expect(from).not.toHaveBeenCalled()
    const spaced = await GET(statusRequest('runId=%20'))
    expect(spaced.status).toBe(404)
    expect(calls.get('test_runs')).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'eq', args: ['run_id', ' '] }),
    ]))
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('returns an empty breakdown when session and error reads come back null', async () => {
    installDatabase({
      test_runs: {
        data: {
          id: 'row-3',
          run_id: 'run-3',
          status: 'completed',
          clients_spawned: 0,
          clients_completed: 0,
          clients_failed: 0,
          started_at: '2026-10-01T10:00:00.000Z',
          completed_at: '2026-10-01T10:00:00.000Z',
          config: {},
        },
        error: null,
      },
      test_client_sessions: { data: null, error: { message: 'sessions unavailable' } },
      test_errors: { data: null, error: { message: 'errors unavailable' } },
    })
    const { GET } = await import('./route')
    const response = await GET(statusRequest('runId=run-3'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      displayStatus: 'completed',
      stats: { successRate: 0, clientsRunning: 0, errorCount: 0 },
      scenarioBreakdown: {},
      recentErrors: [],
      sessions: [],
    })
  })

  it('hides query failures behind a generic status error', async () => {
    installDatabase({}, () => { throw new Error('private connection detail') })
    const { GET } = await import('./route')
    const response = await GET(statusRequest())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to get test status' })
  })
})
