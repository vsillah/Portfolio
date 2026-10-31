// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const updates = vi.hoisted(() => [] as unknown[])
const fromTables = vi.hoisted(() => [] as string[])

function queryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const record = (method: string) => (...args: unknown[]) => {
    if (method === 'update') updates.push(args[0])
    return method === 'single' ? Promise.resolve(result) : builder
  }
  for (const method of ['select', 'eq', 'update', 'single']) builder[method] = record(method)
  return builder
}

function installDatabase(result: { data: unknown; error: unknown }) {
  updates.length = 0
  fromTables.length = 0
  createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
    ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
    : {
      from: (table: string) => {
        fromTables.push(table)
        return queryBuilder(result)
      },
    })
}

function errorRequest(method: string, body?: string) {
  return new NextRequest('http://localhost/api/testing/errors/err-1', {
    method,
    headers: { Authorization: 'Bearer synthetic-token' },
    ...(body === undefined ? {} : { body }),
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

describe('testing error remediation status', () => {
  it.each([undefined, '', 'closed', 'FIXED', 'ignored '])('rejects %j before writing', async (status) => {
    installDatabase({ data: { error_id: 'err-1' }, error: null })
    const { PATCH } = await import('./route')
    const response = await PATCH(
      errorRequest('PATCH', JSON.stringify(status === undefined ? {} : { remediation_status: status })),
      { params: Promise.resolve({ id: 'err-1' }) },
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Invalid status. Must be one of: pending, in_progress, fixed, ignored, wont_fix',
    })
    expect(fromTables).toEqual([])
    expect(updates).toEqual([])
  })

  it.each(['pending', 'in_progress', 'fixed', 'ignored', 'wont_fix'])('writes only the allowlisted status %s', async (status) => {
    installDatabase({ data: { error_id: 'err-1', remediation_status: status }, error: null })
    const { PATCH } = await import('./route')
    const response = await PATCH(
      errorRequest('PATCH', JSON.stringify({ remediation_status: status, error_message: 'forged' })),
      { params: Promise.resolve({ id: 'err-1' }) },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, error: { error_id: 'err-1', remediation_status: status } })
    expect(fromTables).toEqual(['test_errors'])
    expect(updates).toEqual([{ remediation_status: status }])
  })

  it('hides update failures and treats an empty write as missing', async () => {
    installDatabase({ data: null, error: { message: 'private write failure' } })
    const { PATCH } = await import('./route')
    const failed = await PATCH(
      errorRequest('PATCH', JSON.stringify({ remediation_status: 'fixed' })),
      { params: Promise.resolve({ id: 'err-1' }) },
    )
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to update error' })

    vi.resetModules()
    installDatabase({ data: null, error: null })
    const { PATCH: reload } = await import('./route')
    const missing = await reload(
      errorRequest('PATCH', JSON.stringify({ remediation_status: 'fixed' })),
      { params: Promise.resolve({ id: 'err-1' }) },
    )
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: 'Error not found' })
  })

  it('returns the joined error row and a generic failure when the read throws', async () => {
    installDatabase({
      data: { error_id: 'err-1', test_remediation_requests: [{ id: 'req-1' }] },
      error: null,
    })
    const { GET } = await import('./route')
    const response = await GET(errorRequest('GET'), { params: Promise.resolve({ id: 'err-1' }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      error: { error_id: 'err-1', test_remediation_requests: [{ id: 'req-1' }] },
    })

    vi.resetModules()
    createClient.mockImplementation((_url: string, key: string) => key === 'synthetic-public-key'
      ? { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'operator' } }, error: null }) } }
      : { from: () => { throw new Error('private read failure') } })
    const { GET: reload } = await import('./route')
    const failed = await reload(errorRequest('GET'), { params: Promise.resolve({ id: 'err-1' }) })
    expect(failed.status).toBe(500)
    expect(await failed.json()).toEqual({ error: 'Failed to get error' })
  })
})
