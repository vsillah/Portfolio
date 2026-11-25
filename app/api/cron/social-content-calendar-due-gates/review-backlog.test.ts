import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), send: vi.fn(), from: vi.fn(), source: vi.fn() }))
vi.mock('@/lib/campaign-review-backlog', () => ({ prepareCampaignReviewBatch: mocks.prepare }))
vi.mock('@/lib/agent-slack-notification-sweep', () => ({ runAgentSlackNotificationSweep: mocks.send }))
vi.mock('@/lib/slack-agent-environment', () => ({ getSlackAgentSource: mocks.source }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/agent-work-items', () => ({ createAgentWorkItem: vi.fn(() => { throw new Error('Unexpected work creation') }) }))
import { GET } from './route'
beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = 'synthetic'; vi.stubEnv('SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED', 'false'); vi.stubEnv('SOCIAL_CALENDAR_PREPARATION_NOTIFICATIONS_ENABLED', 'false'); mocks.prepare.mockResolvedValue({ prepared_count: 0 }) })
afterEach(() => vi.unstubAllEnvs())
it('rejects unauthenticated scheduled preparation', async () => {
  const result = await GET(new NextRequest('http://localhost/cron?mode=review_backlog&campaign_id=campaign'))
  expect(result.status).toBe(401); expect(mocks.prepare).not.toHaveBeenCalled()
})
it('returns before every Slack configuration/delivery path, including dry runs', async () => {
  for (const dry of ['', '&dry_run=1']) {
    const result = await GET(new NextRequest(`http://localhost/cron?mode=review_backlog&campaign_id=campaign${dry}`, { headers: { authorization: 'Bearer synthetic' } }))
    expect(result.status).toBe(200)
  }
  expect(mocks.prepare).toHaveBeenLastCalledWith('campaign', expect.objectContaining({ now: expect.any(Date), scheduled: true, dryRun: true, dueOnly: true, preserveSocialContent: true, syncCalendarPreparation: true }))
  expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.source).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled()
})
it('uses active campaigns for the configured schedule', async () => {
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ limit: async () => ({ data: [{ id: 'active' }], error: null }) }) }) })
  const result = await GET(new NextRequest('http://localhost/cron?mode=review_backlog', { headers: { authorization: 'Bearer synthetic' } }))
  expect(result.status).toBe(200); expect(mocks.prepare).toHaveBeenCalledWith('active', expect.objectContaining({ now: expect.any(Date), scheduled: true, dryRun: false, dueOnly: true, preserveSocialContent: true, syncCalendarPreparation: true })); expect(mocks.send).not.toHaveBeenCalled()
})
it('keeps new and replayed receipt-backed packages inside Portfolio', async () => {
  const ready = {
    rows: [],
    prepared_count: 1,
    prepared_items: [{ calendar_item_id: 'calendar-1' }],
  }
  const duplicate = { rows: [], prepared_count: 0, prepared_items: [] }
  mocks.prepare.mockResolvedValueOnce(ready).mockResolvedValueOnce(duplicate)
  const request = () => new NextRequest('http://localhost/cron?mode=review_backlog&campaign_id=campaign', { headers: { authorization: 'Bearer synthetic' } })

  expect((await GET(request())).status).toBe(200)
  expect((await GET(request())).status).toBe(200)

  expect(mocks.send).not.toHaveBeenCalled()
  expect(mocks.source).not.toHaveBeenCalled()
})

const cronRequest = () => new NextRequest('http://localhost/cron?mode=review_backlog&campaign_id=campaign', { headers: { authorization: 'Bearer synthetic' } })
const dueRow = (id: string, state: 'ready' | 'blocked' | 'eligible' | 'planned') => ({
  id, state, trigger_at: '2026-11-24T00:00:00.000Z',
})
const receiptResult = (id: string, state: 'ready' | 'blocked') => ({
  rows: [dueRow(id, state)], calendar_receipts: [{ calendar_item_id: id, state, evidence_version: 'evidence-v1' }],
  prepared_count: state === 'ready' ? 1 : 0, prepared_items: [], blocked_items: [],
})

it('requests a receipt-backed review notification and reports exact delivery', async () => {
  vi.stubEnv('SOCIAL_CALENDAR_PREPARATION_NOTIFICATIONS_ENABLED', 'true')
  mocks.prepare.mockResolvedValue(receiptResult('calendar-ready', 'ready'))
  mocks.send.mockResolvedValue({ results: [{ itemCount: 1, sent: true, deduped: false,
    deliveredCalendarItemIds: ['calendar-ready'], slackChannel: 'CQA', slackMessageTs: '1.001', runId: 'run-ready' }] })
  const response = await GET(cronRequest())
  expect(response.status).toBe(200)
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
    kinds: ['social_calendar_preparation'], calendarItemIds: ['calendar-ready'], dryRun: false,
  }))
  await expect(response.json()).resolves.toMatchObject({ preparation_notification_result: {
    requested_count: 1, delivered_count: 1, incomplete_count: 0,
    results: [expect.objectContaining({ calendar_item_id: 'calendar-ready', requested: true, delivered: true, run_id: 'run-ready' })],
  } })
})

it('replays an immutable receipt without another delivery request', async () => {
  vi.stubEnv('SOCIAL_CALENDAR_PREPARATION_NOTIFICATIONS_ENABLED', 'true')
  mocks.prepare.mockResolvedValue(receiptResult('calendar-ready', 'ready'))
  mocks.send.mockResolvedValue({ results: [{ itemCount: 1, sent: false, deduped: true,
    deliveredCalendarItemIds: ['calendar-ready'], slackChannel: 'CQA', slackMessageTs: '1.001', runId: 'run-ready' }] })
  const response = await GET(cronRequest())
  await expect(response.json()).resolves.toMatchObject({ preparation_notification_result: {
    requested_count: 0, delivered_count: 1, incomplete_count: 0,
    results: [expect.objectContaining({ requested: false, delivered: true, deduped: true })],
  } })
})

it('reports a human-action blocker and a partial delivery without claiming success', async () => {
  vi.stubEnv('SOCIAL_CALENDAR_PREPARATION_NOTIFICATIONS_ENABLED', 'true')
  mocks.prepare.mockResolvedValue({ rows: [dueRow('calendar-blocked', 'blocked'), dueRow('calendar-ready', 'ready')],
    calendar_receipts: [{ calendar_item_id: 'calendar-blocked', state: 'blocked', evidence_version: 'evidence-v1' }],
    prepared_count: 0, prepared_items: [], blocked_items: [] })
  mocks.send.mockResolvedValueOnce({ results: [{ itemCount: 1, sent: true, deduped: false,
    deliveredCalendarItemIds: ['calendar-blocked'], slackChannel: 'CQA', slackMessageTs: '1.002' }] })
    .mockResolvedValueOnce({ results: [{ itemCount: 1, sent: false, deduped: false, error: 'Slack rejected delivery' }] })
  const response = await GET(cronRequest())
  const cycleNow = mocks.prepare.mock.calls[0][1].now as Date
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
    calendarItemIds: ['calendar-blocked'],
    calendarBlockerReceipt: { blockedAt: cycleNow.toISOString(), evidenceVersion: 'evidence-v1' },
  }))
  await expect(response.json()).resolves.toMatchObject({ preparation_notification_result: {
    requested_count: 2, delivered_count: 1, incomplete_count: 1,
    results: [expect.objectContaining({ calendar_item_id: 'calendar-blocked', delivered: true }),
      expect.objectContaining({ calendar_item_id: 'calendar-ready', incomplete: true, reason: 'Slack rejected delivery' })],
  } })
})

it('does not claim delivery when Slack lacks the exact persisted message receipt', async () => {
  vi.stubEnv('SOCIAL_CALENDAR_PREPARATION_NOTIFICATIONS_ENABLED', 'true')
  mocks.prepare.mockResolvedValue(receiptResult('calendar-ready', 'ready'))
  mocks.send.mockResolvedValue({ results: [{ itemCount: 1, sent: true, deduped: false,
    deliveredCalendarItemIds: ['another-calendar'], slackChannel: 'CQA', slackMessageTs: '1.003' }] })
  const response = await GET(cronRequest())
  await expect(response.json()).resolves.toMatchObject({ preparation_notification_result: {
    requested_count: 1, delivered_count: 0, incomplete_count: 1,
    results: [expect.objectContaining({ calendar_item_id: 'calendar-ready', delivered: false,
      reason: 'Slack delivery receipt lacks the exact calendar item, channel, or message ID.' })],
  } })
})

it('suppresses planned and eligible rows and leaves disabled delivery read-only', async () => {
  mocks.prepare.mockResolvedValue({ rows: [dueRow('calendar-planned', 'planned'), dueRow('calendar-eligible', 'eligible')],
    prepared_count: 0, prepared_items: [], blocked_items: [] })
  const noOp = await GET(cronRequest())
  await expect(noOp.json()).resolves.toMatchObject({ preparation_notification_result: { candidate_count: 0, requested_count: 0 } })
  expect(mocks.send).not.toHaveBeenCalled()
  vi.stubEnv('SLACK_AGENT_OPS_NOTIFICATIONS_ENABLED', 'true')
  mocks.prepare.mockResolvedValue(receiptResult('calendar-blocked', 'blocked'))
  mocks.send.mockResolvedValue({ results: [{ itemCount: 1, sent: false, skipped: true, deduped: false, dryRun: true }] })
  const disabled = await GET(cronRequest())
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, calendarItemIds: ['calendar-blocked'] }))
  await expect(disabled.json()).resolves.toMatchObject({ preparation_notification_result: {
    requested_count: 0, delivered_count: 0, incomplete_count: 1,
    results: [expect.objectContaining({ reason: 'Slack notification delivery is disabled.' })],
  } })
})

it('does not request Slack for a historical blocked row without a current-cycle receipt', async () => {
  vi.stubEnv('SOCIAL_CALENDAR_PREPARATION_NOTIFICATIONS_ENABLED', 'true')
  mocks.prepare.mockResolvedValue({ rows: [dueRow('calendar-october', 'blocked')],
    calendar_receipts: [], prepared_count: 0, prepared_items: [], blocked_items: [] })
  const response = await GET(cronRequest())
  expect(mocks.send).not.toHaveBeenCalled()
  await expect(response.json()).resolves.toMatchObject({ preparation_notification_result: {
    candidate_count: 0, requested_count: 0, delivered_count: 0,
  } })
})

it('uses a newly persisted blocker receipt even when the backlog projection was eligible', async () => {
  vi.stubEnv('SOCIAL_CALENDAR_PREPARATION_NOTIFICATIONS_ENABLED', 'true')
  mocks.prepare.mockResolvedValue({ rows: [dueRow('calendar-new-blocker', 'eligible')],
    calendar_receipts: [{ calendar_item_id: 'calendar-new-blocker', state: 'blocked', evidence_version: 'evidence-v3' }],
    prepared_count: 0, prepared_items: [], blocked_items: [] })
  mocks.send.mockResolvedValue({ results: [{ itemCount: 1, sent: true, deduped: false,
    deliveredCalendarItemIds: ['calendar-new-blocker'], slackChannel: 'CQA', slackMessageTs: '1.004' }] })
  const response = await GET(cronRequest())
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
    calendarItemIds: ['calendar-new-blocker'],
    calendarBlockerReceipt: { blockedAt: expect.any(String), evidenceVersion: 'evidence-v3' },
  }))
  await expect(response.json()).resolves.toMatchObject({ preparation_notification_result: {
    candidate_count: 1, delivered_count: 1, incomplete_count: 0,
  } })
})
