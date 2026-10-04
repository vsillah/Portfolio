// @vitest-environment node
// Real HTTP signature -> allowlist -> durable receipt -> version CAS -> original-card update.
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), jobs: [] as Promise<unknown>[] }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@vercel/functions', () => ({ waitUntil: (job: Promise<unknown>) => mocks.jobs.push(job) }))
vi.mock('@/lib/chief-of-staff-chat', () => ({ runChiefOfStaffChat: vi.fn(() => { throw new Error('Provider forbidden') }) }))
vi.mock('@/lib/agent-run', () => ({ recordAgentEvent: vi.fn() }))
vi.mock('@/lib/agent-work-items', () => ({ claimAgentWorkItem: vi.fn(), createAgentWorkItem: vi.fn(), getAgentWorkItem: vi.fn(), handoffAgentWorkItem: vi.fn(), markAgentWorkItemReadyForKanban: vi.fn(), recordAgentWorkItemBlocker: vi.fn() }))
vi.mock('@/lib/agent-inbox-routing', () => ({ routeAgentInboxItem: vi.fn() }))
import { POST } from '@/app/api/slack/agent/actions/route'
import { campaignReleaseSlackBlocks } from './campaign-release-slack'
import { campaignSlackProjection, routeCampaignToSlack } from './campaign-slack-bridge'
import { campaignSourceFingerprint, releaseHash, type ReleaseRecord } from './campaign-release-manifest'
import { fixture } from './campaign-release-test-fixture'
import { processSlackReceipt, type Receipt } from './slack-action-receipts'

const rows: Record<string, any>[] = []
const source = { id: fixture().actions[0].source.id, body: 'Synthetic current source' }
let blocks: any[], cardId: string, record: ReleaseRecord
let failDecisionWrite = false, failReceiptOutcome = false
const pathValue = (row: any, path: string) => path.split(/->>?/).reduce((value, key) => value?.[key], row)
function query(table: string) {
  if (table !== 'agent_runs' && table !== 'social_content_queue') throw new Error(`Forbidden downstream table ${table}`)
  const filters: Array<(row: any) => boolean> = []
  let write: any, insert = false, one = false
  const q: any = {
    select: () => q, order: () => q, limit: () => q, abortSignal: () => q,
    eq: (key: string, value: unknown) => { filters.push(row => String(pathValue(row, key)) === String(value)); return q },
    in: (key: string, values: unknown[]) => { filters.push(row => values.includes(pathValue(row, key))); return q },
    neq: (key: string, value: unknown) => { filters.push(row => pathValue(row, key) !== value); return q },
    gt: (key: string, value: string) => { filters.push(row => pathValue(row, key) > value); return q },
    single: () => { one = true; return q }, maybeSingle: () => { one = true; return q },
    insert: (value: any) => { write = value; insert = true; return q }, update: (value: any) => { write = value; return q },
    then: (resolve: (value: any) => void, reject: (error: any) => void) => Promise.resolve().then(() => {
      if (insert) {
        if (rows.some(row => row.idempotency_key === write.idempotency_key)) return { data: null, error: { code: '23505' } }
        rows.push(structuredClone(write)); return { data: structuredClone(write), error: null }
      }
      const found = (table === 'social_content_queue' ? [source] : rows).filter(row => filters.every(f => f(row)))
      if (write) {
        if ((failDecisionWrite && write.metadata?.slackDecision) || (failReceiptOutcome && write.metadata?.state === 'outcome')) return { data: null, error: { message: 'synthetic lost write' } }
        for (const row of found) Object.assign(row, structuredClone(write))
      }
      return { data: structuredClone(one ? found[0] ?? null : found), error: null }
    }).then(resolve, reject),
  }
  return q
}
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T01:00:00Z')); vi.clearAllMocks(); mocks.jobs.length = 0; rows.length = 0
  failDecisionWrite = false; failReceiptOutcome = false
  for (const [key, value] of Object.entries({ APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging', VERCEL_ENV: 'production',
    SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.com', SLACK_AGENT_OPS_STAGING_CHANNEL_ID: 'C123',
    SLACK_AGENT_OPS_TEAM_ID: 'T123', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123', SLACK_AGENT_OPS_STAGING_BOT_TOKEN: 'synthetic',
    SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED: 'true', CAMPAIGN_SLACK_DISPATCH_ENABLED: 'true', SLACK_ACTION_RECEIPTS_ENABLED: 'true',
    SLACK_ACTION_RECEIPTS_ENVIRONMENT: 'staging', SLACK_SIGNING_SECRET: 'synthetic-secret', SLACK_AGENT_OPS_STAGING_ALLOWED_CHANNEL_IDS: '',
    SLACK_AGENT_OPS_PRODUCTION_ALLOWED_CHANNEL_IDS: '', SLACK_AGENT_OPS_PRODUCTION_CHANNEL_ID: 'CPROD' })) vi.stubEnv(key, value)
  mocks.from.mockImplementation(query)
  const manifest = fixture(); manifest.actions[0].source.fingerprint = campaignSourceFingerprint(source)
  record = { manifest, hash: releaseHash(manifest), version: 1, state: 'pending', audit: [] }
  rows.push({ id: manifest.releaseId, kind: 'campaign_release_manifest', metadata: structuredClone(record) })
  const routed = await routeCampaignToSlack({ campaignId: manifest.campaignId, releaseId: manifest.releaseId, hash: record.hash, version: 1, actor: 'synthetic-admin', dispatch: true }, undefined,
    async () => ({ sent: true, reason: null, mode: 'bot', channel: 'C123', ts: '123.456' }))
  cardId = routed.intent.id
  blocks = campaignReleaseSlackBlocks(record, cardId)
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string)
    expect(body.channel).toBe('C123')
    if (url === 'https://slack.com/api/conversations.history') return Response.json({ ok: true, messages: [{ ts: '123.456', blocks }] })
    if (url === 'https://slack.com/api/chat.update') { expect(body.ts).toBe('123.456'); blocks = body.blocks; return Response.json({ ok: true, channel: 'C123', ts: '123.456' }) }
    throw new Error(`Forbidden provider request: ${url}`)
  }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })
function payload(decision = 'approve', changes: Record<string, unknown> = {}) {
  const value = { action: `campaign_release.${decision}`, schemaVersion: 'campaign-release/v1', runId: record.manifest.releaseId,
    manifestHash: record.hash, releaseVersion: '1', dispatchIntentId: cardId, sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.com', ...changes }
  return { type: 'block_actions', team: { id: 'T123' }, channel: { id: 'C123' }, user: { id: 'U123' },
    container: { message_ts: '123.456', channel_id: 'C123' }, actions: [{ action_id: `campaign_release_${decision}`, value: JSON.stringify(value) }] }
}
async function post(value = payload(), secret = 'synthetic-secret', age = 0) {
  const body = new URLSearchParams({ payload: JSON.stringify(value) }).toString(), timestamp = String(Math.floor(Date.now() / 1000) - age)
  const signature = 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')
  const response = await POST(new NextRequest('https://staging.example.com/api/slack/agent/actions', { method: 'POST', body,
    headers: { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature } }))
  await Promise.all(mocks.jobs.splice(0))
  return response
}
const receiptRows = () => rows.filter(row => row.kind === 'slack_action_receipt' && row.metadata.state !== 'message_lock') as Receipt[]
it.each(['approve', 'revise', 'hold', 'stop'])('signed %s saves one bound decision and updates only the original card', async decision => {
  await post(payload(decision))
  expect(rows[0].metadata.audit).toHaveLength(1)
  expect(rows[0].metadata.slackDecision).toMatchObject({ actor: 'U123', channel: 'C123', version: 1, hash: record.hash, intentId: cardId, ts: '123.456' })
  expect(receiptRows()[0].metadata.envelope.value).toMatchObject({ manifestHash: record.hash, releaseVersion: '1', dispatchIntentId: cardId })
  expect(receiptRows()[0].metadata.state).toBe('delivered')
  expect(JSON.stringify(blocks)).not.toContain('campaign_release.approve'); expect(JSON.stringify(blocks)).not.toContain('campaign_release.stop')
  expect(JSON.stringify(blocks)).toContain('Open in Portfolio')
  const replay = await post(payload(decision))
  expect((await replay.json()).text).toContain('Duplicate callback')
  expect(receiptRows()).toHaveLength(1); expect(rows[0].metadata.audit).toHaveLength(1)
  expect(fetch).toHaveBeenCalledTimes(2)
  const projection = await campaignSlackProjection(record.manifest.campaignId, record.manifest.releaseId)
  expect(projection.receipts[0]).toMatchObject({ status: 'completed', delivery: 'delivered' })
})
it.each([['wrong-secret', 0], ['synthetic-secret', 301]] as const)('rejects invalid/stale signature before persistence', async (secret, age) => {
  expect((await post(payload(), secret, age)).status).toBe(401); expect(receiptRows()).toHaveLength(0); expect(fetch).not.toHaveBeenCalled()
})
it.each(['actor', 'channel', 'team', 'source', 'missing_hash', 'missing_version', 'missing_intent'])('rejects unauthorized %s before receipt insert', async kind => {
  const p = payload()
  if (kind === 'actor') p.user.id = 'U999'
  if (kind === 'team') p.team.id = 'T999'
  if (kind === 'channel') p.channel.id = p.container.channel_id = 'C999'
  const value = JSON.parse(p.actions[0].value)
  if (kind === 'source') value.sourceOrigin = 'https://other.example.com'
  if (kind === 'missing_hash') delete value.manifestHash
  if (kind === 'missing_version') delete value.releaseVersion
  if (kind === 'missing_intent') delete value.dispatchIntentId
  p.actions[0].value = JSON.stringify(value)
  await post(p); expect(receiptRows()).toHaveLength(0); expect(rows[0].metadata.audit).toHaveLength(0); expect(fetch).not.toHaveBeenCalled()
})
it.each([{ manifestHash: 'b'.repeat(64) }, { releaseVersion: '2' }])('persists blocked changed binding without deciding: %j', async changes => {
  await post(payload('approve', changes)); expect(receiptRows()[0].outcome.canonical?.actionStatus).toBe('blocked'); expect(rows[0].metadata.audit).toHaveLength(0)
})
it('rejects another decision from the stale card without a second campaign mutation', async () => {
  await post(); await post(payload('hold'))
  expect(rows[0].metadata.audit).toHaveLength(1); expect(receiptRows()[1].outcome.canonical?.actionStatus).toBe('blocked')
})
it('preserves decision when missing Slack configuration blocks card update', async () => {
  vi.stubEnv('SLACK_AGENT_OPS_STAGING_BOT_TOKEN', '')
  await post(); expect(rows[0].metadata.audit).toHaveLength(1)
  expect(receiptRows()[0].metadata.state).toBe('delivery_blocked')
  expect(receiptRows()[0].outcome.deliveryError).toContain('Configure the source-environment Slack bot token')
  await post(); expect(rows[0].metadata.audit).toHaveLength(1); expect(fetch).not.toHaveBeenCalled()
})
it('retries only card feedback after transport failure', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error('synthetic network failure'))
  await post(); const receipt = receiptRows()[0]
  expect(receipt.outcome.canonical?.actionStatus).toBe('completed'); expect(receipt.outcome.delivery).toBe('failed')
  vi.setSystemTime(new Date(Date.now() + 1000_000)); await processSlackReceipt(receipt.idempotency_key)
  expect(receiptRows()[0].metadata.state).toBe('delivered'); expect(rows[0].metadata.audit).toHaveLength(1)
})
it('reports an unconfirmed decision write without retrying campaign mutation', async () => {
  failDecisionWrite = true; await post()
  expect(receiptRows()[0].outcome.canonical?.actionStatus).toBe('failed'); expect(rows[0].metadata.audit).toHaveLength(0)
  failDecisionWrite = false; await post(); expect(rows[0].metadata.audit).toHaveLength(0)
})
it('lost receipt outcome retains executing then requires reconciliation, never redecides', async () => {
  failReceiptOutcome = true; await post(); expect(rows[0].metadata.audit).toHaveLength(1)
  const receipt = receiptRows()[0]; expect(receipt.metadata.state).toBe('executing')
  failReceiptOutcome = false; vi.setSystemTime(new Date(Date.now() + 121_000)); await processSlackReceipt(receipt.idempotency_key)
  expect(receiptRows()[0].metadata.state).toBe('reconciliation_required'); expect(rows[0].metadata.audit).toHaveLength(1); expect(fetch).not.toHaveBeenCalled()
})

it('projects only campaign decisions, excluding unrelated run actions and message locks', async () => {
  await post()
  const unrelated = structuredClone(receiptRows()[0])
  unrelated.id = '55555555-5555-4555-8555-555555555555'
  unrelated.metadata.envelope.value.action = 'run.ask_shaka'
  rows.push({ ...unrelated, kind: 'slack_action_receipt' })
  const projection = await campaignSlackProjection(record.manifest.campaignId, record.manifest.releaseId)
  expect(projection.receipts).toHaveLength(1)
  expect(projection.release.state).toBe('approved')
})
