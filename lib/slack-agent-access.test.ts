import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireAuthorizedSlackActor, requireAuthorizedSlackChannel } from './slack-agent-access'

afterEach(() => vi.unstubAllEnvs())

function hosted() {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('SLACK_AGENT_OPS_TEAM_ID', 'T_ALLOWED')
  vi.stubEnv('SLACK_AGENT_OPS_ALLOWED_USER_IDS', 'U_ALLOWED')
  vi.stubEnv('SLACK_AGENT_ALLOWED_USER_IDS', '')
}

describe('shared Slack actor authorization', () => {
  it.each([
    { userId: 'U_OTHER', teamId: 'T_ALLOWED' },
    { userId: 'U_ALLOWED', teamId: 'T_OTHER' },
    { userId: 'U_ALLOWED' },
    { teamId: 'T_ALLOWED' },
  ])('rejects missing or unauthorized actor/workspace before use: %j', (actor) => {
    hosted()
    expect(requireAuthorizedSlackActor(actor).ok).toBe(false)
  })
  it('requires both hosted operator and workspace configuration', () => {
    hosted()
    vi.stubEnv('SLACK_AGENT_OPS_TEAM_ID', '')
    expect(requireAuthorizedSlackActor({ userId: 'U_ALLOWED', teamId: 'T_ALLOWED' }).ok).toBe(false)
    vi.stubEnv('SLACK_AGENT_OPS_TEAM_ID', 'T_ALLOWED')
    vi.stubEnv('SLACK_AGENT_OPS_ALLOWED_USER_IDS', '')
    expect(requireAuthorizedSlackActor({ userId: 'U_ALLOWED', teamId: 'T_ALLOWED' }).ok).toBe(false)
  })
  it('accepts the configured hosted actor and workspace', () => {
    hosted()
    expect(requireAuthorizedSlackActor({ userId: 'U_ALLOWED', teamId: 'T_ALLOWED' }).ok).toBe(true)
  })
  it('does not interpret APP_ENV staging as local even with NODE_ENV test', () => {
    hosted()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_ENV', 'staging')
    vi.stubEnv('SLACK_AGENT_OPS_TEAM_ID', '')
    expect(requireAuthorizedSlackActor({ userId: 'U_ALLOWED' }).ok).toBe(false)
  })
})


describe('source-scoped Slack channel authorization', () => {
  function source(environment = 'staging') {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_ENV', environment === 'preview' ? 'preview' : 'production')
    vi.stubEnv('APP_ENV', environment)
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', environment)
    vi.stubEnv('SLACK_AGENT_OPS_CHANNEL_ID', 'CPRODUCTION')
    vi.stubEnv('SLACK_AGENT_OPS_PRODUCTION_CHANNEL_ID', 'CPRODUCTION')
    vi.stubEnv('SLACK_AGENT_OPS_PRODUCTION_ALLOWED_CHANNEL_IDS', 'DPRODUCTION')
    vi.stubEnv(`SLACK_AGENT_OPS_${environment.toUpperCase()}_CHANNEL_ID`, environment === 'production' ? 'CPRODUCTION' : 'CREVIEW')
    vi.stubEnv(`SLACK_AGENT_OPS_${environment.toUpperCase()}_ALLOWED_CHANNEL_IDS`, '')
  }
  it.each(['production', 'staging', 'preview'])('accepts only the configured %s review channel', (environment) => {
    source(environment)
    expect(requireAuthorizedSlackChannel(environment === 'production' ? 'CPRODUCTION' : 'CREVIEW').ok).toBe(true)
    expect(requireAuthorizedSlackChannel('COTHER').ok).toBe(false)
    expect(requireAuthorizedSlackChannel(undefined).ok).toBe(false)
    expect(requireAuthorizedSlackChannel('').ok).toBe(false)
  })
  it('requires explicit source-specific permission for additional channels and DMs', () => {
    source()
    expect(requireAuthorizedSlackChannel('DREVIEW').ok).toBe(false)
    vi.stubEnv('SLACK_AGENT_OPS_STAGING_ALLOWED_CHANNEL_IDS', 'DREVIEW, CSECOND')
    expect(requireAuthorizedSlackChannel('DREVIEW').ok).toBe(true)
    expect(requireAuthorizedSlackChannel('CSECOND').ok).toBe(true)
    expect(requireAuthorizedSlackChannel('CREVIEW').ok).toBe(true)
  })
  it('fails closed with missing hosted source/channel configuration', () => {
    source()
    vi.stubEnv('SLACK_AGENT_OPS_STAGING_CHANNEL_ID', '')
    expect(requireAuthorizedSlackChannel('CPRODUCTION').ok).toBe(false)
    vi.stubEnv('APP_ENV', '')
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', '')
    expect(requireAuthorizedSlackChannel('CREVIEW').ok).toBe(false)
  })
  it.each(['CPRODUCTION', 'DPRODUCTION'])('rejects a nonproduction allowlist reusing production destination %s', (channel) => {
    source()
    vi.stubEnv('SLACK_AGENT_OPS_STAGING_ALLOWED_CHANNEL_IDS', channel)
    expect(requireAuthorizedSlackChannel(channel).ok).toBe(false)
    expect(requireAuthorizedSlackChannel('CREVIEW').ok).toBe(false)
  })
  it('does not allow a local bypass when APP_ENV is hosted', () => {
    source()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('VERCEL_ENV', '')
    expect(requireAuthorizedSlackChannel('COTHER').ok).toBe(false)
  })
  it('keeps explicitly local fixtures local', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('APP_ENV', 'local')
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'local')
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('VERCEL_ENV', '')
    expect(requireAuthorizedSlackChannel(undefined)).toEqual({ ok: true, channelId: null })
  })
})
