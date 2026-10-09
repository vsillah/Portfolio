import { describe, expect, it, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  getAgentWorkItem: vi.fn(),
  updateAgentWorkItemMetadata: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/agent-work-items', () => ({
  getAgentWorkItem: mocks.getAgentWorkItem,
  updateAgentWorkItemMetadata: mocks.updateAgentWorkItemMetadata,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

import { POST } from './route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/admin/agents/work-items/work-1/research-packets', {
    method: 'POST',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const workItem = {
  id: 'work-1',
  source_type: 'social_topic_trigger',
  metadata: {
    social_topic_trigger: true,
    research_packet_ids: ['packet-existing'],
    insight: {
      title: 'Approval gates create trust',
      approved_research_patterns: [
        {
          packet_id: 'packet-existing',
          source_url: 'https://example.com/existing',
          pattern_packet: { hook_structure: 'Existing hook' },
        },
      ],
    },
  },
}

const packet = {
  id: 'packet-1',
  source_url: 'https://youtube.com/watch?v=abc',
  platform: 'youtube',
  creator_name: 'Creator',
  creator_handle: '@creator',
  title: 'Useful outlier',
  outlier_score: 87,
  pattern_status: 'needs_brand_translation',
  pattern_packet: {
    hook_structure: 'Start with the missed approval gate.',
    promise_value: 'Show how review gates build trust.',
  },
  privacy_notes: 'Public pattern only.',
  retrieved_at: '2026-06-23T10:00:00.000Z',
  status: 'review_ready',
}

function mockResearchPacketQuery(packetRows = [packet]) {
  mocks.from.mockImplementation((table: string) => {
    if (table !== 'social_content_research_packets') throw new Error(`Unexpected table ${table}`)
    return {
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: packetRows, error: null })),
      })),
      update: vi.fn(() => ({
        in: vi.fn(async () => ({ error: null })),
      })),
    }
  })
}

function calendarHandoffWorkItem() {
  return {
    id: 'work-1',
    source_type: 'social_content_calendar_authorization',
    metadata: {
      draft_handoff_only: true,
      calendar_item_id: 'calendar-1',
      campaign_id: 'campaign-1',
      social_content_id: 'draft-1',
      insight: {
        claim_boundaries: ['Campaign planning is not evidence of delivered outcomes.'],
      } as Record<string, unknown>,
    },
  }
}

function approvedPacket(overrides: Record<string, unknown> = {}) {
  return { ...packet, status: 'approved', pattern_status: 'usable_framework', ...overrides }
}

function mockCalendarHandoff(
  calendar: Record<string, unknown>,
  packets = [approvedPacket()],
  calendarResult?: { data: unknown, error: { message: string } | null },
) {
  const packetUpdate = vi.fn(() => ({ in: vi.fn(async () => ({ error: null })) }))
  mocks.from.mockImplementation((table: string) => {
    if (table === 'social_content_research_packets') {
      return {
        select: () => ({ in: async () => ({ data: packets, error: null }) }),
        update: packetUpdate,
      }
    }
    if (table === 'social_content_calendar_items') {
      return {
        select: () => ({
          eq: () => ({
            single: async () => calendarResult ?? { data: calendar, error: null },
          }),
        }),
      }
    }
    throw new Error(`Unexpected table ${table}`)
  })
  return { packetUpdate }
}

describe('/api/admin/agents/work-items/[id]/research-packets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-user', email: 'admin@example.com' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.getAgentWorkItem.mockResolvedValue(workItem)
    mocks.updateAgentWorkItemMetadata.mockResolvedValue(workItem)
    mockResearchPacketQuery()
  })

  it('requires admin auth', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getAgentWorkItem).not.toHaveBeenCalled()
  })

  it('rejects research patterns that are too close to the source', async () => {
    mockResearchPacketQuery([{ ...packet, pattern_status: 'too_close_to_source' }])

    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Only usable or brand-translation research patterns can be linked to an insight',
    })
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('links public research patterns to a social insight without production side effects', async () => {
    const response = await POST(request({
      packet_ids: ['packet-1'],
      decision_note: 'Use the hook framework, not the wording.',
    }) as never, {
      params: { id: 'work-1' },
    })

    expect(response.status).toBe(200)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      id: 'work-1',
      note: 'Linked 1 public research pattern(s) to social insight.',
      metadata: expect.objectContaining({
        research_packet_ids: ['packet-existing', 'packet-1'],
        research_patterns_decision_note: 'Use the hook framework, not the wording.',
        insight: expect.objectContaining({
          approved_research_patterns: expect.arrayContaining([
            expect.objectContaining({
              packet_id: 'packet-1',
              source_url: 'https://youtube.com/watch?v=abc',
              pattern_packet: expect.objectContaining({
                hook_structure: 'Start with the missed approval gate.',
              }),
            }),
          ]),
        }),
      }),
    }))
    expect(await response.json()).toMatchObject({
      success: true,
      linked_packet_ids: ['packet-existing', 'packet-1'],
      side_effects: {
        provider_generation: false,
        upload: false,
        publish: false,
        schedule: false,
        external_post: false,
      },
    })
  })
  it('links approved evidence without approving or mutating research packets', async () => {
    mockResearchPacketQuery([{ ...packet, status: 'approved', pattern_status: 'usable_framework' }])
    const response = await POST(request({ packet_ids: ['packet-1'], mode: 'link_approved' }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(200)
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledTimes(1)
  })

  it.each(['review_ready', 'rejected', 'archived'])('rejects %s evidence in recovery mode', async (status) => {
    mockResearchPacketQuery([{ ...packet, status, pattern_status: 'usable_framework' }])
    const response = await POST(request({ packet_ids: ['packet-1'], mode: 'link_approved' }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(400)
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })

  it.each(['needs_brand_translation', 'too_close_to_source', 'not_relevant'])('rejects approved but %s patterns', async (pattern_status) => {
    mockResearchPacketQuery([{ ...packet, status: 'approved', pattern_status }])
    const response = await POST(request({ packet_ids: ['packet-1'], mode: 'link_approved' }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(400)
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it.each([true, false])('recovers only a matching authorized calendar handoff (match=%s)', async (matches) => {
    mocks.getAgentWorkItem.mockResolvedValue({
      id: 'work-1', source_type: 'social_content_calendar_authorization',
      metadata: { draft_handoff_only: true, calendar_item_id: 'calendar-1', campaign_id: 'campaign-1', social_content_id: 'draft-1' },
    })
    mocks.from.mockImplementation((table) => {
      if (table === 'social_content_research_packets') return { select: () => ({ in: async () => ({ data: [{ ...packet, status: 'approved', pattern_status: 'usable_framework' }], error: null }) }) }
      if (table === 'social_content_calendar_items') return { select: () => ({ eq: () => ({ single: async () => ({ data: {
        id: 'calendar-1', campaign_id: 'campaign-1', social_content_id: 'draft-1', title: 'Readiness Challenge',
        planned_angle: 'Find the first workflow that needs a human decision.', authorization_status: 'authorized',
        metadata: { platform_draft_handoff: { work_item_id: matches ? 'work-1' : 'other-work' } },
      }, error: null }) }) }) }
      throw new Error('Unexpected database access')
    })
    // Calendar handoffs always require already-approved evidence, even without mode.
    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(matches ? 200 : 409)
    if (matches) expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({
      campaign_id: 'campaign-1', calendar_item_id: 'calendar-1', social_content_id: 'draft-1',
      insight: expect.objectContaining({ title: 'Readiness Challenge', content_angle: 'Find the first workflow that needs a human decision.', source_ids: ['calendar-1', 'campaign-1'] }),
    }) }))
    else expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it.each([
    ['blank source', { source_url: '   ' }],
    ['missing source', { source_url: undefined }],
    ['empty pattern', { pattern_packet: {} }],
    ['list pattern', { pattern_packet: ['not-a-framework'] }],
  ])('rejects recovery evidence with a %s', async (_label, overrides) => {
    mockResearchPacketQuery([approvedPacket(overrides)])
    const response = await POST(request({ packet_ids: ['packet-1'], mode: 'link_approved' }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Select an approved usable framework. Review other evidence in Content Intelligence first.',
    })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('does not let recovery mode link evidence onto a non-social work item', async () => {
    mocks.getAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      source_type: 'manual_note',
      metadata: { draft_handoff_only: true, calendar_item_id: 'calendar-1' },
    })
    const response = await POST(request({ packet_ids: ['packet-1'], mode: 'link_approved' }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Work item is not a social topic trigger or campaign draft handoff' })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it.each([false, 'true'])('requires an exact calendar handoff flag (draft_handoff_only=%s)', async (flag) => {
    mocks.getAgentWorkItem.mockResolvedValue({
      id: 'work-1',
      source_type: 'social_content_calendar_authorization',
      metadata: {
        draft_handoff_only: flag,
        calendar_item_id: 'calendar-1',
        campaign_id: 'campaign-1',
        social_content_id: 'draft-1',
      },
    })
    const response = await POST(request({ packet_ids: ['packet-1'], mode: 'link_approved' }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Work item is not a social topic trigger or campaign draft handoff' })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it.each([
    ['authorization', { authorization_status: 'pending' }],
    ['campaign', { campaign_id: 'other-campaign' }],
    ['draft', { social_content_id: 'other-draft' }],
  ])('rejects a calendar handoff after %s drift', async (_label, drift) => {
    mocks.getAgentWorkItem.mockResolvedValue(calendarHandoffWorkItem())
    const { packetUpdate } = mockCalendarHandoff({
      id: 'calendar-1',
      campaign_id: 'campaign-1',
      social_content_id: 'draft-1',
      title: 'Readiness Challenge',
      planned_angle: 'Find the first workflow that needs a human decision.',
      authorization_status: 'authorized',
      metadata: { platform_draft_handoff: { work_item_id: 'work-1' } },
      ...drift,
    })
    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'The authorized calendar handoff no longer matches this insight. Open the calendar to review its current handoff.',
    })
    expect(packetUpdate).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('rejects ineligible calendar evidence before reading the handoff', async () => {
    mocks.getAgentWorkItem.mockResolvedValue(calendarHandoffWorkItem())
    const { packetUpdate } = mockCalendarHandoff(
      { id: 'calendar-1' },
      [approvedPacket({ source_url: ' ' })],
    )
    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Select an approved usable framework. Review other evidence in Content Intelligence first.',
    })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(packetUpdate).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it('does not rewrite the insight when the calendar handoff cannot be read', async () => {
    mocks.getAgentWorkItem.mockResolvedValue(calendarHandoffWorkItem())
    const { packetUpdate } = mockCalendarHandoff({}, [approvedPacket()], {
      data: null,
      error: { message: 'calendar relation missing' },
    })
    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'calendar relation missing' })
    expect(packetUpdate).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemMetadata).not.toHaveBeenCalled()
  })

  it.each(['', null])('rebuilds a calendar insight from the title when the angle is %s', async (plannedAngle) => {
    const item = calendarHandoffWorkItem()
    item.metadata.insight.claim_boundaries = [
      'Campaign planning is not evidence of delivered outcomes.',
      'Keep the operator review.',
    ]
    mocks.getAgentWorkItem.mockResolvedValue(item)
    const { packetUpdate } = mockCalendarHandoff({
      id: 'calendar-1',
      campaign_id: 'campaign-1',
      social_content_id: 'draft-1',
      title: 'Readiness Challenge',
      planned_angle: plannedAngle,
      authorization_status: 'authorized',
      metadata: { platform_draft_handoff: { work_item_id: 'work-1' } },
    })
    const response = await POST(request({ packet_ids: ['packet-1'] }) as never, { params: { id: 'work-1' } })
    expect(response.status).toBe(200)
    expect(packetUpdate).not.toHaveBeenCalled()
    expect(mocks.updateAgentWorkItemMetadata).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        insight: expect.objectContaining({
          title: 'Readiness Challenge',
          triggering_event: 'Readiness Challenge',
          content_angle: 'Readiness Challenge',
          suggested_hook: 'Readiness Challenge',
          evidence_summary: 'Authorized campaign calendar brief. Research provides structure only; claims still require human review.',
          claim_boundaries: [
            'Campaign planning is not evidence of delivered outcomes.',
            'Keep the operator review.',
            'Public patterns are frameworks, not source copy.',
          ],
          source_ids: ['calendar-1', 'campaign-1'],
          source_type: 'social_content_calendar_authorization',
        }),
      }),
    }))
  })

})
