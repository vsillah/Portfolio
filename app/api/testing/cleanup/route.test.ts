// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

type QueryResult = { data?: unknown; error?: unknown; count?: number | null }
type Call = { method: string; args: unknown[] }

function queryBuilder(result: QueryResult) {
  const recorded: Call[] = []
  const builder: Record<string, unknown> = {}
  const record = (method: string) => (...args: unknown[]) => {
    recorded.push({ method, args })
    if (method === 'single') return Promise.resolve(result)
    return builder
  }
  for (const method of ['select', 'eq', 'in', 'lt', 'delete', 'single']) builder[method] = record(method)
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return { builder, recorded }
}

function installDatabase(queues: Record<string, QueryResult[]>) {
  const calls: Array<{ table: string; recorded: Call[] }> = []
  const from = vi.fn((table: string) => {
    const result = (queues[table] ?? []).shift() ?? { data: null, error: null, count: null }
    const query = queryBuilder(result)
    calls.push({ table, recorded: query.recorded })
    return query.builder
  })
  createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
    ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
    : { from, rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc down' } }) })
  return { from, calls }
}

function cleanupRequest(method: string, query = '', body?: unknown) {
  return new NextRequest(`http://localhost/api/testing/cleanup${query}`, {
    method,
    headers: { Authorization: 'Bearer synthetic-token' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
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

describe('DELETE /api/testing/cleanup per-run resource deletion', () => {
  it('deletes created resources for each session, then errors, sessions, and the run', async () => {
    const { calls } = installDatabase({
      test_runs: [
        { data: { id: 'run-row' }, error: null },
        { error: null },
      ],
      test_client_sessions: [
        {
          data: [
            {
              created_chat_session_id: 'chat-1',
              created_diagnostic_id: 'diag-1',
              created_contact_id: 'contact-1',
              created_order_id: 'order-1',
            },
            {
              created_chat_session_id: '',
              created_diagnostic_id: 0,
              created_contact_id: null,
            },
            { created_chat_session_id: 'chat-2' },
          ],
          error: null,
        },
        { count: 3 },
      ],
      chat_messages: [{ count: 4 }, { count: null }],
      chat_sessions: [{ count: 1 }, { count: 1 }],
      diagnostic_audits: [{ count: 1 }],
      contact_submissions: [{ count: 2 }],
      order_items: [{ error: null }],
      orders: [{ count: 1 }],
      test_errors: [{ count: 5 }],
    })
    const { DELETE } = await import('./route')
    const response = await DELETE(cleanupRequest('DELETE', '?runId=run-live'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      runId: 'run-live',
      cleanupResults: {
        chatSessions: 2,
        chatMessages: 4,
        contacts: 2,
        diagnostics: 1,
        orders: 1,
        testErrors: 5,
        testSessions: 3,
      },
    })
    expect(calls.map(call => call.table)).toEqual([
      'test_runs',
      'test_client_sessions',
      'chat_messages',
      'chat_sessions',
      'diagnostic_audits',
      'contact_submissions',
      'order_items',
      'orders',
      'chat_messages',
      'chat_sessions',
      'test_errors',
      'test_client_sessions',
      'test_runs',
    ])
    expect(calls[0].recorded).toEqual([
      { method: 'select', args: ['id'] },
      { method: 'eq', args: ['run_id', 'run-live'] },
      { method: 'single', args: [] },
    ])
    expect(calls[1].recorded).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['test_run_id', 'run-row'] },
    ])
    expect(calls[2].recorded[0]).toEqual({ method: 'delete', args: [{ count: 'exact' }] })
    expect(calls[2].recorded[1]).toEqual({ method: 'eq', args: ['session_id', 'chat-1'] })
    expect(calls[6].recorded).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['order_id', 'order-1'] },
    ])
    expect(calls[10].recorded).toEqual([
      { method: 'delete', args: [{ count: 'exact' }] },
      { method: 'eq', args: ['test_run_id', 'run-row'] },
    ])
    expect(calls[12].recorded).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['id', 'run-row'] },
    ])
  })

  it('still deletes run rows when the session query returns null', async () => {
    installDatabase({
      test_runs: [{ data: { id: 'run-row' }, error: null }, { error: null }],
      test_client_sessions: [{ data: null, error: null }, { count: null }],
      test_errors: [{ count: null }],
    })
    const { DELETE } = await import('./route')
    const response = await DELETE(cleanupRequest('DELETE', '?runId=run-live'))
    expect(await response.json()).toMatchObject({
      cleanupResults: {
        chatSessions: 0,
        chatMessages: 0,
        contacts: 0,
        diagnostics: 0,
        orders: 0,
        testErrors: 0,
        testSessions: 0,
      },
    })
  })

  it('requires a run id and treats a lookup error as not found before deleting children', async () => {
    const { from } = installDatabase({
      test_runs: [{ data: { id: 'run-row' }, error: { message: 'ambiguous' } }],
    })
    const { DELETE } = await import('./route')
    const missing = await DELETE(cleanupRequest('DELETE', '?runId='))
    expect(missing.status).toBe(400)
    expect(await missing.json()).toEqual({ error: 'runId is required' })
    expect(from).not.toHaveBeenCalled()

    const failed = await DELETE(cleanupRequest('DELETE', '?runId=%20run'))
    expect(failed.status).toBe(404)
    expect(await failed.json()).toEqual({ error: 'Test run not found' })
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('test_runs')
  })

  it('returns a generic error when a delete throws', async () => {
    createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
      ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
      : { from: vi.fn(() => { throw new Error('db down') }) })
    const { DELETE } = await import('./route')
    const response = await DELETE(cleanupRequest('DELETE', '?runId=run-live'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to clean up test run' })
  })
})

describe('POST /api/testing/cleanup manual fallback deletion', () => {
  it('deletes errors, sessions, and runs for rows older than the requested cutoff', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-02T10:02:00.000Z'))
    const { calls } = installDatabase({
      test_runs: [
        { data: [{ id: 'old-1' }, { id: 'old-2' }] },
        { count: 2 },
      ],
      test_errors: [{ count: 6 }],
      test_client_sessions: [{ count: null }],
    })
    const { POST } = await import('./route')
    const response = await POST(cleanupRequest('POST', '', { daysOld: 3 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'Cleaned up test data older than 3 days',
      result: { testRuns: 2, testSessions: 0, testErrors: 6 },
    })
    const cutoff = new Date('2026-10-02T10:02:00.000Z')
    cutoff.setDate(cutoff.getDate() - 3)
    expect(calls.map(call => call.table)).toEqual([
      'test_runs',
      'test_errors',
      'test_client_sessions',
      'test_runs',
    ])
    expect(calls[0].recorded).toEqual([
      { method: 'select', args: ['id'] },
      { method: 'lt', args: ['started_at', cutoff.toISOString()] },
    ])
    expect(calls[1].recorded).toEqual([
      { method: 'delete', args: [{ count: 'exact' }] },
      { method: 'in', args: ['test_run_id', ['old-1', 'old-2']] },
    ])
    expect(calls[3].recorded).toEqual([
      { method: 'delete', args: [{ count: 'exact' }] },
      { method: 'in', args: ['id', ['old-1', 'old-2']] },
    ])
  })
})
