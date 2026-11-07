import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { activationProviderConfigured, configuredAppOrigins } from './app-activation-repository.server'

const configured = {
  APP_ACTIVATION_PROVIDER: 'postgres', APP_ACTIVATION_ENABLE_WRITES: 'true',
  APP_ACTIVATION_DATABASE_URL: 'postgres://fixture:fixture@localhost:5432/fixture',
  APP_ACTIVATION_APP_ORIGINS: '{"trumpet-trainer":["https://app.example.test"]}',
  APP_ACTIVATION_CONSENT_VERSION: 'interest-v1',
}

describe('activation provider gate', () => {
  it('stays unconfigured until every explicit server-only setting is present', () => {
    expect(activationProviderConfigured({})).toBe(false)
    for (const key of Object.keys(configured)) {
      const partial = { ...configured } as Record<string, string>
      delete partial[key]
      expect(activationProviderConfigured(partial)).toBe(false)
    }
    expect(activationProviderConfigured(configured)).toBe(true)
  })
  it('allows only exact HTTPS app origins and exposes no database secret in the public contract', () => {
    expect(configuredAppOrigins(configured)).toEqual({ 'trumpet-trainer': ['https://app.example.test'] })
    expect(configuredAppOrigins({ ...configured, APP_ACTIVATION_APP_ORIGINS: '{"trumpet-trainer":["http://bad.example.test"]}' })).toEqual({})
    expect(JSON.stringify(configuredAppOrigins(configured))).not.toContain('fixture:fixture')
  })
})
