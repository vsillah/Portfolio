// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  ALL_PERSONAS,
  ALL_SCENARIOS,
  CRITICAL_SCENARIOS,
  JOURNEY_SCENARIOS,
  POPULATE_DEMO_SCENARIOS,
  SMOKE_TEST_SCENARIOS,
} from '@/lib/testing'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const mocks = vi.hoisted(() => {
  const orchestrator = {
    start: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn(() => ({ runId: 'run-live', status: 'running' })),
    stop: vi.fn().mockResolvedValue({ stopped: true }),
  }
  return { orchestrator, createOrchestrator: vi.fn(() => orchestrator) }
})

vi.mock('@/lib/testing', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/testing')>()
  return { ...actual, createOrchestrator: mocks.createOrchestrator }
})

type QueryResult = { data: unknown; error: unknown }

function queryBuilder(result: QueryResult) {
  const recorded: Array<{ method: string; args: unknown[] }> = []
  const builder: Record<string, unknown> = {}
  const record = (method: string) => (...args: unknown[]) => {
    recorded.push({ method, args })
    return builder
  }
  for (const method of ['select', 'eq', 'order', 'limit']) builder[method] = record(method)
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return { builder, recorded }
}

function installAuth() {
  createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
    ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
    : { from: vi.fn() })
}

function installList(result: QueryResult) {
  const query = queryBuilder(result)
  const from = vi.fn(() => query.builder)
  createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
    ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
    : { from })
  return { from, recorded: query.recorded }
}

function request(method: string, body?: unknown, query = '') {
  return new NextRequest(`http://localhost/api/testing/run${query}`, {
    method,
    headers: { Authorization: 'Bearer synthetic-token' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
}

async function startRun(body: Record<string, unknown> | string = {}) {
  vi.useFakeTimers()
  const handlers = await import('./route')
  const pending = handlers.POST(request('POST', body))
  await vi.advanceTimersByTimeAsync(500)
  return { handlers, response: await pending }
}

function personaIds(personas: ReadonlyArray<{ id: string }>) {
  return personas.map(persona => persona.id)
}

function expectStarted(
  config: {
    scenarios: ReadonlyArray<{ scenario: { id: string }; weight: number; personaPool: Array<{ id: string }> }>
    maxConcurrentClients: number
    spawnInterval: number
    runDuration: number
    maxClients?: number
    cleanupAfter: boolean
    adminToken?: string
  },
  scenarios: ReadonlyArray<{ id: string }>,
  personas: ReadonlyArray<{ id: string }>,
  overrides: {
    maxConcurrentClients: number
    spawnInterval: number
    runDuration: number
    maxClients?: number
    cleanupAfter: boolean
    adminToken?: string
  }
) {
  expect(config.scenarios.map(entry => ({
    id: entry.scenario.id,
    weight: entry.weight,
    personas: personaIds(entry.personaPool),
  }))).toEqual(scenarios.map(scenario => ({
    id: scenario.id,
    weight: 1,
    personas: personaIds(personas),
  })))
  expect(config).toMatchObject({
    ...overrides,
    testDataPrefix: 'test_e2e_',
    headless: true,
    screenshotOnFailure: true,
    captureNetworkHar: false,
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.orchestrator.start.mockResolvedValue(undefined)
  mocks.orchestrator.getStats.mockReturnValue({ runId: 'run-live', status: 'running' })
  mocks.orchestrator.stop.mockResolvedValue({ stopped: true })
  createClient.mockReset()
  installAuth()
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

describe('POST /api/testing/run scenario and persona selection', () => {
  it('defaults to every scenario and persona when the body is empty', async () => {
    const { response } = await startRun({})
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      runId: 'run-live',
      config: {
        scenarios: personaIds(ALL_SCENARIOS),
        personas: personaIds(ALL_PERSONAS),
        maxConcurrentClients: 1,
        runDuration: 60000,
      },
      message: `Test run started with ${ALL_SCENARIOS.length} scenarios and ${ALL_PERSONAS.length} personas`,
    })
    expectStarted(mocks.createOrchestrator.mock.calls[0][0], ALL_SCENARIOS, ALL_PERSONAS, {
      maxConcurrentClients: 1,
      spawnInterval: 5000,
      runDuration: 60000,
      maxClients: undefined,
      cleanupAfter: true,
      adminToken: undefined,
    })
    expect(mocks.orchestrator.start).toHaveBeenCalledOnce()
  })

  it.each([
    ['critical', CRITICAL_SCENARIOS],
    ['smoke', SMOKE_TEST_SCENARIOS],
    ['journey', JOURNEY_SCENARIOS],
    ['all', ALL_SCENARIOS],
    ['unrecognized', ALL_SCENARIOS],
  ] as const)('preset %s selects that scenario list without populate overrides', async (preset, scenarios) => {
    const { response } = await startRun({
      scenarioPreset: preset,
      personaIds: ['startup_sarah'],
      maxConcurrentClients: 2,
      spawnInterval: 8000,
      runDuration: 15000,
      maxClients: 4,
      cleanupAfter: false,
      adminToken: 'admin-jwt',
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.config).toEqual({
      scenarios: personaIds(scenarios),
      personas: ['startup_sarah'],
      maxConcurrentClients: 2,
      runDuration: 15000,
    })
    expectStarted(mocks.createOrchestrator.mock.calls[0][0], scenarios, [{ id: 'startup_sarah' }], {
      maxConcurrentClients: 2,
      spawnInterval: 8000,
      runDuration: 15000,
      maxClients: 4,
      cleanupAfter: false,
      adminToken: 'admin-jwt',
    })
  })

  it('forces populate-demo concurrency, interval, duration, and no cleanup', async () => {
    const { response } = await startRun({
      scenarioPreset: 'populate_demo',
      cleanupAfter: true,
      maxClients: 1,
      maxConcurrentClients: 3,
      spawnInterval: 9000,
      runDuration: 1000,
      adminToken: '',
    })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.config).toMatchObject({
      scenarios: personaIds(POPULATE_DEMO_SCENARIOS),
      personas: personaIds(ALL_PERSONAS),
      maxConcurrentClients: 3,
      runDuration: 1000,
    })
    expectStarted(
      mocks.createOrchestrator.mock.calls[0][0],
      POPULATE_DEMO_SCENARIOS,
      ALL_PERSONAS,
      {
        maxConcurrentClients: POPULATE_DEMO_SCENARIOS.length,
        spawnInterval: 2000,
        runDuration: 120000,
        maxClients: POPULATE_DEMO_SCENARIOS.length,
        cleanupAfter: false,
        adminToken: undefined,
      }
    )
  })

  it('lets explicit scenario ids override a preset while populate-demo still rewrites execution limits', async () => {
    const { response } = await startRun({
      scenarioPreset: 'populate_demo',
      scenarioIds: ['quick_browse', 'missing', 'quick_browse'],
      personaIds: ['ready_rachel', 'missing'],
    })
    expect(response.status).toBe(200)
    expect((await response.json()).config.scenarios).toEqual(['quick_browse', 'quick_browse'])
    expectStarted(
      mocks.createOrchestrator.mock.calls[0][0],
      [{ id: 'quick_browse' }, { id: 'quick_browse' }],
      [{ id: 'ready_rachel' }],
      {
        maxConcurrentClients: 2,
        spawnInterval: 2000,
        runDuration: 120000,
        maxClients: 2,
        cleanupAfter: false,
        adminToken: undefined,
      }
    )
  })

  it('rejects an id list that resolves to no scenarios before creating an orchestrator', async () => {
    const { response } = await startRun({ scenarioIds: ['missing'], scenarioPreset: 'smoke' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'No valid scenarios selected' })
    expect(mocks.createOrchestrator).not.toHaveBeenCalled()
  })

  it('falls back to every persona when every requested persona id is unknown', async () => {
    const { response } = await startRun({ scenarioIds: ['quick_browse'], personaIds: ['missing'] })
    expect(response.status).toBe(200)
    expect((await response.json()).config.personas).toEqual(personaIds(ALL_PERSONAS))
    expect(mocks.createOrchestrator.mock.calls[0][0].scenarios[0].personaPool.map((persona: { id: string }) => persona.id))
      .toEqual(personaIds(ALL_PERSONAS))
  })

  it('returns success when the orchestrator fails to start after the run is accepted', async () => {
    mocks.orchestrator.start.mockRejectedValue(new Error('spawn failed'))
    const { response } = await startRun({ scenarioIds: ['quick_browse'] })
    expect(response.status).toBe(200)
    expect((await response.json()).runId).toBe('run-live')
  })

  it('returns the thrown message when the body is not JSON', async () => {
    const { response } = await startRun('{')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to start test run')
    expect(body.details).toEqual(expect.any(String))
    expect(mocks.createOrchestrator).not.toHaveBeenCalled()
  })
})

describe('GET and DELETE /api/testing/run active orchestrators', () => {
  it('lists runs with the requested limit and status and attaches live stats only for the active id', async () => {
    const { handlers } = await startRun({ scenarioIds: ['quick_browse'], runDuration: 0 })
    const { from, recorded } = installList({
      data: [
        { run_id: 'run-live', status: 'running' },
        { run_id: 'run-old', status: 'completed' },
      ],
      error: null,
    })
    const response = await handlers.GET(request('GET', undefined, '?limit=10abc&status=running'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      runs: [
        { run_id: 'run-live', status: 'running', liveStats: { runId: 'run-live', status: 'running' } },
        { run_id: 'run-old', status: 'completed' },
      ],
      activeRuns: ['run-live'],
    })
    expect(from).toHaveBeenCalledWith('test_runs')
    expect(recorded).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'order', args: ['started_at', { ascending: false }] },
      { method: 'limit', args: [10] },
      { method: 'eq', args: ['status', 'running'] },
    ])
  })

  it('drops live stats after the request run duration plus one minute', async () => {
    const { handlers } = await startRun({ scenarioIds: ['quick_browse'], runDuration: 0 })
    await vi.advanceTimersByTimeAsync(60000)
    installList({ data: [{ run_id: 'run-live', status: 'running' }], error: null })
    const response = await handlers.GET(request('GET'))
    expect(await response.json()).toEqual({
      runs: [{ run_id: 'run-live', status: 'running' }],
      activeRuns: [],
    })
  })

  it('uses a limit of 10 and skips the status filter when those params are blank', async () => {
    const { recorded } = installList({ data: [], error: null })
    const { GET } = await import('./route')
    const response = await GET(request('GET', undefined, '?limit=&status='))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ runs: [], activeRuns: [] })
    expect(recorded).toContainEqual({ method: 'limit', args: [10] })
    expect(recorded.some(call => call.method === 'eq')).toBe(false)
  })

  it('passes a numeric zero limit through', async () => {
    const { recorded } = installList({ data: [], error: null })
    const { GET } = await import('./route')
    await GET(request('GET', undefined, '?limit=0'))
    expect(recorded).toContainEqual({ method: 'limit', args: [0] })
  })

  it('hides query failures as a generic list error', async () => {
    installList({ data: null, error: { message: 'relation missing' } })
    const { GET } = await import('./route')
    const response = await GET(request('GET'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to list test runs' })
  })

  it('stops a live run once and then reports it completed', async () => {
    const { handlers } = await startRun({ scenarioIds: ['quick_browse'] })
    const response = await handlers.DELETE(request('DELETE', undefined, '?runId=run-live'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, runId: 'run-live', result: { stopped: true } })
    expect(mocks.orchestrator.stop).toHaveBeenCalledOnce()
    const second = await handlers.DELETE(request('DELETE', undefined, '?runId=run-live'))
    expect(second.status).toBe(404)
    expect(await second.json()).toEqual({ error: 'Test run not found or already completed' })
  })

  it('requires a run id and does not stop an unknown run', async () => {
    const { DELETE } = await import('./route')
    const missing = await DELETE(request('DELETE'))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'runId is required' })
    const unknown = await DELETE(request('DELETE', undefined, '?runId=%20%20'))
    expect(unknown.status).toBe(404)
    expect(mocks.orchestrator.stop).not.toHaveBeenCalled()
  })

  it('returns a generic error when stop throws', async () => {
    const { handlers } = await startRun({ scenarioIds: ['quick_browse'] })
    mocks.orchestrator.stop.mockRejectedValue(new Error('already stopped'))
    const response = await handlers.DELETE(request('DELETE', undefined, '?runId=run-live'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to stop test run' })
  })
})
