import { describe, expect, it } from 'vitest'
import { getSlackAgentDeliveryConfig, getSlackAgentEnvironment, getSlackAgentSource } from './slack-agent-environment'

const staging = { NEXT_PUBLIC_APP_ENV: 'staging', VERCEL: '1', VERCEL_ENV: 'production', VERCEL_URL: 'staging.example.test', NEXT_PUBLIC_BASE_URL: 'https://production.example.test' }

describe('Slack source isolation', () => {
  it('distinguishes the staging project from production hosting', () => {
    expect(getSlackAgentEnvironment(staging)).toBe('staging')
    expect(getSlackAgentSource(staging)).toEqual({ sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.test', hosted: true })
    expect(getSlackAgentEnvironment({ ...staging, VERCEL_ENV: 'preview' })).toBe('preview')
    expect(getSlackAgentEnvironment({})).toBe('local')
    expect(getSlackAgentEnvironment({ APP_ENV: 'production' })).toBe('production')
  })
  it.each([
    { VERCEL: '1' }, { NODE_ENV: 'production' }, { VERCEL_ENV: 'production' },
    { ...staging, APP_ENV: 'production' }, { ...staging, NEXT_PUBLIC_APP_ENV: 'unknown' },
    { ...staging, VERCEL_ENV: 'preview', NEXT_PUBLIC_APP_ENV: 'production' },
    { ...staging, NEXT_PUBLIC_APP_ENV: 'development' },
  ])('rejects missing or conflicting hosted provenance %j', (env) => {
    expect(() => getSlackAgentEnvironment(env)).toThrow()
  })
  it('cannot inherit a production URL or destination in nonproduction', () => {
    expect(() => getSlackAgentSource({ ...staging, VERCEL_URL: undefined })).toThrow('origin')
    expect(() => getSlackAgentSource({ ...staging, SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://production.example.test' })).toThrow('production')
    expect(() => getSlackAgentSource({ ...staging, SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://amadutown.com' })).toThrow('production')
    expect(() => getSlackAgentDeliveryConfig({ ...staging, SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED: 'true', SLACK_BOT_TOKEN: 'production-token', SLACK_AGENT_OPS_CHANNEL_ID: 'CPROD' })).toThrow('Source-specific')
    expect(() => getSlackAgentDeliveryConfig({ ...staging, SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED: 'true', SLACK_AGENT_OPS_STAGING_BOT_TOKEN: 'test-token', SLACK_AGENT_OPS_STAGING_CHANNEL_ID: 'CPROD', SLACK_AGENT_OPS_CHANNEL_ID: 'CPROD' })).toThrow('production')
  })
  it('requires explicit enablement and a scoped bot receipt destination', () => {
    expect(() => getSlackAgentDeliveryConfig(staging)).toThrow('disabled')
    const config = getSlackAgentDeliveryConfig({ ...staging, SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED: 'true', SLACK_AGENT_OPS_STAGING_BOT_TOKEN: 'test-token', SLACK_AGENT_OPS_STAGING_CHANNEL_ID: 'CSTAGING' })
    expect(config.channel).toBe('CSTAGING')
    expect(config.sourceOrigin).toBe('https://staging.example.test')
  })
  it.each(['https://user:pass@example.test', 'https://example.test/path', 'https://example.test?token=secret', 'http://example.test'])('rejects unsafe or non-origin URLs %s', (url) => {
    expect(() => getSlackAgentSource({ ...staging, SLACK_AGENT_OPS_STAGING_BASE_URL: url })).toThrow()
  })
  it('permits a local loopback origin but never a production origin for local cards', () => {
    expect(getSlackAgentSource({ APP_ENV: 'development', NEXT_PUBLIC_BASE_URL: 'http://localhost:3000' }).sourceOrigin).toBe('http://localhost:3000')
    expect(() => getSlackAgentSource({ APP_ENV: 'development', SLACK_AGENT_OPS_LOCAL_BASE_URL: 'https://amadutown.com' })).toThrow('production')
  })

})
