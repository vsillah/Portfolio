// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getUser: vi.fn(), orchestrator: vi.fn(), remediation: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/testing', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/testing')>(),
  createOrchestrator: mocks.orchestrator,
  getRemediationEngine: mocks.remediation,
}))
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
let events: string[]
let from: ReturnType<typeof vi.fn>
let rpc: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  events = []
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://synthetic.invalid')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'mock-public-key')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-privileged-key')
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null }) }
  for (const name of ['select', 'eq', 'in', 'order', 'limit', 'range', 'update', 'delete', 'lt']) chain[name] = vi.fn(() => chain)
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  from = vi.fn(() => { events.push('database'); return chain })
  rpc = vi.fn(async () => { events.push('database'); return { data: {}, error: null } })
  mocks.createClient.mockImplementation((_url, key) => {
    if (key === 'mock-public-key') return { auth: { getUser: mocks.getUser } }
    expect(key).toBe('mock-privileged-key')
    events.push('privileged-client')
    return { from, rpc }
  })
  mocks.getUser.mockImplementation(async () => {
    events.push('identity')
    return { data: { user: { id: 'operator' } }, error: null }
  })
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    expect(url).toBe('https://synthetic.invalid/rest/v1/user_profiles?select=role&id=eq.operator&limit=1')
    expect(init.headers.Authorization).toBe('Bearer synthetic-token')
    expect(init.headers.apikey).toBe('mock-public-key')
    events.push('profile')
    return new Response(JSON.stringify([{ role: 'admin' }]))
  }))
  mocks.orchestrator.mockImplementation(() => { throw new Error('Unexpected orchestration') })
  mocks.remediation.mockImplementation(() => { throw new Error('Unexpected remediation') })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('every testing handler uses the real admin guard before privileged work', () => {
  for (const route of routes) for (const method of route.methods) {
    const loadHandler = async () => (await route.load() as Record<string, (r: NextRequest, c: { params: Promise<{ id: string }> }) => Promise<Response>>)[method]
    const request = (authorization = 'Bearer synthetic-token') => new NextRequest(`http://localhost/api/testing/${route.path}?runId=synthetic`, {
      method, headers: { authorization, 'x-admin': 'true', cookie: 'role=admin' },
      ...(method === 'GET' ? {} : { body: JSON.stringify({ errorIds: ['missing'], error_ids: ['missing'], remediation_status: 'ignored', scenarioIds: ['missing'] }) }),
    })
    it.each(['missing', 'malformed', 'invalid', 'nonadmin', 'identity-failure', 'profile-failure', 'profile-denied'])
    (`${method} ${route.path} denies %s without privileged work or body parsing`, async mode => {
      if (mode === 'invalid') mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
      if (mode === 'identity-failure') mocks.getUser.mockRejectedValue(new Error('auth unavailable'))
      if (mode === 'nonadmin') vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ role: 'user' }])))
      if (mode === 'profile-denied') vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 500 }))
      if (mode === 'profile-failure') vi.mocked(fetch).mockRejectedValue(new Error('profile unavailable'))
      const handler = await loadHandler()
      expect(mocks.createClient).not.toHaveBeenCalled()
      const req = request(mode === 'missing' ? '' : mode === 'malformed' ? 'Basic forged' : undefined)
      const body = vi.spyOn(req, 'json')
      const result = await handler(req, { params: Promise.resolve({ id: 'synthetic' }) })
      expect(result.status).toBe(['identity-failure', 'profile-failure'].includes(mode) ? 503 : ['nonadmin', 'profile-denied'].includes(mode) ? 403 : 401)
      expect(body).not.toHaveBeenCalled()
      expect(events).not.toContain('privileged-client')
      expect(from).not.toHaveBeenCalled()
      expect(rpc).not.toHaveBeenCalled()
      expect(mocks.orchestrator).not.toHaveBeenCalled()
      expect(mocks.remediation).not.toHaveBeenCalled()
      expect(mocks.createClient.mock.calls.every(([, key]) => key === 'mock-public-key')).toBe(true)
    })

    it(`${method} ${route.path} permits verified admin through to existing handling`, async () => {
      const handler = await loadHandler()
      expect(mocks.createClient).not.toHaveBeenCalled()
      const req = request()
      const body = vi.spyOn(req, 'json')
      const result = await handler(req, { params: Promise.resolve({ id: 'synthetic' }) })
      expect([200, 400, 404]).toContain(result.status)
      expect(mocks.getUser).toHaveBeenCalledWith('synthetic-token')
      expect(events.slice(0, 2)).toEqual(['identity', 'profile'])
      if (route.path === 'run' && method !== 'GET') {
        expect(events).not.toContain('privileged-client')
        if (method === 'POST') expect(body).toHaveBeenCalledOnce()
      } else {
        expect(events[2]).toBe('privileged-client')
        expect(events).toContain('database')
      }
      expect(mocks.orchestrator).not.toHaveBeenCalled()
      expect(mocks.remediation).not.toHaveBeenCalled()
    })
  }
})
