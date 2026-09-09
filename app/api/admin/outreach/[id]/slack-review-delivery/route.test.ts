import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { warmFinalCopyFingerprint } from '@/lib/warm-outreach-copy-fingerprint'
import { buildWarmGmailActionRequest } from '@/lib/warm-gmail-action-request'
const mocks = vi.hoisted(() => ({ from: vi.fn(), fetch: vi.fn(), channel: vi.fn(), config: vi.fn(), packet: vi.fn(), start: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: vi.fn(async () => ({ user: { id: 'admin' } })), isAuthError: () => false }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/slack-agent-environment', () => ({
  getSlackAgentDeliveryConfig: mocks.config,
  getSlackAgentSource: () => ({ sourceEnvironment: 'production', sourceOrigin: 'https://portfolio.example.test', hosted: true }),
}))
vi.mock('@/lib/slack-agent-access', () => ({ requireAuthorizedSlackChannel: mocks.channel }))
vi.mock('@/lib/agent-run', () => ({ startAgentRun: mocks.start }))
vi.mock('@/app/api/admin/outreach/leads/[id]/relationship-packet/route', () => ({ GET: mocks.packet }))
import { POST } from './route'
const base = { id: 'queue-1', contact_submission_id: 42, channel: 'email', status: 'approved', subject: 'Workshop', body: 'Hi Amina, would Tuesday suit a follow-up?', updated_at: '2026-09-08T12:00:00.000Z', contact_submissions: { id: 42, name: 'Amina', email: 'amina@example.test' } }
const fp = warmFinalCopyFingerprint(base)
function row() { return { ...base, generation_inputs: { gmail_draft_creation: { draft_id: 'draft-1', final_copy_fingerprint: fp }, warm_gmail_send_slack_approval_request: { message_version_key: fp, outreach_queue_id: 'queue-1', contact_submission_id: 42, request_key: 'request-1', status: 'pending', final_copy_fingerprint: fp, gmail_draft_id: 'draft-1', lifecycle_message_version_key: 'lifecycle-1', send_queue_idempotency_key: 'send-1' } } } }
function db({ loseQueueClaim = false, loseReceipt = false } = {}) {
  let current: Record<string, unknown> = row()
  let run: Record<string, unknown> = { id: 'run-1', status: 'queued' }
  const writes: unknown[] = []
  mocks.from.mockImplementation((table: string) => {
    let payload: Record<string, unknown> | undefined
    const filters: Array<[string, unknown]> = []
    const query = { select: vi.fn(() => query), eq: vi.fn((key, value) => { filters.push([key, value]); return query }), update: vi.fn(value => { payload = value; return query }), maybeSingle: vi.fn(async () => {
      if (!payload) return { data: structuredClone(current), error: null }
      writes.push({ table, payload, filters })
      const target = table === 'agent_runs' ? run : current
      const match = filters.every(([key, value]) => key === 'metadata->>delivery_claim_token' ? (target.metadata as Record<string, unknown>)?.delivery_claim_token === value : target[key] === value)
      if (!match || (table === 'outreach_queue' && loseQueueClaim) || (loseReceipt && table === 'agent_runs' && payload.outcome)) return { data: null, error: null }
      if (table === 'agent_runs') run = { ...run, ...payload }; else current = { ...current, ...payload }
      return { data: { id: target.id, updated_at: payload.updated_at }, error: null }
    }) }
    return query
  })
  return { writes, current: () => current, change: (value: Record<string, unknown>) => { current = { ...current, ...value } } }
}
function request(body: Record<string, unknown>) { return new NextRequest('http://localhost/api/admin/outreach/queue-1/slack-review-delivery', { method: 'POST', body: JSON.stringify(body) }) }
const params = () => ({ params: Promise.resolve({ id: 'queue-1' }) })
const explicit = () => ({ sendReviewToSlack: true, expectedUpdatedAt: base.updated_at, finalCopyFingerprint: fp, requestKey: 'request-1', workspaceId: 'TTEST', channelId: 'CTEST', recipientEmail: base.contact_submissions.email })
const savedEnv = { ...process.env }
beforeEach(() => {
  vi.clearAllMocks()
  process.env.ENABLE_WARM_GMAIL_SLACK_REVIEW_DELIVERY = 'true'
  process.env.SLACK_AGENT_OPS_TEAM_ID = 'TTEST'
  mocks.config.mockReturnValue({ channel: 'CTEST', token: 'synthetic-token', sourceEnvironment: 'production', sourceOrigin: 'https://portfolio.example.test' })
  mocks.channel.mockReturnValue({ ok: true })
  mocks.start.mockResolvedValue({ id: 'run-1' })
  mocks.packet.mockImplementation(async () => Response.json({ responseMonitoring: { sendReadiness: { modes: { warm_1_to_1: [{ channel: 'email', emailSendLifecycle: { messageVersionKey: 'lifecycle-1', sendQueueIdempotencyKey: 'send-1', suppressionCheck: { status: 'clear' }, relationshipProvenance: { detail: 'Prior workshop context' }, externalSendReadiness: { suppressionConsent: { state: 'clear', detail: 'Clear', reasons: [] }, senderIdentity: { requiredSender: 'sender@example.test', connectedAs: 'sender@example.test' }, draftEvidence: { gmailDraftExists: true, draftId: 'draft-1' } } } }] } } } }))
  mocks.fetch.mockImplementation(async (url: string) => url.endsWith('auth.test') ? Response.json({ ok: true, team_id: 'TTEST' }) : Response.json({ ok: true, channel: 'CTEST', ts: '123.456' }))
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => { vi.unstubAllGlobals(); for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key]; Object.assign(process.env, savedEnv) })
describe('on-demand warm Slack review delivery', () => {
  it('stops before reads, claims or provider calls when disabled', async () => {
    delete process.env.ENABLE_WARM_GMAIL_SLACK_REVIEW_DELIVERY
    expect((await POST(request(explicit()), params())).status).toBe(409)
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled()
  })
  it('prepares without writes then uses the real UI request contract and records actual receipt', async () => {
    const state = db()
    const prepared = await (await POST(request({ prepareOnly: true }), params())).json()
    expect(state.writes).toHaveLength(0); expect(mocks.fetch).not.toHaveBeenCalled()
    const body = buildWarmGmailActionRequest('slack', prepared, { ...base, updatedAt: base.updated_at })
    const result = await POST(request(body), params())
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ sent: true, receipt: { channel: 'CTEST', ts: '123.456' } })
    expect(state.current()).toMatchObject({ generation_inputs: { warm_gmail_review_slack_delivery: { state: 'sent', slack_channel: 'CTEST', slack_message_ts: '123.456' } } })
    const message = JSON.parse(mocks.fetch.mock.calls.find(([url]) => url.endsWith('chat.postMessage'))![1].body)
    expect(message.channel).toBe('CTEST'); expect(JSON.stringify(message.blocks)).toContain(base.body)
    const decisions = message.blocks.flatMap((block: { type: string; elements?: Array<{ value?: string }> }) =>
      block.type === 'actions' ? (block.elements ?? []).filter(element => element.value).map(element => JSON.parse(element.value!)) : [])
    expect(decisions.length).toBeGreaterThan(0)
    expect(decisions).toEqual(expect.arrayContaining([expect.objectContaining({ sourceEnvironment: 'production', sourceOrigin: 'https://portfolio.example.test' })]))
  })
  it('never trusts a supplied destination or stale copy', async () => {
    db()
    expect((await POST(request({ ...explicit(), channelId: 'OTHER', blocks: [] }), params())).status).toBe(409)
    expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('rejects an unauthorized channel before writing', async () => {
    db(); mocks.channel.mockReturnValue({ ok: false, text: 'Unauthorized source channel.' })
    expect((await POST(request(explicit()), params())).status).toBe(409)
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('rejects a bot in another workspace before claiming or posting', async () => {
    db(); mocks.fetch.mockResolvedValue(Response.json({ ok: true, team_id: 'OTHER' }))
    expect((await POST(request(explicit()), params())).status).toBe(409)
    expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
  it('only lets the winning concurrent claim post once', async () => {
    db()
    const responses = await Promise.all([POST(request(explicit()), params()), POST(request(explicit()), params())])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    expect(mocks.fetch.mock.calls.filter(([url]) => url.endsWith('chat.postMessage'))).toHaveLength(1)
  })
  it('does not post when copy changes before the queue claim', async () => {
    db({ loseQueueClaim: true })
    const response = await POST(request(explicit()), params())
    expect(response.status).toBe(409)
    expect((await response.json()).actionOutcome).toBe('rejected_before_external_action')
    expect(mocks.fetch.mock.calls.filter(([url]) => url.endsWith('chat.postMessage'))).toHaveLength(0)
  })
  it.each(['timeout', 'malformed', 'receipt-failure'])('locks %s without automatic resend', async mode => {
    const state = db({ loseReceipt: mode === 'receipt-failure' })
    if (mode !== 'receipt-failure') mocks.fetch.mockImplementation(async (url: string) => { if (url.endsWith('auth.test')) return Response.json({ ok: true, team_id: 'TTEST' }); if (mode === 'timeout') throw new Error('timeout'); return Response.json({ ok: true }) })
    expect((await POST(request(explicit()), params())).status).toBe(502)
    expect((await POST(request({ ...explicit(), expectedUpdatedAt: state.current().updated_at }), params())).status).toBe(409)
    expect(mocks.fetch.mock.calls.filter(([url]) => url.endsWith('chat.postMessage'))).toHaveLength(1)
  })
})
