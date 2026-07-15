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
    data: { id, slug: 'agentified-trust-scale-2026-07' },
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
      id: input.idempotencyKey.replace('agentified-launch:', 'work-'),
    }))
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request() as never)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('previews the Agentified launch packet summary without mutating data', async () => {
    const response = await GET(request('GET') as never)

    expect(response.status).toBe(200)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({
      summary: {
        campaign_slug: 'agentified-trust-scale-2026-07',
        template_key: 'whisper_to_shout',
        calendar_item_count: 12,
        supported_channels: ['linkedin', 'youtube_shorts', 'thumbnail'],
        side_effects: expect.objectContaining({
          social_drafts_created: false,
          publish: false,
          external_post: false,
        }),
      },
    })
  })

  it('imports campaign, central backlog work items, and calendar items without external execution', async () => {
    const campaignRead = campaignLookup(null)
    const campaignCreate = campaignInsert('campaign-agentified')
    const calendarRead = calendarLookup([])
    const calendarCreate = calendarInsert()

    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') {
        const attractionCalls = mocks.from.mock.calls.filter(([name]) => name === 'attraction_campaigns').length
        return attractionCalls === 1 ? { select: campaignRead.select } : { insert: campaignCreate.insert }
      }
      if (table === 'social_content_calendar_items') {
        const calendarCalls = mocks.from.mock.calls.filter(([name]) => name === 'social_content_calendar_items').length
        return calendarCalls === 1 ? { select: calendarRead.select } : { insert: calendarCreate.insert }
      }
      return {}
    })

    const response = await POST(request() as never)

    expect(response.status).toBe(200)
    expect(campaignCreate.insert).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'agentified-trust-scale-2026-07',
      status: 'draft',
      created_by: 'admin-user',
    }))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledTimes(12)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({ type: 'social_topic_trigger', id: 'AGT-LI-01' }),
      metadata: expect.objectContaining({
        social_topic_trigger: true,
        campaign_slug: 'agentified-trust-scale-2026-07',
        agentified_asset_id: 'AGT-LI-01',
        channel_lanes: expect.objectContaining({
          linkedin: expect.objectContaining({ status: 'selected' }),
        }),
        insight: expect.objectContaining({
          approved_research_patterns: expect.arrayContaining([
            expect.objectContaining({ pattern_status: 'usable_framework' }),
          ]),
        }),
        side_effects: expect.objectContaining({
          provider_generation: false,
          publish: false,
          external_post: false,
        }),
      }),
      idempotencyKey: 'agentified-launch:AGT-LI-01',
    }))
    expect(calendarCreate.insert).toHaveBeenCalledTimes(12)
    expect(calendarCreate.insert).toHaveBeenCalledWith(expect.objectContaining({
      campaign_id: 'campaign-agentified',
      agent_work_item_id: 'work-AGT-LI-01',
      channel: 'linkedin',
      authorization_status: 'pending',
      metadata: expect.objectContaining({
        agentified_asset_id: 'AGT-LI-01',
        external_execution_enabled: false,
        side_effects: expect.objectContaining({
          social_draft_created: false,
          publish: false,
          external_post: false,
        }),
      }),
    }))
    expect(await response.json()).toMatchObject({
      ok: true,
      campaign: { id: 'campaign-agentified', created: true },
      work_items: { total: 12 },
      calendar_items: { inserted_count: 12, updated_count: 0, total: 12 },
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        external_post: false,
        social_drafts_created: false,
      },
    })
  })

  it('updates matching Agentified calendar rows instead of inserting duplicates', async () => {
    const campaignRead = campaignLookup({
      id: 'campaign-agentified',
      slug: 'agentified-trust-scale-2026-07',
      status: 'draft',
    })
    const campaignUpdate = calendarUpdate('campaign-updated')
    const existingCalendar = calendarLookup([
      { id: 'calendar-li-1', metadata: { agentified_asset_id: 'AGT-LI-01' } },
    ])
    const calendarExistingUpdate = calendarUpdate()
    const calendarCreate = calendarInsert()

    mocks.from.mockImplementation((table: string) => {
      if (table === 'attraction_campaigns') {
        const attractionCalls = mocks.from.mock.calls.filter(([name]) => name === 'attraction_campaigns').length
        return attractionCalls === 1 ? { select: campaignRead.select } : { update: campaignUpdate.update }
      }
      if (table === 'social_content_calendar_items') {
        const calendarCalls = mocks.from.mock.calls.filter(([name]) => name === 'social_content_calendar_items').length
        if (calendarCalls === 1) return { select: existingCalendar.select }
        if (calendarCalls === 2) return { update: calendarExistingUpdate.update }
        return { insert: calendarCreate.insert }
      }
      return {}
    })

    const response = await POST(request() as never)

    expect(response.status).toBe(200)
    expect(campaignUpdate.update).toHaveBeenCalled()
    expect(calendarExistingUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      agent_work_item_id: 'work-AGT-LI-01',
      metadata: expect.objectContaining({ agentified_asset_id: 'AGT-LI-01' }),
    }))
    expect(calendarCreate.insert).toHaveBeenCalledTimes(11)
    expect(await response.json()).toMatchObject({
      ok: true,
      campaign: { id: 'campaign-updated-1', created: false, updated: true },
      calendar_items: { inserted_count: 11, updated_count: 1, total: 12 },
    })
  })
})
