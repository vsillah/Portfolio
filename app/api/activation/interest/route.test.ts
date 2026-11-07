import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { repository, provider, origins } = vi.hoisted(() => ({
  repository: { intake: vi.fn(), consumeAbuseBudget: vi.fn() }, provider: vi.fn(), origins: vi.fn(),
}))
vi.mock('@/lib/app-activation-repository.server', () => ({ getActivationRepository: provider, configuredAppOrigins: origins, activationRuntimeConfigured: () => true, ActivationError: class ActivationError extends Error { status = 409 } }))
vi.mock('@/lib/simple-ip-rate-limit', () => ({ getClientIpFromRequest: () => 'fixture-ip' }))
import { OPTIONS, POST } from './route'

const payload = { appKey: 'trumpet-trainer', adultEmail: ' ADULT@EXAMPLE.TEST ', consentGranted: true, adultConfirmed: true,
  consentVersion: 'interest-v1', idempotencyKey: '123e4567-e89b-12d3-a456-426614174000', sourceReceipt: 'direct:fixture-1' }
const request = (body: unknown = payload, headers: Record<string, string> = {}) => new NextRequest('https://portfolio.example.test/api/activation/interest', {
  method: 'POST', headers: { origin: 'https://app.example.test', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
})

beforeEach(() => {
  repository.intake.mockReset().mockResolvedValue(undefined); provider.mockReset().mockReturnValue(repository); origins.mockReset().mockReturnValue({ 'trumpet-trainer': ['https://app.example.test'] })
  repository.consumeAbuseBudget.mockReset().mockResolvedValue(true); process.env.APP_ACTIVATION_CONSENT_VERSION = 'interest-v1'
})

describe('adult activation interest route', () => {
  it('does not write when the provider is unconfigured', async () => {
    provider.mockReturnValueOnce(null)
    expect((await POST(request())).status).toBe(503)
    expect(repository.intake).not.toHaveBeenCalled()
  })
  it('normalizes adult email, records explicit consent and source receipt, and makes no access claim', async () => {
    const response = await POST(request())
    expect(response.status).toBe(202)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.test')
    expect(repository.intake).toHaveBeenCalledWith(expect.objectContaining({ adultEmail: 'adult@example.test', consentGranted: true, sourceReceipt: 'direct:fixture-1' }))
    expect(JSON.stringify(await response.json())).toContain('No account or access')
  })
  it('limits browser preflight to configured origins', async () => {
    expect((await OPTIONS(request())).status).toBe(204)
    expect((await OPTIONS(request(payload, { origin: 'https://wrong.example.test' }))).status).toBe(403)
  })
  it('rejects missing consent, app origin, stale version, and rate limit before writing', async () => {
    expect((await POST(request({ ...payload, consentGranted: false }))).status).toBe(400)
    expect((await POST(request(payload, { origin: 'https://wrong.example.test' }))).status).toBe(403)
    expect((await POST(request({ ...payload, consentVersion: 'old' }))).status).toBe(409)
    repository.consumeAbuseBudget.mockResolvedValueOnce(false)
    expect((await POST(request())).status).toBe(429)
    expect(repository.intake).not.toHaveBeenCalled()
  })
})
