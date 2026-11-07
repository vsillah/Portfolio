import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const { repo, auth, provider } = vi.hoisted(() => ({ repo: { consumeAbuseBudget: vi.fn(), issueHandoff: vi.fn() }, auth: vi.fn(), provider: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: auth, isAuthError: (value: unknown) => !!value && typeof value === 'object' && 'error' in value }))
vi.mock('@/lib/app-activation-repository.server', () => ({ activationRuntimeConfigured: () => true, getActivationRepository: provider, configuredAppOrigins: () => ({ 'trumpet-trainer': ['https://app.example.test'] }) }))
vi.mock('@/lib/simple-ip-rate-limit', () => ({ getClientIpFromRequest: () => 'fixture-ip' }))
import { POST } from './route'
const code = 'c'.repeat(43)
const request = (body: unknown = { appKey: 'trumpet-trainer', returnUrl: 'https://app.example.test/welcome', adultConfirmed: true }, origin = 'https://portfolio.example.test') => new NextRequest('https://portfolio.example.test/api/activation/handoff', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => { process.env.APP_ACTIVATION_HANDOFF_ENABLED = 'true'; provider.mockReturnValue(repo); repo.consumeAbuseBudget.mockReset().mockResolvedValue(true); repo.issueHandoff.mockReset().mockResolvedValue(code); auth.mockReset().mockResolvedValue({ user: { id: 'adult-id', email: 'adult@example.test', is_anonymous: false } }) })
describe('first-party adult handoff', () => {
  it('returns only an exact-origin fragment code with no Portfolio bearer or identity', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ returnUrl: `https://app.example.test/welcome#activation_code=${code}`, expiresInSeconds: 120 })
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(repo.issueHandoff).toHaveBeenCalledWith('trumpet-trainer', 'adult-id')
  })
  it('rejects app-origin callers, unregistered destinations, and redirect tricks', async () => {
    expect((await POST(request(undefined, 'https://app.example.test'))).status).toBe(403)
    for (const returnUrl of ['https://evil.example.test/', 'https://app.example.test.evil.test/', 'https://app.example.test/#prior', 'https://user@app.example.test/']) {
      expect((await POST(request({ appKey: 'trumpet-trainer', returnUrl, adultConfirmed: true }))).status).toBe(403)
    }
    expect(repo.issueHandoff).not.toHaveBeenCalled()
  })
  it('fails closed for revoked access and abuse store failure', async () => {
    repo.issueHandoff.mockResolvedValueOnce(null)
    expect((await POST(request())).status).toBe(404)
    repo.consumeAbuseBudget.mockRejectedValueOnce(new Error('down'))
    expect((await POST(request())).status).toBe(503)
  })
})
