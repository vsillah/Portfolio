// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

const routes = [
  { path: 'cleanup', load: () => import('./cleanup/route'), methods: ['POST', 'DELETE'] },
  { path: 'errors/item', load: () => import('./errors/[id]/route'), methods: ['GET', 'PATCH'] },
  { path: 'errors/bulk', load: () => import('./errors/bulk/route'), methods: ['PATCH'] },
  { path: 'remediation/item', load: () => import('./remediation/[id]/route'), methods: ['GET', 'POST', 'DELETE'] },
  { path: 'remediation', load: () => import('./remediation/route'), methods: ['GET', 'POST'] },
  { path: 'results', load: () => import('./results/route'), methods: ['GET'] },
  { path: 'run', load: () => import('./run/route'), methods: ['GET', 'POST', 'DELETE'] },
  { path: 'status', load: () => import('./status/route'), methods: ['GET'] },
]

beforeEach(() => {
  vi.resetModules()
  createClient.mockReset().mockImplementation(() => { throw new Error('Unexpected client creation') })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request') }))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-public-key')
})

afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('testing route import and fail-closed configuration', () => {
  for (const route of routes) {
    it(`imports ${route.path} without credentials or client creation`, async () => {
      await route.load()
      expect(createClient).not.toHaveBeenCalled()
    })

    for (const method of route.methods) {
      it.each([
        ['', ''],
        ['https://synthetic.invalid', ''],
        ['', 'mock-service-key'],
        ['https://synthetic.invalid', '   '],
        ['invalid-url', 'mock-service-key'],
      ])(`${method} ${route.path} blocks missing/invalid configuration (%s)`, async (url, key) => {
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url)
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', key)
        const handlers = await route.load() as Record<string, (
          request: NextRequest, context: { params: Promise<{ id: string }> }
        ) => Promise<Response>>
        // Invalid JSON deliberately proves the guard precedes request processing.
        const request = new NextRequest(`http://localhost/api/testing/${route.path}?runId=synthetic`, {
          method,
          ...(method === 'GET' ? {} : { body: '{' }),
        })
        const response = await handlers[method](request, { params: Promise.resolve({ id: 'synthetic' }) })
        expect(response.status).toBe(503)
        expect(await response.json()).toEqual({ error: 'Testing database is not configured' })
        expect(createClient).not.toHaveBeenCalled()
      })
    }
  }

  it('preserves the configured cleanup RPC and rechecks configuration for later requests', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { removed: 2 }, error: null })
    createClient.mockReturnValue({ rpc })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.invalid')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key')
    const { POST } = await import('./cleanup/route')
    expect(createClient).not.toHaveBeenCalled()
    const request = () => new NextRequest('http://localhost/api/testing/cleanup', {
      method: 'POST', body: JSON.stringify({ daysOld: 14 }),
    })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, result: { removed: 2 } })
    expect(createClient).toHaveBeenCalledExactlyOnceWith('https://synthetic.invalid', 'mock-service-key')
    expect(rpc).toHaveBeenCalledExactlyOnceWith('cleanup_old_test_data', { days_old: 14 })

    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect((await POST(request())).status).toBe(503)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('passes the configured request client to the manual cleanup fallback', async () => {
    const lt = vi.fn().mockResolvedValue({ data: [], error: null })
    const select = vi.fn().mockReturnValue({ lt })
    const from = vi.fn().mockReturnValue({ select })
    createClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ error: { message: 'mock RPC unavailable' } }), from })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.invalid')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key')
    const { POST } = await import('./cleanup/route')
    const response = await POST(new NextRequest('http://localhost/api/testing/cleanup', {
      method: 'POST', body: '{}',
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, result: { testRuns: 0, testSessions: 0, testErrors: 0 } })
    expect(from).toHaveBeenCalledWith('test_runs')
    expect(lt).toHaveBeenCalledWith('started_at', expect.any(String))
    expect(createClient).toHaveBeenCalledTimes(1)
  })
})
