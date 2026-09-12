// @vitest-environment node
// Real signature, decoder, authorization, acceptSlackAction and receiptStore.
// Only database transport and background execution are replaced; no live credentials.
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ from: vi.fn(), process: vi.fn(), wait: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@vercel/functions', () => ({ waitUntil: mocks.wait }))
vi.mock('@/lib/slack-action-receipts', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/slack-action-receipts')>(), processSlackReceipt: mocks.process,
}))
vi.mock('@/lib/chief-of-staff-chat', () => ({ runChiefOfStaffChat: vi.fn() }))
vi.mock('@/lib/agent-run', () => ({ recordAgentEvent: vi.fn() }))
vi.mock('@/lib/agent-work-items', () => ({ claimAgentWorkItem: vi.fn(), createAgentWorkItem: vi.fn(), getAgentWorkItem: vi.fn(), handoffAgentWorkItem: vi.fn(), markAgentWorkItemReadyForKanban: vi.fn(), recordAgentWorkItemBlocker: vi.fn() }))
vi.mock('@/lib/agent-inbox-routing', () => ({ routeAgentInboxItem: vi.fn() }))
import { POST } from './route'
import type { Receipt } from '@/lib/slack-action-receipts'

type StoredReceipt = Receipt & { kind: string }
const rows = new Map<string, StoredReceipt>()
const syntheticSecret = 'synthetic-signing-secret-never-used-outside-tests'
function payload() {
  return { type: 'block_actions', team: { id: 'T123' }, user: { id: 'U123' }, channel: { id: 'C123' },
    container: { message_ts: '123.456', channel_id: 'C123' },
    response_url: 'https://hooks.slack.com/actions/synthetic-never-fetch',
    actions: [{ action_id: 'decision', value: JSON.stringify({ action: 'social_calendar.approve', schemaVersion: 'v1',
      sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.com', calendarItemId: 'calendar-1' }) }] }
}
function signed(value: unknown, options: { retry?: boolean; invalid?: boolean; stale?: boolean } = {}) {
  const body = new URLSearchParams({ payload: JSON.stringify(value) }).toString()
  const timestamp = String(Math.floor(Date.now() / 1000) - (options.stale ? 301 : 0))
  const signature = 'v0=' + createHmac('sha256', options.invalid ? 'wrong-secret' : syntheticSecret).update(`v0:${timestamp}:${body}`).digest('hex')
  return new NextRequest('https://staging.example.com/api/slack/agent/actions', { method: 'POST', body,
    headers: { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature,
      ...(options.retry ? { 'x-slack-retry-num': '1', 'x-slack-retry-reason': 'http_timeout' } : {}) } })
}
beforeEach(() => {
  vi.resetAllMocks(); rows.clear()
  for (const [key, value] of Object.entries({
    SLACK_SIGNING_SECRET: syntheticSecret, SLACK_ACTION_RECEIPTS_ENABLED: 'true', SLACK_ACTION_RECEIPTS_ENVIRONMENT: 'staging',
    VERCEL_ENV: 'production', APP_ENV: 'staging', NEXT_PUBLIC_APP_ENV: 'staging',
    SLACK_AGENT_OPS_STAGING_BASE_URL: 'https://staging.example.com', SLACK_AGENT_OPS_STAGING_CHANNEL_ID: 'C123',
    SLACK_AGENT_OPS_STAGING_ALLOWED_CHANNEL_IDS: '', SLACK_AGENT_OPS_PRODUCTION_CHANNEL_ID: 'CPROD',
    SLACK_AGENT_OPS_PRODUCTION_ALLOWED_CHANNEL_IDS: '', SLACK_AGENT_OPS_TEAM_ID: 'T123', SLACK_AGENT_OPS_ALLOWED_USER_IDS: 'U123',
  })) vi.stubEnv(key, value)
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Egress forbidden') }))
  // Never resolve the worker: a successful ACK proves it is not awaited or run inline.
  mocks.process.mockImplementation(() => new Promise(() => {}))
  mocks.from.mockImplementation(table => {
    expect(table).toBe('agent_runs')
    let inserted: StoredReceipt | undefined
    let key: string | undefined
    const query = {
      insert(row: StoredReceipt) { inserted = row; return query },
      select() { return query }, single() { return query }, maybeSingle() { return query },
      eq(field: string, value: string) { if (field === 'idempotency_key') key = value; return query },
      async abortSignal() {
        if (inserted) {
          if (rows.has(inserted.idempotency_key)) return { data: null, error: { code: '23505' } }
          rows.set(inserted.idempotency_key, structuredClone(inserted))
          return { data: structuredClone(inserted), error: null }
        }
        return { data: rows.get(key!) ?? null, error: null }
      },
    }
    return query
  })
})
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled()
  vi.unstubAllEnvs(); vi.unstubAllGlobals()
})
it('signed callback ACKs promptly after durable mocked-store insert, retries reuse the row, and response URLs never escape', async () => {
  const start = performance.now()
  const response = await POST(signed(payload()))
  expect(performance.now() - start).toBeLessThan(2500)
  expect(response.status).toBe(200)
  const ack = await response.json()
  const row = [...rows.values()][0]
  expect(rows.size).toBe(1)
  expect(row).toMatchObject({ kind: 'slack_action_receipt', status: 'queued', metadata: { state: 'queued' }, outcome: {} })
  expect(ack).toMatchObject({ response_type: 'ephemeral' })
  expect(ack.text).toContain('saved and queued')
  expect(ack.text).toContain(`/admin/agents/runs/${row.id}`)
  expect(JSON.stringify(row)).not.toContain('response_url')
  expect(JSON.stringify(row)).not.toContain('hooks.slack.com')
  expect(mocks.process).toHaveBeenCalledWith(row.idempotency_key)
  expect(mocks.wait).toHaveBeenCalledOnce()
  expect(await (await POST(signed(payload(), { retry: true }))).json()).toEqual(ack)
  expect(rows.size).toBe(1)
})
it.each([{ invalid: true }, { stale: true }, { invalid: true, retry: true }])('rejects invalid signed callback %j before store access', async options => {
  expect((await POST(signed(payload(), options))).status).toBe(401)
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.process).not.toHaveBeenCalled()
})
it.each(['disabled', 'wrong-environment', 'ephemeral', 'view_submission', 'unsupported', 'unauthorized-channel', 'malformed-action'])('blocks %s without receipt trace or execution', async mode => {
  const value = payload()
  if (mode === 'disabled') vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', 'false')
  if (mode === 'wrong-environment') vi.stubEnv('SLACK_ACTION_RECEIPTS_ENVIRONMENT', 'production')
  if (mode === 'ephemeral') Object.assign(value.container, { is_ephemeral: true })
  if (mode === 'view_submission' || mode === 'unsupported') value.type = mode
  if (mode === 'unauthorized-channel') value.channel.id = value.container.channel_id = 'COTHER'
  if (mode === 'malformed-action') value.actions[0].value = '{'
  const response = await POST(signed(value))
  expect(response.status).toBe(200)
  const ack = await response.json()
  expect(ack.response_type).toBe('ephemeral')
  if (mode === 'view_submission' || mode === 'unsupported') expect(ack.text).toContain('expected one block action')
  expect(ack.text).not.toContain('Receipt:')
  expect(ack.text).not.toContain('saved and queued')
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.process).not.toHaveBeenCalled()
})
it('unconfirmed store write returns 503 with no trace or fallback execution', async () => {
  mocks.from.mockImplementation(() => { throw new Error('Synthetic store outage') })
  const response = await POST(signed(payload()))
  expect(response.status).toBe(503)
  expect((await response.json()).text).toBe('Action receipt could not be confirmed. Check Portfolio before retrying.')
  expect(mocks.process).not.toHaveBeenCalled()
  expect(rows.size).toBe(0)
})

function canaryPayload() {
  const value = payload()
  Object.assign(value, { api_app_id: 'A123' })
  Object.assign(value.container, { is_ephemeral: true })
  value.actions = [{ action_id: 'agent_canary_receipt', value: JSON.stringify({ action: 'canary.receipt',
    schemaVersion: 'receipt-canary-v1', canaryAppId: 'A123', sourceEnvironment: 'staging', sourceOrigin: 'https://staging.example.com' }) }]
  return value
}
it('signed ephemeral canary creates a durable receipt and processes a no-op without delivery or real record access', async () => {
  const response = await POST(signed(canaryPayload()))
  expect((await response.json()).text).toContain('Receipt:')
  const row = [...rows.values()][0]
  expect(row.kind).toBe('slack_action_receipt')
  const actual = await vi.importActual<typeof import('@/lib/slack-action-receipts')>('@/lib/slack-action-receipts')
  const store: import('@/lib/slack-action-receipts').ReceiptStore = {
    insert: async r => r,
    get: async key => rows.get(key) ?? null,
    cas: async (old, next) => { rows.set(old.idempotency_key, { ...next, kind: 'slack_action_receipt' }); return next },
    pending: async () => [],
  }
  const deliver = vi.fn()
  await actual.processSlackReceipt(row.idempotency_key, store, undefined, deliver)
  const done = rows.get(row.idempotency_key)!
  expect(done).toMatchObject({ status: 'completed', metadata: { state: 'receipt_only' },
    outcome: { canonical: { actionStatus: 'completed', text: expect.stringContaining('No approval, work, outreach, or provider') } } })
  expect(done.outcome.delivery).toBeUndefined()
  expect(deliver).not.toHaveBeenCalled()
  // Every database transport access is asserted to be agent_runs in the shared mock.
  const writes = mocks.from.mock.calls.length
  await actual.processSlackReceipt(row.idempotency_key, store, undefined, deliver)
  expect(mocks.from).toHaveBeenCalledTimes(writes)
  expect(deliver).not.toHaveBeenCalled()
  const duplicate = await POST(signed(canaryPayload(), { retry: true }))
  expect((await duplicate.json()).text).toContain('intentionally skipped')
  expect(rows.size).toBe(1)
})
it.each(['actor', 'team', 'channel', 'source', 'app', 'action-id', 'target', 'version', 'signature', 'stale', 'disabled'])('rejects canary %s before receipt access', async mode => {
  const p = canaryPayload()
  const value = JSON.parse(p.actions[0].value)
  if (mode === 'actor') p.user.id = 'U999'
  if (mode === 'team') p.team.id = 'T999'
  if (mode === 'channel') p.channel.id = p.container.channel_id = 'C999'
  if (mode === 'source') value.sourceOrigin = 'https://wrong.example.com'
  if (mode === 'app') value.canaryAppId = 'A999'
  if (mode === 'action-id') p.actions[0].action_id = 'approval_reject'
  if (mode === 'target') value.approvalId = 'real-approval'
  if (mode === 'version') value.schemaVersion = 'v0'
  if (mode === 'disabled') vi.stubEnv('SLACK_ACTION_RECEIPTS_ENABLED', 'false')
  p.actions[0].value = JSON.stringify(value)
  await POST(signed(p, { invalid: mode === 'signature', stale: mode === 'stale' }))
  expect(rows.size).toBe(0)
  expect(mocks.from).not.toHaveBeenCalled()
  expect(mocks.process).not.toHaveBeenCalled()
})
it('signed slash canary responds inline from the invoking app without response URL delivery', async () => {
  const { POST: command } = await import('../route')
  const body = new URLSearchParams({ text: 'canary', user_id: 'U123', team_id: 'T123', channel_id: 'C123',
    api_app_id: 'A123', response_url: 'https://hooks.slack.com/commands/never-fetch' }).toString()
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = 'v0=' + createHmac('sha256', syntheticSecret).update(`v0:${timestamp}:${body}`).digest('hex')
  const response = await command(new NextRequest('https://staging.example.com/api/slack/agent', { method: 'POST', body,
    headers: { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature } }))
  const card = await response.json()
  expect(card.response_type).toBe('ephemeral')
  expect(card.text).toContain('Signed command app ID: A123')
  expect(JSON.parse(card.blocks[1].elements[0].value)).toMatchObject({ action: 'canary.receipt', canaryAppId: 'A123' })
  expect(mocks.wait).not.toHaveBeenCalled()
  expect(mocks.from).not.toHaveBeenCalled()
})
