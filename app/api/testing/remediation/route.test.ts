// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const engine = vi.hoisted(() => ({
  createRequest: vi.fn(),
  processRequest: vi.fn().mockResolvedValue(undefined),
  getCursorTaskPrompt: vi.fn(),
}))
vi.mock('@/lib/testing', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/testing')>()
  return { ...actual, getRemediationEngine: () => engine }
})

type QueryResult = { data?: unknown; error?: unknown }
type Call = { method: string; args: unknown[] }

function queryBuilder(result: QueryResult) {
  const recorded: Call[] = []
  const builder: Record<string, unknown> = {}
  const record = (method: string) => (...args: unknown[]) => {
    recorded.push({ method, args })
    if (method === 'single') return Promise.resolve(result)
    return builder
  }
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'single']) builder[method] = record(method)
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  return { builder, recorded }
}

function installDatabase(queues: Record<string, QueryResult[]>) {
  const calls: Array<{ table: string; recorded: Call[] }> = []
  const from = vi.fn((table: string) => {
    const result = (queues[table] ?? []).shift() ?? { data: null, error: null }
    const query = queryBuilder(result)
    calls.push({ table, recorded: query.recorded })
    return query.builder
  })
  createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
    ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
    : { from })
  return { from, calls }
}

function remediationRequest(method: string, body?: unknown, query = '') {
  return new NextRequest(`http://localhost/api/testing/remediation${query}`, {
    method,
    headers: { Authorization: 'Bearer synthetic-token' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  engine.createRequest.mockResolvedValue({ id: 'req-1' })
  engine.processRequest.mockResolvedValue(undefined)
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

describe('POST /api/testing/remediation', () => {
  it('requires at least one error id before querying', async () => {
    const { from } = installDatabase({})
    const { POST } = await import('./route')
    const missing = await POST(remediationRequest('POST', {}))
    const empty = await POST(remediationRequest('POST', { errorIds: [] }))
    expect(missing.status).toBe(400)
    expect(empty.status).toBe(400)
    expect(await empty.json()).toEqual({ error: 'errorIds is required' })
    expect(from).not.toHaveBeenCalled()
    expect(engine.createRequest).not.toHaveBeenCalled()
  })

  it.each([
    [{ data: null, error: { message: 'missing' } }],
    [{ data: [], error: null }],
    [{ data: null, error: null }],
  ])('returns not found when the error lookup is %j', async result => {
    installDatabase({ test_errors: [result] })
    const { POST } = await import('./route')
    const response = await POST(remediationRequest('POST', { errorIds: ['missing'] }))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'No errors found with the provided IDs' })
    expect(engine.createRequest).not.toHaveBeenCalled()
  })

  it('creates a request with the documented defaults and still returns success if processing rejects', async () => {
    const errors = [{ error_id: 'e1', message: 'boom' }]
    const { calls } = installDatabase({ test_errors: [{ data: errors, error: null }] })
    engine.processRequest.mockRejectedValue(new Error('processor down'))
    const { POST } = await import('./route')
    const response = await POST(remediationRequest('POST', { errorIds: ['e1'] }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      requestId: 'req-1',
      errorCount: 1,
      output: 'cursor_task',
      message: 'Remediation request created and processing started',
    })
    expect(calls[0].recorded).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'in', args: ['error_id', ['e1']] },
    ])
    expect(engine.createRequest).toHaveBeenCalledWith(errors, {
      output: 'cursor_task',
      autoCreatePR: false,
      targetBranch: 'main',
      assignees: [],
      fixScope: 'minimal',
      includeTests: false,
      requireApproval: true,
    }, undefined, 'medium')
    expect(engine.processRequest).toHaveBeenCalledWith('req-1')
  })

  it('forwards explicit remediation options', async () => {
    const errors = [{ error_id: 'e1' }, { error_id: 'e2' }]
    installDatabase({ test_errors: [{ data: errors, error: null }] })
    const { POST } = await import('./route')
    const response = await POST(remediationRequest('POST', {
      errorIds: ['e1', 'e2'],
      output: 'github_pr',
      autoCreatePR: true,
      targetBranch: 'develop',
      assignees: ['octo'],
      fixScope: 'broader',
      includeTests: true,
      requireApproval: false,
      additionalNotes: 'keep the public copy',
      priorityLevel: 'high',
    }))
    expect(response.status).toBe(200)
    expect((await response.json()).output).toBe('github_pr')
    expect(engine.createRequest).toHaveBeenCalledWith(errors, {
      output: 'github_pr',
      autoCreatePR: true,
      targetBranch: 'develop',
      assignees: ['octo'],
      fixScope: 'broader',
      includeTests: true,
      requireApproval: false,
    }, 'keep the public copy', 'high')
  })

  it('hides engine and JSON failures', async () => {
    installDatabase({ test_errors: [{ data: [{ error_id: 'e1' }], error: null }] })
    engine.createRequest.mockRejectedValue(new Error('insert failed'))
    const { POST } = await import('./route')
    const failed = await POST(remediationRequest('POST', { errorIds: ['e1'] }))
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to create remediation request' })

    const invalid = await POST(remediationRequest('POST', '{'))
    expect(invalid.status).toBe(500)
    expect(await invalid.json()).toEqual({ error: 'Failed to create remediation request' })
  })
})

describe('GET /api/testing/remediation', () => {
  it('applies status, limit, and the resolved test run id', async () => {
    const { calls } = installDatabase({
      test_remediation_requests: [{ data: [{ id: 'req-1' }], error: null }],
      test_runs: [{ data: { id: 'run-row' }, error: null }],
    })
    const { GET } = await import('./route')
    const response = await GET(remediationRequest('GET', undefined, '?status=pending&limit=12abc&testRunId=%20run-live'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ requests: [{ id: 'req-1' }], count: 1 })
    expect(calls.map(call => call.table)).toEqual(['test_remediation_requests', 'test_runs'])
    expect(calls[1].recorded).toEqual([
      { method: 'select', args: ['id'] },
      { method: 'eq', args: ['run_id', ' run-live'] },
      { method: 'single', args: [] },
    ])
    expect(calls[0].recorded).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'limit', args: [12] },
      { method: 'eq', args: ['status', 'pending'] },
      { method: 'eq', args: ['test_run_id', 'run-row'] },
    ])
  })

  it('leaves the list unscoped when the test run lookup returns no row', async () => {
    const { calls } = installDatabase({
      test_remediation_requests: [{ data: null, error: null }],
      test_runs: [{ data: null, error: { message: 'missing' } }],
    })
    const { GET } = await import('./route')
    const response = await GET(remediationRequest('GET', undefined, '?limit=&testRunId=missing'))
    expect(await response.json()).toEqual({ requests: null, count: 0 })
    expect(calls[0].recorded).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'order', args: ['created_at', { ascending: false }] },
      { method: 'limit', args: [20] },
    ])
  })

  it('hides list failures', async () => {
    installDatabase({ test_remediation_requests: [{ data: null, error: { message: 'relation missing' } }] })
    const { GET } = await import('./route')
    const response = await GET(remediationRequest('GET'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to list remediation requests' })
  })
})
