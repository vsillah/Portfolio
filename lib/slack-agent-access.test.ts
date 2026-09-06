import { afterEach, describe, expect, it, vi } from 'vitest'
import { requireAuthorizedSlackActor } from './slack-agent-access'

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
