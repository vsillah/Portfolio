import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), send: vi.fn(), from: vi.fn(), source: vi.fn() }))
vi.mock('@/lib/campaign-review-backlog', () => ({ prepareCampaignReviewBatch: mocks.prepare }))
vi.mock('@/lib/agent-slack-notification-sweep', () => ({ runAgentSlackNotificationSweep: mocks.send }))
vi.mock('@/lib/slack-agent-environment', () => ({ getSlackAgentSource: mocks.source }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/agent-work-items', () => ({ createAgentWorkItem: vi.fn(() => { throw new Error('Unexpected work creation') }) }))
import { GET } from './route'
beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = 'synthetic'; mocks.prepare.mockResolvedValue({ prepared_count: 0 }) })
it('rejects unauthenticated scheduled preparation', async () => {
  const result = await GET(new NextRequest('http://localhost/cron?mode=review_backlog&campaign_id=campaign'))
  expect(result.status).toBe(401); expect(mocks.prepare).not.toHaveBeenCalled()
})
it('returns before every Slack configuration/delivery path, including dry runs', async () => {
  for (const dry of ['', '&dry_run=1']) {
    const result = await GET(new NextRequest(`http://localhost/cron?mode=review_backlog&campaign_id=campaign${dry}`, { headers: { authorization: 'Bearer synthetic' } }))
    expect(result.status).toBe(200)
  }
  expect(mocks.prepare).toHaveBeenLastCalledWith('campaign', { scheduled: true, dryRun: true, dueOnly: true })
  expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.source).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled()
})
it('uses active campaigns for the configured schedule', async () => {
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ limit: async () => ({ data: [{ id: 'active' }], error: null }) }) }) })
  const result = await GET(new NextRequest('http://localhost/cron?mode=review_backlog', { headers: { authorization: 'Bearer synthetic' } }))
  expect(result.status).toBe(200); expect(mocks.prepare).toHaveBeenCalledWith('active', { scheduled: true, dryRun: false, dueOnly: true }); expect(mocks.send).not.toHaveBeenCalled()
})
it('notifies once after a new receipt-backed package and stays quiet on duplicate retry', async () => {
  const ready = {
    rows: [],
    prepared_count: 1,
    prepared_items: [{ calendar_item_id: 'calendar-1' }],
  }
  const duplicate = { rows: [], prepared_count: 0, prepared_items: [] }
  mocks.prepare.mockResolvedValueOnce(ready).mockResolvedValueOnce(duplicate)
  mocks.send.mockResolvedValue({ sentCount: 1, dedupedCount: 0, results: [{ sent: true }] })
  const request = () => new NextRequest('http://localhost/cron?mode=review_backlog&campaign_id=campaign', { headers: { authorization: 'Bearer synthetic' } })

  expect((await GET(request())).status).toBe(200)
  expect((await GET(request())).status).toBe(200)

  expect(mocks.send).toHaveBeenCalledTimes(1)
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
    kinds: ['review_ready'],
    calendarItemIds: ['calendar-1'],
    triggerSource: 'campaign_review_backlog',
  }))
})
