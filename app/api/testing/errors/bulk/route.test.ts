// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

type QueryResult = { data?: unknown; error?: unknown }
type Call = { method: string; args: unknown[] }

function queryBuilder(result: QueryResult) {
  const recorded: Call[] = []
  const builder: Record<string, unknown> = {}
  const record = (method: string) => (...args: unknown[]) => {
    recorded.push({ method, args })
    return builder
  }
  for (const method of ['update', 'eq', 'in', 'select']) builder[method] = record(method)
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

function patchRequest(body: unknown) {
  return new NextRequest('http://localhost/api/testing/errors/bulk', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer synthetic-token' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.resetModules()
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

describe('PATCH /api/testing/errors/bulk', () => {
  it.each(['Fixed', 'fixed ', 'pending ', '', undefined])('rejects status %j before querying', async status => {
    const { from } = installDatabase({})
    const { PATCH } = await import('./route')
    const response = await PATCH(patchRequest({ remediation_status: status, error_ids: ['e1'] }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Invalid status. Must be one of: pending, in_progress, fixed, ignored, wont_fix',
    })
    expect(from).not.toHaveBeenCalled()
  })

  it('requires an id list or a remediation request id', async () => {
    const { from } = installDatabase({})
    const { PATCH } = await import('./route')
    const response = await PATCH(patchRequest({ remediation_status: 'pending' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Must provide either error_ids or remediation_request_id' })
    expect(from).not.toHaveBeenCalled()
  })

  it('updates only the requested error ids and does not touch the remediation request', async () => {
    const updated = [{ error_id: 'e1' }, { error_id: 'e2' }]
    const { calls } = installDatabase({ test_errors: [{ data: updated, error: null }] })
    const { PATCH } = await import('./route')
    const response = await PATCH(patchRequest({
      remediation_status: 'ignored',
      error_ids: ['e1', 'e2'],
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, updatedCount: 2, errors: updated })
    expect(calls).toHaveLength(1)
    expect(calls[0].recorded).toEqual([
      { method: 'update', args: [{ remediation_status: 'ignored' }] },
      { method: 'in', args: ['error_id', ['e1', 'e2']] },
      { method: 'select', args: [] },
    ])
  })

  it('prefers a remediation request id over error ids', async () => {
    const { calls } = installDatabase({
      test_errors: [{ data: [{ error_id: 'e1' }], error: null }],
    })
    const { PATCH } = await import('./route')
    const response = await PATCH(patchRequest({
      remediation_status: 'in_progress',
      remediation_request_id: 'req-1',
      error_ids: ['e1'],
    }))
    expect(response.status).toBe(200)
    expect(calls).toHaveLength(1)
    expect(calls[0].recorded).toEqual([
      { method: 'update', args: [{ remediation_status: 'in_progress' }] },
      { method: 'eq', args: ['remediation_request_id', 'req-1'] },
      { method: 'select', args: [] },
    ])
  })

  it.each([
    ['fixed', 'applied'],
    ['wont_fix', 'rejected'],
  ] as const)('maps bulk status %s onto remediation request status %s', async (status, requestStatus) => {
    const { calls } = installDatabase({
      test_errors: [{ data: [], error: null }],
      test_remediation_requests: [{ error: null }],
    })
    const { PATCH } = await import('./route')
    const response = await PATCH(patchRequest({
      remediation_status: status,
      remediation_request_id: 'req-1',
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, updatedCount: 0, errors: [] })
    expect(calls[1].table).toBe('test_remediation_requests')
    expect(calls[1].recorded).toEqual([
      {
        method: 'update',
        args: [{ status: requestStatus, completed_at: '2026-10-02T10:02:00.000Z' }],
      },
      { method: 'eq', args: ['id', 'req-1'] },
    ])
  })

  it('updates every row when error ids are present but not an array', async () => {
    const { calls } = installDatabase({ test_errors: [{ data: [{ error_id: 'e1' }], error: null }] })
    const { PATCH } = await import('./route')
    const response = await PATCH(patchRequest({ remediation_status: 'pending', error_ids: 'e1' }))
    expect(response.status).toBe(200)
    expect(calls[0].recorded).toEqual([
      { method: 'update', args: [{ remediation_status: 'pending' }] },
      { method: 'select', args: [] },
    ])
  })

  it('counts a null update payload as zero and hides update errors', async () => {
    const { from } = installDatabase({ test_errors: [{ data: null, error: null }] })
    const { PATCH } = await import('./route')
    const empty = await PATCH(patchRequest({ remediation_status: 'pending', error_ids: [] }))
    expect(await empty.json()).toEqual({ success: true, updatedCount: 0, errors: null })

    from.mockImplementation(() => {
      throw new Error('db down')
    })
    const thrown = await PATCH(patchRequest({ remediation_status: 'pending', error_ids: ['e1'] }))
    expect(thrown.status).toBe(500)
    expect(await thrown.json()).toEqual({ error: 'Failed to update errors' })
  })

  it('returns a generic error when the update result has an error', async () => {
    installDatabase({ test_errors: [{ data: null, error: { message: 'check violation' } }] })
    const { PATCH } = await import('./route')
    const response = await PATCH(patchRequest({ remediation_status: 'fixed', error_ids: ['e1'] }))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to update errors' })
  })

  it('returns a generic error for invalid JSON', async () => {
    installDatabase({})
    const { PATCH } = await import('./route')
    const response = await PATCH(patchRequest('{'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Failed to update errors' })
  })
})
