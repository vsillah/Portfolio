import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createAgentWorkItem: vi.fn(),
  runAgentSlackNotificationSweep: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

vi.mock('@/lib/agent-slack-notification-sweep', () => ({
  runAgentSlackNotificationSweep: mocks.runAgentSlackNotificationSweep,
}))

import { GET, POST } from './route'

function request(url: string, method = 'GET') {
  return new Request(url, {
    method,
    headers: { authorization: 'Bearer cron-secret' },
  })
}

function mockDueGateQuery(items: unknown[]) {
  const query: Record<string, unknown> = {
    data: items,
    error: null,
    eq: vi.fn(() => query),
    lte: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
  }
  mocks.from.mockReturnValue({ select: vi.fn(() => query) })
  return query
}

describe('/api/cron/social-content-calendar-due-gates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    process.env.N8N_INGEST_SECRET = ''
  })

  it('rejects unauthenticated cron requests', async () => {
    const response = await GET(new Request('http://localhost/api/cron/social-content-calendar-due-gates') as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('supports dry-run due-gate scans without creating work items', async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const query = mockDueGateQuery([
      {
        id: 'calendar-1',
        title: 'Authorize tomorrow post',
        campaign_id: 'campaign-1',
        agent_work_item_id: 'work-social-1',
        social_content_id: null,
        channel: 'linkedin',
        campaign_phase: 'teach',
        scheduled_for: scheduledFor,
        authorization_status: 'pending',
        metadata: {},
      },
    ])

    const response = await GET(request('http://localhost/api/cron/social-content-calendar-due-gates?dry_run=1') as never)

    expect(response.status).toBe(200)
    expect(query.eq).toHaveBeenCalledWith('authorization_status', 'pending')
    expect(query.lte).toHaveBeenCalledWith('scheduled_for', expect.any(String))
    expect(mocks.createAgentWorkItem).not.toHaveBeenCalled()
    expect(mocks.runAgentSlackNotificationSweep).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      ok: true,
      dry_run: true,
      candidate_count: 1,
      pinged_count: 0,
      candidates: [expect.objectContaining({ id: 'calendar-1', due_gate_window: '2h' })],
      side_effects: { publish: false, external_post: false },
    })
  })

  it('creates a deduped Agent Ops work item for due authorization without publishing', async () => {
    const scheduledFor = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const selectQuery: Record<string, unknown> = {
      data: [
        {
          id: 'calendar-1',
          title: 'Authorize tomorrow post',
          campaign_id: 'campaign-1',
          agent_work_item_id: 'work-social-1',
          social_content_id: null,
          channel: 'linkedin',
          campaign_phase: 'teach',
          scheduled_for: scheduledFor,
          authorization_status: 'pending',
          metadata: {},
        },
      ],
      error: null,
      eq: vi.fn(() => selectQuery),
      lte: vi.fn(() => selectQuery),
      order: vi.fn(() => selectQuery),
      limit: vi.fn(() => selectQuery),
    }
    const updateEq = vi.fn(async () => ({ data: null, error: null }))
    const update = vi.fn(() => ({ eq: updateEq }))
    mocks.from
      .mockReturnValueOnce({ select: vi.fn(() => selectQuery) })
      .mockReturnValue({ update })
    mocks.createAgentWorkItem.mockResolvedValue({ id: 'work-due-gate' })
    mocks.runAgentSlackNotificationSweep.mockResolvedValue({ sentCount: 1 })

    const response = await POST(request('http://localhost/api/cron/social-content-calendar-due-gates', 'POST') as never)

    expect(response.status).toBe(200)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Authorize content calendar item: Authorize tomorrow post',
      priority: 'urgent',
      ownerAgentKey: 'chief-of-staff',
      source: {
        type: 'social_content_calendar_due_gate',
        id: 'calendar-1',
        label: 'Authorize tomorrow post',
      },
      metadata: expect.objectContaining({
        approval_action: 'authorize_internal_platform_draft_handoff',
        side_effects: expect.objectContaining({ publish: false, external_post: false }),
      }),
      idempotencyKey: 'social-content-calendar-due:calendar-1:2h',
    }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        external_execution_enabled: false,
        due_gate_pings: expect.objectContaining({
          '2h': expect.objectContaining({ work_item_id: 'work-due-gate' }),
        }),
      }),
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      dry_run: false,
      pinged_count: 1,
      side_effects: {
        publish: false,
        external_post: false,
        internal_work_items_created: 1,
        slack_notification_requested: true,
      },
    })
  })
})
