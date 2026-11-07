import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const { repo, provider, secret } = vi.hoisted(() => ({ repo: { consumeAbuseBudget: vi.fn(), exchangeHandoff: vi.fn() }, provider: vi.fn(), secret: vi.fn() }))
vi.mock('@/lib/app-activation-repository.server', () => ({ activationRuntimeConfigured: () => true, getActivationRepository: provider, configuredAppOrigins: () => ({ 'trumpet-trainer': ['https://app.example.test'] }), appServerSecretValid: secret }))
vi.mock('@/lib/simple-ip-rate-limit', () => ({ getClientIpFromRequest: () => 'fixture-ip' }))
import { POST } from './route'
const code = 'c'.repeat(43)
const handle = 'h'.repeat(43)
const request = (body: unknown = { appKey: 'trumpet-trainer', code }, origin?: string) => new NextRequest('https://portfolio.example.test/api/activation/handoff/exchange', { method: 'POST', headers: { 'content-type': 'application/json', 'x-activation-app-secret': 's'.repeat(32), ...(origin ? { origin } : {}) }, body: JSON.stringify(body) })
beforeEach(() => { process.env.APP_ACTIVATION_HANDOFF_ENABLED = 'true'; provider.mockReturnValue(repo); secret.mockReset().mockReturnValue(true); repo.consumeAbuseBudget.mockReset().mockResolvedValue(true); repo.exchangeHandoff.mockReset().mockResolvedValue(handle) })
describe('app server handoff exchange', () => {
  it('returns an opaque handle without a stable Portfolio ID', async () => {
    expect(await (await POST(request())).json()).toEqual({ appKey: 'trumpet-trainer', sessionHandle: handle, expiresInSeconds: 86400 })
    expect(repo.exchangeHandoff).toHaveBeenCalledWith('trumpet-trainer', code)
  })
  it('rejects browser calls, cross-app secrets, and replay or expiry failures', async () => {
    expect((await POST(request(undefined, 'https://app.example.test'))).status).toBe(403)
    secret.mockReturnValueOnce(false)
    expect((await POST(request())).status).toBe(403)
    repo.exchangeHandoff.mockResolvedValueOnce(null)
    expect((await POST(request())).status).toBe(404)
  })
})
