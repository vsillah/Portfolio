import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const { primaryEmail } = vi.hoisted(() => ({ primaryEmail: vi.fn() }))
vi.mock('./auth-user-email', () => ({ getAuthUserPrimaryEmail: primaryEmail }))
import { activationProviderConfigured, activationRuntimeConfigured, appServerSecretValid, configuredAppOrigins, getActivationRepository } from './app-activation-repository.server'

const configured = {
  APP_ACTIVATION_PROVIDER: 'convex', APP_ACTIVATION_ENABLE_WRITES: 'true',
  APP_ACTIVATION_CONVEX_SITE_URL: 'https://portfolio-activation.convex.site', APP_ACTIVATION_CONVEX_BRIDGE_SECRET: 'b'.repeat(32),
  NEXT_PUBLIC_SUPABASE_URL: 'https://auth.example.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-fixture', SUPABASE_SERVICE_ROLE_KEY: 'service-fixture',
  APP_ACTIVATION_APP_ORIGINS: '{"trumpet-trainer":["https://app.example.test"]}',
  APP_ACTIVATION_CONSENT_VERSION: 'adult-interest-2026-11-07-v1',
  APP_ACTIVATION_DISTRIBUTED_ABUSE_ENABLED: 'true', APP_ACTIVATION_ABUSE_SECRET: 'a'.repeat(32),
}

beforeEach(() => {
  vi.unstubAllEnvs(); vi.restoreAllMocks(); primaryEmail.mockReset()
  for (const [key, value] of Object.entries(configured)) vi.stubEnv(key, value)
})

describe('Convex activation boundary', () => {
  it('requires every explicit server setting and rejects a borrowed or malformed endpoint', () => {
    expect(activationRuntimeConfigured(configured)).toBe(true)
    for (const key of Object.keys(configured)) {
      const partial = { ...configured } as Record<string, string>
      delete partial[key]
      expect(activationRuntimeConfigured(partial)).toBe(false)
    }
    expect(activationProviderConfigured({ ...configured, APP_ACTIVATION_CONVEX_SITE_URL: 'https://other.example.test' })).toBe(false)
    expect(activationProviderConfigured({ ...configured, APP_ACTIVATION_CONVEX_SITE_URL: 'https://portfolio-activation.convex.site/path' })).toBe(false)
    expect(activationProviderConfigured({ ...configured, APP_ACTIVATION_PROVIDER: 'postgres' })).toBe(false)
  })
  it('accepts exact HTTPS origins and distinct app secrets only', () => {
    expect(configuredAppOrigins(configured)).toEqual({ 'trumpet-trainer': ['https://app.example.test'] })
    expect(configuredAppOrigins({ ...configured, APP_ACTIVATION_APP_ORIGINS: '{"trumpet-trainer":["https://app.example.test/path"]}' })).toEqual({})
    expect(configuredAppOrigins({ ...configured, APP_ACTIVATION_APP_ORIGINS: '{"trumpet-trainer":["https://app.example.test"],"other-app":["https://app.example.test"]}' })).toEqual({})
    const env = { APP_ACTIVATION_HANDOFF_ENABLED: 'true', APP_ACTIVATION_APP_SECRETS: JSON.stringify({ 'trumpet-trainer': 't'.repeat(32), 'future-app': 'f'.repeat(32) }) }
    expect(appServerSecretValid('trumpet-trainer', 't'.repeat(32), env)).toBe(true)
    expect(appServerSecretValid('future-app', 't'.repeat(32), env)).toBe(false)
  })
  it('rejects stale, changed, and deleted Supabase identity before redemption writes', async () => {
    const transport = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ result: true }))
    const repository = getActivationRepository()!
    primaryEmail.mockResolvedValue(null)
    expect(await repository.redeem({ appKey: 'trumpet-trainer', token: 'x'.repeat(43), authUserId: 'adult-id', adultEmail: 'adult@example.test' })).toBe(false)
    primaryEmail.mockResolvedValue('changed@example.test')
    expect(await repository.redeem({ appKey: 'trumpet-trainer', token: 'x'.repeat(43), authUserId: 'adult-id', adultEmail: 'adult@example.test' })).toBe(false)
    expect(transport).not.toHaveBeenCalled()
  })
  it('sends only hashed token material and verified identity to Convex', async () => {
    const transport = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ result: true }))
    primaryEmail.mockResolvedValue('adult@example.test')
    const repository = getActivationRepository()!
    expect(await repository.redeem({ appKey: 'trumpet-trainer', token: 'x'.repeat(43), authUserId: 'adult-id', adultEmail: 'adult@example.test' })).toBe(true)
    const call = transport.mock.calls[0]
    const body = JSON.parse(String(call[1]?.body))
    expect(body.args).toMatchObject({ appKey: 'trumpet-trainer', externalSubject: 'adult-id', verifiedEmail: 'adult@example.test' })
    expect(body.args.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(body)).not.toContain('x'.repeat(43))
    expect(call[0]).toBe('https://portfolio-activation.convex.site/activation')
  })
  it('fails closed on provider failure and deleted or changed account at handle check', async () => {
    const repository = getActivationRepository()!
    const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ result: { externalSubject: 'adult-id', emailAtRedemption: 'adult@example.test' } }))
    primaryEmail.mockResolvedValue(null)
    expect(await repository.hasGrantForHandle('trumpet-trainer', 'handle')).toBe(false)
    primaryEmail.mockResolvedValue('changed@example.test')
    expect(await repository.hasGrantForHandle('trumpet-trainer', 'handle')).toBe(false)
    transport.mockRejectedValueOnce(new Error('offline'))
    await expect(repository.hasGrantForHandle('trumpet-trainer', 'handle')).rejects.toThrow()
  })
  it('redacts bridge and provider details from failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'private provider detail' }, { status: 500 }))
    const repository = getActivationRepository()!
    await expect(repository.snapshot()).rejects.toThrow('Activation provider unavailable.')
    try { await repository.snapshot() } catch (error) {
      expect(String(error)).not.toContain(configured.APP_ACTIVATION_CONVEX_BRIDGE_SECRET)
      expect(String(error)).not.toContain('private provider detail')
    }
  })
})
