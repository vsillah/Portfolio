import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { repository, provider, auth, limited } = vi.hoisted(() => ({ repository: { redeem: vi.fn() }, provider: vi.fn(), auth: vi.fn(), limited: vi.fn() }))
vi.mock('@/lib/app-activation-repository.server', () => ({ getActivationRepository: provider, configuredAppOrigins: () => ({ 'trumpet-trainer': ['https://app.example.test'] }) }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: auth, isAuthError: (value: unknown) => !!value && typeof value === 'object' && 'error' in value }))
vi.mock('@/lib/simple-ip-rate-limit', () => ({ getClientIpFromRequest: () => 'fixture-ip', isIpRateLimited: limited }))
import { OPTIONS, POST } from './route'

const body = { appKey: 'trumpet-trainer', token: 'a'.repeat(43), adultConfirmed: true }
const request = (value: unknown = body) => new NextRequest('https://portfolio.example.test/api/activation/redeem', {
  method: 'POST', headers: { origin: 'https://app.example.test', 'content-type': 'application/json' }, body: JSON.stringify(value),
})
beforeEach(() => { repository.redeem.mockReset().mockResolvedValue(true); provider.mockReset().mockReturnValue(repository); auth.mockReset().mockResolvedValue({ user: { id: 'adult-user', email: 'adult@example.test', is_anonymous: false } }); limited.mockReset().mockReturnValue(false) })

describe('activation redemption route', () => {
  it('does not claim a token when provider is unconfigured', async () => {
    provider.mockReturnValueOnce(null)
    expect((await POST(request())).status).toBe(503)
    expect(repository.redeem).not.toHaveBeenCalled()
  })
  it('binds redemption to the verified adult auth identity', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.test')
    expect((await OPTIONS(request())).headers.get('access-control-allow-headers')).toContain('Authorization')
    expect(repository.redeem).toHaveBeenCalledWith({ appKey: body.appKey, token: body.token, authUserId: 'adult-user', adultEmail: 'adult@example.test' })
  })
  it('fails closed for missing auth, wrong app, replay and rate limit', async () => {
    auth.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    expect((await POST(request())).status).toBe(401)
    expect((await POST(request({ ...body, appKey: 'other-app' }))).status).toBe(403)
    repository.redeem.mockResolvedValueOnce(false)
    expect((await POST(request())).status).toBe(404)
    limited.mockReturnValueOnce(true)
    expect((await POST(request())).status).toBe(429)
  })
})
