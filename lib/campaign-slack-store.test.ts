// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ admin: null as { from: ReturnType<typeof vi.fn> } | null }))
vi.mock('./supabase', () => ({ get supabaseAdmin() { return state.admin } }))
vi.mock('@/lib/supabase', () => ({ get supabaseAdmin() { return state.admin } }))
import { CAMPAIGN_SLACK_KIND, campaignSlackProjection, campaignSlackStore, type CampaignSlackIntent } from './campaign-slack-bridge'
import { CAMPAIGN_RELEASE_KIND } from './campaign-release-store'
import { fixture } from './campaign-release-test-fixture'
import { releaseHash, type ReleaseRecord } from './campaign-release-manifest'

type Result = { data: unknown; error: { message?: string; code?: string } | null }
const calls: Array<{ table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> }> = []
const queued: Result[] = []
function queue(result: Result) { queued.push(result) }
function from(table: string) {
  const result = queued.shift() ?? { data: null, error: { message: 'unexpected query' } }
  const filters: Array<[string, unknown]> = []
  let op = 'select'
  let payload: unknown
  let settled = false
  const finish = () => {
    if (!settled) { settled = true; calls.push({ table, op, payload, filters: [...filters] }) }
    return result
  }
  const q: Record<string, unknown> = {}
  const chain = () => q
  Object.assign(q, {
    select: chain, order: chain, limit: chain,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return q },
    neq: (key: string, value: unknown) => { filters.push([`neq:${key}`, value]); return q },
    in: (key: string, value: unknown) => { filters.push([`in:${key}`, value]); return q },
    insert: (value: unknown) => { op = 'insert'; payload = value; return q },
    update: (value: unknown) => { op = 'update'; payload = value; return q },
    single: () => Promise.resolve(finish()), maybeSingle: () => Promise.resolve(finish()),
    then: (resolve: (value: Result) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(finish()).then(resolve, reject),
  })
  return q
}
const intent: CampaignSlackIntent = {
  id: '22222222-2222-4222-8222-222222222222', key: 'campaign-slack:abc', releaseId: fixture().releaseId,
  hash: 'a'.repeat(64), version: 1, campaignId: fixture().campaignId, sourceEnvironment: 'staging',
  sourceOrigin: 'https://staging.example.com', team: 'T123', channel: 'C123', actor: 'admin-1', state: 'prepared',
}
function record(): ReleaseRecord {
  const manifest = fixture()
  return { manifest, hash: releaseHash(manifest), state: 'pending', version: 1, audit: [] }
}
beforeEach(() => {
  calls.length = 0; queued.length = 0; state.admin = { from: vi.fn(from) }
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Egress forbidden') }))
  for (const [key, value] of Object.entries({ APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', VERCEL_ENV: 'production',
    SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.com' })) vi.stubEnv(key, value)
})
describe('campaign Slack persistence contracts', () => {
  it('fails closed when the database client is missing', async () => {
    state.admin = null
    const current = record()
    await expect(campaignSlackStore.intent(intent.id)).rejects.toThrow('Campaign Slack storage unavailable.')
    await expect(campaignSlackStore.insert(intent)).rejects.toThrow('Campaign Slack storage unavailable.')
    await expect(campaignSlackStore.transition(intent, { ...intent, state: 'sending' })).rejects.toThrow('Campaign Slack storage unavailable.')
    await expect(campaignSlackStore.decide(current, { ...current, state: 'stopped' })).rejects.toThrow('Campaign Slack storage unavailable.')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('hides a dispatch read failure and returns no intent for a real miss', async () => {
    queue({ data: null, error: { message: 'password=secret-token' } })
    await expect(campaignSlackStore.intent(intent.id)).rejects.toThrow(/^Dispatch read unconfirmed\.$/)
    queue({ data: null, error: null })
    await expect(campaignSlackStore.intent(intent.id)).resolves.toBeUndefined()
    expect(calls[0]).toMatchObject({ table: 'agent_runs', op: 'select', filters: [['kind', CAMPAIGN_SLACK_KIND], ['id', intent.id]] })
  })
  it('saves one review intent and reuses the stored row after a unique conflict', async () => {
    queue({ data: { metadata: intent }, error: null })
    await expect(campaignSlackStore.insert(intent)).resolves.toEqual(intent)
    expect(calls[0].payload).toMatchObject({ id: intent.id, kind: CAMPAIGN_SLACK_KIND, idempotency_key: intent.key, metadata: intent,
      status: 'waiting_for_approval', outcome: { providerExecutionEnabled: false } })
    const stored = { ...intent, id: '33333333-3333-4333-8333-333333333333' }
    queue({ data: null, error: { code: '23505', message: 'duplicate key secret-token' } })
    queue({ data: { metadata: stored }, error: null })
    await expect(campaignSlackStore.insert({ ...intent, id: '44444444-4444-4444-8444-444444444444' })).resolves.toEqual(stored)
    expect(calls[2]).toMatchObject({ op: 'select', filters: [['kind', CAMPAIGN_SLACK_KIND], ['idempotency_key', intent.key]] })
  })
  it.each([
    [{ data: null, error: { code: '42501', message: 'permission denied secret-token' } }],
    [{ data: null, error: { code: '23505', message: 'duplicate key secret-token' } }, { data: null, error: { message: 'lookup secret-token' } }],
    [{ data: null, error: { code: '23505', message: 'duplicate key secret-token' } }, { data: null, error: null }],
  ])('does not confirm a dispatch save on %j', async (...results: Result[]) => {
    results.forEach(queue)
    await expect(campaignSlackStore.insert(intent)).rejects.toThrow(/^Dispatch intent save unconfirmed\. Refresh before retrying\.$/)
    expect(JSON.stringify(calls)).not.toContain('secret-token')
  })
  it('hides a lost dispatch transition and reports a compare-and-swap miss', async () => {
    queue({ data: null, error: { message: 'deadlock secret-token' } })
    await expect(campaignSlackStore.transition(intent, { ...intent, state: 'sending' })).rejects.toThrow(/^Dispatch save unconfirmed\. Reconcile the original card; do not resend\.$/)
    queue({ data: null, error: null })
    await expect(campaignSlackStore.transition(intent, { ...intent, state: 'sending' })).resolves.toBeNull()
    expect(calls[0].payload).toMatchObject({ current_step: 'Slack sending', metadata: { state: 'sending' } })
    expect(calls[0].filters).toEqual([['kind', CAMPAIGN_SLACK_KIND], ['id', intent.id], ['metadata->>state', 'prepared']])
  })
  it('binds a decision to the release hash and version without returning database text', async () => {
    const current = record()
    const stopped = { ...current, state: 'stopped' as const, version: 2 }
    queue({ data: { id: current.manifest.releaseId }, error: null })
    await expect(campaignSlackStore.decide(current, stopped)).resolves.toBe(true)
    expect(calls[0].payload).toMatchObject({ status: 'cancelled', current_step: 'stopped; provider execution unavailable', metadata: stopped })
    expect(calls[0].filters).toEqual([
      ['id', current.manifest.releaseId], ['kind', CAMPAIGN_RELEASE_KIND],
      ['metadata->>hash', current.hash], ['metadata->>version', '1'],
    ])
    const approved = { ...current, state: 'approved' as const, version: 2 }
    queue({ data: null, error: null })
    await expect(campaignSlackStore.decide(current, approved)).resolves.toBe(false)
    expect(calls[1].payload).toMatchObject({ status: 'waiting_for_approval' })
    queue({ data: null, error: { message: 'constraint secret-token' } })
    await expect(campaignSlackStore.decide(current, approved)).rejects.toThrow(/^Decision write unconfirmed\. Inspect the receipt before retrying\.$/)
  })
  it('hides projection failures and refuses another campaign release', async () => {
    const current = record()
    queue({ data: null, error: { message: 'relation secret-token' } })
    queue({ data: [], error: null })
    await expect(campaignSlackProjection(current.manifest.campaignId, current.manifest.releaseId)).rejects.toThrow(/^Slack outcome unavailable\. Refresh before retrying\.$/)
    const otherCampaign = '99999999-9999-4999-8999-999999999999'
    queue({ data: [], error: null }); queue({ data: [], error: null }); queue({ data: { metadata: current }, error: null })
    await expect(campaignSlackProjection(otherCampaign, current.manifest.releaseId)).rejects.toThrow(/^Campaign mismatch\.$/)
    expect(calls[2].filters).toEqual(expect.arrayContaining([
      ['kind', CAMPAIGN_SLACK_KIND], ['subject_id', otherCampaign],
      ['metadata->>releaseId', current.manifest.releaseId], ['metadata->>sourceEnvironment', 'staging'],
      ['metadata->>sourceOrigin', 'https://staging.example.com'],
    ]))
    expect(calls[3].filters).toEqual(expect.arrayContaining([
      ['kind', 'slack_action_receipt'], ['metadata->envelope->value->>runId', current.manifest.releaseId],
      ['neq:metadata->>state', 'message_lock'],
    ]))
    expect(fetch).not.toHaveBeenCalled()
  })
})
