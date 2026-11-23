import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

import { GET, POST } from './route'

function request(method: 'GET' | 'POST' = 'POST') {
  return new Request('http://localhost/api/admin/content/agentified/campaign/import', {
    method,
    headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
  })
}

function campaignLookup(data: Record<string, unknown> | null = null) {
  const maybeSingle = vi.fn(async () => ({ data, error: null }))
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq, maybeSingle }
}

function campaignInsert(id = 'campaign-agentified') {
  const single = vi.fn(async () => ({
    data: { id, slug: 'agentified-workshop-2026-post-thanksgiving' },
    error: null,
  }))
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  return { insert, select, single }
}

function calendarLookup(data: Array<Record<string, unknown>> = []) {
  const eq = vi.fn(async () => ({ data, error: null }))
  const select = vi.fn(() => ({ eq }))
  return { select, eq }
}

function calendarInsert(idPrefix = 'calendar-new') {
  let count = 0
  const single = vi.fn(async () => {
    count += 1
    return {
      data: {
        id: `${idPrefix}-${count}`,
        title: 'Inserted calendar item',
        authorization_status: 'pending',
      },
      error: null,
    }
  })
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  return { insert, select, single }
}

function calendarUpdate(idPrefix = 'calendar-existing') {
  let count = 0
  const single = vi.fn(async () => {
    count += 1
    return {
      data: {
        id: `${idPrefix}-${count}`,
        title: 'Updated calendar item',
        authorization_status: 'pending',
      },
      error: null,
    }
  })
  const select = vi.fn(() => ({ single }))
  const eq = vi.fn(() => ({ select }))
  const update = vi.fn(() => ({ eq }))
  return { update, eq, select, single }
}

describe('/api/admin/content/agentified/campaign/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.createAgentWorkItem.mockImplementation((input: { idempotencyKey: string }) => Promise.resolve({
      id: input.idempotencyKey.replace('agentified-workshop:', 'work-'),
    }))
  })

  it('requires admin auth before any read or write', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)
    const response = await POST(request() as never)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('previews the public workshop packet without mutating data', async () => {
    const response = await GET(request('GET') as never)
    expect(response.status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({ summary: {
      campaign_slug: 'agentified-workshop-2026-post-thanksgiving',
      template_key: 'whisper_to_shout',
      first_review_packet_path: 'agentified/campaign/workshop-review-packet-2026-11-23.md',
      starts_at: '2026-11-30T10:00:00-05:00',
      ends_at: '2026-12-18T10:00:00-05:00',
      calendar_item_count: 10,
      supported_channels: ['linkedin', 'instagram', 'instagram_reels', 'youtube', 'youtube_shorts'],
      side_effects: expect.objectContaining({ social_drafts_created: false, publish: false, external_post: false }),
    } })
  })

  it('builds ten pending workshop rows and zero-value campaign fields on an explicitly invoked import', async () => {
    const campaignRead = campaignLookup(null)
    const campaignCreate = campaignInsert()
    const calendarRead = calendarLookup([])
    const calendarCreate = calendarInsert()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') {
        const count = mocks.from.mock.calls.filter(([name]) => name === 'attraction_campaigns').length
        return count === 1 ? { select: campaignRead.select } : { insert: campaignCreate.insert }
      }
      if (table === 'social_content_calendar_items') {
        const count = mocks.from.mock.calls.filter(([name]) => name === 'social_content_calendar_items').length
        return count === 1 ? { select: calendarRead.select } : { insert: calendarCreate.insert }
      }
      return {}
    })
    const response = await POST(request() as never)
    expect(response.status).toBe(200)
    expect(campaignCreate.insert).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'agentified-workshop-2026-post-thanksgiving', name: 'Agentified: Public Workshop Practice',
      campaign_type: 'free_challenge', status: 'draft', starts_at: '2026-11-30T10:00:00-05:00',
      ends_at: '2026-12-18T10:00:00-05:00', min_purchase_amount: 0,
      payout_type: 'credit', payout_amount_type: 'fixed', payout_amount_value: 0,
      created_by: 'admin-user',
    }))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledTimes(10)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({ type: 'social_topic_trigger', id: 'AW-LI-01' }),
      idempotencyKey: 'agentified-workshop:AW-LI-01',
      metadata: expect.objectContaining({
        campaign_slug: 'agentified-workshop-2026-post-thanksgiving',
        first_review_packet_path: 'agentified/campaign/workshop-review-packet-2026-11-23.md',
        source_paths: ['app/agentified/page.tsx'],
        side_effects: expect.objectContaining({ provider_generation: false, schedule: false, publish: false }),
      }),
    }))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({ id: 'AW-YT-01' }),
      metadata: expect.objectContaining({ calendar_channel: 'youtube' }),
    }))
    expect(mocks.createAgentWorkItem.mock.calls.map(([input]) => input.source.id)).not.toContain('AW-EMAIL-01')
    expect(mocks.createAgentWorkItem.mock.calls.map(([input]) => input.source.id)).not.toContain('AGT-X-04')
    expect(calendarCreate.insert).toHaveBeenCalledTimes(10)
    expect(calendarCreate.insert).toHaveBeenCalledWith(expect.objectContaining({
      campaign_id: 'campaign-agentified', agent_work_item_id: 'work-AW-LI-01', channel: 'linkedin',
      scheduled_for: '2026-11-30T15:00:00.000Z',
      authorization_due_at: '2026-11-24T15:00:00.000Z', authorization_status: 'pending',
      autonomy_eligible: false,
      metadata: expect.objectContaining({
        agentified_asset_id: 'AW-LI-01', preparation_deadline: '2026-11-24T15:00:00.000Z',
        first_review_packet_path: 'agentified/campaign/workshop-review-packet-2026-11-23.md',
        external_execution_enabled: false,
        side_effects: expect.objectContaining({ publish: false, external_post: false, social_draft_created: false }),
      }),
    }))
    expect(await response.json()).toMatchObject({
      ok: true, work_items: { total: 10 }, calendar_items: { inserted_count: 10, updated_count: 0, total: 10 },
      side_effects: expect.objectContaining({ publish: false, external_post: false, social_drafts_created: false }),
    })
  })

  it('updates an existing calendar asset instead of inserting a duplicate', async () => {
    const campaignRead = campaignLookup({ id: 'campaign-agentified', slug: 'agentified-workshop-2026-post-thanksgiving', status: 'draft' })
    const campaignUpdate = calendarUpdate('campaign-updated')
    const existingCalendar = calendarLookup([{ id: 'calendar-li-1', metadata: { agentified_asset_id: 'AW-LI-01' } }])
    const calendarExistingUpdate = calendarUpdate()
    const calendarCreate = calendarInsert()
    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') {
        const count = mocks.from.mock.calls.filter(([name]) => name === 'attraction_campaigns').length
        return count === 1 ? { select: campaignRead.select } : { update: campaignUpdate.update }
      }
      if (table === 'social_content_calendar_items') {
        const count = mocks.from.mock.calls.filter(([name]) => name === 'social_content_calendar_items').length
        if (count === 1) return { select: existingCalendar.select }
        if (count === 2) return { update: calendarExistingUpdate.update }
        return { insert: calendarCreate.insert }
      }
      return {}
    })
    const response = await POST(request() as never)
    expect(response.status).toBe(200)
    expect(campaignUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'agentified-workshop-2026-post-thanksgiving', campaign_type: 'free_challenge', payout_amount_value: 0,
    }))
    expect(calendarExistingUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      agent_work_item_id: 'work-AW-LI-01', metadata: expect.objectContaining({ agentified_asset_id: 'AW-LI-01' }),
    }))
    expect(calendarCreate.insert).toHaveBeenCalledTimes(9)
    expect(await response.json()).toMatchObject({
      ok: true, calendar_items: { inserted_count: 9, updated_count: 1, total: 10 },
    })
  })
})
