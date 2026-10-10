// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const engine = vi.hoisted(() => ({
  createRequest: vi.fn(),
  processRequest: vi.fn().mockResolvedValue(undefined),
  getCursorTaskPrompt: vi.fn().mockResolvedValue('prompt body'),
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
  for (const method of ['select', 'eq', 'in', 'update', 'delete', 'single']) builder[method] = record(method)
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

function detailRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/testing/remediation/req-1', {
    method,
    headers: { Authorization: 'Bearer synthetic-token' },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  })
}

function context(id = 'req-1') {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  engine.processRequest.mockResolvedValue(undefined)
  engine.getCursorTaskPrompt.mockResolvedValue('prompt body')
  createClient.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T10:02:00.000Z'))
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

describe('GET /api/testing/remediation/[id]', () => {
  it('returns the request, linked errors, and a cursor prompt when a task id exists', async () => {
    const requestRow = { id: 'req-1', cursor_task_id: 'task-1', error_ids: ['e1'], options: { output: 'github_pr' } }
    const errors = [{ error_id: 'e1' }]
    const { calls } = installDatabase({
      test_remediation_requests: [{ data: requestRow, error: null }],
      test_errors: [{ data: errors, error: null }],
    })
    const { GET } = await import('./route')
    const response = await GET(detailRequest('GET'), context(' req-1 '))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      request: requestRow,
      errors,
      cursorTaskPrompt: 'prompt body',
    })
    expect(calls[0].recorded).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'eq', args: ['id', ' req-1 '] },
      { method: 'single', args: [] },
    ])
    expect(calls[1].recorded).toEqual([
      { method: 'select', args: ['*'] },
      { method: 'in', args: ['error_id', ['e1']] },
    ])
    expect(engine.getCursorTaskPrompt).toHaveBeenCalledWith(' req-1 ')
  })

  it('loads a cursor prompt from options.output and skips it for other outputs', async () => {
    installDatabase({
      test_remediation_requests: [
        { data: { id: 'req-1', error_ids: null, options: { output: 'cursor_task' } }, error: null },
        { data: { id: 'req-1', error_ids: ['e1'], options: { output: 'github_pr' } }, error: null },
      ],
      test_errors: [{ data: null }, { data: [] }],
    })
    const { GET } = await import('./route')
    const cursor = await GET(detailRequest('GET'), context())
    expect((await cursor.json()).cursorTaskPrompt).toBe('prompt body')
    expect(engine.getCursorTaskPrompt).toHaveBeenCalledOnce()

    const other = await GET(detailRequest('GET'), context())
    expect((await other.json()).cursorTaskPrompt).toBeNull()
    expect(engine.getCursorTaskPrompt).toHaveBeenCalledOnce()
  })

  it('returns not found without loading errors or a prompt', async () => {
    const { from } = installDatabase({
      test_remediation_requests: [{ data: null, error: { message: 'missing' } }],
    })
    const { GET } = await import('./route')
    const response = await GET(detailRequest('GET'), context())
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Remediation request not found' })
    expect(from).toHaveBeenCalledTimes(1)
    expect(engine.getCursorTaskPrompt).not.toHaveBeenCalled()
  })

  it('hides unexpected failures', async () => {
    createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
      ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
      : { from: vi.fn(() => { throw new Error('db down') }) })
    const { GET } = await import('./route')
    const response = await GET(detailRequest('GET'), context())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to get remediation request' })
  })
})

describe('POST /api/testing/remediation/[id]', () => {
  it('defaults to process without resetting a found request', async () => {
    const { calls } = installDatabase({
      test_remediation_requests: [{ data: { id: 'req-1', status: 'failed' }, error: null }],
    })
    engine.processRequest.mockRejectedValue(new Error('processor down'))
    const { POST } = await import('./route')
    const response = await POST(detailRequest('POST', {}), context())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'Remediation processing started',
      requestId: 'req-1',
    })
    expect(calls).toHaveLength(1)
    expect(engine.processRequest).toHaveBeenCalledWith('req-1')
  })

  it('resets stored analysis before reprocessing', async () => {
    const { calls } = installDatabase({
      test_remediation_requests: [
        { data: { id: 'req-1', status: 'completed' }, error: null },
        { error: null },
      ],
    })
    const { POST } = await import('./route')
    const response = await POST(detailRequest('POST', { action: 'reprocess' }), context())
    expect(response.status).toBe(200)
    expect(calls[1].recorded).toEqual([
      {
        method: 'update',
        args: [{
          status: 'pending',
          analysis: null,
          fixes: null,
          started_at: null,
          completed_at: null,
        }],
      },
      { method: 'eq', args: ['id', 'req-1'] },
    ])
    expect(engine.processRequest).toHaveBeenCalledWith('req-1')
  })

  it('cancels a request without starting processing', async () => {
    const { calls } = installDatabase({
      test_remediation_requests: [
        { data: { id: 'req-1', status: 'pending' }, error: null },
        { error: null },
      ],
    })
    const { POST } = await import('./route')
    const response = await POST(detailRequest('POST', { action: 'cancel' }), context())
    expect(await response.json()).toEqual({
      success: true,
      message: 'Remediation request cancelled',
      requestId: 'req-1',
    })
    expect(calls[1].recorded).toEqual([
      {
        method: 'update',
        args: [{
          status: 'rejected',
          outcome: 'rejected',
          outcome_notes: 'Cancelled by user',
          completed_at: '2026-10-02T10:02:00.000Z',
        }],
      },
      { method: 'eq', args: ['id', 'req-1'] },
    ])
    expect(engine.processRequest).not.toHaveBeenCalled()
  })

  it('rejects an unknown action and a missing request before processing', async () => {
    const { from } = installDatabase({
      test_remediation_requests: [
        { data: { id: 'req-1', status: 'pending' }, error: null },
        { data: null, error: null },
      ],
    })
    const { POST } = await import('./route')
    const unknown = await POST(detailRequest('POST', { action: 'approve' }), context())
    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toEqual({ error: 'Unknown action: approve' })
    expect(engine.processRequest).not.toHaveBeenCalled()

    const missing = await POST(detailRequest('POST', { action: 'process' }), context('missing'))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Remediation request not found' })
    expect(from).toHaveBeenCalledTimes(2)
  })

  it('hides invalid JSON and processing failures', async () => {
    installDatabase({})
    const { POST } = await import('./route')
    const invalid = await POST(detailRequest('POST', '{'), context())
    expect(invalid.status).toBe(500)
    expect(await invalid.json()).toEqual({ error: 'Failed to process remediation request' })

    createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
      ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
      : { from: vi.fn(() => { throw new Error('db down') }) })
    const thrown = await POST(detailRequest('POST', { action: 'process' }), context())
    expect(thrown.status).toBe(500)
  })
})

describe('DELETE /api/testing/remediation/[id]', () => {
  it('deletes history before the request', async () => {
    const { calls } = installDatabase({
      test_error_remediation_history: [{ error: null }],
      test_remediation_requests: [{ error: null }],
    })
    const { DELETE } = await import('./route')
    const response = await DELETE(detailRequest('DELETE'), context())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      message: 'Remediation request deleted',
      requestId: 'req-1',
    })
    expect(calls.map(call => call.table)).toEqual([
      'test_error_remediation_history',
      'test_remediation_requests',
    ])
    expect(calls[0].recorded).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['remediation_request_id', 'req-1'] },
    ])
    expect(calls[1].recorded).toEqual([
      { method: 'delete', args: [] },
      { method: 'eq', args: ['id', 'req-1'] },
    ])
  })

  it('hides a failed request delete', async () => {
    installDatabase({
      test_error_remediation_history: [{ error: null }],
      test_remediation_requests: [{ error: { message: 'fk violation' } }],
    })
    const { DELETE } = await import('./route')
    const response = await DELETE(detailRequest('DELETE'), context())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to delete remediation request' })
  })
})
