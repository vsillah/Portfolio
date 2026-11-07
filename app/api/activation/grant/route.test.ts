import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { repo, provider, secret } = vi.hoisted(() => ({ repo: { hasGrantForHandle: vi.fn(), consumeAbuseBudget: vi.fn() }, provider: vi.fn(), secret: vi.fn() }))
vi.mock('@/lib/app-activation-repository.server', () => ({ getActivationRepository: provider, activationRuntimeConfigured: () => true, appServerSecretValid: secret, configuredAppOrigins: () => ({ 'trumpet-trainer': ['https://app.example.test'] }) }))
vi.mock('@/lib/simple-ip-rate-limit', () => ({ getClientIpFromRequest: () => 'fixture-ip' }))
import { POST } from './route'

const handle = 'h'.repeat(43)
const request = (body: unknown = { appKey: 'trumpet-trainer', sessionHandle: handle }, origin?: string) => new NextRequest('https://portfolio.example.test/api/activation/grant', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-activation-app-secret': 's'.repeat(32), ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
})
beforeEach(() => { process.env.APP_ACTIVATION_HANDOFF_ENABLED = 'true'; repo.hasGrantForHandle.mockReset().mockResolvedValue(true); repo.consumeAbuseBudget.mockReset().mockResolvedValue(true); provider.mockReset().mockReturnValue(repo); secret.mockReset().mockReturnValue(true) })

describe('server-side app grant check', () => {
  it('is default off and never reads without a configured repository', async () => {
    provider.mockReturnValueOnce(null)
    expect((await POST(request())).status).toBe(503)
    expect(repo.hasGrantForHandle).not.toHaveBeenCalled()
  })
  it('checks one app and account after authenticating the app server', async () => {
    expect(await (await POST(request())).json()).toEqual({ appKey: 'trumpet-trainer', active: true })
    expect(repo.consumeAbuseBudget).toHaveBeenCalledWith('grant', 'fixture-ip')
    expect(repo.hasGrantForHandle).toHaveBeenCalledWith('trumpet-trainer', handle)
    expect((await POST(request({ appKey: 'other-app', sessionHandle: handle }))).status).toBe(403)
    secret.mockReturnValueOnce(false)
    expect((await POST(request())).status).toBe(403)
    expect(repo.hasGrantForHandle).toHaveBeenCalledTimes(1)
  })
  it('blocks browser calls and fails closed on abuse-store failure', async () => {
    expect((await POST(request(undefined, 'https://app.example.test'))).status).toBe(403)
    repo.consumeAbuseBudget.mockRejectedValueOnce(new Error('database unavailable'))
    expect((await POST(request())).status).toBe(503)
  })
})
