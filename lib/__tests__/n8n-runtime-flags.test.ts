import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('n8n-runtime-flags', () => {
  const original = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...original }
    vi.resetModules()
  })

  it('staging + unset MOCK_N8N / N8N_DISABLE_OUTBOUND → real n8n (both off)', async () => {
    delete process.env.MOCK_N8N
    delete process.env.N8N_DISABLE_OUTBOUND
    process.env.NEXT_PUBLIC_APP_ENV = 'staging'
    delete process.env.VERCEL_ENV
    const mod = await import('../n8n-runtime-flags')
    expect(mod.getAppDeploymentTier()).toBe('staging')
    expect(mod.isMockN8nEnabled()).toBe(false)
    expect(mod.isN8nOutboundDisabled()).toBe(false)
  })

  it('staging + explicit MOCK_N8N=true overrides default', async () => {
    process.env.MOCK_N8N = 'true'
    delete process.env.N8N_DISABLE_OUTBOUND
    process.env.NEXT_PUBLIC_APP_ENV = 'staging'
    const mod = await import('../n8n-runtime-flags')
    expect(mod.isMockN8nEnabled()).toBe(true)
    expect(mod.isN8nOutboundDisabled()).toBe(false)
  })

  it('staging + explicit N8N_DISABLE_OUTBOUND=true overrides default', async () => {
    delete process.env.MOCK_N8N
    process.env.N8N_DISABLE_OUTBOUND = 'true'
    process.env.NEXT_PUBLIC_APP_ENV = 'staging'
    const mod = await import('../n8n-runtime-flags')
    expect(mod.isMockN8nEnabled()).toBe(false)
    expect(mod.isN8nOutboundDisabled()).toBe(true)
  })

  it('development + unset → legacy behavior (not mocked, not disabled)', async () => {
    delete process.env.MOCK_N8N
    delete process.env.N8N_DISABLE_OUTBOUND
    process.env.NEXT_PUBLIC_APP_ENV = 'development'
    delete process.env.VERCEL_ENV
    const mod = await import('../n8n-runtime-flags')
    expect(mod.getAppDeploymentTier()).toBe('development')
    expect(mod.isMockN8nEnabled()).toBe(false)
    expect(mod.isN8nOutboundDisabled()).toBe(false)
  })

  it('parses false / 0 / no as explicit overrides on staging', async () => {
    process.env.MOCK_N8N = 'false'
    process.env.N8N_DISABLE_OUTBOUND = 'false'
    process.env.NEXT_PUBLIC_APP_ENV = 'staging'
    const mod = await import('../n8n-runtime-flags')
    expect(mod.isMockN8nEnabled()).toBe(false)
    expect(mod.isN8nOutboundDisabled()).toBe(false)
  })

  it('VERCEL_ENV=production without NEXT_PUBLIC_APP_ENV → production tier', async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV
    delete process.env.MOCK_N8N
    delete process.env.N8N_DISABLE_OUTBOUND
    process.env.VERCEL_ENV = 'production'
    const mod = await import('../n8n-runtime-flags')
    expect(mod.getAppDeploymentTier()).toBe('production')
    expect(mod.isMockN8nEnabled()).toBe(false)
    expect(mod.isN8nOutboundDisabled()).toBe(false)
  })
})
