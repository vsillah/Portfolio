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
    in: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => ({ data: items, error: null })),
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
    expect(query.in).toHaveBeenCalledWith('authorization_status', ['pending', 'authorized'])
    expect(query.gte).toHaveBeenCalledWith('scheduled_for', expect.any(String))
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
      in: vi.fn(() => selectQuery),
      gte: vi.fn(() => selectQuery),
      lte: vi.fn(() => selectQuery),
      order: vi.fn(() => selectQuery),
      range: vi.fn(async () => ({ data: selectQuery.data, error: null })),
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

  it('dedupes overdue authorized drafts into one internal publish-preparation item', async () => {
    const scheduledFor = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const authorizedDraft = {
      id: 'calendar-instagram-overdue',
      title: 'Authorized Instagram launch post',
      campaign_id: 'campaign-1',
      agent_work_item_id: 'work-social-1',
      social_content_id: 'social-instagram-draft',
      channel: 'instagram',
      campaign_phase: 'offer',
      scheduled_for: scheduledFor,
      authorization_status: 'authorized',
      metadata: {},
      social_content_queue: {
        id: 'social-instagram-draft',
        status: 'draft',
        platform: 'instagram',
        target_platforms: ['instagram'],
        rag_context: { source: 'social_content_calendar_authorization' },
        social_content_publishes: [],
      },
    }
    const selectQuery: Record<string, unknown> = {
      data: [authorizedDraft, { ...authorizedDraft }],
      in: vi.fn(() => selectQuery),
      gte: vi.fn(() => selectQuery),
      lte: vi.fn(() => selectQuery),
      order: vi.fn(() => selectQuery),
      range: vi.fn(async () => ({ data: selectQuery.data, error: null })),
    }
    const updateEq = vi.fn(async () => ({ data: null, error: null }))
    const update = vi.fn(() => ({ eq: updateEq }))
    mocks.from
      .mockReturnValueOnce({ select: vi.fn(() => selectQuery) })
      .mockReturnValue({ update })
    mocks.createAgentWorkItem.mockResolvedValue({ id: 'work-instagram-preparation' })
    mocks.runAgentSlackNotificationSweep.mockResolvedValue({ sentCount: 1 })

    const response = await POST(request('http://localhost/api/cron/social-content-calendar-due-gates', 'POST') as never)

    expect(response.status).toBe(200)
    expect(selectQuery.in).toHaveBeenCalledWith('authorization_status', ['pending', 'authorized'])
    expect(selectQuery.gte).toHaveBeenCalledWith('scheduled_for', expect.any(String))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledTimes(1)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Prepare authorized Instagram Social Content item: Authorized Instagram launch post',
      priority: 'urgent',
      source: {
        type: 'social_content_calendar_publish_preparation',
        id: 'calendar-instagram-overdue',
        label: 'Authorized Instagram launch post',
      },
      idempotencyKey: 'social-content-calendar-publish-preparation:calendar-instagram-overdue',
      metadata: expect.objectContaining({
        social_content_id: 'social-instagram-draft',
        preparation_action: 'prepare_publish_rows_and_gates_for_human_review',
        missing_publish_rows: true,
        external_execution_enabled: false,
        side_effects: expect.objectContaining({
          provider_generation: false,
          upload: false,
          external_schedule: false,
          publish: false,
          external_post: false,
        }),
      }),
    }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        external_execution_enabled: false,
        publish_preparation: expect.objectContaining({
          work_item_id: 'work-instagram-preparation',
          social_content_id: 'social-instagram-draft',
        }),
      }),
    }))
    expect(mocks.runAgentSlackNotificationSweep).toHaveBeenCalledTimes(1)
    expect(mocks.from.mock.calls.every(([table]) => table === 'social_content_calendar_items')).toBe(true)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      candidate_count: 1,
      pinged_count: 0,
      preparation_count: 1,
      prepared: [{
        calendar_item_id: 'calendar-instagram-overdue',
        social_content_id: 'social-instagram-draft',
        work_item_id: 'work-instagram-preparation',
      }],
      side_effects: {
        provider_generation: false,
        upload: false,
        external_schedule: false,
        publish: false,
        external_post: false,
        internal_work_items_created: 1,
      },
    })
  })

  it('pages past recorded old rows so a newer actionable preparation item is not starved', async () => {
    const oldScheduledFor = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    const actionableScheduledFor = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const recordedRows = Array.from({ length: 50 }, (_, index) => ({
      id: `calendar-recorded-${index}`,
      title: `Recorded preparation ${index}`,
      campaign_id: 'campaign-1',
      agent_work_item_id: null,
      social_content_id: `social-recorded-${index}`,
      channel: 'instagram',
      campaign_phase: 'teach',
      scheduled_for: oldScheduledFor,
      authorization_status: 'authorized',
      metadata: {
        publish_preparation: { work_item_id: `work-recorded-${index}` },
      },
      social_content_queue: {
        id: `social-recorded-${index}`,
        status: 'draft',
        social_content_publishes: [],
      },
    }))
    const actionableRow = {
      id: 'calendar-actionable-newer',
      title: 'Prepare newer Instagram item',
      campaign_id: 'campaign-1',
      agent_work_item_id: null,
      social_content_id: 'social-actionable-newer',
      channel: 'instagram',
      campaign_phase: 'offer',
      scheduled_for: actionableScheduledFor,
      authorization_status: 'authorized',
      metadata: {},
      social_content_queue: {
        id: 'social-actionable-newer',
        status: 'draft',
        social_content_publishes: [],
      },
    }
    const firstPage = mockDueGateQuery(recordedRows)
    const secondPage: Record<string, unknown> = {
      in: vi.fn(() => secondPage),
      gte: vi.fn(() => secondPage),
      lte: vi.fn(() => secondPage),
      order: vi.fn(() => secondPage),
      range: vi.fn(async () => ({ data: [actionableRow], error: null })),
    }
    const updateEq = vi.fn(async () => ({ data: null, error: null }))
    const update = vi.fn(() => ({ eq: updateEq }))
    mocks.from
      .mockReturnValueOnce({ select: vi.fn(() => firstPage) })
      .mockReturnValueOnce({ select: vi.fn(() => secondPage) })
      .mockReturnValue({ update })
    mocks.createAgentWorkItem.mockResolvedValue({ id: 'work-actionable-newer' })
    mocks.runAgentSlackNotificationSweep.mockResolvedValue({ sentCount: 1 })

    const response = await POST(request('http://localhost/api/cron/social-content-calendar-due-gates', 'POST') as never)

    expect(response.status).toBe(200)
    expect(firstPage.range).toHaveBeenCalledWith(0, 49)
    expect(secondPage.range).toHaveBeenCalledWith(50, 99)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledTimes(1)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'social-content-calendar-publish-preparation:calendar-actionable-newer',
    }))
    await expect(response.json()).resolves.toMatchObject({
      scanned_count: 51,
      candidate_count: 1,
      preparation_count: 1,
      prepared: [{
        calendar_item_id: 'calendar-actionable-newer',
        social_content_id: 'social-actionable-newer',
        work_item_id: 'work-actionable-newer',
      }],
      side_effects: { publish: false, external_post: false },
    })
  })
})
