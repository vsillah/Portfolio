import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createAgentWorkItem: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.from },
}))

vi.mock('@/lib/agent-work-items', () => ({
  createAgentWorkItem: mocks.createAgentWorkItem,
}))

import {
  authorizeCalendarDraftHandoff,
  rejectCalendarDraftHandoff,
} from './social-content-calendar-handoff'

const auth = { user: { id: 'admin-user' } }

function baseCalendarItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'calendar-1',
    campaign_id: 'campaign-1',
    agent_work_item_id: 'work-source-1',
    social_content_id: null,
    channel: 'linkedin',
    campaign_phase: 'teach',
    title: 'Explain approval gates',
    planned_angle: 'Show why internal draft handoffs reduce publish risk.',
    scheduled_for: '2026-06-25T15:00:00.000Z',
    due_status: 'due_soon',
    authorization_status: 'pending',
    authorization_due_at: '2026-06-24T15:00:00.000Z',
    last_pinged_at: null,
    autonomy_eligible: false,
    metadata: { existing: true },
    created_by: 'admin-user',
    created_at: '2026-06-24T10:00:00.000Z',
    updated_at: '2026-06-24T10:00:00.000Z',
    attraction_campaigns: {
      id: 'campaign-1',
      name: 'Approval Gates Campaign',
      slug: 'approval-gates',
      status: 'active',
      starts_at: '2026-06-24T00:00:00.000Z',
      ends_at: '2026-07-01T00:00:00.000Z',
    },
    agent_work_items: null,
    social_content_queue: null,
    ...overrides,
  }
}

function mockReadCalendarItem(item: Record<string, unknown>) {
  const single = vi.fn(async () => ({ data: item, error: null }))
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  mocks.from.mockReturnValueOnce({ select })
  return { select, eq, single }
}

function mockExistingDraftLookup(data: Record<string, unknown> | null) {
  const maybeSingle = vi.fn(async () => ({ data, error: null }))
  const contains = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ contains }))
  mocks.from.mockReturnValueOnce({ select })
  return { select, contains, maybeSingle }
}

function mockDraftInsert(id = 'social-draft-1') {
  const single = vi.fn(async () => ({ data: { id }, error: null }))
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  mocks.from.mockReturnValueOnce({ insert })
  return { insert, select, single }
}

function mockCalendarUpdate(data: Record<string, unknown>) {
  const single = vi.fn(async () => ({ data, error: null }))
  const select = vi.fn(() => ({ single }))
  const eq = vi.fn(() => ({ select }))
  const update = vi.fn(() => ({ eq }))
  mocks.from.mockReturnValueOnce({ update })
  return { update, eq, select, single }
}

describe('social-content-calendar-handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-24T10:00:00.000Z'))
    mocks.createAgentWorkItem.mockResolvedValue({ id: 'work-handoff-1' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('authorizes a LinkedIn item by creating an internal draft and deduped handoff work item', async () => {
    const item = baseCalendarItem()
    mockReadCalendarItem(item)
    mockExistingDraftLookup(null)
    const draftInsert = mockDraftInsert('social-draft-1')
    const calendarUpdate = mockCalendarUpdate({
      ...item,
      authorization_status: 'authorized',
      social_content_id: 'social-draft-1',
    })

    const result = await authorizeCalendarDraftHandoff('calendar-1', auth)

    expect(draftInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      platform: 'linkedin',
      status: 'draft',
      scheduled_for: null,
      target_platforms: ['linkedin'],
      rag_context: expect.objectContaining({
        source: 'social_content_calendar_authorization',
        calendar_item_id: 'calendar-1',
        campaign_id: 'campaign-1',
        campaign_name: 'Approval Gates Campaign',
        authorization_status: 'authorized',
        authorized_at: '2026-06-24T10:00:00.000Z',
        authorized_by: 'admin-user',
        publish_gate: 'draft_only',
        external_execution_enabled: false,
      }),
    }))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      priority: 'high',
      status: 'queued',
      ownerAgentKey: 'content-repurposing',
      source: {
        type: 'social_content_calendar_authorization',
        id: 'calendar-1',
        label: 'Explain approval gates',
      },
      metadata: expect.objectContaining({
        social_content_id: 'social-draft-1',
        draft_handoff_only: true,
        external_execution_enabled: false,
        side_effects: expect.objectContaining({
          provider_generation: false,
          upload: false,
          external_schedule: false,
          publish: false,
          external_post: false,
          social_content_draft_created: true,
        }),
      }),
      idempotencyKey: 'social-content-calendar-draft-handoff:calendar-1',
    }))
    expect(calendarUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      authorization_status: 'authorized',
      social_content_id: 'social-draft-1',
      metadata: expect.objectContaining({
        existing: true,
        authorized_at: '2026-06-24T10:00:00.000Z',
        authorized_by: 'admin-user',
        draft_handoff_only: true,
        external_execution_enabled: false,
        platform_draft_handoff: expect.objectContaining({
          kind: 'linkedin_social_content_draft',
          work_item_id: 'work-handoff-1',
          social_content_id: 'social-draft-1',
        }),
      }),
    }))
    expect(result).toMatchObject({
      socialContentId: 'social-draft-1',
      handoffWorkItemId: 'work-handoff-1',
      handoffKind: 'linkedin_social_content_draft',
    })
  })

  it('reuses an existing LinkedIn draft instead of inserting a duplicate', async () => {
    const item = baseCalendarItem()
    mockReadCalendarItem(item)
    const lookup = mockExistingDraftLookup({ id: 'social-existing-1' })
    const calendarUpdate = mockCalendarUpdate({
      ...item,
      authorization_status: 'authorized',
      social_content_id: 'social-existing-1',
    })

    const result = await authorizeCalendarDraftHandoff('calendar-1', auth)

    expect(lookup.contains).toHaveBeenCalledWith('rag_context', {
      source: 'social_content_calendar_authorization',
      calendar_item_id: 'calendar-1',
    })
    expect(mocks.from.mock.calls.map((call) => call[0])).toEqual([
      'social_content_calendar_items',
      'social_content_queue',
      'social_content_calendar_items',
    ])
    expect(calendarUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      social_content_id: 'social-existing-1',
    }))
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ social_content_id: 'social-existing-1' }),
    }))
    expect(result.socialContentId).toBe('social-existing-1')
  })

  it('authorizes non-LinkedIn channels as planning-only handoffs without social queue inserts', async () => {
    const item = baseCalendarItem({
      channel: 'youtube_shorts',
      social_content_id: null,
    })
    mockReadCalendarItem(item)
    const calendarUpdate = mockCalendarUpdate({
      ...item,
      authorization_status: 'authorized',
    })

    const result = await authorizeCalendarDraftHandoff('calendar-1', auth)

    expect(mocks.from).toHaveBeenCalledTimes(2)
    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      objective: expect.stringContaining('planning/export-readiness inputs only'),
      metadata: expect.objectContaining({
        channel: 'youtube_shorts',
        social_content_id: null,
        external_execution_enabled: false,
        side_effects: expect.objectContaining({
          publish: false,
          external_post: false,
          social_content_draft_created: false,
        }),
      }),
    }))
    expect(calendarUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      authorization_status: 'authorized',
      social_content_id: null,
      metadata: expect.objectContaining({
        platform_draft_handoff: expect.objectContaining({
          kind: 'channel_planning_handoff',
          social_content_id: null,
        }),
      }),
    }))
    expect(result).toMatchObject({
      socialContentId: null,
      handoffKind: 'channel_planning_handoff',
    })
  })

  it('rejects an item with a revision work item and keeps external execution disabled', async () => {
    const item = baseCalendarItem({ social_content_id: 'social-draft-1' })
    mockReadCalendarItem(item)
    const calendarUpdate = mockCalendarUpdate({
      ...item,
      authorization_status: 'rejected',
    })

    const result = await rejectCalendarDraftHandoff({
      id: 'calendar-1',
      decisionNote: 'Strengthen the source boundary before drafting.',
      auth,
    })

    expect(mocks.createAgentWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Revise content calendar item: Explain approval gates',
      objective: expect.stringContaining('Strengthen the source boundary before drafting.'),
      ownerAgentKey: 'chief-of-staff',
      source: {
        type: 'social_content_calendar_revision',
        id: 'calendar-1',
        label: 'Explain approval gates',
      },
      metadata: expect.objectContaining({
        source: 'social_content_calendar_revision',
        decision_note: 'Strengthen the source boundary before drafting.',
        rejected_by: 'admin-user',
        rejected_at: '2026-06-24T10:00:00.000Z',
        returned_to_shaka: true,
        external_execution_enabled: false,
        side_effects: expect.objectContaining({
          provider_generation: false,
          upload: false,
          external_schedule: false,
          publish: false,
          external_post: false,
        }),
      }),
      idempotencyKey: 'social-content-calendar-revision:calendar-1:1782295200000',
    }))
    expect(calendarUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
      authorization_status: 'rejected',
      metadata: expect.objectContaining({
        existing: true,
        authorization_decision_note: 'Strengthen the source boundary before drafting.',
        rejected_at: '2026-06-24T10:00:00.000Z',
        rejected_by: 'admin-user',
        returned_to_shaka: true,
        revision_work_item_id: 'work-handoff-1',
        external_execution_enabled: false,
      }),
    }))
    expect(result).toMatchObject({
      revisionWorkItemId: 'work-handoff-1',
    })
  })
})
