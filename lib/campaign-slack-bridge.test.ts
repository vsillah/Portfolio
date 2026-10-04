// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabaseAdmin: null }))
import { campaignSlackDispatchGate, decideCampaignSlackRelease, routeCampaignToSlack, type CampaignSlackIntent, type CampaignSlackStore, type CampaignSlackDecision } from './campaign-slack-bridge'
import { fixture } from './campaign-release-test-fixture'
import { releaseHash, type ReleaseRecord } from './campaign-release-manifest'

function memory() {
  const manifest = fixture()
  let record: ReleaseRecord & { slackDecision?: CampaignSlackDecision } = { manifest, hash: releaseHash(manifest), state: 'pending', version: 1, audit: [] }
  const intents = new Map<string, CampaignSlackIntent>()
  const store: CampaignSlackStore = {
    release: vi.fn(async () => structuredClone(record)), sources: vi.fn(async () => {}),
    intent: async id => structuredClone([...intents.values()].find(row => row.id === id) ?? null),
    insert: async row => { if (!intents.has(row.key)) intents.set(row.key, structuredClone(row)); return structuredClone(intents.get(row.key)!) },
    transition: async (row, next) => { if (intents.get(row.key)?.state !== row.state) return null; intents.set(row.key, structuredClone(next)); return structuredClone(next) },
    decide: vi.fn(async (current, next) => { if (record.version !== current.version) return false; record = structuredClone(next); return true }),
  }
  return { store, intents, record: () => record, mutate: (change: Partial<ReleaseRecord>) => { record = { ...record, ...change } },
    input: { campaignId: manifest.campaignId, releaseId: manifest.releaseId, hash: record.hash, version: 1, actor: 'admin-1', dispatch: true } }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T01:00:00Z'))
  for (const [key, value] of Object.entries({ APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', VERCEL_ENV: 'production',
    SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.com', SLACK_AGENT_OPS_STAGING_CHANNEL_ID: 'C123',
    SLACK_AGENT_OPS_TEAM_ID: 'T123', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123', SLACK_AGENT_OPS_STAGING_BOT_TOKEN: 'synthetic',
    SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED: 'true', CAMPAIGN_SLACK_DISPATCH_ENABLED: '', SLACK_ACTION_RECEIPTS_ENABLED: 'true',
    SLACK_ACTION_RECEIPTS_ENVIRONMENT: 'staging', SLACK_SIGNING_SECRET: 'synthetic' })) vi.stubEnv(key, value)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Egress forbidden') }))
})
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })
const send = () => vi.fn(async () => ({ sent: true, reason: null, mode: 'bot' as const, channel: 'C123', ts: '123.456' }))
async function sent() {
  vi.stubEnv('CAMPAIGN_SLACK_DISPATCH_ENABLED', 'true')
  const m = memory(), transport = send()
  const result = await routeCampaignToSlack(m.input, m.store, transport)
  const command: CampaignSlackDecision = { releaseId: m.input.releaseId, hash: m.input.hash, version: 1, intentId: result.intent.id,
    decision: 'approve', actor: 'U123', team: 'T123', channel: 'C123', ts: '123.456', sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.com', commandKey: 'signed-command-1' }
  return { ...m, command, transport }
}
describe('campaign Slack dispatch and signed decision bridge', () => {
  it('saves a default-off intent once without invoking any transport', async () => {
    const m = memory(), transport = send()
    const a = await routeCampaignToSlack(m.input, m.store, transport), b = await routeCampaignToSlack(m.input, m.store, transport)
    expect(a.intent.id).toBe(b.intent.id); expect(a.intent.state).toBe('prepared'); expect(a.gate.enabled).toBe(false)
    expect(m.intents.size).toBe(1); expect(transport).not.toHaveBeenCalled()
  })
  it.each(['SLACK_SIGNING_SECRET', 'SLACK_ACTION_RECEIPTS_ENABLED', 'SLACK_AGENT_OPS_ALLOWED_USER_IDS', 'SLACK_AGENT_OPS_TEAM_ID', 'SLACK_AGENT_OPS_STAGING_BOT_TOKEN', 'SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED'])(
    'blocks dispatch with missing %s', key => { vi.stubEnv('CAMPAIGN_SLACK_DISPATCH_ENABLED', 'true'); vi.stubEnv(key, ''); expect(campaignSlackDispatchGate().enabled).toBe(false) })
  it('rejects cross-campaign and stale admin requests before saving an intent', async () => {
    const m = memory(), transport = send()
    await expect(routeCampaignToSlack({ ...m.input, campaignId: 'other' }, m.store, transport)).rejects.toThrow('Campaign mismatch')
    await expect(routeCampaignToSlack({ ...m.input, version: 2 }, m.store, transport)).rejects.toThrow('changed')
    expect(m.intents.size).toBe(0); expect(transport).not.toHaveBeenCalled()
  })
  it('prepare-only never dispatches even when enabled', async () => {
    vi.stubEnv('CAMPAIGN_SLACK_DISPATCH_ENABLED', 'true'); const m = memory(), transport = send()
    await routeCampaignToSlack({ ...m.input, dispatch: false }, m.store, transport); expect(transport).not.toHaveBeenCalled()
  })
  it('claims one message under competing dispatches and preserves exact card identity', async () => {
    vi.stubEnv('CAMPAIGN_SLACK_DISPATCH_ENABLED', 'true'); const m = memory(), transport = send()
    await Promise.allSettled([routeCampaignToSlack(m.input, m.store, transport), routeCampaignToSlack(m.input, m.store, transport)])
    expect(transport).toHaveBeenCalledOnce()
    const calls = vi.mocked(transport).mock.calls as unknown as Array<[string, unknown]>
    expect(JSON.stringify(calls[0][1])).toContain(m.input.hash)
    await routeCampaignToSlack(m.input, m.store, transport); expect(transport).toHaveBeenCalledOnce()
  })
  it.each([true, false])('never retries uncertain/rejected delivery (%s)', async uncertain => {
    vi.stubEnv('CAMPAIGN_SLACK_DISPATCH_ENABLED', 'true'); const m = memory()
    const transport = vi.fn(async () => ({ sent: false, reason: 'synthetic', mode: 'bot' as const, uncertain }))
    const first = await routeCampaignToSlack(m.input, m.store, transport)
    expect(first.intent.state).toBe(uncertain ? 'unconfirmed' : 'rejected')
    await routeCampaignToSlack(m.input, m.store, transport); expect(transport).toHaveBeenCalledOnce()
  })
  it('preserves sending when the outcome write is lost and never resends', async () => {
    vi.stubEnv('CAMPAIGN_SLACK_DISPATCH_ENABLED', 'true'); const m = memory(), transport = send(), transition = m.store.transition
    m.store.transition = async (row, next) => next.state === 'sent' ? Promise.reject(new Error('lost outcome')) : transition(row, next)
    await expect(routeCampaignToSlack(m.input, m.store, transport)).rejects.toThrow('lost outcome')
    await routeCampaignToSlack(m.input, m.store, transport); expect(transport).toHaveBeenCalledOnce()
  })
  it.each(['approve', 'revise', 'hold', 'stop'] as const)('records %s with signed context and dedupes exactly', async decision => {
    const m = await sent(), command = { ...m.command, decision }
    expect((await decideCampaignSlackRelease(command, m.store)).status).toBe('completed')
    expect((await decideCampaignSlackRelease(command, m.store)).status).toBe('already_recorded')
    expect(m.record().audit).toHaveLength(1); expect(m.record().slackDecision).toEqual(command); expect(m.store.decide).toHaveBeenCalledOnce()
  })
  it.each([{ hash: 'b'.repeat(64) }, { version: 2 }, { team: 'T999' }, { channel: 'C999' }, { ts: '123.457' },
    { sourceOrigin: 'https://other.example.com' }, { sourceEnvironment: 'production' }, { releaseId: 'other' }, { intentId: 'unknown' }])('rejects changed binding %j', async change => {
    const m = await sent()
    expect((await decideCampaignSlackRelease({ ...m.command, ...change }, m.store)).status).toBe('blocked')
    expect(m.store.decide).not.toHaveBeenCalled()
  })
  it('rejects stale alternate decision and concurrent winners by release version', async () => {
    const m = await sent()
    const results = await Promise.all([decideCampaignSlackRelease(m.command, m.store), decideCampaignSlackRelease({ ...m.command, decision: 'hold', commandKey: 'other' }, m.store)])
    expect(results.map(r => r.status).sort()).toEqual(['blocked', 'completed']); expect(m.record().audit).toHaveLength(1)
    expect((await decideCampaignSlackRelease({ ...m.command, decision: 'stop', commandKey: 'stale' }, m.store)).status).toBe('blocked')
  })
  it('rejects changed sources and expired approval before any decision write', async () => {
    const m = await sent(); vi.mocked(m.store.sources).mockRejectedValueOnce(new Error('changed'))
    expect((await decideCampaignSlackRelease(m.command, m.store)).status).toBe('blocked')
    vi.setSystemTime(new Date('2026-10-05T00:00:00Z'))
    expect((await decideCampaignSlackRelease(m.command, m.store)).status).toBe('blocked'); expect(m.store.decide).not.toHaveBeenCalled()
  })
})
