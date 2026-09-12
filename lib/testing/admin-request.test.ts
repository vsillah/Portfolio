import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testingAdminRequest, TestingRequestError } from './admin-request'
import { getCurrentSession } from '@/lib/auth'
import { readFileSync } from 'node:fs'
vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn() }))

const calls = [
  ['/api/testing/run?limit=10', 'GET'],
  ['/api/testing/remediation?limit=10', 'GET'],
  ['/api/testing/status?runId=errors', 'GET'],
  ['/api/testing/status?runId=modal', 'GET'],
  ['/api/testing/status?runId=details', 'GET'],
  ['/api/testing/run', 'POST'],
  ['/api/testing/run?runId=stop', 'DELETE'],
  ['/api/testing/cleanup?runId=cleanup', 'DELETE'],
  ['/api/testing/remediation', 'POST'],
  ['/api/testing/remediation/poll', 'GET'],
  ['/api/testing/errors/bulk', 'PATCH'],
  ['/api/testing/remediation/details', 'GET'],
]
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCurrentSession).mockResolvedValue({ access_token: 'synthetic-token', expires_at: Date.now() / 1000 + 300 } as Awaited<ReturnType<typeof getCurrentSession>>)
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"runs":[]}')))
})
afterEach(() => vi.unstubAllGlobals())

describe('testing dashboard transport', () => {
  it('routes all 11 dashboard calls (the duplicate log loader is consolidated) through the guarded helper', () => {
    const source = readFileSync('app/admin/testing/page.tsx', 'utf8')
    expect(source.match(/requestTesting\(['`]/g)).toHaveLength(11)
    expect(source).not.toMatch(/fetch\(['`]\/api\/testing\//)
  })
  it.each(calls)('sends a current session only to local %s %s', async (path, method) => {
    await testingAdminRequest(path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer stale' } })
    expect(getCurrentSession).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledOnce()
    const [destination, options] = vi.mocked(fetch).mock.calls[0]
    expect(destination).toBe(path)
    expect(options?.method).toBe(method)
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer synthetic-token')
    expect(new Headers(options?.headers).get('content-type')).toBe('application/json')
    expect(options?.redirect).toBe('error')
  })
  it.each(['missing', 'expired', 'lookup-failed'])('blocks %s session before sending', async mode => {
    if (mode === 'missing') vi.mocked(getCurrentSession).mockResolvedValue(null)
    if (mode === 'expired') vi.mocked(getCurrentSession).mockResolvedValue({ access_token: 'expired', expires_at: 1 } as Awaited<ReturnType<typeof getCurrentSession>>)
    if (mode === 'lookup-failed') vi.mocked(getCurrentSession).mockRejectedValue(new Error('Session lookup failed'))
    await expect(testingAdminRequest('/api/testing/run')).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([401, 403, 500])('throws for HTTP %i instead of returning an empty successful list', async status => {
    vi.mocked(fetch).mockResolvedValue(new Response('{"runs":[]}', { status }))
    await expect(testingAdminRequest('/api/testing/run')).rejects.toMatchObject({ status, name: 'TestingRequestError' })
  })
  it.each(['https://external.invalid/api/testing/run', '//external.invalid/api/testing/run', '/api/testing/../../external', '/api/testing/..%2f../admin', '/api/admin/testing'])('rejects an unsafe destination %s', async path => {
    await expect(testingAdminRequest(path)).rejects.toBeInstanceOf(TestingRequestError)
    expect(getCurrentSession).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([400, 404])('preserves useful HTTP %i validation messages', async status => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Test run not found', details: 'private diagnostic' }), { status }))
    await expect(testingAdminRequest('/api/testing/run')).rejects.toMatchObject({ message: 'Test run not found', status })
  })

})
