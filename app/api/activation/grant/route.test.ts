import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { repo, provider, auth } = vi.hoisted(() => ({ repo: { hasGrant: vi.fn() }, provider: vi.fn(), auth: vi.fn() }))
vi.mock('@/lib/app-activation-repository.server', () => ({ getActivationRepository: provider, configuredAppOrigins: () => ({ 'trumpet-trainer': ['https://app.example.test'] }) }))
vi.mock('@/lib/auth-server', () => ({ verifyAuth: auth, isAuthError: (value: unknown) => !!value && typeof value === 'object' && 'error' in value }))
import { GET } from './route'

const request = (appKey = 'trumpet-trainer', origin = 'https://app.example.test') => new NextRequest(`https://portfolio.example.test/api/activation/grant?appKey=${appKey}`, { headers: { origin } })
beforeEach(() => { repo.hasGrant.mockReset().mockResolvedValue(true); provider.mockReset().mockReturnValue(repo); auth.mockReset().mockResolvedValue({ user: { id: 'adult-user', is_anonymous: false } }) })

describe('app-scoped grant route', () => {
  it('does not read when provider is unconfigured', async () => {
    provider.mockReturnValueOnce(null)
    expect((await GET(request())).status).toBe(503)
    expect(repo.hasGrant).not.toHaveBeenCalled()
  })
  it('checks only the verified account and exact app', async () => {
    expect(await (await GET(request())).json()).toEqual({ appKey: 'trumpet-trainer', active: true })
    expect(repo.hasGrant).toHaveBeenCalledWith('trumpet-trainer', 'adult-user')
    expect((await GET(request('other-app'))).status).toBe(403)
    expect(repo.hasGrant).toHaveBeenCalledTimes(1)
  })
  it('rejects unauthenticated and cross-origin reads', async () => {
    auth.mockResolvedValueOnce({ error: 'Authentication required', status: 401 })
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request('trumpet-trainer', 'https://wrong.example.test'))).status).toBe(403)
  })
})
