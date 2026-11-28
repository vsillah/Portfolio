// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

type QueryResult = { data: unknown; error: unknown }

function queryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const record = (method: string) => () => (method === 'single' ? Promise.resolve(result) : builder)
  for (const method of ['select', 'eq', 'order', 'single']) builder[method] = record(method)
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return builder
}

function installDatabase(results: Record<string, QueryResult>) {
  createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
    ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
    : {
      from: (table: string) => queryBuilder(results[table] ?? { data: null, error: { message: 'missing' } }),
    })
}

function resultsRequest(query: string) {
  return new NextRequest(`http://localhost/api/testing/results?${query}`, {
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
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('GET /api/testing/results metrics', () => {
  const sessions = [
    {
      client_id: 'client-1',
      persona: 'anna',
      scenario: 'smoke',
      status: 'completed',
      started_at: '2026-10-01T10:00:00.000Z',
      completed_at: '2026-10-01T10:00:01.000Z',
      steps_completed: ['open', 'submit'],
      errors: [{ id: 'se-1' }],
      created_chat_session_id: 'chat-1',
      created_contact_id: null,
      created_diagnostic_id: null,
      created_order_id: null,
    },
    {
      client_id: 'client-2',
      persona: 'ben',
      scenario: 'smoke',
      status: 'running',
      started_at: '2026-10-01T10:00:00.000Z',
      completed_at: null,
      steps_completed: null,
      errors: null,
      created_chat_session_id: null,
      created_contact_id: 12,
      created_diagnostic_id: null,
      created_order_id: null,
    },
    {
      client_id: 'client-3',
      persona: 'cara',
      scenario: 'audit',
      status: 'failed',
      started_at: '2026-10-01T10:00:00.000Z',
      completed_at: '2026-10-01T10:00:03.000Z',
      steps_completed: [],
      errors: [],
      created_chat_session_id: null,
      created_contact_id: null,
      created_diagnostic_id: 'diag-1',
      created_order_id: 'order-1',
    },
  ]
  const errors = [
    { error_type: 'api_error', scenario: 'smoke', error_message: 'one', step_type: 'chat' },
    { error_type: 'api_error', scenario: 'smoke', error_message: 'two', step_type: 'chat' },
    { error_type: 'api_error', scenario: 'audit', error_message: 'three', step_type: 'form' },
    { error_type: 'api_error', scenario: 'audit', error_message: 'four', step_type: 'form' },
    { error_type: 'timeout', scenario: 'audit', error_message: 'slow', step_type: 'wait' },
  ]

  function installRun() {
    installDatabase({
      test_runs: {
        data: {
          id: 'row-1',
          run_id: 'run-1',
          status: 'completed',
          clients_spawned: 3,
          clients_completed: 1,
          clients_failed: 1,
          started_at: '2026-10-01T10:00:00.000Z',
          completed_at: '2026-10-01T10:05:00.000Z',
          config: { preset: 'smoke' },
        },
        error: null,
      },
      test_client_sessions: { data: sessions, error: null },
      test_errors: { data: errors, error: null },
    })
  }

  it('keeps an unrounded success rate and caps grouped error samples', async () => {
    installRun()
    const { GET } = await import('./route')
    const response = await GET(resultsRequest('runId=run-1&includeSessionDetails=TRUE'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.metrics).toMatchObject({
      totalClients: 3,
      successfulClients: 1,
      failedClients: 1,
      successRate: (1 / 3) * 100,
      totalErrors: 5,
      uniqueErrorTypes: 2,
      totalDuration: 300000,
      averageSessionDuration: 2000,
      scenarioStats: {
        smoke: { total: 2, passed: 1, failed: 0 },
        audit: { total: 1, passed: 0, failed: 1 },
      },
    })
    expect(body.errorsByType.api_error).toEqual({
      count: 4,
      scenarios: ['smoke', 'audit'],
      samples: [
        { message: 'one', stepType: 'chat' },
        { message: 'two', stepType: 'chat' },
        { message: 'three', stepType: 'form' },
      ],
    })
    expect(body.sessions).toBeUndefined()
    expect(body.errors).toBeUndefined()
    expect(body.errorCount).toBe(5)
  })

  it('includes mapped session details only for the exact true flag', async () => {
    installRun()
    const { GET } = await import('./route')
    const response = await GET(resultsRequest('runId=run-1&includeSessionDetails=true'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.sessions).toEqual([
      {
        clientId: 'client-1',
        persona: 'anna',
        scenario: 'smoke',
        status: 'completed',
        startedAt: '2026-10-01T10:00:00.000Z',
        completedAt: '2026-10-01T10:00:01.000Z',
        stepsCompleted: 2,
        errorCount: 1,
        createdResources: { chatSessionId: 'chat-1', contactId: null, diagnosticId: null, orderId: null },
      },
      {
        clientId: 'client-2',
        persona: 'ben',
        scenario: 'smoke',
        status: 'running',
        startedAt: '2026-10-01T10:00:00.000Z',
        completedAt: null,
        stepsCompleted: 0,
        errorCount: 0,
        createdResources: { chatSessionId: null, contactId: 12, diagnosticId: null, orderId: null },
      },
      {
        clientId: 'client-3',
        persona: 'cara',
        scenario: 'audit',
        status: 'failed',
        startedAt: '2026-10-01T10:00:00.000Z',
        completedAt: '2026-10-01T10:00:03.000Z',
        stepsCompleted: 0,
        errorCount: 0,
        createdResources: { chatSessionId: null, contactId: null, diagnosticId: 'diag-1', orderId: 'order-1' },
      },
    ])
    expect(body.errors).toEqual(errors)
  })

  it('uses a zero duration for an unfinished run and a zero average when no session has both timestamps', async () => {
    installDatabase({
      test_runs: {
        data: {
          id: 'row-2',
          run_id: 'run-2',
          status: 'running',
          clients_spawned: 0,
          clients_completed: 0,
          clients_failed: 0,
          started_at: '2026-10-01T10:00:00.000Z',
          completed_at: null,
          config: {},
        },
        error: null,
      },
      test_client_sessions: { data: [{ scenario: 'smoke', status: 'failed', started_at: null, completed_at: '2026-10-01T10:00:01.000Z' }], error: null },
      test_errors: { data: null, error: null },
    })
    const { GET } = await import('./route')
    const response = await GET(resultsRequest('runId=run-2'))
    expect(await response.json()).toMatchObject({
      metrics: { successRate: 0, totalErrors: 0, uniqueErrorTypes: 0, totalDuration: 0, averageSessionDuration: 0 },
      errorCount: 0,
    })
  })

  it('requires a run id and hides a missing run', async () => {
    installDatabase({ test_runs: { data: null, error: { message: 'private missing row' } } })
    const { GET } = await import('./route')
    expect(await (await GET(resultsRequest(''))).json()).toEqual({ error: 'runId is required' })
    const missing = await GET(resultsRequest('runId=missing'))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Test run not found' })
  })
})
