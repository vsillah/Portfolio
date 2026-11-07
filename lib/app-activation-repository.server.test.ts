import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { activationDatabaseUrl, activationProviderConfigured, activationRuntimeConfigured, appServerSecretValid, configuredAppOrigins } from './app-activation-repository.server'

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
    expect(configuredAppOrigins({ ...configured, APP_ACTIVATION_APP_ORIGINS: '{"trumpet-trainer":["https://app.example.test/path"]}' })).toEqual({})
    expect(configuredAppOrigins({ ...configured, APP_ACTIVATION_APP_ORIGINS: '{"trumpet-trainer":["https://app.example.test"],"other-app":["http://bad.example.test"]}' })).toEqual({})
    expect(configuredAppOrigins({ ...configured, APP_ACTIVATION_APP_ORIGINS: '{"trumpet-trainer":["https://app.example.test"],"other-app":["https://app.example.test"]}' })).toEqual({})
    expect(JSON.stringify(configuredAppOrigins(configured))).not.toContain('fixture:fixture')
  })
  it('requires distributed abuse controls and binds the staging database fallback to one project', () => {
    expect(activationRuntimeConfigured(configured)).toBe(false)
    expect(activationRuntimeConfigured({ ...configured, APP_ACTIVATION_DISTRIBUTED_ABUSE_ENABLED: 'true', APP_ACTIVATION_ABUSE_SECRET: 'a'.repeat(32) })).toBe(true)
    const { APP_ACTIVATION_DATABASE_URL: _removed, ...withoutDedicated } = configured
    const fallback = { ...withoutDedicated, APP_ACTIVATION_STAGING_DB_FALLBACK: 'true', APP_ACTIVATION_STAGING_PROJECT_ID: 'staging-id', VERCEL_PROJECT_ID: 'staging-id', VERCEL_ENV: 'production', POSTGRES_URL_NON_POOLING: 'postgres://staging-only' }
    expect(activationDatabaseUrl(fallback)).toBe('postgres://staging-only')
    expect(activationProviderConfigured(fallback)).toBe(true)
    expect(activationDatabaseUrl({ ...fallback, VERCEL_PROJECT_ID: 'portfolio-production-id' })).toBeNull()
    expect(activationDatabaseUrl({ ...fallback, VERCEL_ENV: 'preview' })).toBeNull()
    expect(activationDatabaseUrl({ ...fallback, APP_ACTIVATION_STAGING_DB_FALLBACK: 'false' })).toBeNull()
    expect(activationDatabaseUrl({ ...fallback, APP_ACTIVATION_DATABASE_URL: 'postgres://dedicated' })).toBe('postgres://dedicated')
  })
  it('requires a per-app server secret and never accepts cross-app credentials', () => {
    const env = { APP_ACTIVATION_HANDOFF_ENABLED: 'true', APP_ACTIVATION_APP_SECRETS: JSON.stringify({ 'trumpet-trainer': 't'.repeat(32), 'future-app': 'f'.repeat(32) }) }
    expect(appServerSecretValid('trumpet-trainer', 't'.repeat(32), env)).toBe(true)
    expect(appServerSecretValid('future-app', 't'.repeat(32), env)).toBe(false)
    expect(appServerSecretValid('trumpet-trainer', 't'.repeat(32), { ...env, APP_ACTIVATION_HANDOFF_ENABLED: 'false' })).toBe(false)
  })
})
